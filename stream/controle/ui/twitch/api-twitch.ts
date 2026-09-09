/** Accès à l'API Twitch du centre de contrôle. Aucun secret ne circule par ces routes. */
import type {
  Categorie, Chaine, ConnexionAppareil, DirectTwitch, EtatTwitch, Rediffusion,
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
};
