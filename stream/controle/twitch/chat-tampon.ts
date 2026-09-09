/**
 * Tampon des derniers messages du chat. Le chat est un flux sans fin : la mémoire ne doit
 * pas croître avec lui, donc seuls les N derniers messages sont conservés — les plus anciens
 * sortent au fur et à mesure.
 *
 * Chaque message porte un numéro d'ordre croissant : l'interface renvoie le dernier qu'elle
 * connaît et ne reçoit que la suite, ce qui rend la lecture périodique quasi gratuite.
 */
import type { MessageChat } from "./types.ts";

export interface LotTampon {
  messages: MessageChat[];
  /** Dernier numéro attribué ; 0 tant que rien n'est passé. */
  dernier: number;
  /** Vrai si le demandeur a manqué des messages sortis du tampon entre deux lectures. */
  tronque: boolean;
}

export class TamponChat {
  private readonly max: number;
  private readonly messages: MessageChat[] = [];
  private suivant = 1;

  constructor(max: number) {
    this.max = Math.max(1, max);
  }

  ajouter(entree: Omit<MessageChat, "sequence">): MessageChat {
    const message: MessageChat = { ...entree, sequence: this.suivant };
    this.suivant += 1;
    this.messages.push(message);
    if (this.messages.length > this.max) this.messages.splice(0, this.messages.length - this.max);
    return message;
  }

  /** Messages postérieurs à `sequence` ; `0` demande tout ce que le tampon garde encore. */
  depuis(sequence: number): LotTampon {
    const demande = Number.isFinite(sequence) && sequence > 0 ? Math.trunc(sequence) : 0;
    const premier = this.messages[0]?.sequence ?? this.suivant;
    return {
      messages: this.messages.filter((message) => message.sequence > demande),
      dernier: this.suivant - 1,
      tronque: demande > 0 && demande + 1 < premier,
    };
  }

  vider(): void {
    this.messages.length = 0;
  }
}
