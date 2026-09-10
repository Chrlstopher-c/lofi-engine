/** Accès à l'API Pixabay du centre de contrôle. La clé ne circule que dans un sens : vers le serveur. */
import type { EtatPixabay, Media, Resultats } from "../../pixabay/types.ts";
import { requete, corpsJson } from "../commun/api.ts";

export type Genre = "image" | "video";

export const apiPixabay = {
  lireEtat: (): Promise<EtatPixabay> => requete<EtatPixabay>("/api/pixabay/etat"),
  /** Le serveur l'écrit dans le .env et n'en renvoie que l'existence. */
  enregistrerCle: (cle: string): Promise<EtatPixabay> =>
    requete<EtatPixabay>("/api/pixabay/cle", corpsJson("PUT", { cle })),
  oublierCle: (): Promise<EtatPixabay> =>
    requete<EtatPixabay>("/api/pixabay/cle", { method: "DELETE" }),
  chercher: (q: string, genre: Genre, page: number): Promise<Resultats> =>
    requete<Resultats>(`/api/pixabay/recherche?q=${encodeURIComponent(q)}`
      + `&genre=${genre}&page=${page}`),
  telecharger: (media: Media): Promise<{ fichier: string; octets: number }> =>
    requete("/api/pixabay/telecharger", corpsJson("POST", media)),
  lireFavoris: (): Promise<Resultats> => requete<Resultats>("/api/pixabay/favoris"),
  ajouterFavori: (media: Media): Promise<EtatPixabay> =>
    requete<EtatPixabay>("/api/pixabay/favoris", corpsJson("POST", media)),
  retirerFavori: (media: Media): Promise<EtatPixabay> =>
    requete<EtatPixabay>(`/api/pixabay/favoris/${media.genre}/${media.id}`, { method: "DELETE" }),
};
