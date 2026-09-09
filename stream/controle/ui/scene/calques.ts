/** Opérations pures sur la liste des calques : création, duplication, déplacement. */
import type { Ancre, Calque, TypeCalque } from "../../types.ts";

export const ANCRES: ReadonlyArray<{ valeur: Ancre; libelle: string }> = [
  { valeur: "haut-gauche", libelle: "Haut gauche" },
  { valeur: "haut-centre", libelle: "Haut centre" },
  { valeur: "haut-droite", libelle: "Haut droite" },
  { valeur: "centre", libelle: "Centre" },
  { valeur: "bas-gauche", libelle: "Bas gauche" },
  { valeur: "bas-centre", libelle: "Bas centre" },
  { valeur: "bas-droite", libelle: "Bas droite" },
];

export const TYPES: ReadonlyArray<{ valeur: TypeCalque; libelle: string }> = [
  { valeur: "texte", libelle: "Texte" },
  { valeur: "horloge", libelle: "Horloge" },
  { valeur: "accords", libelle: "Accords" },
  { valeur: "image", libelle: "Image" },
];

export function libelleType(type: TypeCalque): string {
  return TYPES.find((t) => t.valeur === type)?.libelle ?? type;
}

function idUnique(base: string, existants: Calque[]): string {
  const pris = new Set(existants.map((c) => c.id));
  if (!pris.has(base)) return base;
  let n = 2;
  while (pris.has(`${base}-${n}`) && n < 1000) n += 1;
  return `${base}-${n}`;
}

const MODELES: Record<TypeCalque, Partial<Calque>> = {
  texte: { ancre: "bas-gauche", x: 4.5, y: 14, taille: 3, texte: "Nouveau texte", graisse: "normale" },
  horloge: { ancre: "haut-droite", x: 4.5, y: 6, taille: 3.2, date: true },
  accords: { ancre: "bas-droite", x: 4.5, y: 9, taille: 1.1, cadre: true },
  image: { ancre: "centre", x: 0, y: 0, taille: 20, fichier: "" },
};

export function nouveauCalque(type: TypeCalque, existants: Calque[]): Calque {
  const id = idUnique(type, existants);
  return {
    id,
    nom: libelleType(type),
    type,
    visible: true,
    ancre: "bas-gauche",
    x: 4.5,
    y: 10,
    taille: 2,
    opacite: 1,
    couleur: "#f2f4f8",
    ...MODELES[type],
  };
}

export function dupliquerCalque(source: Calque, existants: Calque[]): Calque {
  return { ...source, id: idUnique(`${source.id}-copie`, existants), nom: `${source.nom} (copie)` };
}

/** Déplace l'élément d'un rang ; hors limites, la liste est rendue telle quelle. */
export function deplacer<T>(liste: T[], index: number, delta: -1 | 1): T[] {
  const cible = index + delta;
  if (index < 0 || index >= liste.length || cible < 0 || cible >= liste.length) return liste;
  const copie = [...liste];
  const [element] = copie.splice(index, 1);
  if (element === undefined) return liste;
  copie.splice(cible, 0, element);
  return copie;
}

export function remplacerCalque(liste: Calque[], id: string, transformer: (c: Calque) => Calque): Calque[] {
  return liste.map((c) => (c.id === id ? transformer(c) : c));
}
