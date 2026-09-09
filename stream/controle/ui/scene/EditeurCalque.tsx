/** Panneau d'édition du calque choisi : son en-tête, ses outils, et ses champs. */
import type { ReactNode } from "react";
import type { Calque } from "../../types.ts";
import { BoutonIcone, Vide } from "../commun/composants.tsx";
import { Icone } from "../commun/Icones.tsx";
import { ICONES, nomCalque } from "./calques.ts";
import { ChampsCalque } from "./ChampsCalque.tsx";
import type { Media } from "./useFonds.ts";

interface Props {
  calque: Calque | null;
  fonds: Media[];
  verrou: boolean;
  onModifier: (transformer: (c: Calque) => Calque) => void;
  onVerrou: () => void;
  onDupliquer: () => void;
  onSupprimer: () => void;
}

function Tete({ calque, onDupliquer, onSupprimer }: Props): ReactNode {
  return (
    <header className="panneau-tete">
      <div className="editeur-tete">
        <span className="icone-type"><Icone nom={calque === null ? "scene" : ICONES[calque.type]} /></span>
        <h3>{calque === null ? "Aucun calque choisi" : nomCalque(calque)}</h3>
      </div>
      <div className="outils">
        <BoutonIcone nom="copier" titre="Dupliquer" taille="sm" desactive={calque === null}
          onClick={onDupliquer} />
        <BoutonIcone nom="corbeille" titre="Supprimer" taille="sm" variante="danger"
          desactive={calque === null} onClick={onSupprimer} />
      </div>
    </header>
  );
}

export function EditeurCalque(props: Props): ReactNode {
  const { calque, fonds, verrou, onModifier, onVerrou } = props;
  return (
    <section className="panneau">
      <Tete {...props} />
      <div className="panneau-corps">
        {calque === null
          ? <Vide icone="scene"
              message="Choisir un calque dans la pile, ou dans l'aperçu. Le fond se règle à gauche." />
          : (
            <ChampsCalque calque={calque} fonds={fonds} verrou={verrou}
              onModifier={onModifier} onVerrou={onVerrou} />
          )}
      </div>
    </section>
  );
}
