/**
 * Historique du nombre de spectateurs. L'API Twitch ne donne que l'instant présent : la
 * courbe n'existe que si on l'échantillonne nous-mêmes.
 *
 * Un relevé par minute, **pendant le direct seulement** — hors direct, rien n'est écrit
 * plutôt qu'un zéro qui passerait pour une mesure. Le fichier est une fenêtre glissante :
 * ni le nombre de points ni l'ancienneté ne peuvent croître sans fin.
 */
import { resolve, dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { lireCoffre } from "./coffre.ts";
import { lireDirect } from "./chaine.ts";
import { objet, entier } from "./valider.ts";
import { journal } from "../journal.ts";

const CORPUS = resolve(process.env.CORPUS_DIR ?? resolve(import.meta.dir, "../../../corpus"));
const FICHIER = resolve(CORPUS, "twitch-spectateurs.json");

const PAS_MS = 60_000;
const FENETRE_MS = 48 * 3_600_000;
const MAX_RELEVES = 3_000;

/** Un relevé : instant en millisecondes epoch, nombre de spectateurs mesuré. */
export interface Releve {
  t: number;
  v: number;
}

/** Chargé une fois puis tenu en mémoire : la lecture des statistiques ne touche pas le disque. */
let releves: Releve[] | null = null;
let echantillonnage: ReturnType<typeof setInterval> | null = null;

/** Le fichier a pu être tronqué ou édité : on ne garde que les lignes de la forme attendue. */
function normaliser(brut: unknown): Releve[] {
  const liste = objet(brut)?.releves;
  if (!Array.isArray(liste)) return [];
  const lus: Releve[] = [];
  for (const element of liste) {
    const o = objet(element);
    const t = entier(o, "t");
    const v = entier(o, "v");
    if (t !== null && v !== null && t > 0 && v >= 0) lus.push({ t, v });
  }
  return lus.sort((a, b) => a.t - b.t).slice(-MAX_RELEVES);
}

export async function lireReleves(): Promise<Releve[]> {
  if (releves) return releves;
  try {
    const fichier = Bun.file(FICHIER);
    releves = (await fichier.exists()) ? normaliser(await fichier.json()) : [];
  } catch (erreur) {
    journal.error({ erreur, fichier: FICHIER }, "historique des spectateurs illisible");
    releves = [];
  }
  return releves;
}

async function ecrire(liste: Releve[]): Promise<void> {
  try {
    await mkdir(dirname(FICHIER), { recursive: true });
    await Bun.write(FICHIER, JSON.stringify({ releves: liste }));
  } catch (erreur) {
    journal.error({ erreur, fichier: FICHIER }, "écriture de l'historique des spectateurs impossible");
  }
}

/** Ajoute un relevé et rogne la fenêtre : au plus 48 h, au plus 3 000 points. */
export async function enregistrerReleve(spectateurs: number, instant: number = Date.now()): Promise<void> {
  const actuels = await lireReleves();
  const gardes = [...actuels, { t: instant, v: spectateurs }]
    .filter((releve) => instant - releve.t <= FENETRE_MS)
    .slice(-MAX_RELEVES);
  releves = gardes;
  await ecrire(gardes);
}

async function echantillon(): Promise<void> {
  try {
    const coffre = await lireCoffre();
    if (!coffre.jetonAcces) return; // aucun compte : rien à mesurer, et aucun appel réseau
    const direct = await lireDirect();
    if (!direct.enDirect || direct.spectateurs === null) return; // hors direct : on n'écrit rien
    await enregistrerReleve(direct.spectateurs);
  } catch (erreur) {
    journal.warn({ erreur }, "relevé du nombre de spectateurs impossible");
  }
}

/** Un seul échantillonneur, une mesure par minute : loin des limites de débit de Twitch. */
export function demarrerEchantillonnage(): void {
  if (echantillonnage !== null) return;
  echantillonnage = setInterval(() => void echantillon(), PAS_MS);
  journal.info({ pasSecondes: PAS_MS / 1000 }, "échantillonnage des spectateurs Twitch démarré");
}

/** Arrête l'échantillonnage (double de test, arrêt du serveur). */
export function arreterEchantillonnage(): void {
  if (echantillonnage !== null) clearInterval(echantillonnage);
  echantillonnage = null;
}
