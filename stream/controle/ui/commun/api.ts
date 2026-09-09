/**
 * Accès à l'API du centre de contrôle. Toute erreur réseau ou refus du backend devient une
 * `Error` dont le message est celui écrit par le serveur, lisible tel quel à l'écran.
 */
import type { Diffusion, EtatDiffusion, Scene } from "../../types.ts";
import type { Profil } from "../../profils.ts";

export interface ImageFond { fichier: string; octets: number; }

/** Champs de diffusion envoyés au serveur : une clé est une chaîne à écrire, ou absente. */
export type DiffusionEnvoyee = Omit<Diffusion, "twitchCle" | "youtubeCle"> & {
  twitchCle?: string;
  youtubeCle?: string;
};

const PORT_SCENE = 4707;

/** Origine du site qui sert la scène et les fonds (même hôte que le centre de contrôle). */
export function origineScene(): string {
  return `${window.location.protocol}//${window.location.hostname}:${PORT_SCENE}`;
}

export function urlFond(fichier: string): string {
  return `${origineScene()}/fonds/${encodeURIComponent(fichier)}`;
}

async function lireErreur(reponse: Response): Promise<string> {
  try {
    const corps: unknown = await reponse.json();
    if (corps && typeof corps === "object" && "erreur" in corps) {
      const message = (corps as { erreur: unknown }).erreur;
      if (typeof message === "string" && message) return message;
    }
  } catch {
    // corps non JSON : on retombe sur le statut HTTP
  }
  return `${reponse.status} ${reponse.statusText}`.trim();
}

export async function requete<T>(chemin: string, init?: RequestInit): Promise<T> {
  let reponse: Response;
  try {
    reponse = await fetch(chemin, { cache: "no-store", ...init });
  } catch (erreur) {
    const detail = erreur instanceof Error ? erreur.message : String(erreur);
    throw new Error(`Serveur injoignable (${detail})`);
  }
  if (!reponse.ok) throw new Error(await lireErreur(reponse));
  // Le JSON du serveur est de forme connue (types.ts) : la conversion est le contrat de l'API.
  return (await reponse.json()) as T;
}

export function corpsJson(methode: string, donnees: unknown): RequestInit {
  return {
    method: methode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(donnees),
  };
}

export const api = {
  lireScene: (): Promise<Scene> => requete<Scene>("/api/scene"),
  enregistrerScene: (scene: Scene): Promise<Scene> => requete<Scene>("/api/scene", corpsJson("PUT", scene)),
  lireDiffusion: (): Promise<Diffusion> => requete<Diffusion>("/api/diffusion"),
  enregistrerDiffusion: (conf: DiffusionEnvoyee): Promise<Diffusion> =>
    requete<Diffusion>("/api/diffusion", corpsJson("PUT", conf)),
  lireEtat: (): Promise<EtatDiffusion> => requete<EtatDiffusion>("/api/etat"),
  lireJournal: async (): Promise<string> => (await requete<{ texte: string }>("/api/journal")).texte,
  demarrer: (): Promise<{ ok: boolean; sortie: string }> =>
    requete("/api/diffusion/demarrer", { method: "POST" }),
  arreter: (): Promise<{ ok: boolean; sortie: string }> =>
    requete("/api/diffusion/arreter", { method: "POST" }),
  listerFonds: (): Promise<ImageFond[]> => requete<ImageFond[]>("/api/fonds"),
  deposerFond: (fichier: File): Promise<ImageFond> => {
    const form = new FormData();
    form.append("fichier", fichier, fichier.name);
    return requete<ImageFond>("/api/fonds", { method: "POST", body: form });
  },
  supprimerFond: (fichier: string): Promise<{ ok: boolean }> =>
    requete(`/api/fonds/${encodeURIComponent(fichier)}`, { method: "DELETE" }),
  listerProfils: (): Promise<Profil[]> => requete<Profil[]>("/api/profils"),
  /** La scène envoyée est celle en cours d'édition : le profil garde ce qui est à l'écran. */
  enregistrerProfil: (nom: string, scene: Scene): Promise<Profil> =>
    requete<Profil>("/api/profils", corpsJson("POST", { nom, scene })),
  /** Le profil devient la scène diffusée ; le serveur renvoie la scène telle qu'il l'a écrite. */
  chargerProfil: (nom: string): Promise<Scene> =>
    requete<Scene>(`/api/profils/${encodeURIComponent(nom)}/charger`, { method: "POST" }),
  supprimerProfil: (nom: string): Promise<{ ok: boolean }> =>
    requete(`/api/profils/${encodeURIComponent(nom)}`, { method: "DELETE" }),
};
