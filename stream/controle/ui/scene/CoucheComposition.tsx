/**
 * Couche d'édition posée au-dessus de l'aperçu : une zone de saisie par calque visible,
 * cliquable pour sélectionner et glissable pour déplacer. L'iframe étant d'une autre origine,
 * rien n'y est lu : les zones sont calculées depuis le modèle, dans un conteneur 16/9 identique.
 */
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { Calque } from "../../types.ts";
import { aimanter, SANS_GUIDE, type Guides } from "./aimants.ts";
import { boiteCalque, positionApresGlissement, styleCadre, type Boite, type Position } from "./composition.ts";
import { nomCalque } from "./calques.ts";
import { RATIO_INCONNU, type Ratios } from "./ratiosImages.ts";

interface Props {
  calques: Calque[];
  selection: string | null;
  ratios: Ratios;
  /** Aimantation active : le glissement se colle aux repères du cadre. */
  aimant: boolean;
  verrouille: (id: string) => boolean;
  zone: () => DOMRect | undefined;
  onSelectionner: (id: string) => void;
  onDeplacer: (id: string, position: Position) => void;
  onGuides: (guides: Guides) => void;
}

interface Glissement {
  pointeur: number;
  /** Calque tel qu'au début du glissement : le déplacement est toujours calculé depuis lui. */
  depart: Calque;
  boite: Boite;
  sourisX: number;
  sourisY: number;
  largeur: number;
  hauteur: number;
}

type Souris = PointerEvent<HTMLButtonElement>;

interface Poignees {
  commencer: (e: Souris, calque: Calque, boite: Boite, zone: DOMRect | undefined) => void;
  bouger: (e: Souris) => void;
  finir: (e: Souris) => void;
}

type Options = Pick<Props, "aimant" | "onDeplacer" | "onGuides">;

function useGlissement({ aimant, onDeplacer, onGuides }: Options): Poignees {
  const glissement = useRef<Glissement | null>(null);
  return {
    commencer: (e, calque, boite, zone): void => {
      if (!zone || zone.width <= 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      glissement.current = {
        pointeur: e.pointerId, depart: calque, boite, sourisX: e.clientX, sourisY: e.clientY,
        largeur: zone.width, hauteur: zone.height,
      };
    },
    bouger: (e): void => {
      const g = glissement.current;
      if (!g || g.pointeur !== e.pointerId) return;
      const dx = e.clientX - g.sourisX;
      const dy = e.clientY - g.sourisY;
      const brute = positionApresGlissement(g.depart, dx, dy, g.largeur, g.hauteur);
      const colle = aimant ? aimanter(g.depart, g.boite, brute) : { position: brute, guides: SANS_GUIDE };
      onDeplacer(g.depart.id, colle.position);
      onGuides(colle.guides);
    },
    finir: (e): void => {
      if (glissement.current?.pointeur !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      glissement.current = null;
      onGuides(SANS_GUIDE);
    },
  };
}

interface ZoneProps {
  calque: Calque;
  boite: Boite;
  rang: number;
  actif: boolean;
  survole: boolean;
  verrou: boolean;
  poignees: Poignees;
  zone: () => DOMRect | undefined;
  onSelectionner: () => void;
  onSurvol: (survole: boolean) => void;
}

function classesZone(survole: boolean, verrou: boolean): string {
  return ["cs", survole ? "survol" : "", verrou ? "verrou" : ""].filter(Boolean).join(" ");
}

function ZoneCalque(props: ZoneProps): ReactNode {
  const { calque, boite, rang, actif, survole, verrou, poignees, zone } = props;
  const { onSelectionner, onSurvol } = props;
  const titre = verrou
    ? `${nomCalque(calque)} — verrouillé`
    : `${nomCalque(calque)} — glisser pour déplacer`;
  // Le calque choisi passe au-dessus : sinon un grand calque rendrait un petit insaisissable.
  const style = { ...styleCadre(calque, boite), zIndex: actif ? 999 : rang + 1 };
  return (
    <button
      type="button"
      className={classesZone(survole, verrou)}
      style={style}
      title={titre}
      aria-label={titre}
      onPointerEnter={() => onSurvol(true)}
      onPointerLeave={() => onSurvol(false)}
      onPointerDown={(e) => { onSelectionner(); if (!verrou) poignees.commencer(e, calque, boite, zone()); }}
      onPointerMove={verrou ? undefined : poignees.bouger}
      onPointerUp={verrou ? undefined : poignees.finir}
      onPointerCancel={verrou ? undefined : poignees.finir}
      onClick={onSelectionner}
    />
  );
}

export function CoucheComposition(props: Props): ReactNode {
  const { calques, selection, ratios, aimant, verrouille, zone } = props;
  const { onSelectionner, onDeplacer, onGuides } = props;
  const [survole, setSurvole] = useState<string | null>(null);
  const poignees = useGlissement({ aimant, onDeplacer, onGuides });
  return (
    <div className="composition">
      {calques.map((calque, rang) => (calque.visible ? (
        <ZoneCalque
          key={calque.id} calque={calque} rang={rang} verrou={verrouille(calque.id)}
          actif={calque.id === selection}
          boite={boiteCalque(calque, ratios[calque.fichier ?? ""] ?? RATIO_INCONNU)}
          survole={survole === calque.id} poignees={poignees} zone={zone}
          onSurvol={(dessus) => setSurvole(dessus ? calque.id : null)}
          onSelectionner={() => onSelectionner(calque.id)}
        />
      ) : null))}
    </div>
  );
}
