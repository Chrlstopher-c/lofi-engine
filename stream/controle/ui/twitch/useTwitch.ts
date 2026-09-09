/**
 * Compte Twitch : état de la connexion et actions dessus.
 * L'état est relu toutes les 30 s, et toutes les 2 s seulement pendant qu'un code
 * d'activation est en attente — cette lecture-là ne touche pas l'API de Twitch, elle
 * interroge le centre de contrôle.
 */
import { useCallback, useEffect, useState } from "react";
import type { EtatTwitch } from "../../twitch/types.ts";
import { apiTwitch } from "./api-twitch.ts";
import { messageErreur } from "../commun/format.ts";

const ATTENTE_MS = 2_000;
const REPOS_MS = 30_000;

export interface Twitch {
  etat: EtatTwitch | null;
  erreur: string | null;
  occupe: boolean;
  rafraichir: () => Promise<void>;
  enregistrerApplication: (clientId: string) => Promise<void>;
  connecter: () => Promise<void>;
  annuler: () => Promise<void>;
  deconnecter: () => Promise<void>;
  /** Vrai si la clé a bien été déposée dans le `.env`. */
  recupererCle: () => Promise<boolean>;
  effacerErreur: () => void;
}

interface Lecture {
  etat: EtatTwitch | null;
  erreur: string | null;
  setErreur: (e: string | null) => void;
  rafraichir: () => Promise<void>;
}

/** Lecture de l'état et cadence de relecture : rapide pendant l'attente d'un code, lente sinon. */
function useLecture(): Lecture {
  const [etat, setEtat] = useState<EtatTwitch | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const rafraichir = useCallback(async (): Promise<void> => {
    try {
      setEtat(await apiTwitch.lireEtat());
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);

  useEffect(() => { void rafraichir(); }, [rafraichir]); // première lecture

  const cadence = etat?.connexion?.statut === "attente" ? ATTENTE_MS : REPOS_MS;
  useEffect(() => {
    const minuteur = window.setInterval(() => void rafraichir(), cadence);
    return () => window.clearInterval(minuteur);
  }, [cadence, rafraichir]);

  return { etat, erreur, setErreur, rafraichir };
}

export function useTwitch(): Twitch {
  const { etat, erreur, setErreur, rafraichir } = useLecture();
  const [occupe, setOccupe] = useState(false);

  /** Exécute une action, remonte son erreur, et relit l'état quoi qu'il arrive. */
  const operer = useCallback(async <T>(tache: () => Promise<T>): Promise<T | null> => {
    setOccupe(true);
    try {
      const resultat = await tache();
      setErreur(null);
      return resultat;
    } catch (e) {
      setErreur(messageErreur(e));
      return null;
    } finally {
      setOccupe(false);
      await rafraichir();
    }
  }, [rafraichir, setErreur]);

  return {
    etat, erreur, occupe, rafraichir,
    enregistrerApplication: async (clientId) => { await operer(() => apiTwitch.enregistrerApplication(clientId)); },
    connecter: async () => { await operer(apiTwitch.connecter); },
    annuler: async () => { await operer(apiTwitch.annulerConnexion); },
    deconnecter: async () => { await operer(apiTwitch.deconnecter); },
    recupererCle: async () => (await operer(apiTwitch.recupererCle))?.cleEnregistree === true,
    effacerErreur: () => setErreur(null),
  };
}
