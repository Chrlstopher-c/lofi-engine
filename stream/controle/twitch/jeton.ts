/**
 * Cycle de vie du jeton d'accès : lecture, rafraîchissement, échéance.
 * Le jeton Twitch vit environ quatre heures. Il est renouvelé à l'échéance et, en secours,
 * sur un 401 (voir `client.ts`) — une seule fois, jamais en boucle.
 *
 * Le flux par code d'appareil crée un client *public* : le rafraîchissement est envoyé
 * sans Client Secret, il n'y en a pas.
 */
import type { Coffre } from "./types.ts";
import { lireCoffre, enregistrerJetons, type JetonsRecus } from "./coffre.ts";
import { appelHttp, formulaire } from "./transport.ts";
import { objet, texte, entier, listeTextes, messageTwitch } from "./valider.ts";
import { journal } from "../journal.ts";

export const POINT_JETON = "https://id.twitch.tv/oauth2/token";

/** Marge avant l'échéance : on renouvelle un peu avant, pas au moment où il est déjà mort. */
const MARGE_MS = 120_000;

/** Extrait des jetons d'une réponse OAuth, ou `null` si la forme n'est pas celle attendue. */
export function jetonsDe(corps: unknown): JetonsRecus | null {
  const o = objet(corps);
  const jetonAcces = texte(o, "access_token");
  const duree = entier(o, "expires_in");
  if (!jetonAcces || duree === null || duree <= 0) return null;
  return {
    jetonAcces,
    jetonRafraichissement: texte(o, "refresh_token") ?? "",
    dureeSecondes: duree,
    portees: listeTextes(o, "scope"),
  };
}

export function jetonExpire(coffre: Coffre): boolean {
  return coffre.expireA - MARGE_MS <= Date.now();
}

/**
 * Un seul rafraîchissement à la fois : deux appels simultanés partageraient sinon la course,
 * et le second travaillerait avec un jeton déjà remplacé.
 */
let enCours: Promise<Coffre> | null = null;

async function demanderRafraichissement(coffre: Coffre): Promise<Coffre> {
  const reponse = await appelHttp(POINT_JETON, formulaire({
    client_id: coffre.clientId,
    refresh_token: coffre.jetonRafraichissement,
    grant_type: "refresh_token",
  }));
  if (reponse.statut >= 400) {
    const message = messageTwitch(reponse.corps, reponse.statut);
    journal.warn({ statut: reponse.statut, message }, "rafraîchissement du jeton Twitch refusé");
    throw new Error(`Rafraîchissement refusé par Twitch : ${message}`);
  }
  const jetons = jetonsDe(reponse.corps);
  if (!jetons) throw new Error("Réponse de rafraîchissement inexploitable : Twitch n'a pas renvoyé de jeton.");
  // Twitch peut ne pas renvoyer de nouveau refresh_token : on garde alors le précédent.
  const conserve = jetons.jetonRafraichissement || coffre.jetonRafraichissement;
  return enregistrerJetons({ ...jetons, jetonRafraichissement: conserve });
}

export async function rafraichirJetons(): Promise<Coffre> {
  if (enCours) return enCours;
  const coffre = await lireCoffre();
  if (!coffre.jetonRafraichissement || !coffre.clientId) {
    throw new Error("Aucun jeton de rafraîchissement : reconnecter le compte Twitch.");
  }
  enCours = demanderRafraichissement(coffre).finally(() => { enCours = null; });
  return enCours;
}

/** Coffre garanti porteur d'un jeton utilisable, renouvelé d'avance s'il arrivait à échéance. */
export async function coffreUtilisable(): Promise<Coffre> {
  const coffre = await lireCoffre();
  if (!coffre.jetonAcces) throw new Error("Compte Twitch non connecté : lancer la connexion depuis l'onglet Twitch.");
  return jetonExpire(coffre) ? rafraichirJetons() : coffre;
}
