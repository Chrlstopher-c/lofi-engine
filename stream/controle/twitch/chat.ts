/**
 * Connexion au chat Twitch (IRC sur WebSocket), tenue par le serveur.
 * Le jeton ne quitte jamais ce processus : c'est lui qui s'authentifie, et l'interface ne
 * reçoit que des messages déjà nettoyés, lus par un appel périodique au centre de contrôle.
 *
 * La connexion se rouvre seule, avec une attente croissante plafonnée et un nombre de
 * tentatives borné. Passé ce plafond — ou sur un refus d'authentification, ou sans les
 * portées nécessaires — le chat passe en `refuse` et n'insiste plus : il faut le relancer
 * depuis l'interface. Aucune boucle ne tourne indéfiniment.
 */
import type { Coffre, EtatChat, EtatConnexionChat, LotChat, MessageChat } from "./types.ts";
import { coffreUtilisable, rafraichirJetons } from "./jeton.ts";
import { ouvrirChat, URL_CHAT, type EcouteursChat, type PriseChat } from "./chat-transport.ts";
import { evenementDe, type EvenementChat } from "./irc.ts";
import { TamponChat } from "./chat-tampon.ts";
import { texteEnvoyable, autoriserEnvoi } from "./chat-envoi.ts";
import { journal } from "../journal.ts";

/** Portées indispensables : lire le chat, y écrire. Un jeton plus ancien ne les a pas. */
export const PORTEES_CHAT = ["chat:read", "chat:edit"];

const MAX_MESSAGES = 300;
const ATTENTES_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];
const MAX_TENTATIVES = 60;
/** Twitch envoie un PING toutes les cinq minutes : dix minutes de silence = socket morte. */
const SILENCE_MAX_MS = 600_000;
const SUPERVISION_MS = 60_000;

interface Session {
  prise: PriseChat | null;
  etat: EtatConnexionChat;
  message: string | null;
  depuisMs: number | null;
  tentatives: number;
  echecsAuth: number;
  chaine: string;
  porteesManquantes: string[];
  dernierSigneMs: number;
  /** Génération de la socket : les évènements d'une socket remplacée deviennent inertes. */
  generation: number;
  minuteur: ReturnType<typeof setTimeout> | null;
  surveillance: ReturnType<typeof setInterval> | null;
}

const tampon = new TamponChat(MAX_MESSAGES);

const session: Session = {
  prise: null, etat: "arrete", message: null, depuisMs: null, tentatives: 0, echecsAuth: 0,
  chaine: "", porteesManquantes: [], dernierSigneMs: 0, generation: 0, minuteur: null, surveillance: null,
};

function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}

export function etatChat(): EtatChat {
  return {
    etat: session.etat,
    chaine: session.chaine,
    message: session.message,
    depuis: session.depuisMs === null ? null : new Date(session.depuisMs).toISOString(),
    tentatives: session.tentatives,
    porteesManquantes: [...session.porteesManquantes],
  };
}

function annulerMinuteur(): void {
  if (session.minuteur !== null) clearTimeout(session.minuteur);
  session.minuteur = null;
}

/** Ferme la socket en cours en rendant inertes les évènements qu'elle enverra encore. */
function larguerPrise(): void {
  const prise = session.prise;
  session.generation += 1;
  session.prise = null;
  session.depuisMs = null;
  prise?.fermer();
}

export function arreterChat(raison: string): void {
  annulerMinuteur();
  if (session.surveillance !== null) clearInterval(session.surveillance);
  session.surveillance = null;
  larguerPrise();
  session.etat = "arrete";
  session.message = raison;
  session.tentatives = 0;
  session.echecsAuth = 0;
  session.porteesManquantes = [];
  journal.info({ raison }, "chat Twitch arrêté");
}

/** Le tampon garde les messages d'un compte : changer de compte le vide. */
export function viderChat(): void {
  tampon.vider();
  session.chaine = "";
}

/** Refus : le chat ne repartira pas de lui-même, il faut le relancer explicitement. */
function refuser(message: string, porteesManquantes: string[] = []): void {
  arreterChat(message);
  session.etat = "refuse";
  session.message = message;
  session.porteesManquantes = porteesManquantes;
  journal.warn({ message, porteesManquantes }, "chat Twitch refusé");
}

function porteesAbsentes(coffre: Coffre): string[] {
  return PORTEES_CHAT.filter((portee) => !coffre.portees.includes(portee));
}

function authentifier(coffre: Coffre): void {
  const prise = session.prise;
  if (!prise) {
    journal.warn("chat Twitch : socket ouverte avant d'être enregistrée, authentification abandonnée");
    return;
  }
  prise.envoyer("CAP REQ :twitch.tv/tags twitch.tv/commands");
  prise.envoyer(`PASS oauth:${coffre.jetonAcces}`); // le jeton ne sort pas d'ici : jamais journalisé
  prise.envoyer(`NICK ${coffre.utilisateurLogin}`);
  journal.info({ chaine: coffre.utilisateurLogin }, "chat Twitch : authentification envoyée");
}

function accueillir(): void {
  session.etat = "connecte";
  session.depuisMs = Date.now();
  session.tentatives = 0;
  session.echecsAuth = 0;
  session.message = null;
  session.porteesManquantes = [];
  session.prise?.envoyer(`JOIN #${session.chaine}`);
  journal.info({ chaine: session.chaine }, "chat Twitch connecté");
}

/** Un avis de Twitch est affiché tel quel ; celui qui refuse l'authentification est fatal. */
function traiterAvis(texte: string, authentification: boolean): void {
  tampon.ajouter({ auteur: "Twitch", couleur: null, texte, horodatage: new Date().toISOString(), systeme: true });
  if (!authentification) return;
  session.echecsAuth += 1;
  if (session.echecsAuth >= 2) {
    refuser(`Twitch refuse l'authentification du chat : ${texte} — reconnecter le compte.`);
    return;
  }
  session.message = texte;
  journal.warn({ texte }, "chat Twitch : authentification refusée, le jeton sera renouvelé avant de retenter");
}

function traiter(evenement: EvenementChat): void {
  if (evenement.genre === "ping") {
    session.prise?.envoyer(`PONG :${evenement.jeton}`);
    return;
  }
  if (evenement.genre === "bienvenue") return accueillir();
  if (evenement.genre === "message") {
    const { auteur, couleur, texte, horodatage } = evenement;
    tampon.ajouter({ auteur, couleur, texte, horodatage, systeme: false });
    return;
  }
  if (evenement.genre === "avis") return traiterAvis(evenement.texte, evenement.authentification);
  if (evenement.genre === "reconnexion") {
    journal.info("chat Twitch : reconnexion demandée par Twitch");
    larguerPrise();
    session.tentatives = 0;
    replanifier("Reconnexion demandée par Twitch.");
  }
}

function surFermeture(code: number, raison: string): void {
  session.prise = null;
  session.depuisMs = null;
  if (session.etat === "refuse" || session.etat === "arrete") return;
  const detail = raison.trim().length > 0 ? raison.trim() : `code ${code}`;
  replanifier(`Connexion au chat fermée (${detail}).`);
}

function replanifier(message: string): void {
  annulerMinuteur();
  session.message = message;
  session.tentatives += 1;
  if (session.tentatives > MAX_TENTATIVES) {
    refuser(`${message} Trop de reconnexions de suite : relancer le chat depuis l'interface.`);
    return;
  }
  const attente = ATTENTES_MS[Math.min(session.tentatives - 1, ATTENTES_MS.length - 1)] ?? 30_000;
  session.etat = "attente";
  session.minuteur = setTimeout(() => void reconnecter(), attente);
  journal.warn({ attente, tentatives: session.tentatives, message }, "chat Twitch : reconnexion planifiée");
}

async function reconnecter(): Promise<void> {
  try {
    await connecter();
  } catch (erreur) {
    journal.error({ erreur }, "chat Twitch : reconnexion impossible");
    refuser(messageDe(erreur));
  }
}

function ecouteurs(generation: number, coffre: Coffre): EcouteursChat {
  const vivant = (): boolean => generation === session.generation;
  return {
    ouvert: (): void => { if (vivant()) authentifier(coffre); },
    ligne: (brut: string): void => {
      if (!vivant()) return;
      session.dernierSigneMs = Date.now();
      traiter(evenementDe(brut));
    },
    ferme: (code: number, raison: string): void => { if (vivant()) surFermeture(code, raison); },
    // Une erreur de socket est toujours suivie d'une fermeture : c'est elle qui replanifie.
    erreur: (detail: string): void => { if (vivant()) journal.warn({ detail }, "chat Twitch : socket en erreur"); },
  };
}

function ouvrir(coffre: Coffre): void {
  session.generation += 1;
  session.etat = "connexion";
  session.chaine = coffre.utilisateurLogin;
  session.dernierSigneMs = Date.now();
  try {
    session.prise = ouvrirChat(URL_CHAT, ecouteurs(session.generation, coffre));
  } catch (erreur) {
    session.prise = null;
    replanifier(messageDe(erreur));
  }
}

async function connecter(): Promise<void> {
  session.minuteur = null;
  let coffre: Coffre;
  try {
    // Un refus d'authentification vient le plus souvent d'un jeton périmé : on le renouvelle
    // d'office avant de retenter — une seule fois, le second refus arrête le chat.
    coffre = session.echecsAuth > 0 ? await rafraichirJetons() : await coffreUtilisable();
  } catch (erreur) {
    refuser(messageDe(erreur));
    return;
  }
  const absentes = porteesAbsentes(coffre);
  if (absentes.length > 0) {
    refuser("Le jeton actuel n'autorise pas le chat : reconnecter le compte Twitch pour l'activer.", absentes);
    return;
  }
  if (!coffre.utilisateurLogin) {
    refuser("Chaîne Twitch inconnue : reconnecter le compte.");
    return;
  }
  ouvrir(coffre);
}

function surveiller(): void {
  if (session.surveillance !== null) return;
  session.surveillance = setInterval(() => {
    if (session.etat !== "connecte") return;
    if (Date.now() - session.dernierSigneMs < SILENCE_MAX_MS) return;
    journal.warn({ silence: SILENCE_MAX_MS }, "chat Twitch muet : reconnexion forcée");
    larguerPrise();
    replanifier("Chat silencieux : reconnexion.");
  }, SUPERVISION_MS);
}

/** Ouvre la connexion si rien n'est en cours ; ne réveille jamais un chat refusé. */
export async function demarrerChat(): Promise<EtatChat> {
  if (session.etat !== "arrete") return etatChat();
  surveiller();
  await reconnecter();
  return etatChat();
}

/** Reprise explicite après un refus : la seule voie de retour, jamais une relance automatique. */
export async function relancerChat(): Promise<EtatChat> {
  arreterChat("relance demandée depuis l'interface");
  session.message = null;
  surveiller();
  await reconnecter();
  return etatChat();
}

export async function lireLotChat(depuis: number): Promise<LotChat> {
  await demarrerChat();
  const lot = tampon.depuis(depuis);
  return { etat: etatChat(), messages: lot.messages, sequence: lot.dernier, tronque: lot.tronque };
}

/**
 * Twitch ne renvoie pas à l'expéditeur ses propres messages : celui-ci est inscrit au tampon
 * après un envoi accepté par la socket, pour que l'interface le voie comme les autres.
 */
export async function envoyerMessage(brut: unknown): Promise<MessageChat> {
  const texte = texteEnvoyable(brut);
  await demarrerChat();
  if (session.etat !== "connecte" || !session.prise) {
    throw new Error(`Chat non connecté (${session.message ?? session.etat}) : message non envoyé.`);
  }
  autoriserEnvoi();
  session.prise.envoyer(`PRIVMSG #${session.chaine} :${texte}`);
  journal.info({ chaine: session.chaine, caracteres: texte.length }, "message envoyé sur le chat Twitch");
  return tampon.ajouter({
    auteur: session.chaine, couleur: null, texte, horodatage: new Date().toISOString(), systeme: false,
  });
}
