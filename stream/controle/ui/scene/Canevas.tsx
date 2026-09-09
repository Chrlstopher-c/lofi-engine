/** Colonne centrale : l'aperçu, sa barre d'outils, son état, l'alignement et les compositions. */
import { useState, type ReactNode } from "react";
import type { Calque, Scene } from "../../types.ts";
import type { Editeur } from "../commun/useEditeur.ts";
import { Alerte } from "../commun/composants.tsx";
import { aligner, type Alignement } from "./aimants.ts";
import { Apercu } from "./Apercu.tsx";
import { useApercuDirect, type ApercuDirect } from "./apercuDirect.ts";
import { BarreAlignement } from "./BarreAlignement.tsx";
import { BarreCanevas } from "./BarreCanevas.tsx";
import { boiteCalque, type Position } from "./composition.ts";
import { Compositions } from "./Compositions.tsx";
import { nomCalque } from "./calques.ts";
import { RATIO_INCONNU, useRatiosImages, type Ratios } from "./ratiosImages.ts";
import { useOptionsCanevas, type OptionsCanevas } from "./optionsCanevas.ts";
import type { ActionsCalques, Verrous } from "./etatCalques.ts";

interface Props {
  scene: Scene;
  editeur: Editeur<Scene>;
  selection: string | null;
  calque: Calque | null;
  verrous: Verrous;
  actions: ActionsCalques;
  onSelectionner: (id: string) => void;
}

interface EtatProps {
  curseur: Position | null;
  nom: string | null;
  aimant: boolean;
  pilote: boolean;
}

function EtatCanevas({ curseur, nom, aimant, pilote }: EtatProps): ReactNode {
  return (
    <div className="canevas-etat">
      <span>Cadre <b>16 / 9</b></span>
      <span>Curseur <b>{curseur ? `${curseur.x} / ${curseur.y} %` : "—"}</b></span>
      <span>Sélection <b>{nom ?? "aucune"}</b></span>
      <span>Aimantation <b>{aimant ? "active" : "désactivée"}</b></span>
      <span className="pousse">
        {pilote ? "Aperçu de l'édition en cours" : "Aperçu de la version enregistrée"}
      </span>
    </div>
  );
}

interface Atelier {
  options: OptionsCanevas;
  direct: ApercuDirect;
  ratios: Ratios;
  curseur: Position | null;
  setCurseur: (position: Position | null) => void;
  verrou: boolean;
  positionner: (id: string, position: Position) => void;
  surAlignement: (cible: Alignement) => void;
}

function useCanevas({ scene, calque, verrous, actions }: Props): Atelier {
  const options = useOptionsCanevas();
  const direct = useApercuDirect(scene);
  const ratios = useRatiosImages(scene.calques);
  const [curseur, setCurseur] = useState<Position | null>(null);
  const positionner = (id: string, p: Position): void =>
    actions.modifier(id, (c) => ({ ...c, x: p.x, y: p.y }));
  const surAlignement = (cible: Alignement): void => {
    if (calque === null) return;
    const boite = boiteCalque(calque, ratios[calque.fichier ?? ""] ?? RATIO_INCONNU);
    positionner(calque.id, aligner(calque, boite, cible));
  };
  const verrou = calque !== null && verrous.verrouille(calque.id);
  return { options, direct, ratios, curseur, setCurseur, verrou, positionner, surAlignement };
}

export function Canevas(props: Props): ReactNode {
  const { scene, editeur, selection, calque, verrous, actions, onSelectionner } = props;
  const atelier = useCanevas(props);
  const { options, direct, ratios, curseur, setCurseur, verrou } = atelier;
  const nom = calque === null ? null : nomCalque(calque);
  return (
    <div className="canevas">
      <Alerte message={editeur.erreur} onFermer={editeur.effacerErreur} />
      <Alerte message={direct.erreur} niveau="attention" />
      <BarreCanevas modifie={editeur.modifie} options={options} />
      <Apercu
        scene={scene} direct={direct} options={options} selection={selection} calque={calque}
        verrous={verrous} ratios={ratios} onSelectionner={onSelectionner} onCurseur={setCurseur}
        onDeplacer={atelier.positionner}
        onTaille={(id, taille) => actions.modifier(id, (c) => ({ ...c, taille }))}
      />
      <EtatCanevas curseur={curseur} aimant={options.aimant} pilote={direct.pilote} nom={nom} />
      <BarreAlignement
        nom={nom} verrou={verrou} modifie={editeur.modifie} enregistrement={editeur.enregistrement}
        onAligner={atelier.surAlignement}
        onAnnuler={() => void editeur.recharger()}
        onEnregistrer={() => void editeur.enregistrer()}
      />
      <Compositions scene={scene} modifie={editeur.modifie} onCharge={editeur.adopter} />
    </div>
  );
}
