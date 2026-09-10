/**
 * Routes Pixabay. Aucun secret ne circule par ici : la clé s'écrit, ne se relit jamais.
 *
 * Les résultats sortent enrichis de deux marques que Pixabay ne connaît pas — « déjà dans le
 * corpus » et « mis en favori ». C'est ce qui permet à l'interface de montrer d'un coup d'œil
 * ce qui a déjà été pris, sans que l'utilisateur ait à s'en souvenir.
 */
import type { EtatPixabay, Media, Resultats } from "./types.ts";
import { chercher, ecrireCle, lireCle, oublierCle } from "./client.ts";
import { ajouterFavori, lireFavoris, retirerFavori } from "./favoris.ts";
import { dejaPresent, telecharger } from "./telechargement.ts";
import { journal } from "../journal.ts";

const PREFIXE = "/api/pixabay";

function json(donnees: unknown, statut = 200): Response {
  return new Response(JSON.stringify(donnees), {
    status: statut, headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function erreur(e: unknown, statut = 400): Response {
  const message = e instanceof Error ? e.message : "requête refusée";
  return json({ erreur: message }, statut);
}

async function corps(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** Marque chaque média selon ce qu'on en a déjà fait. Deux lectures, pas une par média. */
async function enrichir(medias: Media[]): Promise<Media[]> {
  const favoris = new Set((await lireFavoris()).map((f) => `${f.genre}:${f.id}`));
  const presents = await Promise.all(medias.map((m) => dejaPresent(m)));
  return medias.map((m, i) => ({
    ...m, favori: favoris.has(`${m.genre}:${m.id}`), telecharge: presents[i] === true,
  }));
}

async function etat(): Promise<EtatPixabay> {
  return { cleEnregistree: (await lireCle()).length > 0, favoris: (await lireFavoris()).length };
}

async function routerCle(req: Request, chemin: string, m: string): Promise<Response | null> {
  if (chemin !== `${PREFIXE}/cle`) return null;
  if (m === "PUT") {
    const o = (await corps(req)) as { cle?: unknown };
    await ecrireCle(o.cle);
    journal.info("clé Pixabay enregistrée");
    return json(await etat());
  }
  if (m === "DELETE") {
    await oublierCle();
    return json(await etat());
  }
  return null;
}

async function routerFavoris(req: Request, chemin: string, m: string): Promise<Response | null> {
  if (chemin === `${PREFIXE}/favoris` && m === "GET") {
    const favoris = await lireFavoris();
    const medias = await enrichir(favoris.map((f) => ({ ...f, telecharge: false, favori: true })));
    return json({ total: medias.length, medias } satisfies Resultats);
  }
  if (chemin === `${PREFIXE}/favoris` && m === "POST") {
    await ajouterFavori(await corps(req));
    return json(await etat());
  }
  if (chemin.startsWith(`${PREFIXE}/favoris/`) && m === "DELETE") {
    const [genre, id] = chemin.slice(`${PREFIXE}/favoris/`.length).split("/");
    await retirerFavori(Number(id), String(genre));
    return json(await etat());
  }
  return null;
}

export async function routerPixabay(req: Request, chemin: string): Promise<Response | null> {
  if (!chemin.startsWith(PREFIXE)) return null;
  const m = req.method;
  try {
    if (chemin === `${PREFIXE}/etat` && m === "GET") return json(await etat());

    const cle = await routerCle(req, chemin, m);
    if (cle) return cle;

    if (chemin === `${PREFIXE}/recherche` && m === "GET") {
      const p = new URL(req.url).searchParams;
      const r = await chercher({ q: p.get("q"), genre: p.get("genre"), page: p.get("page") });
      return json({ total: r.total, medias: await enrichir(r.medias) } satisfies Resultats);
    }
    if (chemin === `${PREFIXE}/telecharger` && m === "POST") {
      return json(await telecharger(await corps(req)));
    }

    const favoris = await routerFavoris(req, chemin, m);
    if (favoris) return favoris;

    return json({ erreur: "route Pixabay inconnue" }, 404);
  } catch (e) {
    return erreur(e);
  }
}
