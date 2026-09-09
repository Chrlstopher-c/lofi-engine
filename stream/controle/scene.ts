/**
 * Lecture et écriture de la scène diffusée.
 * Le fichier vit dans le volume partagé : la scène affichée le relit à chaud, donc une
 * modification se voit en direct, y compris pendant que le stream tourne.
 */
import { resolve } from "node:path";
import type { Ancre, Calque, Scene, TypeCalque } from "./types.ts";
import { journal } from "./journal.ts";

const CHEMIN = resolve(process.env.SCENE_FICHIER ?? "/corpus/scene.json");
const DEFAUT = resolve(import.meta.dir, "scene-defaut.json");

const ANCRES: Ancre[] = [
  "haut-gauche", "haut-centre", "haut-droite",
  "centre", "bas-gauche", "bas-centre", "bas-droite",
];
const TYPES: TypeCalque[] = ["texte", "horloge", "accords", "image", "video"];
const THEMES = ["nuit", "ambre", "brume"] as const;
const TEXTE_MAX = 240;

function borner(valeur: unknown, min: number, max: number, defaut: number): number {
  const n = typeof valeur === "number" ? valeur : Number(valeur);
  if (!Number.isFinite(n)) return defaut;
  return Math.min(max, Math.max(min, n));
}

function texte(valeur: unknown, defaut = ""): string {
  return typeof valeur === "string" ? valeur.slice(0, TEXTE_MAX) : defaut;
}

/** Un nom de fichier, jamais un chemin : rien ne doit pouvoir sortir du dossier des fonds. */
function nomFichier(valeur: unknown): string {
  const v = texte(valeur, "");
  return /^[\w][\w .-]{0,120}$/.test(v) && !v.includes("..") ? v : "";
}

function couleur(valeur: unknown, defaut: string): string {
  const v = texte(valeur, "");
  return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : defaut;
}

function nettoyerCalque(brut: Record<string, unknown>, rang: number): Calque | null {
  const type = TYPES.includes(brut.type as TypeCalque) ? (brut.type as TypeCalque) : null;
  if (!type) return null;
  const id = texte(brut.id, "").replace(/[^\w-]/g, "").slice(0, 40) || `calque-${rang}`;
  return {
    id,
    nom: texte(brut.nom, id).slice(0, 60),
    type,
    visible: brut.visible !== false,
    ancre: ANCRES.includes(brut.ancre as Ancre) ? (brut.ancre as Ancre) : "bas-gauche",
    x: borner(brut.x, -50, 150, 4.5),
    y: borner(brut.y, -50, 150, 10),
    taille: borner(brut.taille, 0.2, 40, 2),
    opacite: borner(brut.opacite, 0, 1, 1),
    couleur: couleur(brut.couleur, "#f2f4f8"),
    texte: texte(brut.texte, ""),
    graisse: brut.graisse === "legere" ? "legere" : "normale",
    date: brut.date !== false,
    cadre: brut.cadre !== false,
    fichier: nomFichier(brut.fichier),
    boucle: brut.boucle !== false,
  };
}

/** Valide et normalise avant toute écriture : ce qui arrive de l'interface n'est pas de confiance. */
export function nettoyerScene(brut: unknown): Scene {
  const o = (brut ?? {}) as Record<string, unknown>;
  const fondBrut = (o.fond ?? {}) as Record<string, unknown>;
  const calquesBruts = Array.isArray(o.calques) ? o.calques : [];
  const calques = calquesBruts
    .slice(0, 40)
    .map((c, i) => nettoyerCalque((c ?? {}) as Record<string, unknown>, i))
    .filter((c): c is Calque => c !== null);
  return {
    version: 1,
    theme: (THEMES as readonly string[]).includes(o.theme as string)
      ? (o.theme as Scene["theme"]) : "nuit",
    fond: {
      fichier: nomFichier(fondBrut.fichier),
      ajustement: fondBrut.ajustement === "contain" ? "contain" : "cover",
      mouvement: fondBrut.mouvement !== false,
      voile: borner(fondBrut.voile, 0, 1, 0.55),
      vignettage: fondBrut.vignettage !== false,
    },
    calques,
  };
}

export async function lireScene(): Promise<Scene> {
  try {
    const f = Bun.file(CHEMIN);
    if (await f.exists()) return nettoyerScene(await f.json());
  } catch (erreur) {
    journal.warn({ erreur, chemin: CHEMIN }, "scène illisible, retour au modèle par défaut");
  }
  try {
    return nettoyerScene(await Bun.file(DEFAUT).json());
  } catch (erreur) {
    journal.error({ erreur }, "modèle de scène par défaut illisible");
    return nettoyerScene({});
  }
}

export async function ecrireScene(brut: unknown): Promise<Scene> {
  const scene = nettoyerScene(brut);
  try {
    await Bun.write(CHEMIN, JSON.stringify(scene, null, 2));
    journal.info({ calques: scene.calques.length }, "scène enregistrée");
    return scene;
  } catch (erreur) {
    journal.error({ erreur, chemin: CHEMIN }, "écriture de la scène impossible");
    throw new Error(`écriture impossible dans ${CHEMIN}`);
  }
}
