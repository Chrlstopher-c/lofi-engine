/**
 * Les favoris : ce qu'on met de côté sans le télécharger.
 *
 * Un fond de scène pèse jusqu'à quelques dizaines de mégaoctets, et on en repère plus qu'on
 * n'en garde. Le favori conserve tout ce qu'il faut pour retrouver et télécharger le média
 * plus tard — y compris son URL source, revérifiée à l'usage : ce fichier est du contenu
 * externe posé sur le disque, il ne devient pas fiable en y séjournant.
 */
import { resolve } from "node:path";
import type { Favori, Media } from "./types.ts";
import { urlAdmise } from "./client.ts";
import { journal } from "../journal.ts";

const CORPUS = resolve(process.env.CORPUS_DIR ?? resolve(import.meta.dir, "../../../corpus"));
const FICHIER = resolve(CORPUS, "pixabay-favoris.json");
/** Au-delà, la liste cesse d'être une sélection. */
const MAX = 300;

function estFavori(brut: unknown): brut is Favori {
  const f = brut as Partial<Favori>;
  return typeof f?.id === "number" && (f.genre === "image" || f.genre === "video")
    && typeof f.source === "string";
}

export async function lireFavoris(): Promise<Favori[]> {
  try {
    const f = Bun.file(FICHIER);
    if (!(await f.exists())) return [];
    const brut: unknown = await f.json();
    if (!Array.isArray(brut)) return [];
    return brut.filter(estFavori).slice(0, MAX);
  } catch (erreur) {
    journal.warn({ erreur, FICHIER }, "favoris Pixabay illisibles — repartis à vide");
    return [];
  }
}

async function ecrire(favoris: Favori[]): Promise<void> {
  try {
    await Bun.write(FICHIER, JSON.stringify(favoris.slice(0, MAX), null, 2));
  } catch (erreur) {
    journal.error({ erreur, FICHIER }, "favoris Pixabay non enregistrés");
    throw new Error("favoris non enregistrés");
  }
}

/** Ajoute, ou remplace si l'identifiant est déjà là. Le média est renettoyé au passage. */
export async function ajouterFavori(brut: unknown): Promise<Favori[]> {
  const m = (brut ?? {}) as Partial<Media>;
  const source = urlAdmise(m.source);
  if (typeof m.id !== "number" || !source) throw new Error("média refusé");
  const favori: Favori = {
    id: Math.floor(m.id), genre: m.genre === "video" ? "video" : "image",
    apercu: urlAdmise(m.apercu), source,
    largeur: Number(m.largeur) || 0, hauteur: Number(m.hauteur) || 0,
    duree: Number(m.duree) || 0, octets: Number(m.octets) || 0,
    auteur: String(m.auteur ?? "").slice(0, 80), page: urlAdmise(m.page),
    tags: String(m.tags ?? "").slice(0, 300), ajoute: new Date().toISOString(),
  };
  const liste = (await lireFavoris()).filter((f) => f.id !== favori.id || f.genre !== favori.genre);
  liste.unshift(favori);
  await ecrire(liste);
  return liste;
}

export async function retirerFavori(id: number, genre: string): Promise<Favori[]> {
  const liste = (await lireFavoris()).filter((f) => f.id !== id || f.genre !== genre);
  await ecrire(liste);
  return liste;
}
