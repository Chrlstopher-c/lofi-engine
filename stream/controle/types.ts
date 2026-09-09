/** Modèle de la scène diffusée et de la configuration de diffusion. */

export type Ancre =
  | "haut-gauche" | "haut-centre" | "haut-droite"
  | "centre"
  | "bas-gauche" | "bas-centre" | "bas-droite";

export type TypeCalque = "texte" | "horloge" | "accords" | "image" | "video";

export interface Calque {
  id: string;
  nom: string;
  type: TypeCalque;
  visible: boolean;
  ancre: Ancre;
  /** Décalage horizontal depuis l'ancre, en pourcentage de la largeur. */
  x: number;
  /** Décalage vertical depuis l'ancre, en pourcentage de la hauteur. */
  y: number;
  /** Taille de base, en pourcentage de la largeur (le texte suit). */
  taille: number;
  opacite: number;
  couleur?: string;
  texte?: string;
  graisse?: "legere" | "normale";
  date?: boolean;
  cadre?: boolean;
  /** Nom du fichier média, pour les calques image et vidéo (servi sous /fonds/). */
  fichier?: string;
  /** Vidéo : relire en boucle. Le son est toujours coupé — voir Fond.boucle. */
  boucle?: boolean;
}

export interface Fond {
  /** Image ou vidéo. Une vidéo de fond est toujours muette et lue en boucle. */
  fichier: string;
  ajustement: "cover" | "contain";
  mouvement: boolean;
  /** Force du voile sombre posé sur le fond, de 0 à 1. */
  voile: number;
  vignettage: boolean;
}

export interface Scene {
  version: number;
  theme: "nuit" | "ambre" | "brume";
  fond: Fond;
  calques: Calque[];
}

export interface Diffusion {
  twitchActif: boolean;
  youtubeActif: boolean;
  /** Vrai si une clé est enregistrée — la valeur elle-même n'est jamais renvoyée. */
  twitchCle: boolean;
  youtubeCle: boolean;
  twitchIngest: string;
  youtubeIngest: string;
  resolution: string;
  fps: number;
  bitrateVideo: string;
  bitrateAudio: string;
}

export interface EtatDiffusion {
  enMarche: boolean;
  conteneur: string | null;
  depuis: string | null;
  corpusFichiers: number;
  corpusOctets: number;
  siteEnMarche: boolean;
  /** L'image du diffuseur est en cours de construction (première mise en route). */
  construction: boolean;
}
