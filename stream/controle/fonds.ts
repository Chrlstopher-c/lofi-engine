/**
 * Images de fond : celles déposées dans le dossier du corpus, servi à la scène sous /fonds/.
 */
import { resolve, extname, basename } from "node:path";
import { journal } from "./journal.ts";

const CORPUS = resolve(process.env.CORPUS_DIR ?? resolve(import.meta.dir, "../../corpus"));
const IMAGES = [".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"];
const VIDEOS = [".mp4", ".webm", ".m4v"];
const EXTENSIONS = new Set([...IMAGES, ...VIDEOS]);
// Une vidéo de fond pèse plus lourd qu'une image : plafond plus haut, mais borné.
// Exportés : ce qui arrive de Pixabay passe par les mêmes plafonds que ce qu'on dépose à la
// main — deux tables de limites finiraient par diverger.
export const TAILLE_MAX = 25 * 1024 * 1024;
export const TAILLE_MAX_VIDEO = 400 * 1024 * 1024;

export interface Image { fichier: string; octets: number; video: boolean; }

export async function listerFonds(): Promise<Image[]> {
  try {
    const glob = new Bun.Glob("*.{png,jpg,jpeg,webp,avif,gif,mp4,webm,m4v,PNG,JPG,JPEG,WEBP,AVIF,GIF,MP4,WEBM,M4V}");
    const images: Image[] = [];
    for await (const nom of glob.scan({ cwd: CORPUS })) {
      const ext = extname(nom).toLowerCase();
      images.push({ fichier: nom, octets: Bun.file(resolve(CORPUS, nom)).size,
                    video: VIDEOS.includes(ext) });
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
  if (!nom) throw new Error("format non accepté : png, jpg, webp, avif, gif, mp4, webm");
  const estVideo = VIDEOS.includes(extname(nom).toLowerCase());
  const plafond = estVideo ? TAILLE_MAX_VIDEO : TAILLE_MAX;
  if (fichier.size > plafond) {
    throw new Error(`fichier trop lourd (${plafond / 1024 / 1024} Mo maximum)`);
  }
  if (fichier.size === 0) throw new Error("fichier vide");
  try {
    const cible = resolve(CORPUS, nom);
    if (!cible.startsWith(CORPUS + "/")) throw new Error("chemin refusé");
    await Bun.write(cible, await fichier.arrayBuffer());
    journal.info({ nom, octets: fichier.size }, "fond déposé");
    return { fichier: nom, octets: fichier.size, video: estVideo };
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
