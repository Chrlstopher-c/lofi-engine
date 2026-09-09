/**
 * Lecture du chat par interrogation périodique du centre de contrôle.
 *
 * Le relais est volontairement un simple appel répété plutôt qu'un flux d'évènements : la
 * connexion IRC vit côté serveur, l'interface n'a donc rien à reconnecter ni à resynchroniser.
 * Chaque appel renvoie le numéro du dernier message reçu et ne rapporte que la suite — une
 * lecture à vide coûte une ligne de JSON. Deux secondes tant que le chat est connecté, dix
 * sinon : aucun appel en rafale.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { EtatChat, MessageChat } from "../../twitch/types.ts";
import { apiTwitch } from "./api-twitch.ts";
import { messageErreur } from "../commun/format.ts";

const CADENCE_ACTIVE_MS = 2_000;
const CADENCE_REPOS_MS = 10_000;
/** Même plafond que le tampon du serveur : le flux est infini, la mémoire ne l'est pas. */
const MAX_AFFICHES = 300;

export interface Chat {
  messages: MessageChat[];
  etat: EtatChat | null;
  erreur: string | null;
  envoi: boolean;
  /** Vrai si le message est parti ; l'erreur est déjà affichée sinon. */
  envoyer: (texte: string) => Promise<boolean>;
  relancer: () => Promise<void>;
  effacerErreur: () => void;
}

interface Flux {
  messages: MessageChat[];
  etat: EtatChat | null;
  erreur: string | null;
  setErreur: (erreur: string | null) => void;
  lire: () => Promise<void>;
}

/** Le flux et sa cadence : rapide quand le chat est connecté, lente sinon. */
function useFlux(): Flux {
  const [messages, setMessages] = useState<MessageChat[]>([]);
  const [etat, setEtat] = useState<EtatChat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Dernier numéro reçu, hors état de rendu : le faire varier ne doit pas relancer la boucle. */
  const dernier = useRef(0);

  const lire = useCallback(async (): Promise<void> => {
    try {
      const lot = await apiTwitch.lireChat(dernier.current);
      dernier.current = lot.sequence;
      setEtat(lot.etat);
      setErreur(null);
      if (lot.messages.length === 0 && !lot.tronque) return;
      // Un lot tronqué signale un trou : on repart de ce que le serveur a encore, sans
      // recoller deux morceaux qui ne se suivent pas.
      setMessages((actuels) => (lot.tronque ? lot.messages : [...actuels, ...lot.messages]).slice(-MAX_AFFICHES));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);

  const cadence = etat?.etat === "connecte" ? CADENCE_ACTIVE_MS : CADENCE_REPOS_MS;

  useEffect(() => {
    void lire(); // première lecture ; c'est elle qui fait ouvrir la connexion côté serveur
    const minuteur = window.setInterval(() => void lire(), cadence);
    return () => window.clearInterval(minuteur);
  }, [cadence, lire]);

  return { messages, etat, erreur, setErreur, lire };
}

export function useChat(): Chat {
  const { messages, etat, erreur, setErreur, lire } = useFlux();
  const [envoi, setEnvoi] = useState(false);

  const envoyer = useCallback(async (texte: string): Promise<boolean> => {
    setEnvoi(true);
    try {
      await apiTwitch.envoyerChat(texte);
      setErreur(null);
      await lire();
      return true;
    } catch (e) {
      setErreur(messageErreur(e));
      return false;
    } finally {
      setEnvoi(false);
    }
  }, [lire, setErreur]);

  const relancer = useCallback(async (): Promise<void> => {
    try {
      await apiTwitch.relancerChat();
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
    await lire();
  }, [lire, setErreur]);

  return { messages, etat, erreur, envoi, envoyer, relancer, effacerErreur: () => setErreur(null) };
}
