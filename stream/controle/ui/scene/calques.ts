/** Opérations pures sur la liste des calques : création, duplication, déplacement. */
import type { Ancre, Calque, TypeCalque } from "../../types.ts";
import type { NomIcone } from "../commun/Icones.tsx";

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
  { valeur: "video", libelle: "Vidéo" },
];

export const ICONES: Readonly<Record<TypeCalque, NomIcone>> = {
  texte: "texte", horloge: "horloge", accords: "accords", image: "image", video: "video",
};

export function libelleType(type: TypeCalque): string {
  return TYPES.find((t) => t.valeur === type)?.libelle ?? type;
}

export function libelleAncre(ancre: Ancre): string {
  return ANCRES.find((a) => a.valeur === ancre)?.libelle ?? ancre;
}

/** Un calque sans nom reste désignable : son identifiant fait office d'étiquette. */
export function nomCalque(calque: Calque): string {
  return calque.nom || calque.id;
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
  video: { ancre: "centre", x: 0, y: 0, taille: 20, fichier: "", boucle: true },
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

/** Repose un calque juste avant ou juste après un autre, dans l'ordre du tableau. */
export function deplacerVers(liste: Calque[], id: string, cible: string, apres: boolean): Calque[] {
  if (id === cible) return liste;
  const source = liste.find((c) => c.id === id);
  if (!source) return liste;
  const restants = liste.filter((c) => c.id !== id);
  const index = restants.findIndex((c) => c.id === cible);
  if (index < 0) return liste;
  const rang = apres ? index + 1 : index;
  return [...restants.slice(0, rang), source, ...restants.slice(rang)];
}

export function remplacerCalque(liste: Calque[], id: string, transformer: (c: Calque) => Calque): Calque[] {
  return liste.map((c) => (c.id === id ? transformer(c) : c));
}
