/**
 * Rapatrier un média de Pixabay dans le corpus.
 *
 * Le corpus est l'explorateur de la composition : un fichier déposé ici apparaît aussitôt dans
 * la liste des fonds de l'onglet Scène. C'est tout le sens du téléchargement — pas un dossier
 * de plus, le même que celui où l'on dépose ses propres images.
 *
 * L'URL vient de Pixabay, donc de l'extérieur : elle est revérifiée juste avant l'appel, même
 * si elle a déjà été validée à la recherche. Entre les deux, elle a pu traverser un favori posé
 * sur le disque et le corps d'une requête HTTP.
 */
import { resolve } from "node:path";
import type { Media } from "./types.ts";
import { urlAdmise } from "./client.ts";
import { TAILLE_MAX, TAILLE_MAX_VIDEO } from "../fonds.ts";
import { journal } from "../journal.ts";

const CORPUS = resolve(process.env.CORPUS_DIR ?? resolve(import.meta.dir, "../../../corpus"));
/** Le même fichier que celui de outils/telecharger-fonds.ts : une seule trace, un seul endroit. */
const SOURCES = resolve(CORPUS, "fonds-sources.json");
const EXTENSIONS_IMAGE = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const DELAI_MS = 120_000;

/**
 * L'extension se lit sur l'aperçu, dont le chemin est propre, et jamais sur l'URL de
 * téléchargement : celle des images est un jeton opaque sans extension.
 */
function extensionDe(media: Media): string {
  if (media.genre === "video") return ".mp4";
  const trouve = /\.(jpe?g|png|webp)(?:$|\?)/i.exec(media.apercu);
  const ext = trouve ? `.${trouve[1].toLowerCase()}` : ".jpg";
  return EXTENSIONS_IMAGE.has(ext) ? ext : ".jpg";
}

/** Un nom construit par nous, jamais repris de l'extérieur : aucun chemin ne peut s'y glisser. */
export function nomFichier(media: Media): string {
  return `pixabay-${media.genre}-${Math.floor(media.id)}${extensionDe(media)}`;
}

export async function dejaPresent(media: Media): Promise<boolean> {
  return Bun.file(resolve(CORPUS, nomFichier(media))).exists();
}

/** Garde l'origine de chaque fichier : de quoi répondre vite à une réclamation. */
async function tracer(nom: string, media: Media): Promise<void> {
  try {
    const f = Bun.file(SOURCES);
    const ancien = (await f.exists()) ? ((await f.json()) as Record<string, unknown>) : {};
    ancien[nom] = {
      source: "Pixabay", licence: "Pixabay Content License", page: media.page,
      auteur: media.auteur, tags: media.tags, duree: media.duree,
      recupere: new Date().toISOString(),
    };
    await Bun.write(SOURCES, JSON.stringify(ancien, null, 2));
  } catch (erreur) {
    // La traçabilité manquante ne doit pas faire échouer un téléchargement réussi.
    journal.warn({ erreur, nom }, "traçabilité non écrite pour ce fond");
  }
}

/** Nettoie ce que le client a envoyé : le corps d'une requête n'est pas un Media de confiance. */
export function mediaSur(brut: unknown): Media {
  const m = (brut ?? {}) as Partial<Media>;
  const source = urlAdmise(m.source);
  if (typeof m.id !== "number" || !Number.isFinite(m.id) || !source) {
    throw new Error("média refusé : identifiant ou source invalide");
  }
  return {
    id: Math.floor(m.id), genre: m.genre === "video" ? "video" : "image",
    apercu: urlAdmise(m.apercu), source,
    largeur: Number(m.largeur) || 0, hauteur: Number(m.hauteur) || 0,
    duree: Number(m.duree) || 0, octets: Number(m.octets) || 0,
    auteur: String(m.auteur ?? "").slice(0, 80), page: urlAdmise(m.page),
    tags: String(m.tags ?? "").slice(0, 300), telecharge: false, favori: false,
  };
}

function plafond(media: Media): number {
  return media.genre === "video" ? TAILLE_MAX_VIDEO : TAILLE_MAX;
}

/** Refuse avant de télécharger quand Pixabay annonce déjà un fichier hors plafond. */
function verifierAnnonce(media: Media): void {
  const max = plafond(media);
  if (media.octets > 0 && media.octets > max) {
    throw new Error(`fichier trop lourd (${Math.round(max / 1024 / 1024)} Mo maximum)`);
  }
}

export async function telecharger(brut: unknown): Promise<{ fichier: string; octets: number }> {
  const media = mediaSur(brut);
  verifierAnnonce(media);
  const nom = nomFichier(media);
  const cible = resolve(CORPUS, nom);
  if (!cible.startsWith(CORPUS + "/")) throw new Error("chemin refusé");
  if (await Bun.file(cible).exists()) {
    return { fichier: nom, octets: Bun.file(cible).size };
  }
  let donnees: ArrayBuffer;
  try {
    const reponse = await fetch(media.source, { signal: AbortSignal.timeout(DELAI_MS) });
    if (!reponse.ok) throw new Error(`Pixabay a répondu ${reponse.status}`);
    donnees = await reponse.arrayBuffer();
  } catch (erreur) {
    journal.error({ erreur, nom }, "téléchargement Pixabay impossible");
    throw new Error("téléchargement impossible : Pixabay est injoignable ou le fichier a disparu");
  }
  // Le poids annoncé n'engage que celui qui l'annonce : on revérifie sur ce qui est arrivé.
  if (donnees.byteLength === 0) throw new Error("fichier vide");
  if (donnees.byteLength > plafond(media)) {
    throw new Error(`fichier trop lourd (${Math.round(plafond(media) / 1024 / 1024)} Mo maximum)`);
  }
  await Bun.write(cible, donnees);
  await tracer(nom, media);
  journal.info({ nom, octets: donnees.byteLength }, "fond récupéré depuis Pixabay");
  return { fichier: nom, octets: donnees.byteLength };
}
