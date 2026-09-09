/** Liste des images de fond et opérations dessus : dépôt, suppression, rechargement. */
import { useCallback, useEffect, useState } from "react";
import { api, type ImageFond } from "../commun/api.ts";
import { messageErreur } from "../commun/format.ts";

export interface Fonds {
  liste: ImageFond[];
  erreur: string | null;
  occupe: boolean;
  recharger: () => Promise<void>;
  deposer: (fichiers: File[]) => Promise<void>;
  supprimer: (fichier: string) => Promise<void>;
  effacerErreur: () => void;
}

async function deposerTous(fichiers: File[]): Promise<void> {
  for (const f of fichiers) await api.deposerFond(f);
}

interface Base {
  liste: ImageFond[];
  erreur: string | null;
  setErreur: (e: string | null) => void;
  recharger: () => Promise<void>;
}

function useListe(): Base {
  const [liste, setListe] = useState<ImageFond[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const recharger = useCallback(async (): Promise<void> => {
    try {
      setListe(await api.listerFonds());
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);
  useEffect(() => { void recharger(); }, [recharger]); // chargement initial ; l'erreur va dans l'état
  return { liste, erreur, setErreur, recharger };
}

export function useFonds(): Fonds {
  const { liste, erreur, setErreur, recharger } = useListe();
  const [occupe, setOccupe] = useState(false);

  /** Exécute une opération puis recharge la liste, quoi qu'il arrive. */
  const operer = useCallback(async (tache: () => Promise<unknown>): Promise<void> => {
    setOccupe(true);
    try {
      await tache();
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
      await recharger();
    }
  }, [recharger, setErreur]);

  const deposer = useCallback((fichiers: File[]) => operer(() => deposerTous(fichiers)), [operer]);
  const supprimer = useCallback(async (fichier: string): Promise<void> => {
    const message = `Supprimer « ${fichier} » du corpus ? L'image ne sera plus disponible pour la scène.`;
    if (!window.confirm(message)) return;
    await operer(() => api.supprimerFond(fichier));
  }, [operer]);

  return { liste, erreur, occupe, recharger, deposer, supprimer, effacerErreur: () => setErreur(null) };
}
