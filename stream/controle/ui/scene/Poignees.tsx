/**
 * Cadre de sélection posé sur le calque choisi : son nom, ses dimensions à la sortie, et les
 * quatre poignées d'angle. Le modèle ne porte qu'une taille de base, donc l'étirement reste
 * proportionnel — il n'y a pas de poignée de côté, qui laisserait croire à une déformation.
 */
import { useRef, type PointerEvent, type ReactNode } from "react";
import type { Calque } from "../../types.ts";
import { nomCalque } from "./calques.ts";
import { dimensionsSortie, styleCadre, tailleApresEtirement, type Boite } from "./composition.ts";

interface Props {
  calque: Calque;
  boite: Boite;
  verrou: boolean;
  zone: () => DOMRect | undefined;
  onTaille: (taille: number) => void;
}

/** Angle et sens de l'étirement : vers la droite agrandit à l'est, réduit à l'ouest. */
const ANGLES: ReadonlyArray<{ nom: string; signe: 1 | -1 }> = [
  { nom: "nw", signe: -1 },
  { nom: "ne", signe: 1 },
  { nom: "sw", signe: -1 },
  { nom: "se", signe: 1 },
];

interface Etirement {
  pointeur: number;
  depart: Calque;
  boite: Boite;
  sourisX: number;
  largeur: number;
  signe: number;
}

type Souris = PointerEvent<HTMLElement>;

interface Gestes {
  commencer: (e: Souris, signe: number) => void;
  bouger: (e: Souris) => void;
  finir: (e: Souris) => void;
}

function useEtirement({ calque, boite, zone, onTaille }: Omit<Props, "verrou">): Gestes {
  const etirement = useRef<Etirement | null>(null);
  return {
    commencer: (e, signe): void => {
      const rect = zone();
      if (!rect || rect.width <= 0) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      etirement.current = {
        pointeur: e.pointerId, depart: calque, boite, sourisX: e.clientX, largeur: rect.width, signe,
      };
    },
    bouger: (e): void => {
      const g = etirement.current;
      if (!g || g.pointeur !== e.pointerId) return;
      const dx = (e.clientX - g.sourisX) * g.signe;
      onTaille(tailleApresEtirement(g.depart, g.boite, dx, g.largeur));
    },
    finir: (e): void => {
      if (etirement.current?.pointeur !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      etirement.current = null;
    },
  };
}

export function Poignees({ calque, boite, verrou, zone, onTaille }: Props): ReactNode {
  const gestes = useEtirement({ calque, boite, zone, onTaille });
  const dimensions = dimensionsSortie(boite);
  return (
    <div className="poignees visible" style={styleCadre(calque, boite)}>
      <span className="etiquette-selection">{nomCalque(calque)}{verrou ? " · verrouillé" : ""}</span>
      <span className="dims">{dimensions.largeur} × {dimensions.hauteur} px</span>
      {verrou ? null : ANGLES.map((angle) => (
        <i
          key={angle.nom}
          className={`poignee ${angle.nom}`}
          onPointerDown={(e) => gestes.commencer(e, angle.signe)}
          onPointerMove={gestes.bouger}
          onPointerUp={gestes.finir}
          onPointerCancel={gestes.finir}
        />
      ))}
    </div>
  );
}
