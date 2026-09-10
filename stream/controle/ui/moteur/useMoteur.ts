/**
 * Les réglages de la génération musicale, appliqués à chaud.
 *
 * Pas de bouton « Enregistrer » : le moteur relit ses réglages toutes les secondes et demie,
 * donc un curseur déplacé s'entend dans la foulée. L'écriture est retardée le temps que la
 * main s'arrête — sans ça, un curseur traîné écrirait cinquante fois le fichier que le moteur
 * est en train de lire.
 */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { requete, corpsJson } from "../commun/api.ts";
import type { Reglages } from "../../../../src/lib/engine/Reglages.ts";

interface EtatMoteur {
  reglages: Reglages;
  types: string[];
}

const REPOS_MS = 400;

export interface Moteur {
  reglages: Reglages | null;
  types: string[];
  erreur: string | null;
  /** true tant que la dernière modification n'a pas été acquittée par le serveur. */
  enVol: boolean;
  modifier: (champ: keyof Reglages, valeur: Reglages[keyof Reglages]) => void;
  choisirType: (nom: string) => void;
}

/** Première lecture, une seule fois, en ignorant la réponse si le panneau a disparu entre-temps. */
function usePremiereLecture(
  poser: (etat: EtatMoteur) => void,
  echouer: (message: string) => void,
  nettoyer: () => void,
): void {
  useEffect(() => {
    let vivant = true;
    void requete<EtatMoteur>("/api/moteur")
      .then((e) => { if (vivant) poser(e); })
      .catch((e: unknown) => { if (vivant) echouer(String(e)); });
    return () => { vivant = false; nettoyer(); };
    // Volontairement une seule fois : les réglages ne changent que par cette interface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** L'écriture vers le serveur : immédiate pour un type, retardée pour un curseur qu'on traîne. */
function useEnvoi(
  minuteur: MutableRefObject<number | null>,
  dernier: MutableRefObject<Reglages | null>,
  setReglages: (r: Reglages) => void,
  setErreur: (e: string | null) => void,
  setEnVol: (v: boolean) => void,
): { envoyer: (r: Reglages) => void; programmer: (r: Reglages) => void } {
  const envoyer = useCallback((suivants: Reglages) => {
    setEnVol(true);
    void requete<EtatMoteur>("/api/moteur", corpsJson("PUT", suivants))
      .then((e) => {
        dernier.current = e.reglages;
        // Le serveur borne : on reprend ce qu'il a réellement retenu, pas ce qu'on a demandé.
        setReglages(e.reglages);
        setErreur(null);
      })
      .catch((e: unknown) => setErreur(String(e)))
      .finally(() => setEnVol(false));
  }, [dernier, setReglages, setErreur, setEnVol]);

  const programmer = useCallback((suivants: Reglages) => {
    setReglages(suivants);
    if (minuteur.current !== null) window.clearTimeout(minuteur.current);
    minuteur.current = window.setTimeout(() => envoyer(suivants), REPOS_MS);
  }, [envoyer, minuteur, setReglages]);

  return { envoyer, programmer };
}

export function useMoteur(): Moteur {
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enVol, setEnVol] = useState(false);
  const minuteur = useRef<number | null>(null);
  const dernier = useRef<Reglages | null>(null);

  usePremiereLecture(
    (e) => { setReglages(e.reglages); dernier.current = e.reglages; setTypes(e.types); },
    setErreur,
    () => { if (minuteur.current !== null) window.clearTimeout(minuteur.current); },
  );

  const { envoyer, programmer } = useEnvoi(minuteur, dernier, setReglages, setErreur, setEnVol);

  const modifier = useCallback((champ: keyof Reglages, valeur: Reglages[keyof Reglages]) => {
    if (!reglages) return;
    programmer({ ...reglages, [champ]: valeur } as Reglages);
  }, [reglages, programmer]);

  const choisirType = useCallback((nom: string) => {
    // Un type nommé remet TOUT à ses valeurs : c'est le serveur qui les connaît.
    if (minuteur.current !== null) window.clearTimeout(minuteur.current);
    envoyer({ type: nom } as unknown as Reglages);
  }, [envoyer, minuteur]);

  return { reglages, types, erreur, enVol, modifier, choisirType };
}
