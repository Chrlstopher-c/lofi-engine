/**
 * Couche d'édition posée au-dessus de l'aperçu : un cadre par calque visible, cliquable pour
 * sélectionner et glissable pour déplacer. L'iframe étant d'une autre origine, rien n'est lu
 * dedans : les cadres sont calculés depuis le modèle, dans un conteneur de mêmes proportions.
 */
import { useRef, type PointerEvent, type ReactNode } from "react";
import type { Calque } from "../../types.ts";
import { boiteCalque, positionApresGlissement, styleCadre, type Position } from "./composition.ts";
import { RATIO_INCONNU, type Ratios } from "./ratiosImages.ts";

interface Props {
  calques: Calque[];
  selection: string | null;
  ratios: Ratios;
  onSelectionner: (id: string) => void;
  onDeplacer: (id: string, position: Position) => void;
}

interface Glissement {
  pointeur: number;
  /** Calque tel qu'au début du glissement : le déplacement est toujours calculé depuis lui. */
  depart: Calque;
  sourisX: number;
  sourisY: number;
  largeur: number;
  hauteur: number;
}

type Souris = PointerEvent<HTMLButtonElement>;

interface Poignees {
  commencer: (e: Souris, calque: Calque, zone: DOMRect | undefined) => void;
  bouger: (e: Souris) => void;
  finir: (e: Souris) => void;
}

function useGlissement(onDeplacer: Props["onDeplacer"]): Poignees {
  const glissement = useRef<Glissement | null>(null);
  return {
    commencer: (e, calque, zone): void => {
      if (!zone || zone.width <= 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      glissement.current = {
        pointeur: e.pointerId, depart: calque, sourisX: e.clientX, sourisY: e.clientY,
        largeur: zone.width, hauteur: zone.height,
      };
    },
    bouger: (e): void => {
      const g = glissement.current;
      if (!g || g.pointeur !== e.pointerId) return;
      const dx = e.clientX - g.sourisX;
      const dy = e.clientY - g.sourisY;
      onDeplacer(g.depart.id, positionApresGlissement(g.depart, dx, dy, g.largeur, g.hauteur));
    },
    finir: (e): void => {
      if (glissement.current?.pointeur !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      glissement.current = null;
    },
  };
}

interface CadreProps {
  calque: Calque;
  actif: boolean;
  rang: number;
  ratio: number;
  poignees: Poignees;
  zone: () => DOMRect | undefined;
  onSelectionner: () => void;
}

function Cadre({ calque, actif, rang, ratio, poignees, zone, onSelectionner }: CadreProps): ReactNode {
  const style = { ...styleCadre(calque, boiteCalque(calque, ratio)), zIndex: actif ? 999 : rang + 1 };
  return (
    <button
      type="button"
      className={actif ? "cadre-calque actif" : "cadre-calque"}
      style={style}
      title={`${calque.nom || calque.id} — glisser pour déplacer`}
      aria-pressed={actif}
      onPointerDown={(e) => { onSelectionner(); poignees.commencer(e, calque, zone()); }}
      onPointerMove={poignees.bouger}
      onPointerUp={poignees.finir}
      onPointerCancel={poignees.finir}
      onClick={onSelectionner}
    >
      <span className="cadre-nom">{calque.nom || calque.id}</span>
    </button>
  );
}

export function CoucheComposition(props: Props): ReactNode {
  const { calques, selection, ratios, onSelectionner, onDeplacer } = props;
  const couche = useRef<HTMLDivElement | null>(null);
  const poignees = useGlissement(onDeplacer);
  const zone = (): DOMRect | undefined => couche.current?.getBoundingClientRect();
  return (
    <div className="composition" ref={couche}>
      {calques.map((calque, rang) => (calque.visible ? (
        <Cadre
          key={calque.id} calque={calque} rang={rang} actif={calque.id === selection}
          ratio={ratios[calque.fichier ?? ""] ?? RATIO_INCONNU} poignees={poignees} zone={zone}
          onSelectionner={() => onSelectionner(calque.id)}
        />
      ) : null))}
    </div>
  );
}
