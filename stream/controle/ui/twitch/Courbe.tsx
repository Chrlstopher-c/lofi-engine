/**
 * Courbe des spectateurs, en SVG écrit à la main — aucune bibliothèque, aucun CDN.
 * Elle ne trace que des relevés réels : sans au moins deux points, elle ne s'affiche pas
 * plutôt que de dessiner une ligne inventée.
 */
import type { ReactNode } from "react";
import type { PointSpectateurs } from "../../twitch/types.ts";
import { Vide } from "../commun/composants.tsx";
import { heureLisible, nombreLisible } from "./format-twitch.ts";

const LARGEUR = 800;
const HAUTEUR = 160;
const MARGE = 12;
/** Trois repères horizontaux : bas, milieu, haut de la zone utile. */
const LIGNES = [MARGE, HAUTEUR / 2, HAUTEUR - MARGE];

const MESSAGE_VIDE = "Pas encore assez de relevés pour tracer une courbe — un relevé est pris chaque "
  + "minute, pendant la diffusion seulement.";

interface Releve { instant: number; valeur: number; }
interface Point { x: number; y: number; }

/** Les instants illisibles sortent : mieux vaut une courbe plus courte qu'un point inventé. */
function utilisables(points: PointSpectateurs[]): Releve[] {
  return points
    .map((point) => ({ instant: Date.parse(point.instant), valeur: point.spectateurs }))
    .filter((point) => Number.isFinite(point.instant) && Number.isFinite(point.valeur));
}

function projeter(releves: Releve[], haut: number, bas: number): Point[] {
  const premier = releves[0]?.instant ?? 0;
  const dernier = releves[releves.length - 1]?.instant ?? premier;
  const etendueT = dernier - premier || 1;
  const etendueV = haut - bas;
  const hauteurUtile = HAUTEUR - 2 * MARGE;
  return releves.map((releve) => ({
    x: ((releve.instant - premier) / etendueT) * LARGEUR,
    // Toutes les valeurs égales : la ligne passe au milieu, pas collée au bord.
    y: etendueV === 0 ? HAUTEUR / 2 : HAUTEUR - MARGE - ((releve.valeur - bas) / etendueV) * hauteurUtile,
  }));
}

function chemin(points: Point[]): string {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function Trace({ points }: { points: Point[] }): ReactNode {
  const ligne = chemin(points);
  const actuel = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} preserveAspectRatio="none" role="presentation">
      {LIGNES.map((y) => <line key={y} className="courbe-grille" x1="0" y1={y} x2={LARGEUR} y2={y} />)}
      <polygon className="courbe-aire" points={`0,${HAUTEUR} ${ligne} ${LARGEUR},${HAUTEUR}`} />
      <polyline className="courbe-trait" points={ligne} vectorEffect="non-scaling-stroke" />
      {actuel ? <circle className="courbe-actuel" cx={actuel.x} cy={actuel.y} r="4" /> : null}
    </svg>
  );
}

export function Courbe({ points }: { points: PointSpectateurs[] }): ReactNode {
  const releves = utilisables(points);
  if (releves.length < 2) {
    return (
      <Vide icone="historique" message={MESSAGE_VIDE} />
    );
  }
  const valeurs = releves.map((releve) => releve.valeur);
  const haut = valeurs.reduce((max, valeur) => (valeur > max ? valeur : max), valeurs[0] ?? 0);
  const bas = valeurs.reduce((min, valeur) => (valeur < min ? valeur : min), valeurs[0] ?? 0);
  const debut = heureLisible(new Date(releves[0]?.instant ?? 0).toISOString());
  const fin = heureLisible(new Date(releves[releves.length - 1]?.instant ?? 0).toISOString());
  return (
    <figure className="courbe" aria-label={`Spectateurs de ${bas} à ${haut}, de ${debut} à ${fin}`}>
      <Trace points={projeter(releves, haut, bas)} />
      <figcaption className="reperes">
        <span>{debut}</span>
        <span>{nombreLisible(bas)} → {nombreLisible(haut)} spectateurs · {releves.length} relevés</span>
        <span>{fin}</span>
      </figcaption>
    </figure>
  );
}
