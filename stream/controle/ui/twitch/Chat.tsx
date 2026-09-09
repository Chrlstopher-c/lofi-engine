/**
 * Chat en direct. Le jeton reste au serveur : cette interface ne parle qu'au centre de
 * contrôle, et n'affiche que des messages déjà nettoyés.
 *
 * Le texte d'un message est écrit par des inconnus : il est rendu comme du texte, jamais
 * comme du balisage. La couleur, elle, est revérifiée ici avant d'entrer dans un style.
 */
import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import type { EtatChat, MessageChat } from "../../twitch/types.ts";
import { Alerte, Bouton, Section } from "../commun/composants.tsx";
import { heureLisible } from "./format-twitch.ts";
import { useChat } from "./useChat.ts";

const PORTEES_CHAT = ["chat:read", "chat:edit"];
const FORME_COULEUR = /^#[0-9a-f]{6}$/i;
const MAX_SAISIE = 480;

/** Une couleur venue du réseau n'entre dans un style qu'après vérification de sa forme. */
function couleurSure(couleur: string | null): string | undefined {
  return couleur && FORME_COULEUR.test(couleur) ? couleur : undefined;
}

function Ligne({ message }: { message: MessageChat }): ReactNode {
  const heure = heureLisible(message.horodatage);
  return (
    <li className={message.systeme ? "chat-message systeme" : "chat-message"}>
      {heure ? <span className="chat-heure mono">{heure}</span> : null}
      <span className="chat-auteur" style={{ color: couleurSure(message.couleur) }}>{message.auteur}</span>
      <span className="chat-texte">{message.texte}</span>
    </li>
  );
}

/** Suit le bas du flux, sauf si l'on est remonté lire plus haut. */
function Liste({ messages }: { messages: MessageChat[] }): ReactNode {
  const cadre = useRef<HTMLUListElement>(null);
  const colle = useRef(true);
  useEffect(() => {
    const element = cadre.current;
    if (!element || !colle.current) return;
    element.scrollTop = element.scrollHeight;
  }, [messages]);
  const surDefilement = (): void => {
    const element = cadre.current;
    if (!element) return;
    colle.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
  };
  if (messages.length === 0) {
    return <p className="discret vide">Aucun message pour l'instant.</p>;
  }
  return (
    <ul className="chat-flux" ref={cadre} onScroll={surDefilement}>
      {messages.map((message) => <Ligne key={message.sequence} message={message} />)}
    </ul>
  );
}

interface SaisieProps { desactive: boolean; envoi: boolean; onEnvoyer: (texte: string) => Promise<boolean>; }

function Saisie({ desactive, envoi, onEnvoyer }: SaisieProps): ReactNode {
  const [texte, setTexte] = useState("");
  const envoyer = async (): Promise<void> => {
    if (texte.trim().length === 0) return;
    if (await onEnvoyer(texte)) setTexte("");
  };
  const surTouche = (evenement: KeyboardEvent<HTMLInputElement>): void => {
    if (evenement.key !== "Enter") return;
    evenement.preventDefault();
    void envoyer();
  };
  return (
    <div className="chat-saisie">
      <input className="saisie" type="text" value={texte} maxLength={MAX_SAISIE} disabled={desactive}
        placeholder={desactive ? "Chat indisponible" : "Écrire dans le chat…"} spellCheck={false}
        onChange={(e) => setTexte(e.target.value)} onKeyDown={surTouche} />
      <Bouton variante="principal" desactive={desactive || envoi || texte.trim().length === 0}
        onClick={() => void envoyer()}>{envoi ? "Envoi…" : "Envoyer"}</Bouton>
    </div>
  );
}

const LIBELLES: Record<EtatChat["etat"], string> = {
  arrete: "Arrêté",
  connexion: "Connexion…",
  connecte: "Connecté",
  attente: "Reconnexion…",
  refuse: "Interrompu",
};

function Etiquette({ etat }: { etat: EtatChat | null }): ReactNode {
  if (!etat) return <span className="etiquette">Lecture…</span>;
  const classe = etat.etat === "connecte" ? "etiquette ok" : "etiquette attention";
  const suite = etat.etat === "attente" && etat.tentatives > 0 ? ` (${etat.tentatives})` : "";
  return <span className={classe}>{LIBELLES[etat.etat]}{suite}</span>;
}

/** Le compte connecté peut être antérieur à l'ajout des portées de chat : il faut le dire. */
function PorteesAbsentes({ manquantes }: { manquantes: string[] }): ReactNode {
  if (manquantes.length === 0) return null;
  return (
    <div className="alerte info" role="status">
      <span>
        Le compte connecté n'a pas les autorisations du chat (<span className="mono">{manquantes.join(" · ")}</span>).
        Elles sont demandées à l'autorisation : se déconnecter puis reconnecter le compte dans « Compte Twitch »
        pour activer le chat. Rien d'autre n'est perdu — la clé de diffusion et les réglages du live restent.
      </span>
    </div>
  );
}

export function Chat({ portees }: { portees: string[] }): ReactNode {
  const chat = useChat();
  const manquantesLocales = PORTEES_CHAT.filter((portee) => !portees.includes(portee));
  const manquantes = chat.etat?.porteesManquantes.length ? chat.etat.porteesManquantes : manquantesLocales;
  const bloque = manquantes.length > 0;
  const connecte = chat.etat?.etat === "connecte";
  const actions = (
    <>
      <Etiquette etat={chat.etat} />
      {chat.etat?.etat === "refuse" && !bloque
        ? <Bouton petit onClick={() => void chat.relancer()}>Relancer le chat</Bouton>
        : null}
    </>
  );
  return (
    <Section titre="Chat en direct" actions={actions}>
      <PorteesAbsentes manquantes={manquantes} />
      <Alerte message={chat.erreur} onFermer={chat.effacerErreur} />
      {!bloque && chat.etat?.message && !connecte
        ? <Alerte niveau="info" message={chat.etat.message} />
        : null}
      {bloque ? null : <Liste messages={chat.messages} />}
      {bloque ? null : <Saisie desactive={!connecte} envoi={chat.envoi} onEnvoyer={chat.envoyer} />}
    </Section>
  );
}
