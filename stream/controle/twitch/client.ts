/**
 * Appels à l'API Helix. Un seul chemin d'accès pour tout le domaine, donc une seule
 * politique : jeton renouvelé d'avance, et sur un 401 une unique reprise après
 * rafraîchissement. Jamais deux — un 401 qui persiste est un problème de portée ou de
 * compte, que réessayer ne réglera pas.
 */
import type { Coffre } from "./types.ts";
import { coffreUtilisable, rafraichirJetons } from "./jeton.ts";
import { appelHttp, type ReponseHttp } from "./transport.ts";
import { messageTwitch } from "./valider.ts";
import { journal } from "../journal.ts";

const HELIX = "https://api.twitch.tv/helix";

export interface OptionsAppel {
  methode?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Paramètres de requête ; une valeur vide est omise. */
  requete?: Record<string, string>;
  corps?: Record<string, unknown>;
}

function construireUrl(chemin: string, requete: Record<string, string> | undefined): string {
  const url = new URL(`${HELIX}${chemin}`);
  for (const [nom, valeur] of Object.entries(requete ?? {})) {
    if (valeur !== "") url.searchParams.set(nom, valeur);
  }
  return url.toString();
}

function envoyer(chemin: string, options: OptionsAppel, coffre: Coffre): Promise<ReponseHttp> {
  const entetes: Record<string, string> = {
    authorization: `Bearer ${coffre.jetonAcces}`,
    "client-id": coffre.clientId,
  };
  if (options.corps) entetes["content-type"] = "application/json";
  return appelHttp(construireUrl(chemin, options.requete), {
    method: options.methode ?? "GET",
    headers: entetes,
    body: options.corps ? JSON.stringify(options.corps) : undefined,
  });
}

/** Une réponse d'échec devient une `Error` portant le message de Twitch, mot pour mot. */
function corpsOuErreur(reponse: ReponseHttp, chemin: string): unknown {
  if (reponse.statut < 400) return reponse.corps;
  const message = messageTwitch(reponse.corps, reponse.statut);
  journal.warn({ statut: reponse.statut, chemin, message }, "appel Helix refusé");
  throw new Error(message);
}

export async function appelHelix(chemin: string, options: OptionsAppel = {}): Promise<unknown> {
  const coffre = await coffreUtilisable();
  const premiere = await envoyer(chemin, options, coffre);
  if (premiere.statut !== 401) return corpsOuErreur(premiere, chemin);
  journal.info({ chemin }, "jeton refusé (401), une reprise après rafraîchissement");
  const rafraichi = await rafraichirJetons();
  return corpsOuErreur(await envoyer(chemin, options, rafraichi), chemin);
}

/** Identifiant de la chaîne connectée, exigé par presque tous les points d'entrée. */
export async function identifiantChaine(): Promise<string> {
  const coffre = await coffreUtilisable();
  if (!coffre.utilisateurId) throw new Error("Chaîne Twitch inconnue : reconnecter le compte.");
  return coffre.utilisateurId;
}
