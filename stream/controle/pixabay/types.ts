/** Ce que l'interface manipule côté Pixabay. La clé d'API n'apparaît dans aucun de ces types. */

/** Un média trouvé sur Pixabay, réduit à ce dont l'interface a besoin. */
export interface Media {
  /** Identifiant Pixabay. Sert de clé de favori et de suffixe de nom de fichier. */
  id: number;
  genre: "image" | "video";
  /** Vignette servie par Pixabay, affichable directement. */
  apercu: string;
  /** Le fichier à télécharger, choisi côté serveur : la plus grande taille raisonnable. */
  source: string;
  largeur: number;
  hauteur: number;
  /** Secondes, pour une vidéo. 0 pour une image. */
  duree: number;
  auteur: string;
  page: string;
  tags: string;
  octets: number;
  /** Vrai si le fichier est déjà dans le corpus, donc visible dans la composition. */
  telecharge: boolean;
  favori: boolean;
}

export interface Resultats {
  total: number;
  medias: Media[];
}

export interface EtatPixabay {
  /** L'existence de la clé, jamais sa valeur. */
  cleEnregistree: boolean;
  /** Nombre de favoris gardés de côté. */
  favoris: number;
}

/** Un favori tel qu'il est conservé sur le disque : tout ce qu'il faut pour le retrouver. */
export interface Favori extends Omit<Media, "telecharge" | "favori"> {
  ajoute: string;
}
