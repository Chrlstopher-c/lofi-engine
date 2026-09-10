/**
 * Interrogation de l'API Pixabay.
 *
 * Deux points de vigilance, tenus ici et nulle part ailleurs :
 *
 * 1. **La clé ne sort jamais.** Elle est lue dans le `.env`, posée dans l'URL appelée par le
 *    serveur, et n'apparaît dans aucune réponse rendue à l'interface — pas même tronquée.
 * 2. **Ce que Pixabay renvoie est une entrée non fiable.** Les URL de téléchargement viennent
 *    de l'extérieur : elles sont vérifiées contre les domaines de Pixabay avant tout appel,
 *    et les nombres sont bornés avant d'être crus.
 */
import type { Media } from "./types.ts";
import { lireEnv, ecrireEnv } from "../env.ts";
import { journal } from "../journal.ts";

const RACINE_API = "https://pixabay.com/api/";
const PAR_PAGE = 30;
/** Au-delà, c'est du poids perdu pour un fond de scène. */
const LARGEUR_MAX = 1920;
/** Les seuls hôtes dont on accepte de télécharger un fichier. Relevés sur de vraies
 * réponses de l'API : les images sortent des deux, les vidéos et leurs vignettes du CDN. */
const HOTES_ADMIS = new Set(["pixabay.com", "cdn.pixabay.com"]);
/** La clé Pixabay est une chaîne du genre « 12345678-abcdef0123456789abcdef012 ». */
const CLE_ADMISE = /^[0-9]{5,12}-[a-f0-9]{16,40}$/i;

export async function lireCle(): Promise<string> {
  return (await lireEnv()).get("PIXABAY_API_KEY") ?? "";
}

/** Refuse une clé mal formée avant de l'écrire : sinon l'échec n'apparaît qu'à la recherche. */
export async function ecrireCle(brut: unknown): Promise<void> {
  const cle = typeof brut === "string" ? brut.trim() : "";
  if (!CLE_ADMISE.test(cle)) {
    throw new Error("clé refusée : Pixabay en délivre du genre « 12345678-abcdef0123456789abc »");
  }
  await ecrireEnv(new Map([["PIXABAY_API_KEY", cle]]));
}

export async function oublierCle(): Promise<void> {
  await ecrireEnv(new Map([["PIXABAY_API_KEY", ""]]));
}

/** Une URL n'est suivie que si elle mène chez Pixabay, en https. */
export function urlAdmise(brut: unknown): string {
  if (typeof brut !== "string" || brut.length > 500) return "";
  try {
    const url = new URL(brut);
    if (url.protocol !== "https:") return "";
    return HOTES_ADMIS.has(url.hostname) ? url.toString() : "";
  } catch {
    return "";
  }
}

function nombre(valeur: unknown, plafond: number): number {
  const n = typeof valeur === "number" ? valeur : Number(valeur);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), plafond) : 0;
}

function texte(valeur: unknown, longueur: number): string {
  return typeof valeur === "string" ? valeur.slice(0, longueur) : "";
}

interface HitImage {
  id: number; previewURL: string; webformatURL: string; largeImageURL: string;
  imageWidth: number; imageHeight: number; imageSize: number; user: string;
  pageURL: string; tags: string;
}

interface HitVideo {
  id: number; duration: number; user: string; pageURL: string; tags: string;
  videos: Record<string, { url: string; width: number; height: number; size: number;
                           thumbnail: string }>;
}

/** Le côté le plus long de largeImageURL, chez Pixabay. */
const COTE_LARGE = 1280;

/**
 * Ce qu'on va vraiment recevoir, pas ce que pèse l'original.
 *
 * `imageWidth` et `imageSize` décrivent le fichier d'origine — souvent 4000 pixels et
 * plusieurs mégaoctets — alors qu'on télécharge `largeImageURL`, que Pixabay plafonne à 1280
 * sur son côté le plus long. Afficher les premiers ferait annoncer « 3888×2592 · 2,9 Mo » pour
 * un fichier de 288 Ko : mesuré, et faux dans les deux chiffres.
 */
function tailleTelechargee(largeur: number, hauteur: number): { largeur: number; hauteur: number } {
  const cote = Math.max(largeur, hauteur);
  if (cote <= 0 || cote <= COTE_LARGE) return { largeur, hauteur };
  const facteur = COTE_LARGE / cote;
  return { largeur: Math.round(largeur * facteur), hauteur: Math.round(hauteur * facteur) };
}

function versImage(h: HitImage): Media | null {
  const apercu = urlAdmise(h.previewURL);
  const source = urlAdmise(h.largeImageURL) || urlAdmise(h.webformatURL);
  if (!apercu || !source) return null;
  const taille = tailleTelechargee(nombre(h.imageWidth, 20000), nombre(h.imageHeight, 20000));
  return {
    id: nombre(h.id, 1e12), genre: "image", apercu, source,
    largeur: taille.largeur, hauteur: taille.hauteur, duree: 0,
    auteur: texte(h.user, 80), page: urlAdmise(h.pageURL), tags: texte(h.tags, 300),
    // Le poids du fichier redimensionné n'est pas annoncé par l'API : mieux vaut ne rien dire
    // que donner celui de l'original. Il est vérifié à l'arrivée, comme pour une vidéo.
    octets: 0, telecharge: false, favori: false,
  };
}

interface Variante { url: string; largeur: number; hauteur: number; octets: number; apercu: string }

/** La plus grande définition qui ne dépasse pas 1920 de large. */
function meilleureVideo(h: HitVideo): Variante | null {
  const choix = Object.values(h.videos ?? {})
    .map((f) => ({ url: urlAdmise(f.url), largeur: nombre(f.width, 20000),
                   hauteur: nombre(f.height, 20000), octets: nombre(f.size, 2e9),
                   apercu: urlAdmise(f.thumbnail) }))
    .filter((f) => f.url && f.largeur > 0 && f.largeur <= LARGEUR_MAX && f.octets > 0)
    .sort((a, b) => b.largeur - a.largeur);
  return choix[0] ?? null;
}

function versVideo(h: HitVideo): Media | null {
  const fichier = meilleureVideo(h);
  if (!fichier) return null;
  // Chaque variante porte sa propre vignette, sur le CDN. Relevé sur une vraie réponse : la
  // déduire de l'identifiant, comme on serait tenté de le faire, donne une URL qui n'existe pas.
  return {
    id: nombre(h.id, 1e12), genre: "video", apercu: fichier.apercu, source: fichier.url,
    largeur: fichier.largeur, hauteur: fichier.hauteur, duree: nombre(h.duration, 36000),
    auteur: texte(h.user, 80), page: urlAdmise(h.pageURL), tags: texte(h.tags, 300),
    octets: fichier.octets, telecharge: false, favori: false,
  };
}

/** Les termes de recherche sont écrits par l'utilisateur : bornés et encodés avant l'appel. */
function requeteSure(brut: unknown): string {
  const q = (typeof brut === "string" ? brut : "").trim().replace(/[^\p{L}\p{N} '-]/gu, " ");
  return q.replace(/\s+/g, " ").slice(0, 100);
}

function pageSure(brut: unknown): number {
  const n = Number(brut);
  // Pixabay refuse au-delà de 500 résultats par requête, soit ~16 pages de 30.
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 16) : 1;
}

interface Reponse { total?: number; hits?: unknown[] }

export interface Recherche {
  q: unknown;
  genre: unknown;
  page: unknown;
}

/** Construit l'URL d'appel. La clé y entre ici, et ne ressort par aucun retour de fonction. */
function urlRecherche(cle: string, r: Recherche): { url: string; video: boolean } {
  const video = r.genre === "video";
  const parametres = new URLSearchParams({
    key: cle, q: requeteSure(r.q), per_page: String(PAR_PAGE),
    page: String(pageSure(r.page)), safesearch: "true", order: "popular",
  });
  if (!video) parametres.set("image_type", "photo");
  return { url: `${RACINE_API}${video ? "videos/" : ""}?${parametres.toString()}`, video };
}

export async function chercher(r: Recherche): Promise<{ total: number; medias: Media[] }> {
  const cle = await lireCle();
  if (!cle) throw new Error("aucune clé Pixabay enregistrée");
  const { url, video } = urlRecherche(cle, r);
  let corps: Reponse;
  try {
    const reponse = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (reponse.status === 400) throw new Error("Pixabay a refusé la requête : clé invalide ?");
    if (reponse.status === 429) throw new Error("trop de requêtes : Pixabay limite à 100 par minute");
    if (!reponse.ok) throw new Error(`Pixabay a répondu ${reponse.status}`);
    corps = (await reponse.json()) as Reponse;
  } catch (erreur) {
    // Le message peut contenir l'URL appelée, donc la clé : il ne remonte jamais tel quel.
    journal.error({ erreur: erreur instanceof Error ? erreur.message : "inconnue" },
                  "recherche Pixabay impossible");
    throw erreur instanceof Error && !erreur.message.includes(RACINE_API)
      ? erreur : new Error("Pixabay est injoignable");
  }
  const medias = (corps.hits ?? [])
    .map((h) => (video ? versVideo(h as HitVideo) : versImage(h as HitImage)))
    .filter((m): m is Media => m !== null);
  return { total: nombre(corps.total, 1e9), medias };
}
