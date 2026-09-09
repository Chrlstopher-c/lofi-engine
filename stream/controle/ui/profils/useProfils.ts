/**
 * Profils de scène : la liste servie par l'API et les opérations dessus.
 * Enregistrer ne change pas la scène diffusée ; charger la remplace.
 */
import { useCallback, useEffect, useState } from "react";
import type { Scene } from "../../types.ts";
import type { Profil } from "../../profils.ts";
import { api } from "../commun/api.ts";
import { messageErreur } from "../commun/format.ts";

export interface Profils {
  liste: Profil[];
  erreur: string | null;
  occupe: boolean;
  recharger: () => Promise<void>;
  /** Renvoie le profil écrit, ou null si l'enregistrement a échoué. */
  enregistrer: (nom: string, scene: Scene) => Promise<Profil | null>;
  /** Renvoie la scène désormais diffusée, ou null si le chargement a échoué. */
  charger: (nom: string) => Promise<Scene | null>;
  supprimer: (nom: string) => Promise<void>;
  effacerErreur: () => void;
}

interface Base {
  liste: Profil[];
  erreur: string | null;
  setErreur: (e: string | null) => void;
  recharger: () => Promise<void>;
}

function useListe(): Base {
  const [liste, setListe] = useState<Profil[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const recharger = useCallback(async (): Promise<void> => {
    try {
      setListe(await api.listerProfils());
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);
  useEffect(() => { void recharger(); }, [recharger]); // chargement initial ; l'erreur va dans l'état
  return { liste, erreur, setErreur, recharger };
}

export function useProfils(): Profils {
  const { liste, erreur, setErreur, recharger } = useListe();
  const [occupe, setOccupe] = useState(false);

  /** Exécute une opération, puis recharge la liste quoi qu'il arrive. */
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
      await recharger();
    }
  }, [recharger, setErreur]);

  return {
    liste, erreur, occupe, recharger,
    enregistrer: (nom, scene) => operer(() => api.enregistrerProfil(nom, scene)),
    charger: (nom) => operer(() => api.chargerProfil(nom)),
    supprimer: async (nom) => { await operer(() => api.supprimerProfil(nom)); },
    effacerErreur: () => setErreur(null),
  };
}
