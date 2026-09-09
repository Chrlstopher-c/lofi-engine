/**
 * Chat en direct, colonne pleine hauteur : on le lit, on y écrit.
 * Le jeton reste au serveur — cette interface ne parle qu'au centre de contrôle, et n'affiche
 * que des messages déjà nettoyés.
 *
 * Le texte d'un message est écrit par des inconnus : il est rendu comme du texte, jamais comme
 * du balisage. La couleur, elle, est revérifiée ici avant d'entrer dans un style.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { EtatChat, MessageChat } from "../../twitch/types.ts";
import { Alerte, Badge, Bouton, Vide } from "../commun/composants.tsx";
import { Icone } from "../commun/Icones.tsx";
import { heureLisible } from "./format-twitch.ts";
import { useChat } from "./useChat.ts";

const PORTEES_CHAT = ["chat:read", "chat:edit"];
const FORME_COULEUR = /^#[0-9a-f]{6}$/i;
const MAX_SAISIE = 480;

/** Une couleur venue du réseau n'entre dans un style qu'après vérification de sa forme. */
function couleurSure(couleur: string | null): string | undefined {
  return couleur && FORME_COULEUR.test(couleur) ? couleur : undefined;
}

function classeMessage(message: MessageChat, moi: string): string {
  if (message.systeme) return "message systeme";
  if (moi && message.auteur.toLowerCase() === moi.toLowerCase()) return "message moi";
  return "message";
}

function Ligne({ message, moi }: { message: MessageChat; moi: string }): ReactNode {
  const heure = heureLisible(message.horodatage);
  return (
    <div className={classeMessage(message, moi)}>
      <span className="av" aria-hidden="true">{message.auteur.slice(0, 1).toLowerCase()}</span>
      <span className="corps">
        <span className="auteur" style={{ color: couleurSure(message.couleur) }}>{message.auteur}</span>
        <span className="texte">{message.texte}</span>
        {heure ? <span className="heure">{heure}</span> : null}
      </span>
    </div>
  );
}

/** Suit le bas du flux, sauf si l'on est remonté lire plus haut. */
function Flux({ messages, moi }: { messages: MessageChat[]; moi: string }): ReactNode {
  const cadre = useRef<HTMLDivElement>(null);
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
  return (
    <div className="chat-flux" ref={cadre} onScroll={surDefilement}>
      {messages.length === 0
        ? <Vide icone="texte" message="Aucun message pour l'instant." />
        : messages.map((message) => <Ligne key={message.sequence} message={message} moi={moi} />)}
    </div>
  );
}

interface SaisieProps {
  desactive: boolean;
  envoi: boolean;
  moi: string;
  onEnvoyer: (texte: string) => Promise<boolean>;
}

function Saisie({ desactive, envoi, moi, onEnvoyer }: SaisieProps): ReactNode {
  const [texte, setTexte] = useState("");
  const envoyer = async (): Promise<void> => {
    if (texte.trim().length === 0) return;
    if (await onEnvoyer(texte)) setTexte("");
  };
  const soumettre = (evenement: FormEvent<HTMLFormElement>): void => {
    evenement.preventDefault();
    void envoyer();
  };
  return (
    <form className="panneau-pied chat-saisie" onSubmit={soumettre}>
      <input className="ctrl" type="text" value={texte} maxLength={MAX_SAISIE} disabled={desactive}
        placeholder={desactive ? "Chat indisponible" : "Écrire dans le chat…"} spellCheck={false}
        autoComplete="off" aria-label="Message à envoyer dans le chat"
        onChange={(e) => setTexte(e.target.value)} />
      <Bouton variante="principal" desactive={desactive || texte.trim().length === 0} encours={envoi}
        onClick={() => void envoyer()}>Envoyer</Bouton>
      <span className="aide">
        {moi ? <>Envoyé en tant que <b>{moi}</b> · </> : null}<kbd>Entrée</kbd> pour envoyer
      </span>
    </form>
  );
}

const LIBELLES: Readonly<Record<EtatChat["etat"], string>> = {
  arrete: "arrêté",
  connexion: "connexion…",
  connecte: "connecté",
  attente: "reconnexion…",
  refuse: "interrompu",
};

function Etat({ etat }: { etat: EtatChat | null }): ReactNode {
  if (!etat) return <Badge>lecture…</Badge>;
  const sens = etat.etat === "connecte" ? "ok" : "warn";
  const suite = etat.etat === "attente" && etat.tentatives > 0 ? ` (${etat.tentatives})` : "";
  return <Badge sens={sens} voyant>{LIBELLES[etat.etat]}{suite}</Badge>;
}

/** Le compte connecté peut être antérieur à l'ajout des portées de chat : il faut le dire. */
function PorteesAbsentes({ manquantes }: { manquantes: string[] }): ReactNode {
  return (
    <div className="avis info" role="status">
      <Icone nom="info" />
      <span>
        Le compte connecté n'a pas les autorisations du chat
        (<span className="mono">{manquantes.join(" · ")}</span>). Elles sont demandées à l'autorisation :
        se déconnecter puis reconnecter le compte pour activer le chat. Rien d'autre n'est perdu — la clé
        de diffusion et les réglages du direct restent.
      </span>
    </div>
  );
}

export function Chat({ portees, moi }: { portees: string[]; moi: string }): ReactNode {
  const chat = useChat();
  const manquantesLocales = PORTEES_CHAT.filter((portee) => !portees.includes(portee));
  const manquantes = chat.etat?.porteesManquantes.length ? chat.etat.porteesManquantes : manquantesLocales;
  const bloque = manquantes.length > 0;
  const connecte = chat.etat?.etat === "connecte";
  const chaine = chat.etat?.chaine ?? "";
  // Message d'état du serveur : utile seulement tant que le chat n'est pas connecté.
  const avisEtat = !bloque && !connecte ? chat.etat?.message ?? null : null;
  const avis = chat.erreur !== null || avisEtat !== null;
  return (
    <section className="panneau chat">
      <header className="panneau-tete">
        <h2>Chat</h2>
        <Etat etat={chat.etat} />
        {chaine ? <span className="compte">#{chaine}</span> : null}
        {chat.etat?.etat === "refuse" && !bloque
          ? <div className="outils">
              <Bouton petit onClick={() => void chat.relancer()}>Relancer</Bouton>
            </div>
          : null}
      </header>
      {bloque ? <div className="panneau-corps"><PorteesAbsentes manquantes={manquantes} /></div> : null}
      {avis
        ? <div className="panneau-corps">
            <Alerte message={chat.erreur} onFermer={chat.effacerErreur} />
            {!chat.erreur && avisEtat ? <Alerte niveau="info" message={avisEtat} /> : null}
          </div>
        : null}
      {bloque ? null : <Flux messages={chat.messages} moi={moi} />}
      {bloque ? null : <Saisie desactive={!connecte} envoi={chat.envoi} moi={moi} onEnvoyer={chat.envoyer} />}
    </section>
  );
}
