/**
 * Archivage des rediffusions.
 *
 * Ce que l'API Twitch ne sait pas faire : activer ou désactiver l'enregistrement des
 * diffusions passées. Le réglage « Store past broadcasts » n'existe que dans le tableau de
 * bord Twitch ; aucun point d'entrée Helix ne l'expose. L'interface le dit franchement et
 * renvoie vers le bon écran, plutôt que de faire croire à un réglage qui n'existe pas.
 *
 * Ce qu'elle sait faire : supprimer une rediffusion. D'où cette option, désactivée par
 * défaut, qui efface les archives **apparues après son activation** — jamais une archive
 * antérieure, jamais sans que l'instant de départ soit connu.
 */
import { resolve, dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import type { Archivage } from "./types.ts";
import { listerRediffusions, supprimerRediffusion } from "./rediffusions.ts";
import { objet, entier } from "./valider.ts";
import { journal } from "../journal.ts";

const CORPUS = resolve(process.env.CORPUS_DIR ?? resolve(import.meta.dir, "../../../corpus"));
const FICHIER = resolve(CORPUS, "twitch-archivage.json");

const PAS_MS = 300_000;
/** Plafond par passage : une suppression est un appel d'API, on n'en enchaîne pas vingt. */
const MAX_PAR_PASSAGE = 5;

interface Reglage {
  suppressionAuto: boolean;
  /** Instant d'activation en millisecondes epoch ; 0 si l'option n'a jamais été activée. */
  depuisMs: number;
  supprimees: number;
}

const VIDE: Reglage = { suppressionAuto: false, depuisMs: 0, supprimees: 0 };

let surveillance: ReturnType<typeof setInterval> | null = null;
let balayageEnCours = false;

function normaliser(brut: unknown): Reglage {
  const o = objet(brut);
  if (!o) return { ...VIDE };
  const depuisMs = entier(o, "depuisMs") ?? 0;
  return {
    suppressionAuto: o.suppressionAuto === true && depuisMs > 0,
    depuisMs,
    supprimees: entier(o, "supprimees") ?? 0,
  };
}

async function lireReglage(): Promise<Reglage> {
  try {
    const fichier = Bun.file(FICHIER);
    return (await fichier.exists()) ? normaliser(await fichier.json()) : { ...VIDE };
  } catch (erreur) {
    journal.error({ erreur, fichier: FICHIER }, "réglage d'archivage illisible");
    return { ...VIDE };
  }
}

async function ecrireReglage(reglage: Reglage): Promise<void> {
  try {
    await mkdir(dirname(FICHIER), { recursive: true });
    await Bun.write(FICHIER, JSON.stringify(reglage, null, 2));
  } catch (erreur) {
    journal.error({ erreur, fichier: FICHIER }, "écriture du réglage d'archivage impossible");
    throw new Error("Enregistrement du réglage d'archivage impossible (voir le journal du serveur).");
  }
}

function vue(reglage: Reglage): Archivage {
  return {
    suppressionAuto: reglage.suppressionAuto,
    depuis: reglage.depuisMs > 0 ? new Date(reglage.depuisMs).toISOString() : null,
    supprimees: reglage.supprimees,
  };
}

export async function lireArchivage(): Promise<Archivage> {
  return vue(await lireReglage());
}

/** Activer démarre une nouvelle session de surveillance : le passé reste hors d'atteinte. */
export async function definirSuppressionAuto(brut: unknown): Promise<Archivage> {
  if (typeof brut !== "boolean") throw new Error("Réglage attendu : vrai ou faux.");
  const actuel = await lireReglage();
  if (brut === actuel.suppressionAuto) return vue(actuel);
  const reglage: Reglage = brut
    ? { suppressionAuto: true, depuisMs: Date.now(), supprimees: 0 }
    : { ...actuel, suppressionAuto: false };
  await ecrireReglage(reglage);
  const exposee = vue(reglage);
  journal.info({ suppressionAuto: exposee.suppressionAuto, depuis: exposee.depuis }, "archivage : réglage modifié");
  return exposee;
}

/** Une passe : supprime les archives publiées après l'activation, cinq au plus, une par une. */
export async function balayer(): Promise<number> {
  const reglage = await lireReglage();
  if (!reglage.suppressionAuto || reglage.depuisMs <= 0) return 0;
  const archives = await listerRediffusions();
  const cibles = archives
    .filter((video) => Date.parse(video.publieeLe) >= reglage.depuisMs)
    .slice(0, MAX_PAR_PASSAGE);
  if (cibles.length === 0) return 0;
  journal.info({ cibles: cibles.map((video) => video.id) }, "archivage : rediffusions à supprimer");
  let faites = 0;
  for (const video of cibles) {
    await supprimerRediffusion(video.id);
    faites += 1;
  }
  await ecrireReglage({ ...reglage, supprimees: reglage.supprimees + faites });
  return faites;
}

async function passe(): Promise<void> {
  if (balayageEnCours) return;
  balayageEnCours = true;
  try {
    const faites = await balayer();
    if (faites > 0) journal.info({ faites }, "archivage : rediffusions supprimées automatiquement");
  } catch (erreur) {
    journal.warn({ erreur }, "archivage : balayage impossible");
  } finally {
    balayageEnCours = false;
  }
}

export function demarrerSurveillanceArchivage(): void {
  if (surveillance !== null) return;
  surveillance = setInterval(() => void passe(), PAS_MS);
  journal.info({ pasSecondes: PAS_MS / 1000 }, "surveillance de l'archivage démarrée");
}

/** Arrête la surveillance (double de test, arrêt du serveur). */
export function arreterSurveillanceArchivage(): void {
  if (surveillance !== null) clearInterval(surveillance);
  surveillance = null;
}
