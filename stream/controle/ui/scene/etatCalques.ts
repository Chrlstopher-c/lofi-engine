/**
 * État d'édition de la pile : les gestes sur les calques, et le verrou d'édition.
 * Le verrou ne fait pas partie du modèle enregistré : il vit le temps de la session et
 * empêche réellement l'édition — poignées retirées, glissement refusé, champs désactivés.
 */
import { useCallback, useState } from "react";
import type { Calque, Scene, TypeCalque } from "../../types.ts";
import type { Editeur } from "../commun/useEditeur.ts";
import { deplacer, deplacerVers, dupliquerCalque, nouveauCalque, remplacerCalque } from "./calques.ts";

export interface ActionsCalques {
  ajouter: (type: TypeCalque) => void;
  dupliquer: (id: string) => void;
  supprimer: (id: string) => void;
  /** Monte (1) ou descend (-1) le calque d'un rang dans l'ordre d'empilement. */
  decaler: (id: string, delta: -1 | 1) => void;
  /** Repose le calque contre un autre, dans l'ordre du tableau. */
  reordonner: (id: string, cible: string, apres: boolean) => void;
  basculerVisible: (id: string) => void;
  modifier: (id: string, transformer: (c: Calque) => Calque) => void;
}

type Choisir = (id: string | null) => void;

export function useCalques(editeur: Editeur<Scene>, selection: string | null, choisir: Choisir): ActionsCalques {
  const actuels = editeur.valeur?.calques ?? [];
  const modifierCalques = (transformer: (calques: Calque[]) => Calque[]): void =>
    editeur.definir((s) => ({ ...s, calques: transformer(s.calques) }));
  return {
    ajouter: (type) => {
      const cree = nouveauCalque(type, actuels);
      modifierCalques((l) => [...l, cree]);
      choisir(cree.id);
    },
    dupliquer: (id) => {
      const index = actuels.findIndex((c) => c.id === id);
      const source = actuels[index];
      if (!source) return;
      const copie = dupliquerCalque(source, actuels);
      modifierCalques((l) => [...l.slice(0, index + 1), copie, ...l.slice(index + 1)]);
      choisir(copie.id);
    },
    supprimer: (id) => {
      modifierCalques((l) => l.filter((c) => c.id !== id));
      if (selection === id) choisir(null);
    },
    decaler: (id, delta) => modifierCalques((l) => deplacer(l, l.findIndex((c) => c.id === id), delta)),
    reordonner: (id, cible, apres) => modifierCalques((l) => deplacerVers(l, id, cible, apres)),
    basculerVisible: (id) => modifierCalques((l) => remplacerCalque(l, id, (c) => ({ ...c, visible: !c.visible }))),
    modifier: (id, transformer) => modifierCalques((l) => remplacerCalque(l, id, transformer)),
  };
}

export interface Verrous {
  verrouille: (id: string) => boolean;
  basculer: (id: string) => void;
}

export function useVerrous(): Verrous {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const basculer = useCallback((id: string): void => {
    setIds((actuels) => {
      const suite = new Set(actuels);
      if (!suite.delete(id)) suite.add(id);
      return suite;
    });
  }, []);
  return { verrouille: (id) => ids.has(id), basculer };
}
