/**
 * Le hasard du moteur, tiré d'une graine.
 *
 * Tout ce que la musique décide — l'enchaînement des accords, le renversement, le pas de la
 * mélodie, les coupures de batterie — passait par `Math.random()`. Un passage réussi était
 * donc perdu à jamais : rien ne permettait de le rejouer. Avec une graine, la *composition*
 * se rejoue à l'identique.
 *
 * La *performance*, elle, ne se rejoue pas : Tone.js décale chaque frappe de quelques
 * millisecondes (l'humanisation), et ce décalage-là ne vient pas d'ici. Deux lectures d'une
 * même graine donnent les mêmes notes, pas la même prise.
 *
 * Générateur : mulberry32. Trente-deux bits d'état, une poignée d'opérations, distribution
 * suffisante pour un choix musical — inutile d'aller chercher plus lourd.
 */

const MASQUE_32 = 0xffffffff;

function mulberry32(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une graine lisible et retapable : huit caractères hexadécimaux. */
export function graineAuHasard(): number {
  return (Math.random() * MASQUE_32) >>> 0;
}

export function graineDepuisTexte(texte: string): number | null {
  const propre = texte.trim().replace(/^0x/i, "");
  if (!/^[0-9a-f]{1,8}$/i.test(propre)) return null;
  return Number.parseInt(propre, 16) >>> 0;
}

export function graineEnTexte(graine: number): string {
  return (graine >>> 0).toString(16).padStart(8, "0");
}

let graineCourante = graineAuHasard();
let tirer = mulberry32(graineCourante);

/** Le tirage du moteur. Remplace `Math.random()` partout où la musique se décide. */
export function alea(): number {
  return tirer();
}

/** Un entier dans [0, borne[. */
export function aleaEntier(borne: number): number {
  return Math.floor(tirer() * borne);
}

export function graine(): number {
  return graineCourante;
}

/** Repart de cette graine : la même suite de décisions recommence. */
export function semer(valeur: number): void {
  graineCourante = valeur >>> 0;
  tirer = mulberry32(graineCourante);
}
