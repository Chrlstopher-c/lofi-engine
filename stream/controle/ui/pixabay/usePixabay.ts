/**
 * L'état de l'onglet Pixabay : la clé, la recherche en cours, les favoris.
 *
 * Découpé en trois morceaux qui ne se connaissent pas, recomposés à la fin. Les favoris sont
 * tenus au-dessus des vignettes et pas dans chacune : mettre un média de côté depuis les
 * résultats doit se voir aussitôt dans la liste des favoris, et l'inverse aussi.
 */
import { useCallback, useEffect, useState } from "react";
import type { EtatPixabay, Media } from "../../pixabay/types.ts";
import { apiPixabay, type Genre } from "./api-pixabay.ts";
import { messageErreur } from "../commun/format.ts";

export interface Pixabay {
  etat: EtatPixabay | null;
  erreur: string | null;
  occupe: boolean;
  resultats: Media[];
  total: number;
  favoris: Media[];
  /** La page affichée, et le nombre de pages atteignables. */
  page: number;
  pages: number;
  chercher: (q: string, genre: Genre, page: number) => Promise<void>;
  /** Rejoue la dernière recherche sur une autre page. */
  allerPage: (page: number) => Promise<void>;
  basculerFavori: (media: Media) => Promise<void>;
  telecharger: (media: Media) => Promise<void>;
  enregistrerCle: (cle: string) => Promise<void>;
  oublierCle: () => Promise<void>;
  effacerErreur: () => void;
}

type Signaler = (erreur: unknown) => void;

/** Remplace un média dans une liste : les deux montrent le même objet, avec le même état. */
function majListe(liste: Media[], media: Media, champs: Partial<Media>): Media[] {
  return liste.map((m) => (m.id === media.id && m.genre === media.genre ? { ...m, ...champs } : m));
}

/** Combien de résultats Pixabay rend par page, et jusqu'où il accepte d'aller. */
const PAR_PAGE = 30;
/** Pixabay refuse au-delà de 500 résultats pour une même requête. */
const PLAFOND = 500;

/** La recherche : ce que Pixabay renvoie, et de quoi y revenir page après page. */
function useRecherche(signaler: Signaler) {
  const [resultats, setResultats] = useState<Media[]>([]);
  const [total, setTotal] = useState(0);
  const [occupe, setOccupe] = useState(false);
  const [page, setPage] = useState(1);
  // La dernière requête, pour que la pagination la rejoue sans la redemander à l'utilisateur.
  const [derniere, setDerniere] = useState<{ q: string; genre: Genre } | null>(null);

  const chercher = useCallback(async (q: string, genre: Genre, n: number): Promise<void> => {
    if (q.trim() === "") return;
    setOccupe(true);
    try {
      const r = await apiPixabay.chercher(q, genre, n);
      setResultats(r.medias);
      setTotal(r.total);
      setPage(n);
      setDerniere({ q, genre });
    } catch (e) {
      signaler(e);
      setResultats([]);
      setTotal(0);
    } finally {
      setOccupe(false);
    }
  }, [signaler]);

  const allerPage = useCallback(async (n: number): Promise<void> => {
    if (!derniere) return;
    await chercher(derniere.q, derniere.genre, n);
  }, [chercher, derniere]);

  // Arrondi vers le BAS : Pixabay refuse une page dont le dernier résultat dépasserait 500.
  // Vers le haut, la dernière page annoncée n'existerait pas — 17 pages proposées pour 16
  // atteignables, et un clic qui ne rend rien.
  const pages = Math.min(Math.ceil(total / PAR_PAGE), Math.floor(PLAFOND / PAR_PAGE));
  return { resultats, setResultats, total, setTotal, occupe, setOccupe,
           chercher, page, pages, allerPage };
}

/** Les favoris, relus depuis le serveur après chaque changement : une seule source de vérité. */
function useFavoris(signaler: Signaler) {
  const [favoris, setFavoris] = useState<Media[]>([]);

  const rafraichir = useCallback(async (): Promise<void> => {
    try {
      setFavoris((await apiPixabay.lireFavoris()).medias);
    } catch (e) {
      signaler(e);
    }
  }, [signaler]);

  return { favoris, setFavoris, rafraichir };
}

/** La clé : son existence seule circule, jamais sa valeur. */
function useCle(signaler: Signaler, apresChangement: () => Promise<void>) {
  const [etat, setEtat] = useState<EtatPixabay | null>(null);

  const relire = useCallback(async (): Promise<void> => {
    try {
      const e = await apiPixabay.lireEtat();
      setEtat(e);
      if (e.cleEnregistree) await apresChangement();
    } catch (e) {
      signaler(e);
    }
  }, [signaler, apresChangement]);

  useEffect(() => { void relire(); }, [relire]);

  const enregistrer = useCallback(async (cle: string): Promise<void> => {
    try {
      setEtat(await apiPixabay.enregistrerCle(cle));
      await apresChangement();
    } catch (e) {
      signaler(e);
    }
  }, [signaler, apresChangement]);

  const oublier = useCallback(async (): Promise<void> => {
    try {
      setEtat(await apiPixabay.oublierCle());
    } catch (e) {
      signaler(e);
    }
  }, [signaler]);

  return { etat, setEtat, enregistrer, oublier };
}

type Recherche = ReturnType<typeof useRecherche>;
type Favoris = ReturnType<typeof useFavoris>;
type Cle = ReturnType<typeof useCle>;

/** Les deux gestes qui touchent aux trois morceaux à la fois. */
function useGestes(r: Recherche, f: Favoris, c: Cle, signaler: Signaler) {
  const basculerFavori = useCallback(async (media: Media): Promise<void> => {
    try {
      c.setEtat(media.favori
        ? await apiPixabay.retirerFavori(media)
        : await apiPixabay.ajouterFavori(media));
      r.setResultats((l) => majListe(l, media, { favori: !media.favori }));
      await f.rafraichir();
    } catch (e) {
      signaler(e);
    }
  }, [c, f, r, signaler]);

  const telecharger = useCallback(async (media: Media): Promise<void> => {
    r.setOccupe(true);
    try {
      await apiPixabay.telecharger(media);
      // Le média vit dans les deux listes : le marquer dans une seule laisserait l'autre mentir.
      r.setResultats((l) => majListe(l, media, { telecharge: true }));
      f.setFavoris((l) => majListe(l, media, { telecharge: true }));
    } catch (e) {
      signaler(e);
    } finally {
      r.setOccupe(false);
    }
  }, [f, r, signaler]);

  const oublierCle = useCallback(async (): Promise<void> => {
    await c.oublier();
    r.setResultats([]);
    r.setTotal(0);
  }, [c, r]);

  return { basculerFavori, telecharger, oublierCle };
}

export function usePixabay(): Pixabay {
  const [erreur, setErreur] = useState<string | null>(null);
  const signaler = useCallback((e: unknown) => setErreur(messageErreur(e)), []);
  const r = useRecherche(signaler);
  const f = useFavoris(signaler);
  const c = useCle(signaler, f.rafraichir);
  const { basculerFavori, telecharger, oublierCle } = useGestes(r, f, c, signaler);

  return {
    etat: c.etat, erreur, occupe: r.occupe, resultats: r.resultats, total: r.total,
    page: r.page, pages: r.pages, allerPage: r.allerPage,
    favoris: f.favoris, chercher: r.chercher, basculerFavori, telecharger,
    enregistrerCle: c.enregistrer, oublierCle, effacerErreur: () => setErreur(null),
  };
}
