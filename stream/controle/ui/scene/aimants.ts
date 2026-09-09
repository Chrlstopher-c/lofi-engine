/**
 * Repères du cadre : les cinq positions vers lesquelles un glissement se laisse attirer, et
 * les mêmes positions employées par la barre d'alignement. Tout est exprimé dans le repère du
 * cadre — le bord initial du calque en % de la largeur ou de la hauteur — puis reconverti en
 * décalage x/y du modèle, qui dépend de l'ancre.
 */
import type { Calque } from "../../types.ts";
import { arrondir, axes, hauteurRelative, type Axe, type Boite, type Position } from "./composition.ts";

/** Retrait de la zone sûre Twitch, en % : la surcouche `.zone-sure` pose le même. */
const ZONE_SURE = 5;
/** Écart en dessous duquel le glissement se colle au repère, en % du cadre. */
const SEUIL = 0.8;

/** Position du bord initial (gauche ou haut) du calque dans le cadre, en %. */
function bordDepuisDecalage(axe: Axe, taille: number, decalage: number): number {
  if (axe === "debut") return decalage;
  if (axe === "fin") return 100 - decalage - taille;
  return 50 + decalage - taille / 2;
}

/** Décalage x/y qui pose le bord initial du calque à cette position. Inverse du précédent. */
function decalageDepuisBord(axe: Axe, taille: number, bord: number): number {
  if (axe === "debut") return bord;
  if (axe === "fin") return 100 - bord - taille;
  return bord + taille / 2 - 50;
}

interface Repere {
  /** Position visée du bord initial du calque. */
  bord: number;
  /** Trait à afficher : le bord du cadre, la marge sûre ou l'axe médian. */
  guide: number;
}

function reperes(taille: number): Repere[] {
  return [
    { bord: 0, guide: 0 },
    { bord: ZONE_SURE, guide: ZONE_SURE },
    { bord: 50 - taille / 2, guide: 50 },
    { bord: 100 - ZONE_SURE - taille, guide: 100 - ZONE_SURE },
    { bord: 100 - taille, guide: 100 },
  ];
}

interface Collage { decalage: number; guide: number | null; }

function coller(axe: Axe, taille: number, decalage: number): Collage {
  const courant = bordDepuisDecalage(axe, taille, decalage);
  for (const repere of reperes(taille)) {
    if (Math.abs(courant - repere.bord) > SEUIL) continue;
    return { decalage: arrondir(decalageDepuisBord(axe, taille, repere.bord)), guide: repere.guide };
  }
  return { decalage, guide: null };
}

/** Traits affichés pendant un glissement aimanté, en % du cadre ; null = aucun. */
export interface Guides { v: number | null; h: number | null; }

export const SANS_GUIDE: Guides = { v: null, h: null };

export interface Aimantation { position: Position; guides: Guides; }

/** Colle la position visée aux repères du cadre, et dit quels traits montrer. */
export function aimanter(calque: Calque, boite: Boite, position: Position): Aimantation {
  const { horiz, vert } = axes(calque.ancre);
  const x = coller(horiz, boite.largeur, position.x);
  const y = coller(vert, hauteurRelative(boite), position.y);
  return { position: { x: x.decalage, y: y.decalage }, guides: { v: x.guide, h: y.guide } };
}

export type Alignement = "gauche" | "centre" | "droite" | "haut" | "milieu" | "bas";

const BORDS: Readonly<Record<Alignement, Axe>> = {
  gauche: "debut", centre: "centre", droite: "fin",
  haut: "debut", milieu: "centre", bas: "fin",
};

function positionDuBord(bord: Axe, taille: number): number {
  if (bord === "debut") return 0;
  if (bord === "fin") return 100 - taille;
  return 50 - taille / 2;
}

/** Décalages qui posent le calque contre ce bord du cadre, sans changer son ancre. */
export function aligner(calque: Calque, boite: Boite, cible: Alignement): Position {
  const { horiz, vert } = axes(calque.ancre);
  const bord = BORDS[cible];
  if (cible === "gauche" || cible === "centre" || cible === "droite") {
    const x = decalageDepuisBord(horiz, boite.largeur, positionDuBord(bord, boite.largeur));
    return { x: arrondir(x), y: calque.y };
  }
  const hauteur = hauteurRelative(boite);
  return { x: calque.x, y: arrondir(decalageDepuisBord(vert, hauteur, positionDuBord(bord, hauteur))) };
}
