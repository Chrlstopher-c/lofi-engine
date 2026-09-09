/**
 * Couche d'appel HTTP du domaine Twitch, isolée pour être remplaçable par un double
 * pendant les tests : c'est le seul endroit du domaine qui touche `fetch`.
 */
import { journal } from "../journal.ts";

export interface ReponseHttp {
  statut: number;
  /** Corps décodé si c'était du JSON, `null` sinon. */
  corps: unknown;
  texte: string;
}

export type AppelHttp = (url: string, init: RequestInit) => Promise<ReponseHttp>;

const DELAI_MS = 15_000;

function analyser(texte: string): unknown {
  try {
    return texte.length > 0 ? JSON.parse(texte) : null;
  } catch {
    return null; // Twitch peut répondre du HTML (maintenance, portail captif) : ce n'est pas fatal
  }
}

/** Journalise le point d'entrée sans la chaîne de requête : elle porte des identifiants. */
function cible(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "url illisible";
  }
}

async function appelReel(url: string, init: RequestInit): Promise<ReponseHttp> {
  try {
    const reponse = await fetch(url, { ...init, signal: AbortSignal.timeout(DELAI_MS) });
    const texte = await reponse.text();
    return { statut: reponse.status, corps: analyser(texte), texte };
  } catch (erreur) {
    journal.error({ erreur, cible: cible(url) }, "appel Twitch impossible");
    const detail = erreur instanceof Error ? erreur.message : String(erreur);
    throw new Error(`Twitch injoignable (${detail})`);
  }
}

/**
 * Point d'injection : partagé volontairement par tout le domaine, réglé en un seul endroit.
 * Sans remplaçant, c'est `appelReel` qui sert.
 */
let appel: AppelHttp = appelReel;

/** Remplace la couche réseau (double de test) ; `null` rétablit l'appel réel. */
export function definirTransport(remplacant: AppelHttp | null): void {
  appel = remplacant ?? appelReel;
  journal.debug({ double: remplacant !== null }, "transport Twitch remplacé");
}

export function appelHttp(url: string, init: RequestInit): Promise<ReponseHttp> {
  return appel(url, init);
}

/** Corps `application/x-www-form-urlencoded` attendu par les points d'entrée OAuth de Twitch. */
export function formulaire(champs: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(champs).toString(),
  };
}
