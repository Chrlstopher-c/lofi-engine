/**
 * Couche WebSocket du chat, isolée pour être remplaçable par un double — même intention
 * que `transport.ts` pour HTTP : c'est le seul endroit du domaine qui ouvre une socket,
 * et le seul à remplacer pour éprouver la logique du chat sans compte Twitch.
 */
import { journal } from "../journal.ts";

export const URL_CHAT = "wss://irc-ws.chat.twitch.tv:443";

/** Ce que la logique de chat peut faire d'une connexion ouverte : écrire une ligne, fermer. */
export interface PriseChat {
  envoyer(ligne: string): void;
  fermer(): void;
}

/** Ce que la connexion rapporte. Une « ligne » est une commande IRC, sans son CRLF. */
export interface EcouteursChat {
  ouvert(): void;
  ligne(brut: string): void;
  ferme(code: number, raison: string): void;
  erreur(detail: string): void;
}

export type OuvrirChat = (url: string, ecouteurs: EcouteursChat) => PriseChat;

/** Un cadre WebSocket peut porter plusieurs commandes : Twitch les sépare par CRLF. */
export function lignesDe(donnees: unknown): string[] {
  if (typeof donnees !== "string") return [];
  return donnees.split("\r\n").filter((ligne) => ligne.length > 0);
}

function ecrire(prise: WebSocket, ligne: string): void {
  if (prise.readyState !== WebSocket.OPEN) return;
  try {
    prise.send(`${ligne}\r\n`);
  } catch (erreur) {
    journal.warn({ erreur }, "écriture sur la socket du chat impossible");
  }
}

function ouvrirReel(url: string, ecouteurs: EcouteursChat): PriseChat {
  const prise = new WebSocket(url);
  prise.onopen = (): void => ecouteurs.ouvert();
  prise.onmessage = (evenement: MessageEvent): void => {
    for (const ligne of lignesDe(evenement.data)) ecouteurs.ligne(ligne);
  };
  prise.onclose = (evenement: CloseEvent): void => ecouteurs.ferme(evenement.code, evenement.reason);
  // Une erreur de socket est toujours suivie d'une fermeture : la reconnexion se décide là-bas,
  // jamais ici — deux planifications pour un même incident en feraient deux connexions.
  prise.onerror = (): void => ecouteurs.erreur("socket du chat en erreur");
  return {
    envoyer: (ligne: string): void => ecrire(prise, ligne),
    fermer: (): void => {
      try {
        prise.close();
      } catch (erreur) {
        journal.warn({ erreur }, "fermeture de la socket du chat impossible");
      }
    },
  };
}

/** Point d'injection unique, réglé en un seul endroit ; sans remplaçant, la socket est réelle. */
let ouvrir: OuvrirChat = ouvrirReel;

/** Remplace la couche WebSocket (double de test) ; `null` rétablit la socket réelle. */
export function definirTransportChat(remplacant: OuvrirChat | null): void {
  ouvrir = remplacant ?? ouvrirReel;
  journal.debug({ double: remplacant !== null }, "transport du chat Twitch remplacé");
}

export function ouvrirChat(url: string, ecouteurs: EcouteursChat): PriseChat {
  return ouvrir(url, ecouteurs);
}
