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

/** Comment l'image diffusée se fabrique, tel que le diffuseur l'a arrêté à son démarrage. */
export interface Rendu {
  /** Identifiant technique : nvenc, vaapi, qsv, x264. */
  encodeur: string;
  /** Le même, dit en clair pour l'interface. */
  encodeurLibelle: string;
  /** false = le processeur encode, c'est ce qui coûte cher. */
  materiel: boolean;
  /** ffmpeg compose la scène, ou le navigateur la dessine et ffmpeg la recapture. */
  modeScene: "ffmpeg" | "navigateur";
  resolution: string;
  fps: string;
  /** Cœurs vus par le conteneur. 0 si le diffuseur n'a pas su le dire. */
  coeurs: number;
  /** Date ISO d'écriture du dépôt, qui sert à écarter celui d'une diffusion précédente. */
  ecrit: string;
}

/**
 * L'état de chaque plateforme pendant le flux en cours. `refusee` veut dire que le muxer a
 * abandonné cette sortie : elle ne reviendra pas sans relancer la diffusion.
 */
export interface Destinations {
  twitch: "active" | "refusee" | null;
  youtube: "active" | "refusee" | null;
  ecrit: string;
}

/** Ce que la machine offre comme encodeur matériel, et pourquoi quand elle n'offre rien. */
export interface MaterielEncodage {
  /** nvidia | dri | aucun */
  nom: string;
  /** La puce vue sur le bus PCI, même inutilisable. Vide si aucune. */
  puce: string;
  /** Vides quand l'encodage matériel est disponible. */
  cause: string;
  remede: string;
}

export interface EtatDiffusion {
  materiel: MaterielEncodage;
  /** null tant qu'aucun flux n'a démarré, ou quand le dépôt est illisible. */
  destinations: Destinations | null;
  enMarche: boolean;
  conteneur: string | null;
  depuis: string | null;
  corpusFichiers: number;
  corpusOctets: number;
  siteEnMarche: boolean;
  /** L'image du diffuseur est en cours de construction (première mise en route). */
  construction: boolean;
  /** null tant qu'aucune diffusion n'a démarré sur cette machine. */
  rendu: Rendu | null;
  /** Charge du conteneur de diffusion, en pourcentage d'un cœur. null si non mesurable. */
  charge: number | null;
}
