/**
 * Images de fond : celles déposées dans le dossier du corpus, servi à la scène sous /fonds/.
 */
import { resolve, extname, basename } from "node:path";
import { journal } from "./journal.ts";

const CORPUS = resolve(process.env.CORPUS_DIR ?? resolve(import.meta.dir, "../../corpus"));
const EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);
const TAILLE_MAX = 25 * 1024 * 1024;

export interface Image { fichier: string; octets: number; }

export async function listerFonds(): Promise<Image[]> {
  try {
    const glob = new Bun.Glob("*.{png,jpg,jpeg,webp,avif,PNG,JPG,JPEG,WEBP,AVIF}");
    const images: Image[] = [];
    for await (const nom of glob.scan({ cwd: CORPUS })) {
      images.push({ fichier: nom, octets: Bun.file(resolve(CORPUS, nom)).size });
    }
    return images.sort((a, b) => a.fichier.localeCompare(b.fichier));
  } catch (erreur) {
    journal.error({ erreur, CORPUS }, "liste des fonds impossible");
    return [];
  }
}

/** Assainit le nom : jamais de chemin, jamais d'extension non prévue. */
function nomSur(propose: string): string | null {
  const base = basename(propose).replace(/[^\w .-]/g, "_").slice(0, 100);
  const ext = extname(base).toLowerCase();
  if (!EXTENSIONS.has(ext) || base.startsWith(".")) return null;
  return base;
}

export async function deposerFond(fichier: File): Promise<Image> {
  const nom = nomSur(fichier.name);
  if (!nom) throw new Error("format non accepté : png, jpg, webp ou avif uniquement");
  if (fichier.size > TAILLE_MAX) throw new Error("image trop lourde (25 Mo maximum)");
  if (fichier.size === 0) throw new Error("fichier vide");
  try {
    const cible = resolve(CORPUS, nom);
    if (!cible.startsWith(CORPUS + "/")) throw new Error("chemin refusé");
    await Bun.write(cible, await fichier.arrayBuffer());
    journal.info({ nom, octets: fichier.size }, "fond déposé");
    return { fichier: nom, octets: fichier.size };
  } catch (erreur) {
    journal.error({ erreur, nom }, "dépôt du fond impossible");
    throw erreur instanceof Error ? erreur : new Error("dépôt impossible");
  }
}

export async function supprimerFond(nomBrut: string): Promise<void> {
  const nom = nomSur(nomBrut);
  if (!nom) throw new Error("nom refusé");
  const cible = resolve(CORPUS, nom);
  if (!cible.startsWith(CORPUS + "/")) throw new Error("chemin refusé");
  try {
    await Bun.file(cible).delete();
    journal.info({ nom }, "fond supprimé");
  } catch (erreur) {
    journal.error({ erreur, nom }, "suppression impossible");
    throw new Error("suppression impossible");
  }
}
