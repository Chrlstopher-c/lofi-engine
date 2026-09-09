/**
 * Réglages d'affichage du canevas : surcouches, aimantation, zoom. Rien n'est enregistré,
 * ce sont des aides à l'édition.
 */
import { useState } from "react";

/**
 * Le zoom réduit seulement : `.espace-canevas` masque ce qui dépasse, un agrandissement
 * rognerait l'aperçu au lieu de le laisser défiler.
 */
export const ZOOMS: readonly number[] = [50, 75, 100];

export type Mode = "composition" | "direct";

export interface OptionsCanevas {
  mode: Mode;
  grille: boolean;
  zone: boolean;
  aimant: boolean;
  zoom: number;
  setMode: (mode: Mode) => void;
  basculerGrille: () => void;
  basculerZone: () => void;
  basculerAimant: () => void;
  zoomer: (valeur: number) => void;
}

/** Palier de zoom suivant dans la direction demandée ; borné aux extrémités de l'échelle. */
export function zoomVoisin(zoom: number, delta: -1 | 1): number {
  const rang = ZOOMS.indexOf(zoom);
  const cible = Math.min(ZOOMS.length - 1, Math.max(0, (rang < 0 ? ZOOMS.length - 1 : rang) + delta));
  return ZOOMS[cible] ?? 100;
}

export function useOptionsCanevas(): OptionsCanevas {
  const [mode, setMode] = useState<Mode>("composition");
  const [grille, setGrille] = useState(false);
  const [zone, setZone] = useState(true);
  const [aimant, setAimant] = useState(true);
  const [zoom, setZoom] = useState(100);
  return {
    mode, grille, zone, aimant, zoom, setMode,
    basculerGrille: () => setGrille((v) => !v),
    basculerZone: () => setZone((v) => !v),
    basculerAimant: () => setAimant((v) => !v),
    zoomer: (valeur) => setZoom(valeur),
  };
}
