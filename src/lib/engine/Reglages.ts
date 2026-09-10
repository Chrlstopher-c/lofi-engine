/**
 * Les réglages du moteur, pilotés depuis le centre de contrôle.
 *
 * Même chemin que la scène : le centre de contrôle écrit un fichier dans le corpus, la page le
 * relit régulièrement et l'applique à chaud. Aucune infrastructure en plus, et le moteur
 * continue de tourner si le fichier n'existe pas — il retombe sur ses propres valeurs.
 *
 * Ce qui arrive ici a été écrit par quelqu'un d'autre : chaque valeur est bornée avant d'être
 * rendue. Un tempo à zéro ou une densité négative arrêterait la musique sans rien dire.
 */

export type ModeInstrument = 'auto' | 'toujours' | 'jamais';

export interface Reglages {
  type: string;
  tempo: number;
  swing: number;
  notesParAccord: number;
  densiteMelodie: number;
  penchantAccord: number;
  partMineur: number;
  sectionMin: number;
  sectionMax: number;
  basse: ModeInstrument;
  pad: ModeInstrument;
  voix: ModeInstrument;
  coupureKick: number;
  coupureCaisse: number;
  coupureCharleston: number;
  voile: number;
  souffle: number;
}

export const DEFAUTS: Reglages = {
  type: 'equilibre',
  tempo: 156,
  swing: 1,
  notesParAccord: 4,
  densiteMelodie: 0.45,
  penchantAccord: 3,
  partMineur: 0.45,
  sectionMin: 16,
  sectionMax: 48,
  basse: 'auto',
  pad: 'auto',
  voix: 'auto',
  coupureKick: 0.13,
  coupureCaisse: 0.17,
  coupureCharleston: 0.22,
  voile: 2000,
  souffle: -32,
};

/** Les bornes de chaque réglage : hors de là, la musique s'arrête ou devient inécoutable. */
const BORNES: Record<string, [number, number]> = {
  tempo: [70, 200],
  swing: [0, 1],
  notesParAccord: [3, 6],
  densiteMelodie: [0, 1],
  penchantAccord: [1, 6],
  partMineur: [0, 1],
  sectionMin: [4, 96],
  sectionMax: [4, 128],
  coupureKick: [0, 0.9],
  coupureCaisse: [0, 0.9],
  coupureCharleston: [0, 0.9],
  voile: [400, 12000],
  souffle: [-60, -12],
};

const MODES: ModeInstrument[] = ['auto', 'toujours', 'jamais'];

/**
 * Quatre couleurs, chacune un jeu complet de réglages. Ce ne sont pas des styles différents :
 * c'est le même moteur, avec le curseur mis ailleurs.
 */
export const TYPES: Record<string, Partial<Reglages>> = {
  equilibre: {},
  nocturne: {
    tempo: 128, swing: 1, notesParAccord: 3, densiteMelodie: 0.28, penchantAccord: 4,
    partMineur: 0.6, sectionMin: 24, sectionMax: 64, voix: 'auto',
    coupureKick: 0.2, coupureCaisse: 0.3, coupureCharleston: 0.45, voile: 1400, souffle: -30,
  },
  atmospherique: {
    tempo: 112, swing: 0.8, notesParAccord: 5, densiteMelodie: 0.14, penchantAccord: 5,
    partMineur: 0.55, sectionMin: 32, sectionMax: 80, basse: 'auto', pad: 'toujours',
    voix: 'toujours', coupureKick: 0.55, coupureCaisse: 0.6, coupureCharleston: 0.5,
    voile: 1100, souffle: -26,
  },
  energique: {
    tempo: 172, swing: 0.55, notesParAccord: 4, densiteMelodie: 0.72, penchantAccord: 2,
    partMineur: 0.3, sectionMin: 12, sectionMax: 28, basse: 'toujours', pad: 'auto',
    voix: 'jamais', coupureKick: 0.04, coupureCaisse: 0.06, coupureCharleston: 0.08,
    voile: 3200, souffle: -36,
  },
};

function borner(nom: string, valeur: unknown, defaut: number): number {
  const n = typeof valeur === 'number' ? valeur : Number.NaN;
  if (!Number.isFinite(n)) return defaut;
  const bornes = BORNES[nom];
  if (!bornes) return defaut;
  return Math.min(bornes[1], Math.max(bornes[0], n));
}

function mode(valeur: unknown, defaut: ModeInstrument): ModeInstrument {
  return MODES.includes(valeur as ModeInstrument) ? (valeur as ModeInstrument) : defaut;
}

/** Le type nommé sert de socle ; les valeurs présentes dans le fichier passent par-dessus. */
export function nettoyer(brut: unknown): Reglages {
  const objet = (typeof brut === 'object' && brut !== null ? brut : {}) as Record<string, unknown>;
  const nomType = typeof objet.type === 'string' && TYPES[objet.type] ? objet.type : 'equilibre';
  const socle: Reglages = { ...DEFAUTS, ...TYPES[nomType], type: nomType };
  const sortie: Reglages = { ...socle };
  for (const nom of Object.keys(BORNES)) {
    sortie[nom] = borner(nom, objet[nom], socle[nom] as number);
  }
  sortie.basse = mode(objet.basse, socle.basse);
  sortie.pad = mode(objet.pad, socle.pad);
  sortie.voix = mode(objet.voix, socle.voix);
  // Une section ne peut pas finir avant d'avoir commencé.
  if (sortie.sectionMax < sortie.sectionMin) sortie.sectionMax = sortie.sectionMin;
  return sortie;
}

/** Lit le fichier du corpus. Rend null si rien n'est lisible — l'appelant garde l'existant. */
export async function lireReglages(chemin = '/fonds/moteur.json'): Promise<Reglages | null> {
  try {
    const reponse = await fetch(chemin, { cache: 'no-store' });
    if (!reponse.ok) return null;
    return nettoyer(await reponse.json());
  } catch {
    return null;
  }
}
