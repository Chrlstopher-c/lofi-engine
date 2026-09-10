/**
 * Réglages de la génération musicale : lecture et écriture du fichier que le moteur relit.
 *
 * Le schéma, les bornes et les types nommés vivent dans le moteur lui-même et sont importés
 * d'ici. Deux copies de la même table de bornes divergeraient au premier réglage ajouté, et
 * c'est la sorte de divergence qui ne se voit pas : le centre de contrôle accepterait une
 * valeur que le moteur refuse, sans que personne ne le sache.
 */
import { resolve } from "node:path";
import { DEFAUTS, TYPES, nettoyer, type Reglages } from "../../src/lib/engine/Reglages.ts";
import { journal } from "./journal.ts";

const RACINE = resolve(process.env.RACINE_PROJET ?? resolve(import.meta.dir, "../.."));
const CORPUS = resolve(process.env.CORPUS_DIR ?? resolve(RACINE, "corpus"));
const FICHIER = resolve(CORPUS, "moteur.json");

export interface EtatMoteur {
  reglages: Reglages;
  /** Les types nommés proposés par le moteur, pour que l'interface n'en invente pas. */
  types: string[];
}

export async function lireMoteur(): Promise<EtatMoteur> {
  const types = Object.keys(TYPES);
  try {
    const fichier = Bun.file(FICHIER);
    if (!(await fichier.exists())) return { reglages: { ...DEFAUTS }, types };
    return { reglages: nettoyer(await fichier.json()), types };
  } catch (erreur) {
    journal.warn({ erreur, FICHIER }, "réglages du moteur illisibles — valeurs par défaut");
    return { reglages: { ...DEFAUTS }, types };
  }
}

/**
 * Écriture atomique : le moteur relit ce fichier toutes les secondes et demie, il ne doit
 * jamais tomber sur un JSON tronqué.
 */
export async function ecrireMoteur(brut: unknown): Promise<EtatMoteur> {
  const reglages = nettoyer(brut);
  const partiel = `${FICHIER}.partiel`;
  try {
    await Bun.write(partiel, `${JSON.stringify(reglages, null, 2)}\n`);
    await Bun.file(partiel).exists();
    const { rename } = await import("node:fs/promises");
    await rename(partiel, FICHIER);
    journal.info({ type: reglages.type, tempo: reglages.tempo }, "réglages du moteur écrits");
  } catch (erreur) {
    journal.error({ erreur, FICHIER }, "réglages du moteur non écrits");
    throw erreur;
  }
  return { reglages, types: Object.keys(TYPES) };
}

/** Les valeurs d'un type nommé, sans les écrire : l'interface s'en sert pour l'aperçu. */
export function reglagesDuType(nom: string): Reglages {
  return nettoyer({ type: nom });
}
