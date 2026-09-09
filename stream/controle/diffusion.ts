/**
 * Configuration et pilotage de la diffusion.
 * Les clés de diffusion sont écrites dans le .env mais ne ressortent jamais par l'API :
 * l'interface sait seulement si une clé est enregistrée.
 */
import { resolve } from "node:path";
import type { Diffusion, EtatDiffusion } from "./types.ts";
import { journal } from "./journal.ts";

const RACINE = resolve(process.env.RACINE_PROJET ?? resolve(import.meta.dir, "../.."));
const ENV = resolve(RACINE, ".env");
const CLES_SECRETES = ["TWITCH_STREAM_KEY", "YOUTUBE_STREAM_KEY"];

async function lireEnv(): Promise<Map<string, string>> {
  const valeurs = new Map<string, string>();
  try {
    const f = Bun.file(ENV);
    if (!(await f.exists())) return valeurs;
    for (const ligne of (await f.text()).split("\n")) {
      const nette = ligne.trim();
      if (!nette || nette.startsWith("#")) continue;
      const sep = nette.indexOf("=");
      if (sep > 0) valeurs.set(nette.slice(0, sep).trim(), nette.slice(sep + 1).trim());
    }
  } catch (erreur) {
    journal.error({ erreur, chemin: ENV }, "lecture du .env impossible");
  }
  return valeurs;
}

/** Réécrit les clés demandées en conservant commentaires et ordre du fichier. */
async function ecrireEnv(modifs: Map<string, string>): Promise<void> {
  const f = Bun.file(ENV);
  const source = (await f.exists()) ? await f.text() : "";
  const restantes = new Map(modifs);
  const lignes = source.split("\n").map((ligne) => {
    const nette = ligne.trim();
    if (!nette || nette.startsWith("#")) return ligne;
    const sep = nette.indexOf("=");
    if (sep <= 0) return ligne;
    const nom = nette.slice(0, sep).trim();
    if (!restantes.has(nom)) return ligne;
    const valeur = restantes.get(nom) as string;
    restantes.delete(nom);
    return `${nom}=${valeur}`;
  });
  for (const [nom, valeur] of restantes) lignes.push(`${nom}=${valeur}`);
  await Bun.write(ENV, lignes.join("\n"));
  journal.info({ clefs: [...modifs.keys()] }, "configuration de diffusion enregistrée");
}

function estVrai(valeur: string | undefined): boolean {
  return ["true", "1", "oui", "on"].includes((valeur ?? "").toLowerCase());
}

export async function lireDiffusion(): Promise<Diffusion> {
  const e = await lireEnv();
  return {
    twitchActif: estVrai(e.get("STREAM_TWITCH")),
    youtubeActif: estVrai(e.get("STREAM_YOUTUBE")),
    twitchCle: (e.get("TWITCH_STREAM_KEY") ?? "").length > 0,
    youtubeCle: (e.get("YOUTUBE_STREAM_KEY") ?? "").length > 0,
    twitchIngest: e.get("TWITCH_INGEST") ?? "rtmp://live.twitch.tv/app",
    youtubeIngest: e.get("YOUTUBE_INGEST") ?? "rtmp://a.rtmp.youtube.com/live2",
    resolution: e.get("STREAM_RESOLUTION") ?? "1920x1080",
    fps: Number(e.get("STREAM_FPS") ?? 30),
    bitrateVideo: e.get("STREAM_VIDEO_BITRATE") ?? "1500k",
    bitrateAudio: e.get("STREAM_AUDIO_BITRATE") ?? "160k",
  };
}

function texteSur(valeur: unknown, defaut: string, motif: RegExp): string {
  const v = typeof valeur === "string" ? valeur.trim() : "";
  return motif.test(v) ? v : defaut;
}

/** Une clé absente du corps laisse la valeur enregistrée intacte : on n'efface jamais par omission. */
export async function ecrireDiffusion(brut: unknown): Promise<Diffusion> {
  const o = (brut ?? {}) as Record<string, unknown>;
  const actuel = await lireDiffusion();
  const modifs = new Map<string, string>([
    ["STREAM_TWITCH", String(o.twitchActif === true)],
    ["STREAM_YOUTUBE", String(o.youtubeActif === true)],
    ["TWITCH_INGEST", texteSur(o.twitchIngest, actuel.twitchIngest, /^rtmps?:\/\/[\w.\-/]{3,180}$/)],
    ["YOUTUBE_INGEST", texteSur(o.youtubeIngest, actuel.youtubeIngest, /^rtmps?:\/\/[\w.\-/]{3,180}$/)],
    ["STREAM_RESOLUTION", texteSur(o.resolution, actuel.resolution, /^\d{3,5}x\d{3,5}$/)],
    ["STREAM_FPS", texteSur(String(o.fps ?? ""), String(actuel.fps), /^(24|25|30|48|50|60)$/)],
    ["STREAM_VIDEO_BITRATE", texteSur(o.bitrateVideo, actuel.bitrateVideo, /^\d{3,6}k$/)],
    ["STREAM_AUDIO_BITRATE", texteSur(o.bitrateAudio, actuel.bitrateAudio, /^\d{2,4}k$/)],
  ]);
  for (const nom of CLES_SECRETES) {
    const champ = nom === "TWITCH_STREAM_KEY" ? o.twitchCle : o.youtubeCle;
    if (typeof champ === "string") modifs.set(nom, champ.trim().slice(0, 200));
  }
  await ecrireEnv(modifs);
  return lireDiffusion();
}
