/**
 * Configuration et pilotage de la diffusion.
 * Les clés de diffusion sont écrites dans le .env mais ne ressortent jamais par l'API :
 * l'interface sait seulement si une clé est enregistrée.
 */
import type { Diffusion, EtatDiffusion } from "./types.ts";
import { journal } from "./journal.ts";
import { lireEnv, ecrireEnv } from "./env.ts";

const CLES_SECRETES = ["TWITCH_STREAM_KEY", "YOUTUBE_STREAM_KEY"];

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
