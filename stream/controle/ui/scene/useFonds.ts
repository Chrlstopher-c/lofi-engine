/** Fichiers de fond disponibles et opérations dessus : dépôt, suppression, rechargement. */
import { useCallback, useEffect, useState } from "react";
import { api, type ImageFond } from "../commun/api.ts";
import { messageErreur } from "../commun/format.ts";

/** Un fond servi par l'API, plus la nature du fichier : une vidéo ne s'affiche pas comme une image. */
export interface Media {
  fichier: string;
  octets: number;
  video: boolean;
  /** Vidéo ou GIF : le fichier bouge tout seul, la galerie le signale. */
  anime: boolean;
  /** Extension en majuscules, sans le point. */
  format: string;
}

/** Mêmes extensions que stream/controle/fonds.ts, qui décide de ce que le serveur accepte. */
const VIDEOS = ["mp4", "webm", "m4v"];

function classer(fond: ImageFond): Media {
  const point = fond.fichier.lastIndexOf(".");
  const format = point < 0 ? "" : fond.fichier.slice(point + 1).toLowerCase();
  const video = VIDEOS.includes(format);
  return { fichier: fond.fichier, octets: fond.octets, video, anime: video || format === "gif",
    format: format.toUpperCase() };
}

export interface Fonds {
  liste: Media[];
  erreur: string | null;
  chargement: boolean;
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
  liste: Media[];
  erreur: string | null;
  chargement: boolean;
  setErreur: (e: string | null) => void;
  recharger: () => Promise<void>;
}

function useListe(): Base {
  const [liste, setListe] = useState<Media[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const recharger = useCallback(async (): Promise<void> => {
    try {
      setListe((await api.listerFonds()).map(classer));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { void recharger(); }, [recharger]); // chargement initial ; l'erreur va dans l'état
  return { liste, erreur, chargement, setErreur, recharger };
}

export function useFonds(): Fonds {
  const { liste, erreur, chargement, setErreur, recharger } = useListe();
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
    const message = `Supprimer « ${fichier} » du corpus ? Le fichier ne sera plus disponible pour la scène.`;
    if (!window.confirm(message)) return;
    await operer(() => api.supprimerFond(fichier));
  }, [operer]);

  return { liste, erreur, chargement, occupe, recharger, deposer, supprimer,
    effacerErreur: () => setErreur(null) };
}
