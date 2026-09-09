/**
 * Bord HTTP du domaine Twitch : `/api/twitch/*`.
 * Toute erreur levée plus bas devient une réponse 400 portant le message d'origine —
 * ceux de Twitch sont explicites, ils sont remontés tels quels à l'utilisateur.
 */
import type { EtatTwitch } from "./types.ts";
import { lireCoffre, enregistrerApplication, effacerJetons } from "./coffre.ts";
import { demarrerConnexion, annulerConnexion, etatConnexion } from "./appareil.ts";
import { lireChaine, modifierChaine, chercherCategories, lireDirect } from "./chaine.ts";
import { listerRediffusions, supprimerRediffusion } from "./rediffusions.ts";
import { recupererCleDiffusion } from "./cle-diffusion.ts";

const PREFIXE = "/api/twitch";

function json(donnees: unknown, statut = 200): Response {
  return new Response(JSON.stringify(donnees), {
    status: statut,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function corpsJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const corps: unknown = await req.json();
    return typeof corps === "object" && corps !== null ? (corps as Record<string, unknown>) : {};
  } catch {
    throw new Error("corps de requête illisible (JSON attendu)");
  }
}

/** L'état exposé : ce qui existe et où en est la connexion, jamais une valeur secrète. */
export async function lireEtatTwitch(): Promise<EtatTwitch> {
  const coffre = await lireCoffre();
  return {
    applicationEnregistree: coffre.clientId.length > 0,
    compteConnecte: coffre.jetonAcces.length > 0,
    utilisateurLogin: coffre.utilisateurLogin,
    portees: coffre.portees,
    jetonExpireA: coffre.expireA > 0 ? new Date(coffre.expireA).toISOString() : null,
    connexion: etatConnexion(),
  };
}

async function routerCompte(req: Request, chemin: string): Promise<Response | null> {
  const m = req.method;
  if (chemin === `${PREFIXE}/etat` && m === "GET") return json(await lireEtatTwitch());
  if (chemin === `${PREFIXE}/application` && m === "PUT") {
    await enregistrerApplication((await corpsJson(req)).clientId);
    return json(await lireEtatTwitch());
  }
  if (chemin === `${PREFIXE}/connexion` && m === "POST") return json(await demarrerConnexion());
  if (chemin === `${PREFIXE}/connexion/annuler` && m === "POST") {
    annulerConnexion();
    return json(await lireEtatTwitch());
  }
  if (chemin === `${PREFIXE}/deconnexion` && m === "POST") {
    annulerConnexion();
    await effacerJetons();
    return json(await lireEtatTwitch());
  }
  if (chemin === `${PREFIXE}/cle-diffusion` && m === "POST") return json(await recupererCleDiffusion());
  return null;
}

async function routerChaine(req: Request, chemin: string): Promise<Response | null> {
  const m = req.method;
  if (chemin === `${PREFIXE}/chaine` && m === "GET") return json(await lireChaine());
  if (chemin === `${PREFIXE}/chaine` && m === "PATCH") return json(await modifierChaine(await corpsJson(req)));
  if (chemin === `${PREFIXE}/categories` && m === "GET") {
    const recherche = new URL(req.url).searchParams.get("q") ?? "";
    return json(await chercherCategories(recherche));
  }
  if (chemin === `${PREFIXE}/direct` && m === "GET") return json(await lireDirect());
  if (chemin === `${PREFIXE}/rediffusions` && m === "GET") return json(await listerRediffusions());
  if (chemin.startsWith(`${PREFIXE}/rediffusions/`) && m === "DELETE") {
    await supprimerRediffusion(decodeURIComponent(chemin.slice(`${PREFIXE}/rediffusions/`.length)));
    return json({ ok: true });
  }
  return null;
}

/** Renvoie `null` si le chemin n'appartient pas au domaine Twitch. */
export async function routerTwitch(req: Request, chemin: string): Promise<Response | null> {
  if (!chemin.startsWith(`${PREFIXE}/`)) return null;
  try {
    return (await routerCompte(req, chemin)) ?? (await routerChaine(req, chemin));
  } catch (e) {
    return json({ erreur: e instanceof Error ? e.message : "erreur Twitch" }, 400);
  }
}
