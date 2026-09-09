/**
 * Télécharge des boucles de fond depuis l'API Pixabay, avec leur traçabilité.
 *
 * La licence Pixabay n'exige pas d'attribution, mais garder l'origine de chaque fichier est
 * ce qui permet de répondre vite à une réclamation sur un stream qui tourne des mois.
 *
 * Usage : bun run outils/telecharger-fonds.ts [nombre par thème]
 */
import { resolve } from "node:path";

const CLE = process.env.PIXABAY_API_KEY ?? "";
const CORPUS = resolve(process.env.CORPUS_DIR ?? "./corpus");
const SOURCES = resolve(CORPUS, "fonds-sources.json");
const PAR_THEME = Number(process.argv[2] ?? 2);
const DUREE_MIN = 8;
const DUREE_MAX = 120;
const TAILLE_MAX = 120 * 1024 * 1024;

// L'esthétique Lofi Girl est protégée : on écarte ce qui s'en approche volontairement.
const REFUSES = ["lofi girl", "lofigirl", "study girl", "anime girl"];

const THEMES = [
  "rain window", "night city rain", "cozy room", "pixel art loop", "cassette tape",
  "vinyl record", "bokeh lights", "fireplace", "clouds timelapse", "neon night",
  "train window", "coffee shop", "aquarium", "ink water", "abstract slow motion",
];

interface Video { id: number; duration: number; tags: string; pageURL: string; user: string;
  videos: Record<string, { url: string; width: number; size: number }>; }

function acceptable(v: Video): boolean {
  const t = (v.tags ?? "").toLowerCase();
  if (REFUSES.some((r) => t.includes(r))) return false;
  return v.duration >= DUREE_MIN && v.duration <= DUREE_MAX;
}

/** La plus grande définition qui ne dépasse pas 1080 de large : au-delà, c'est du poids perdu. */
function meilleureQualite(v: Video): { url: string; size: number } | null {
  const choix = Object.values(v.videos ?? {})
    .filter((f) => f.url && f.width <= 1920 && f.size > 0 && f.size <= TAILLE_MAX)
    .sort((a, b) => b.width - a.width);
  return choix[0] ?? null;
}

async function chercher(theme: string): Promise<Video[]> {
  const url = `https://pixabay.com/api/videos/?key=${CLE}`
    + `&q=${encodeURIComponent(theme)}&per_page=20&safesearch=true&order=popular`;
  try {
    const rep = await fetch(url);
    if (!rep.ok) { console.error(`  ${theme} : réponse ${rep.status}`); return []; }
    const corps = (await rep.json()) as { hits?: Video[] };
    return (corps.hits ?? []).filter(acceptable);
  } catch (erreur) {
    console.error(`  ${theme} : ${erreur instanceof Error ? erreur.message : erreur}`);
    return [];
  }
}

async function telecharger(v: Video, theme: string): Promise<string | null> {
  const fichier = meilleureQualite(v);
  if (!fichier) return null;
  const nom = `fond-${theme.replace(/\s+/g, "-")}-${v.id}.mp4`;
  const cible = resolve(CORPUS, nom);
  if (await Bun.file(cible).exists()) return null;
  try {
    const rep = await fetch(fichier.url);
    if (!rep.ok) return null;
    await Bun.write(cible, await rep.arrayBuffer());
    const mo = (fichier.size / 1024 / 1024).toFixed(1);
    console.log(`  + ${nom}  (${mo} Mo, ${v.duration}s)`);
    return nom;
  } catch (erreur) {
    console.error(`  échec ${nom} : ${erreur instanceof Error ? erreur.message : erreur}`);
    return null;
  }
}

async function principal(): Promise<void> {
  if (!CLE) { console.error("PIXABAY_API_KEY absente du .env"); process.exit(1); }
  const traces: Record<string, unknown> = {};
  // Un même clip ressort sur plusieurs thèmes : on ne le prend qu'une fois.
  const vus = new Set<number>();
  let total = 0;
  for (const theme of THEMES) {
    console.log(`\n${theme}`);
    const trouves = await chercher(theme);
    for (const v of trouves.filter((v) => !vus.has(v.id)).slice(0, PAR_THEME)) {
      vus.add(v.id);
      const nom = await telecharger(v, theme);
      if (!nom) continue;
      traces[nom] = { source: "Pixabay", licence: "Pixabay Content License",
        page: v.pageURL, auteur: v.user, tags: v.tags, duree: v.duration, theme };
      total += 1;
    }
  }
  const ancien = (await Bun.file(SOURCES).exists()) ? await Bun.file(SOURCES).json() : {};
  await Bun.write(SOURCES, JSON.stringify({ ...ancien, ...traces }, null, 2));
  console.log(`\n${total} fond(s) téléchargé(s). Traçabilité : ${SOURCES}`);
}

void principal();
