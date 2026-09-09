/**
 * État d'un objet édité puis enregistré explicitement : version chargée, version en cours,
 * indicateur de changements non enregistrés, erreur affichable.
 * Après un enregistrement, c'est la version renvoyée par le serveur qui devient l'état.
 */
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { messageErreur } from "./format.ts";

export interface Editeur<T> {
  valeur: T | null;
  modifie: boolean;
  chargement: boolean;
  enregistrement: boolean;
  erreur: string | null;
  definir: (transformer: (actuel: T) => T) => void;
  /** Repart d'une valeur venue d'ailleurs (chargement d'un profil) : elle devient la référence. */
  adopter: (valeur: T) => void;
  recharger: () => Promise<void>;
  enregistrer: () => Promise<boolean>;
  effacerErreur: () => void;
}

interface Options<T> {
  lire: () => Promise<T>;
  /** Envoie la valeur et renvoie la version normalisée par le serveur. */
  ecrire: (valeur: T) => Promise<T>;
}

interface Interne<T> {
  initiale: T | null;
  valeur: T | null;
  chargement: boolean;
  enregistrement: boolean;
  erreur: string | null;
}

type Poser<T> = Dispatch<SetStateAction<Interne<T>>>;
type Drapeau = "chargement" | "enregistrement";

/** Exécute une lecture ou une écriture, pose le résultat (ou l'erreur) dans l'état interne. */
async function appliquer<T>(poser: Poser<T>, drapeau: Drapeau, tache: () => Promise<T>): Promise<boolean> {
  poser((e) => ({ ...e, [drapeau]: true }));
  try {
    const obtenue = await tache();
    poser((e) => ({ ...e, initiale: obtenue, valeur: obtenue, erreur: null, [drapeau]: false }));
    return true;
  } catch (erreur) {
    poser((e) => ({ ...e, erreur: messageErreur(erreur), [drapeau]: false }));
    return false;
  }
}

export function useEditeur<T>({ lire, ecrire }: Options<T>): Editeur<T> {
  const [etat, poser] = useState<Interne<T>>({
    initiale: null, valeur: null, chargement: true, enregistrement: false, erreur: null,
  });

  const recharger = useCallback(async (): Promise<void> => {
    await appliquer(poser, "chargement", lire);
  }, [lire]);

  useEffect(() => {
    void recharger(); // chargement initial ; l'erreur éventuelle est déjà posée dans l'état
  }, [recharger]);

  const enregistrer = useCallback(async (): Promise<boolean> => {
    const valeur = etat.valeur;
    if (valeur === null) return false;
    return appliquer(poser, "enregistrement", () => ecrire(valeur));
  }, [etat.valeur, ecrire]);

  const definir = useCallback((transformer: (actuel: T) => T): void => {
    poser((e) => (e.valeur === null ? e : { ...e, valeur: transformer(e.valeur) }));
  }, []);

  const adopter = useCallback((valeur: T): void => {
    poser((e) => ({ ...e, initiale: valeur, valeur, erreur: null }));
  }, []);

  const modifie = etat.initiale !== null && etat.valeur !== null
    && JSON.stringify(etat.initiale) !== JSON.stringify(etat.valeur);

  return {
    valeur: etat.valeur, modifie, chargement: etat.chargement, enregistrement: etat.enregistrement,
    erreur: etat.erreur, definir, adopter, recharger, enregistrer,
    effacerErreur: () => poser((e) => ({ ...e, erreur: null })),
  };
}
