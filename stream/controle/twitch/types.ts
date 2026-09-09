/**
 * Modèle du domaine Twitch.
 * Deux familles bien séparées : ce qui reste au serveur (`Coffre`, jamais sérialisé vers
 * l'interface) et ce que l'API expose (des booléens et des données publiques de la chaîne).
 */

/** Identifiants et jetons. Aucune de ces valeurs ne franchit l'API. */
export interface Coffre {
  /** Client ID de l'application Twitch — client public, pas de secret en flux appareil. */
  clientId: string;
  jetonAcces: string;
  jetonRafraichissement: string;
  /** Expiration du jeton d'accès, en millisecondes epoch ; 0 si aucun jeton. */
  expireA: number;
  portees: string[];
  utilisateurId: string;
  utilisateurLogin: string;
}

/** Étape courante d'une connexion par code d'appareil. */
export type StatutConnexion = "attente" | "reussie" | "echouee" | "expiree" | "annulee";

/** Connexion en cours, telle que l'interface la voit : le `device_code` reste au serveur. */
export interface ConnexionAppareil {
  statut: StatutConnexion;
  /** Code à saisir sur twitch.tv, affiché en grand. */
  codeUtilisateur: string;
  urlVerification: string;
  /** Fin de validité du code, en ISO ; passé cette date le flux s'arrête de lui-même. */
  expireA: string;
  /** Message d'échec renvoyé par Twitch, tel quel ; `null` tant que rien n'a échoué. */
  message: string | null;
}

/** État exposé à l'interface : ce qui existe, jamais ce que ça vaut. */
export interface EtatTwitch {
  applicationEnregistree: boolean;
  compteConnecte: boolean;
  /** Identifiant public de la chaîne connectée ; vide si aucun compte. */
  utilisateurLogin: string;
  portees: string[];
  /** Expiration du jeton d'accès en ISO, pour que l'interface sache qu'il vit encore. */
  jetonExpireA: string | null;
  connexion: ConnexionAppareil | null;
}

export interface Chaine {
  titre: string;
  categorieId: string;
  categorieNom: string;
  langue: string;
}

export interface Categorie {
  id: string;
  nom: string;
  imageUrl: string;
}

/** État réel de la chaîne. Hors direct, tout est `null` : rien n'est inventé. */
export interface DirectTwitch {
  enDirect: boolean;
  titre: string | null;
  categorieNom: string | null;
  spectateurs: number | null;
  /** Début du direct en ISO. */
  depuis: string | null;
}

export interface Rediffusion {
  id: string;
  titre: string;
  /** Durée telle que Twitch la donne, ex. « 3h12m5s ». */
  duree: string;
  publieeLe: string;
  vues: number;
  url: string;
}
