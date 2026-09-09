/** Accès à l'API Twitch du centre de contrôle. Aucun secret ne circule par ces routes. */
import type {
  Archivage, Categorie, Chaine, ConnexionAppareil, DirectTwitch, EtatChat, EtatTwitch,
  LotChat, MessageChat, Rediffusion, StatistiquesTwitch,
} from "../../twitch/types.ts";
import { requete, corpsJson } from "../commun/api.ts";

export const apiTwitch = {
  lireEtat: (): Promise<EtatTwitch> => requete<EtatTwitch>("/api/twitch/etat"),
  enregistrerApplication: (clientId: string): Promise<EtatTwitch> =>
    requete<EtatTwitch>("/api/twitch/application", corpsJson("PUT", { clientId })),
  connecter: (): Promise<ConnexionAppareil> =>
    requete<ConnexionAppareil>("/api/twitch/connexion", { method: "POST" }),
  annulerConnexion: (): Promise<EtatTwitch> =>
    requete<EtatTwitch>("/api/twitch/connexion/annuler", { method: "POST" }),
  deconnecter: (): Promise<EtatTwitch> =>
    requete<EtatTwitch>("/api/twitch/deconnexion", { method: "POST" }),
  /** Le serveur écrit la clé dans le .env et n'en renvoie que l'existence. */
  recupererCle: (): Promise<{ cleEnregistree: boolean }> =>
    requete("/api/twitch/cle-diffusion", { method: "POST" }),
  lireChaine: (): Promise<Chaine> => requete<Chaine>("/api/twitch/chaine"),
  modifierChaine: (chaine: Chaine): Promise<Chaine> =>
    requete<Chaine>("/api/twitch/chaine", corpsJson("PATCH", {
      titre: chaine.titre, categorieId: chaine.categorieId,
    })),
  chercherCategories: (recherche: string): Promise<Categorie[]> =>
    requete<Categorie[]>(`/api/twitch/categories?q=${encodeURIComponent(recherche)}`),
  lireDirect: (): Promise<DirectTwitch> => requete<DirectTwitch>("/api/twitch/direct"),
  listerRediffusions: (): Promise<Rediffusion[]> => requete<Rediffusion[]>("/api/twitch/rediffusions"),
  supprimerRediffusion: (id: string): Promise<{ ok: boolean }> =>
    requete(`/api/twitch/rediffusions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  /** Le serveur tient la connexion IRC : on ne lit ici que des messages déjà nettoyés. */
  lireChat: (depuis: number): Promise<LotChat> =>
    requete<LotChat>(`/api/twitch/chat?depuis=${encodeURIComponent(String(depuis))}`),
  envoyerChat: (texte: string): Promise<MessageChat> =>
    requete<MessageChat>("/api/twitch/chat/message", corpsJson("POST", { texte })),
  relancerChat: (): Promise<EtatChat> => requete<EtatChat>("/api/twitch/chat/relance", { method: "POST" }),
  lireStatistiques: (): Promise<StatistiquesTwitch> => requete<StatistiquesTwitch>("/api/twitch/statistiques"),
  lireArchivage: (): Promise<Archivage> => requete<Archivage>("/api/twitch/archivage"),
  definirSuppressionAuto: (suppressionAuto: boolean): Promise<Archivage> =>
    requete<Archivage>("/api/twitch/archivage", corpsJson("PUT", { suppressionAuto })),
};
