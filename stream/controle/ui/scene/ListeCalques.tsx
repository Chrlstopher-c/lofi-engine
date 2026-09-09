/** Liste ordonnée des calques : le dernier de la liste est au-dessus des autres. */
import type { ReactNode } from "react";
import type { Calque, TypeCalque } from "../../types.ts";
import { Bouton, Selection } from "../commun/composants.tsx";
import { TYPES, libelleType } from "./calques.ts";

interface Props {
  calques: Calque[];
  selection: string | null;
  onSelectionner: (id: string) => void;
  onDeplacer: (index: number, delta: -1 | 1) => void;
  onBasculerVisible: (id: string) => void;
  onDupliquer: (id: string) => void;
  onSupprimer: (id: string) => void;
  onAjouter: (type: TypeCalque) => void;
}

interface LigneProps {
  calque: Calque;
  index: number;
  total: number;
  actif: boolean;
  actions: Props;
}

function Ligne({ calque, index, total, actif, actions }: LigneProps): ReactNode {
  return (
    <li className={actif ? "calque actif" : "calque"} onClick={() => actions.onSelectionner(calque.id)}>
      <button
        type="button"
        className={calque.visible ? "oeil" : "oeil ferme"}
        title={calque.visible ? "Masquer" : "Afficher"}
        onClick={(e) => { e.stopPropagation(); actions.onBasculerVisible(calque.id); }}
      >
        {calque.visible ? "●" : "○"}
      </button>
      <span className="calque-nom">{calque.nom || calque.id}</span>
      <span className="calque-type">{libelleType(calque.type)}</span>
      <span className="calque-outils" onClick={(e) => e.stopPropagation()}>
        <Bouton petit variante="discret" titre="Descendre d'un cran" desactive={index === 0}
          onClick={() => actions.onDeplacer(index, -1)}>↓</Bouton>
        <Bouton petit variante="discret" titre="Monter d'un cran" desactive={index === total - 1}
          onClick={() => actions.onDeplacer(index, 1)}>↑</Bouton>
        <Bouton petit variante="discret" titre="Dupliquer" onClick={() => actions.onDupliquer(calque.id)}>⧉</Bouton>
        <Bouton petit variante="discret" titre="Supprimer" onClick={() => actions.onSupprimer(calque.id)}>×</Bouton>
      </span>
    </li>
  );
}

export function ListeCalques(props: Props): ReactNode {
  const { calques, selection, onAjouter } = props;
  // Affichée de haut en bas dans l'ordre d'empilement : le dernier du tableau en tête.
  const ordonnes = calques.map((c, index) => ({ c, index })).reverse();
  return (
    <div className="liste-calques">
      {calques.length === 0 ? <p className="discret vide">Aucun calque : la scène ne montre que le fond.</p> : null}
      <ul>
        {ordonnes.map(({ c, index }) => (
          <Ligne key={c.id} calque={c} index={index} total={calques.length}
            actif={c.id === selection} actions={props} />
        ))}
      </ul>
      <div className="ajout-calque">
        <span className="discret">Ajouter</span>
        <Selection<TypeCalque | ""> valeur="" onChange={(t) => { if (t) onAjouter(t); }}
          options={[{ valeur: "", libelle: "un calque…" }, ...TYPES]} />
      </div>
    </div>
  );
}
