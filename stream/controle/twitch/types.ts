/**
 * Ce que Twitch répond quand on lui demande si le compte a le droit de diffuser.
 * En RTMP un refus se réduit à « Input/output error » ; ceci le nomme.
 */
export interface Aptitude {
  /** true quand Twitch accepterait une diffusion pour autant qu'on puisse le savoir. */
  apte: boolean;
  cause: string | null;
  remede: string | null;
}

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

/** Un message du chat, déjà nettoyé : c'est la seule forme qui franchit l'API. */
export interface MessageChat {
  /** Numéro d'ordre croissant : l'interface ne redemande que ce qui suit le dernier reçu. */
  sequence: number;
  auteur: string;
  /** Couleur `#rrggbb` fournie par Twitch, ou `null` — aucune couleur n'est inventée. */
  couleur: string | null;
  texte: string;
  horodatage: string;
  /** Vrai pour un avis de Twitch (NOTICE), faux pour le message d'un spectateur. */
  systeme: boolean;
}

/**
 * `arrete` : rien en cours, l'interface peut demander l'ouverture.
 * `refuse` : le chat ne repartira pas seul (portées absentes, refus d'authentification,
 * trop de reconnexions) — il faut une action explicite.
 */
export type EtatConnexionChat = "arrete" | "connexion" | "connecte" | "attente" | "refuse";

export interface EtatChat {
  etat: EtatConnexionChat;
  /** Chaîne rejointe ; vide tant qu'aucune connexion n'a abouti. */
  chaine: string;
  message: string | null;
  /** Établissement de la connexion en cours, en ISO. */
  depuis: string | null;
  tentatives: number;
  /** Portées absentes du jeton : tant que la liste n'est pas vide, le chat ne peut pas s'ouvrir. */
  porteesManquantes: string[];
}

/** Ce que renvoie une lecture du chat : l'état, et les messages postérieurs au dernier connu. */
export interface LotChat {
  etat: EtatChat;
  messages: MessageChat[];
  /** Dernier numéro d'ordre côté serveur, à renvoyer tel quel à la lecture suivante. */
  sequence: number;
  /** Vrai si des messages sont sortis du tampon entre deux lectures : le flux a un trou. */
  tronque: boolean;
}

export interface PointSpectateurs {
  instant: string;
  spectateurs: number;
}

/** Chaque champ vaut `null` quand la mesure n'existe pas — jamais un zéro de complaisance. */
export interface StatistiquesTwitch {
  enDirect: boolean;
  spectateurs: number | null;
  abonnes: number | null;
  /** Début du direct en cours, en ISO : la durée s'en déduit. */
  depuis: string | null;
  pic: number | null;
  moyenne: number | null;
  /** Relevés échantillonnés par le centre de contrôle, l'API Twitch n'en fournit aucun. */
  points: PointSpectateurs[];
  /** Vrai si les points décrivent le direct en cours ; faux s'il s'agit du dernier relevé connu. */
  sessionEnCours: boolean;
}

/** Suppression automatique des rediffusions : jamais rétroactive, jamais active par défaut. */
export interface Archivage {
  suppressionAuto: boolean;
  /** Démarrage de la surveillance en ISO ; rien de publié avant cette date n'est touché. */
  depuis: string | null;
  supprimees: number;
}
