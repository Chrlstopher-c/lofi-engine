/**
 * Ce que coûte et comment se fabrique l'image diffusée : quel encodeur a été retenu, qui dessine
 * la scène, et combien de processeur le diffuseur consomme.
 *
 * Le diffuseur tourne dans un conteneur et ne parle au centre de contrôle que par le corpus :
 * il y dépose `rendu.json` au démarrage, une fois l'encodeur essayé pour de vrai. Sans ce
 * fichier l'interface ne pourrait pas dire si la puce vidéo encode ou si le processeur a repris
 * la main — c'est exactement la bascule qu'on veut voir.
 */
import { resolve } from "node:path";
import type { Rendu } from "./types.ts";
import { journal } from "./journal.ts";

const RACINE = resolve(process.env.RACINE_PROJET ?? resolve(import.meta.dir, "../.."));
const CORPUS = resolve(process.env.CORPUS_DIR ?? resolve(RACINE, "corpus"));
const FICHIER_RENDU = resolve(CORPUS, "rendu.json");
const CONTENEUR = "lofi-direct";

/** `docker stats` demande plus d'une seconde : au-delà, on relance une mesure. */
const FRAICHEUR_MS = 5_000;
/** Sans mesure fraîche depuis ce délai, mieux vaut ne rien afficher qu'un chiffre périmé. */
const PEREMPTION_MS = 30_000;
const DELAI_MESURE_MS = 10_000;

const ENCODEURS: Record<string, string> = {
  nvenc: "NVENC — puce vidéo NVIDIA",
  vaapi: "VAAPI — puce vidéo Intel ou AMD",
  qsv: "Quick Sync — puce vidéo Intel",
  x264: "libx264 — le processeur encode",
};

let charge: { valeur: number | null; mesuree: number } = { valeur: null, mesuree: 0 };
let mesureEnCours = false;

/** Lit le dépôt du diffuseur. Absent tant qu'aucune diffusion n'a jamais démarré ici. */
export async function lireRendu(): Promise<Rendu | null> {
  try {
    const fichier = Bun.file(FICHIER_RENDU);
    if (!(await fichier.exists())) return null;
    const brut = (await fichier.json()) as Record<string, unknown>;
    const encodeur = typeof brut.encodeur === "string" ? brut.encodeur : "";
    if (!encodeur) return null;
    return {
      encodeur,
      encodeurLibelle: ENCODEURS[encodeur] ?? encodeur,
      materiel: encodeur !== "x264",
      modeScene: brut.modeScene === "ffmpeg" ? "ffmpeg" : "navigateur",
      resolution: typeof brut.resolution === "string" ? brut.resolution : "",
      fps: typeof brut.fps === "string" ? brut.fps : "",
      coeurs: typeof brut.coeurs === "number" && brut.coeurs > 0 ? brut.coeurs : 0,
      ecrit: typeof brut.ecrit === "string" ? brut.ecrit : "",
    };
  } catch (erreur) {
    journal.warn({ erreur, FICHIER_RENDU }, "rendu.json illisible");
    return null;
  }
}

/** Une seule lecture de `docker stats`, bornée dans le temps. */
async function mesurer(): Promise<number | null> {
  try {
    const proc = Bun.spawn(
      ["docker", "stats", "--no-stream", "--format", "{{.CPUPerc}}", CONTENEUR],
      { stdout: "pipe", stderr: "ignore" },
    );
    const minuteur = setTimeout(() => proc.kill(), DELAI_MESURE_MS);
    const [sortie, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    clearTimeout(minuteur);
    if (code !== 0) return null;
    const valeur = Number.parseFloat(sortie.trim().replace("%", ""));
    return Number.isFinite(valeur) ? valeur : null;
  } catch (erreur) {
    journal.warn({ erreur }, "charge du diffuseur non mesurable");
    return null;
  }
}

/**
 * Rend la dernière charge connue et lance la suivante en fond. Mesurer dans la requête
 * ajouterait plus d'une seconde à chaque rafraîchissement de l'interface, pour une jauge qui
 * n'a pas besoin d'être à la seconde près.
 */
export function chargeProcesseur(): number | null {
  const age = Date.now() - charge.mesuree;
  if (!mesureEnCours && age > FRAICHEUR_MS) {
    mesureEnCours = true;
    // Rafraîchissement détaché : la requête en cours ne l'attend pas.
    void mesurer()
      .then((valeur) => {
        charge = { valeur, mesuree: Date.now() };
      })
      .finally(() => {
        mesureEnCours = false;
      });
  }
  return age > PEREMPTION_MS ? null : charge.valeur;
}

/**
 * Le dépôt survit à l'arrêt du conteneur. Celui d'une diffusion précédente décrirait un encodeur
 * qui ne tourne plus — et rien à l'écran ne dirait qu'il est périmé. On ne le garde donc que s'il
 * a été écrit après le démarrage du conteneur en cours.
 */
export function renduDeCetteDiffusion(rendu: Rendu | null, depuis: string | null): Rendu | null {
  if (!rendu || !depuis) return null;
  const ecrit = Date.parse(rendu.ecrit);
  const demarrage = Date.parse(depuis);
  if (!Number.isFinite(ecrit) || !Number.isFinite(demarrage)) return null;
  return ecrit >= demarrage ? rendu : null;
}

/** Remet le cache à zéro : après un arrêt, l'ancienne charge ne veut plus rien dire. */
export function oublierCharge(): void {
  charge = { valeur: null, mesuree: 0 };
}
