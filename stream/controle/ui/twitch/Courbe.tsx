/**
 * Courbe des spectateurs, en SVG écrit à la main — aucune bibliothèque, aucun CDN.
 * Elle ne trace que des relevés réels : sans au moins deux points, elle ne s'affiche pas
 * plutôt que de dessiner une ligne inventée.
 */
import type { ReactNode } from "react";
import type { PointSpectateurs } from "../../twitch/types.ts";
import { heureLisible, nombreLisible } from "./format-twitch.ts";

const LARGEUR = 600;
const HAUTEUR = 120;
const MARGE = 12;

interface Mesure {
  x: number;
  y: number;
}

/** Les instants illisibles sortent : mieux vaut une courbe plus courte qu'un point inventé. */
function utilisables(points: PointSpectateurs[]): Array<{ instant: number; valeur: number }> {
  return points
    .map((point) => ({ instant: Date.parse(point.instant), valeur: point.spectateurs }))
    .filter((point) => Number.isFinite(point.instant) && Number.isFinite(point.valeur));
}

function projeter(points: Array<{ instant: number; valeur: number }>, haut: number, bas: number): Mesure[] {
  const premier = points[0]?.instant ?? 0;
  const dernier = points[points.length - 1]?.instant ?? premier;
  const etendueT = dernier - premier || 1;
  const etendueV = haut - bas;
  const hauteurUtile = HAUTEUR - 2 * MARGE;
  return points.map((point) => ({
    x: ((point.instant - premier) / etendueT) * LARGEUR,
    // Toutes les valeurs égales : la ligne passe au milieu, pas collée au bord.
    y: etendueV === 0 ? HAUTEUR / 2 : HAUTEUR - MARGE - ((point.valeur - bas) / etendueV) * hauteurUtile,
  }));
}

function chemin(mesures: Mesure[]): string {
  return mesures.map((mesure) => `${mesure.x.toFixed(1)},${mesure.y.toFixed(1)}`).join(" ");
}

export function Courbe({ points }: { points: PointSpectateurs[] }): ReactNode {
  const lus = utilisables(points);
  if (lus.length < 2) {
    return (
      <p className="discret vide">
        Pas encore assez de relevés pour tracer une courbe — un relevé est pris chaque minute,
        pendant la diffusion seulement.
      </p>
    );
  }
  const valeurs = lus.map((point) => point.valeur);
  const haut = valeurs.reduce((max, valeur) => (valeur > max ? valeur : max), valeurs[0] ?? 0);
  const bas = valeurs.reduce((min, valeur) => (valeur < min ? valeur : min), valeurs[0] ?? 0);
  const mesures = projeter(lus, haut, bas);
  const ligne = chemin(mesures);
  const aire = `0,${HAUTEUR} ${ligne} ${LARGEUR},${HAUTEUR}`;
  const debut = heureLisible(new Date(lus[0]?.instant ?? 0).toISOString());
  const fin = heureLisible(new Date(lus[lus.length - 1]?.instant ?? 0).toISOString());
  return (
    <figure className="courbe">
      <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} preserveAspectRatio="none" role="img"
        aria-label={`Spectateurs de ${bas} à ${haut}, de ${debut} à ${fin}`}>
        <polygon className="courbe-aire" points={aire} />
        <polyline className="courbe-trait" points={ligne} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="courbe-reperes discret mono">
        <span>{debut}</span>
        <span>{nombreLisible(bas)} → {nombreLisible(haut)} spectateurs · {lus.length} relevés</span>
        <span>{fin}</span>
      </figcaption>
    </figure>
  );
}
