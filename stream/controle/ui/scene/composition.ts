/**
 * Géométrie de la vue composition : où poser le cadre d'un calque dans l'aperçu, et comment
 * un glissement se traduit en décalages x/y. Le placement réel est fait par stream/scene :
 * `placer()` de scene-calques.js pose top/bottom/left/right en vh/vw, et scene.html ajoute
 * translate(-50%) sur les ancres centrées. Ce fichier en est le miroir exact.
 */
import type { CSSProperties } from "react";
import type { Ancre, Calque } from "../../types.ts";

/** L'aperçu est en 16/9 : une hauteur exprimée en % de la largeur vaut RATIO fois plus en % de la hauteur. */
const RATIO = 16 / 9;
/** Le fichier de scène garde une décimale : le glissement ne produit pas de valeurs plus fines. */
const PAS = 10;
/** Sortie 1920 × 1080 : un point de pourcentage de la largeur vaut ce nombre de pixels. */
const PIXELS_PAR_POURCENT = 19.2;

export type Axe = "debut" | "centre" | "fin";

export interface Axes { horiz: Axe; vert: Axe; }

/** « bas-droite » → bord bas et bord droit ; sur ces axes, augmenter le décalage éloigne du bord. */
export function axes(ancre: Ancre): Axes {
  if (ancre === "centre") return { horiz: "centre", vert: "centre" };
  const [v, h] = ancre.split("-");
  return {
    vert: v === "haut" ? "debut" : "fin",
    horiz: h === "gauche" ? "debut" : h === "droite" ? "fin" : "centre",
  };
}

/** Encombrement estimé du calque, en % de la largeur de l'aperçu (comme les vw de la scène). */
export interface Boite { largeur: number; hauteur: number; }

function boiteTexte(calque: Calque): Boite {
  const lignes = (calque.texte ?? "").split("\n");
  const plusLongue = lignes.reduce((max, l) => Math.max(max, l.length), 1);
  return { largeur: plusLongue * 0.5 * calque.taille, hauteur: lignes.length * calque.taille * 1.35 };
}

/**
 * Taille approchée : seule la scène connaît le rendu réel du texte. Le cadre situe le calque,
 * il ne le mesure pas — d'où l'étiquette « cadres approchés » dans l'interface.
 */
export function boiteCalque(calque: Calque, ratioImage: number): Boite {
  switch (calque.type) {
    case "texte": return boiteTexte(calque);
    case "horloge":
      return { largeur: calque.taille * 2.9, hauteur: calque.taille * (calque.date === false ? 1.05 : 2) };
    case "accords": return { largeur: calque.taille * 11, hauteur: calque.taille * 3.4 };
    case "image": return { largeur: calque.taille, hauteur: calque.taille * ratioImage };
    case "video": return { largeur: calque.taille, hauteur: calque.taille * (9 / 16) };
  }
}

/** Hauteur de la boîte convertie en % de la hauteur du cadre, pour l'axe vertical. */
export function hauteurRelative(boite: Boite): number {
  return boite.hauteur * RATIO;
}

/** Dimensions de la boîte à la sortie 1920 × 1080, arrondies au pixel. */
export function dimensionsSortie(boite: Boite): { largeur: number; hauteur: number } {
  return {
    largeur: Math.round(boite.largeur * PIXELS_PAR_POURCENT),
    hauteur: Math.round(boite.hauteur * PIXELS_PAR_POURCENT),
  };
}

/** Style absolu du cadre dans un conteneur 16/9 : mêmes bords et mêmes translations que la scène. */
export function styleCadre(calque: Calque, boite: Boite): CSSProperties {
  const { horiz, vert } = axes(calque.ancre);
  const style: CSSProperties = { width: `${boite.largeur}%`, height: `${hauteurRelative(boite)}%` };
  const translations: string[] = [];
  if (horiz === "debut") style.left = `${calque.x}%`;
  else if (horiz === "fin") style.right = `${calque.x}%`;
  else { style.left = `calc(50% + ${calque.x}%)`; translations.push("translateX(-50%)"); }
  if (vert === "debut") style.top = `${calque.y}%`;
  else if (vert === "fin") style.bottom = `${calque.y}%`;
  else { style.top = `calc(50% + ${calque.y}%)`; translations.push("translateY(-50%)"); }
  if (translations.length > 0) style.transform = translations.join(" ");
  return style;
}

export interface Position { x: number; y: number; }

export function arrondir(valeur: number): number {
  return Math.round(valeur * PAS) / PAS;
}

/**
 * Nouveaux décalages après un glissement de (dxPx, dyPx) dans un aperçu de largeurPx sur hauteurPx.
 * Sur une ancre droite ou basse, le décalage est une distance au bord : la souris vers la droite
 * diminue x, la souris vers le bas diminue y.
 */
export function positionApresGlissement(
  depart: Calque, dxPx: number, dyPx: number, largeurPx: number, hauteurPx: number,
): Position {
  if (largeurPx <= 0 || hauteurPx <= 0) return { x: depart.x, y: depart.y };
  const { horiz, vert } = axes(depart.ancre);
  const dx = (dxPx / largeurPx) * 100;
  const dy = (dyPx / hauteurPx) * 100;
  return {
    x: arrondir(depart.x + (horiz === "fin" ? -dx : dx)),
    y: arrondir(depart.y + (vert === "fin" ? -dy : dy)),
  };
}

/** Bornes du champ Taille, partagées par le curseur de l'éditeur et les poignées de l'aperçu. */
export const TAILLE_MIN = 0.2;
export const TAILLE_MAX = 40;

/** Nouvelle taille de base après un étirement horizontal de dxPx sur une boîte de largeurPx. */
export function tailleApresEtirement(depart: Calque, boite: Boite, dxPx: number, largeurPx: number): number {
  const largeurBoite = (boite.largeur / 100) * largeurPx;
  if (largeurBoite <= 0) return depart.taille;
  const facteur = (largeurBoite + dxPx) / largeurBoite;
  return Math.min(TAILLE_MAX, Math.max(TAILLE_MIN, arrondir(depart.taille * facteur)));
}
