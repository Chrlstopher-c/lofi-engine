/**
 * Connexion du compte par flux « code d'appareil » (Device Code Grant).
 * Twitch le prévoit pour les applications sans serveur web : aucune URL de redirection,
 * aucun Client Secret. L'utilisateur saisit un code sur twitch.tv pendant que le serveur
 * interroge Twitch à intervalle imposé.
 *
 * Le sondage respecte l'`interval` renvoyé par Twitch, s'arrête à l'expiration du code,
 * et porte en plus un plafond de tentatives : aucune boucle ne peut tourner indéfiniment.
 */
import type { ConnexionAppareil, StatutConnexion } from "./types.ts";
import { lireCoffre, enregistrerJetons, enregistrerUtilisateur, type JetonsRecus } from "./coffre.ts";
import { appelHttp, formulaire } from "./transport.ts";
import { jetonsDe, POINT_JETON } from "./jeton.ts";
import { appelHelix } from "./client.ts";
import { objet, texte, entier, premierElement, messageTwitch } from "./valider.ts";
import { journal } from "../journal.ts";

const POINT_APPAREIL = "https://id.twitch.tv/oauth2/device";
const TYPE_ACCORD = "urn:ietf:params:oauth:grant-type:device_code";
const ORIGINES_ACTIVATION = ["https://www.twitch.tv/", "https://twitch.tv/"];

/** Portées demandées : clé de diffusion, titre et catégorie, suppression des rediffusions. */
export const PORTEES = ["channel:read:stream_key", "channel:manage:broadcast", "channel:manage:videos"];

const MAX_TENTATIVES = 240;
const INTERVALLE_MIN_MS = 5_000;
const INTERVALLE_MAX_MS = 30_000;
const MAX_ECHECS_RESEAU = 3;

interface Flux {
  /** Preuve de possession du flux : ne sort jamais du serveur. */
  codeAppareil: string;
  intervalleMs: number;
  expireA: number;
  vue: ConnexionAppareil;
}

/** Un seul flux de connexion à la fois : en lancer un neuf annule le précédent. */
let flux: Flux | null = null;

function patienter(ms: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, ms));
}

function conclure(cible: Flux, statut: StatutConnexion, message: string | null): void {
  if (cible.vue.statut !== "attente") return;
  cible.vue.statut = statut;
  cible.vue.message = message;
  journal.info({ statut, message }, "connexion Twitch par code d'appareil terminée");
}

/** La réponse d'ouverture est une entrée non fiable : sans forme valide, on n'ouvre rien. */
function lireOuverture(corps: unknown): Flux {
  const o = objet(corps);
  const codeAppareil = texte(o, "device_code");
  const codeUtilisateur = texte(o, "user_code");
  const url = texte(o, "verification_uri");
  const duree = entier(o, "expires_in");
  if (!codeAppareil || !codeUtilisateur || !url || duree === null || duree <= 0) {
    throw new Error("Réponse de Twitch inexploitable : le code d'activation est incomplet.");
  }
  if (!ORIGINES_ACTIVATION.some((origine) => url.startsWith(origine))) {
    throw new Error("URL d'activation refusée : elle ne pointe pas vers twitch.tv.");
  }
  const intervalle = entier(o, "interval") ?? 5;
  return {
    codeAppareil,
    intervalleMs: Math.min(INTERVALLE_MAX_MS, Math.max(INTERVALLE_MIN_MS, intervalle * 1000)),
    expireA: Date.now() + duree * 1000,
    vue: {
      statut: "attente", codeUtilisateur, urlVerification: url,
      expireA: new Date(Date.now() + duree * 1000).toISOString(), message: null,
    },
  };
}

type Verdict =
  | { genre: "jetons"; jetons: JetonsRecus }
  | { genre: "attente" }
  | { genre: "ralentir" }
  | { genre: "reseau"; message: string }
  | { genre: "echec"; message: string };

/** `authorization_pending` est la réponse normale tant que l'utilisateur n'a pas validé. */
function classer(corps: unknown, statut: number): Verdict {
  const o = objet(corps);
  const marqueurs = `${texte(o, "message") ?? ""} ${texte(o, "error") ?? ""}`.toLowerCase();
  if (marqueurs.includes("authorization_pending")) return { genre: "attente" };
  if (marqueurs.includes("slow_down")) return { genre: "ralentir" };
  return { genre: "echec", message: messageTwitch(corps, statut) };
}

async function tenter(cible: Flux, clientId: string): Promise<Verdict> {
  try {
    const reponse = await appelHttp(POINT_JETON, formulaire({
      client_id: clientId,
      device_code: cible.codeAppareil,
      scopes: PORTEES.join(" "),
      grant_type: TYPE_ACCORD,
    }));
    if (reponse.statut >= 400) return classer(reponse.corps, reponse.statut);
    const jetons = jetonsDe(reponse.corps);
    return jetons ? { genre: "jetons", jetons } : { genre: "echec", message: "Twitch n'a pas renvoyé de jeton." };
  } catch (erreur) {
    return { genre: "reseau", message: erreur instanceof Error ? erreur.message : String(erreur) };
  }
}

/** Le jeton ne dit pas à quelle chaîne il appartient : on le demande une fois, ici. */
async function identifierChaine(): Promise<void> {
  const utilisateur = premierElement(await appelHelix("/users"));
  const id = texte(utilisateur, "id");
  const login = texte(utilisateur, "login");
  if (!id || !login) throw new Error("Twitch n'a pas renvoyé la chaîne associée au jeton.");
  await enregistrerUtilisateur(id, login);
}

async function finaliser(cible: Flux, jetons: JetonsRecus): Promise<void> {
  try {
    await enregistrerJetons(jetons);
    await identifierChaine();
    cible.vue.statut = "reussie";
    cible.vue.message = null;
    journal.info("compte Twitch connecté");
  } catch (erreur) {
    conclure(cible, "echouee", erreur instanceof Error ? erreur.message : String(erreur));
  }
}

async function sonder(cible: Flux, clientId: string): Promise<void> {
  let intervalleMs = cible.intervalleMs;
  let echecsReseau = 0;
  for (let tentative = 0; tentative < MAX_TENTATIVES; tentative += 1) {
    await patienter(intervalleMs);
    if (cible.vue.statut !== "attente") return; // annulée, ou remplacée par un autre flux
    if (Date.now() >= cible.expireA) {
      conclure(cible, "expiree", "Le code a expiré avant d'être validé. Relancer la connexion.");
      return;
    }
    const verdict = await tenter(cible, clientId);
    if (verdict.genre === "jetons") return finaliser(cible, verdict.jetons);
    if (verdict.genre === "echec") return conclure(cible, "echouee", verdict.message);
    if (verdict.genre === "ralentir") intervalleMs = Math.min(INTERVALLE_MAX_MS, intervalleMs + 5_000);
    if (verdict.genre !== "reseau") {
      echecsReseau = 0;
      continue;
    }
    echecsReseau += 1;
    if (echecsReseau >= MAX_ECHECS_RESEAU) return conclure(cible, "echouee", verdict.message);
  }
  conclure(cible, "expiree", "Connexion abandonnée : trop de tentatives sans validation.");
}

export function etatConnexion(): ConnexionAppareil | null {
  return flux ? { ...flux.vue } : null;
}

export function annulerConnexion(): void {
  if (flux) conclure(flux, "annulee", "Connexion annulée.");
}

export async function demarrerConnexion(): Promise<ConnexionAppareil> {
  const { clientId } = await lireCoffre();
  if (!clientId) throw new Error("Client ID manquant : enregistrer l'application Twitch avant de connecter le compte.");
  annulerConnexion();
  const reponse = await appelHttp(POINT_APPAREIL, formulaire({ client_id: clientId, scopes: PORTEES.join(" ") }));
  if (reponse.statut >= 400) throw new Error(messageTwitch(reponse.corps, reponse.statut));
  const ouvert = lireOuverture(reponse.corps);
  flux = ouvert;
  journal.info({ expireA: ouvert.vue.expireA }, "code d'activation Twitch obtenu");
  // Sondage détaché : son résultat vit dans `ouvert.vue`, que l'interface relit.
  void sonder(ouvert, clientId).catch((erreur: unknown) => {
    journal.error({ erreur }, "sondage du code d'appareil interrompu");
    conclure(ouvert, "echouee", erreur instanceof Error ? erreur.message : String(erreur));
  });
  return { ...ouvert.vue };
}
