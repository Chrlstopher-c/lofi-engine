/**
 * Centre de contrôle du stream : API et interface.
 * Sert l'interface d'administration et expose ce qu'elle pilote — scène, diffusion, fonds.
 */
import { resolve, join, normalize } from "node:path";
import { lireScene, ecrireScene } from "./scene.ts";
import { lireDiffusion, ecrireDiffusion } from "./diffusion.ts";
import { lireEtat, demarrerDiffusion, arreterDiffusion, lireJournalDiffusion } from "./pilotage.ts";
import { listerFonds, deposerFond, supprimerFond } from "./fonds.ts";
import {
  listerProfils, enregistrerProfil, chargerProfil, supprimerProfil,
} from "./profils.ts";
import { routerTwitch } from "./twitch/routes.ts";
import { demarrerEchantillonnage } from "./twitch/historique.ts";
import { demarrerSurveillanceArchivage } from "./twitch/archivage.ts";
import { journal } from "./journal.ts";

const PORT = Number(process.env.CONTROLE_PORT ?? 4708);
const HOTE = process.env.CONTROLE_HOST ?? "0.0.0.0";
const UI = resolve(import.meta.dir, "ui/dist");

function json(donnees: unknown, statut = 200): Response {
  return new Response(JSON.stringify(donnees), {
    status: statut,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function erreur(message: string, statut = 400): Response {
  return json({ erreur: message }, statut);
}

async function corpsJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new Error("corps de requête illisible (JSON attendu)");
  }
}

async function routerApi(req: Request, chemin: string): Promise<Response | null> {
  const m = req.method;
  if (chemin === "/api/scene" && m === "GET") return json(await lireScene());
  if (chemin === "/api/scene" && m === "PUT") return json(await ecrireScene(await corpsJson(req)));
  if (chemin === "/api/diffusion" && m === "GET") return json(await lireDiffusion());
  if (chemin === "/api/diffusion" && m === "PUT") {
    return json(await ecrireDiffusion(await corpsJson(req)));
  }
  if (chemin === "/api/etat" && m === "GET") return json(await lireEtat());
  if (chemin === "/api/journal" && m === "GET") {
    return json({ texte: await lireJournalDiffusion() });
  }
  const twitch = await routerTwitch(req, chemin);
  return twitch ?? routerActions(req, chemin);
}

async function routerActions(req: Request, chemin: string): Promise<Response | null> {
  const m = req.method;
  if (chemin === "/api/diffusion/demarrer" && m === "POST") {
    const conf = await lireDiffusion();
    if (!conf.twitchActif && !conf.youtubeActif) {
      return erreur("Aucune plateforme activée : cocher Twitch et/ou YouTube.");
    }
    if (conf.twitchActif && !conf.twitchCle) return erreur("Clé Twitch manquante.");
    if (conf.youtubeActif && !conf.youtubeCle) return erreur("Clé YouTube manquante.");
    const r = await demarrerDiffusion();
    return r.ok ? json({ ok: true, sortie: r.sortie }) : erreur(r.sortie || "démarrage refusé", 500);
  }
  if (chemin === "/api/diffusion/arreter" && m === "POST") {
    const r = await arreterDiffusion();
    return r.ok ? json({ ok: true, sortie: r.sortie }) : erreur(r.sortie || "arrêt refusé", 500);
  }
  const fonds = await routerFonds(req, chemin);
  return fonds ?? routerProfils(req, chemin);
}

async function routerProfils(req: Request, chemin: string): Promise<Response | null> {
  const m = req.method;
  if (chemin === "/api/profils" && m === "GET") return json(await listerProfils());
  if (chemin === "/api/profils" && m === "POST") {
    const corps = (await corpsJson(req)) as { nom?: string; scene?: unknown };
    if (!corps?.nom) return erreur("nom de profil manquant");
    return json(await enregistrerProfil(corps.nom, corps.scene));
  }
  if (chemin.startsWith("/api/profils/") && chemin.endsWith("/charger") && m === "POST") {
    const nom = decodeURIComponent(chemin.slice("/api/profils/".length, -"/charger".length));
    return json(await chargerProfil(nom));
  }
  if (chemin.startsWith("/api/profils/") && m === "DELETE") {
    await supprimerProfil(decodeURIComponent(chemin.slice("/api/profils/".length)));
    return json({ ok: true });
  }
  return null;
}

async function routerFonds(req: Request, chemin: string): Promise<Response | null> {
  const m = req.method;
  if (chemin === "/api/fonds" && m === "GET") return json(await listerFonds());
  if (chemin === "/api/fonds" && m === "POST") {
    const form = await req.formData();
    const fichier = form.get("fichier");
    if (!(fichier instanceof File)) return erreur("aucun fichier reçu");
    return json(await deposerFond(fichier));
  }
  if (chemin.startsWith("/api/fonds/") && m === "DELETE") {
    await supprimerFond(decodeURIComponent(chemin.slice("/api/fonds/".length)));
    return json({ ok: true });
  }
  return null;
}

/** Sert l'interface construite ; toute route inconnue retombe sur la page. */
async function servirUi(chemin: string): Promise<Response> {
  const demande = chemin === "/" ? "/index.html" : chemin;
  const cible = resolve(join(UI, normalize(demande)));
  if (cible === UI || cible.startsWith(UI + "/")) {
    const f = Bun.file(cible);
    if (await f.exists()) return new Response(f);
  }
  const index = Bun.file(join(UI, "index.html"));
  if (await index.exists()) return new Response(index);
  return new Response(
    "Interface non construite. Lancer : bun run build-ui dans stream/controle/",
    { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}

Bun.serve({
  port: PORT,
  hostname: HOTE,
  idleTimeout: 120,
  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    try {
      const reponse = await routerApi(req, pathname);
      if (reponse) return reponse;
      return await servirUi(pathname);
    } catch (e) {
      const message = e instanceof Error ? e.message : "erreur interne";
      journal.error({ erreur: e, pathname }, "requête en échec");
      return erreur(message, 500);
    }
  },
});

// Deux tâches de fond, toutes deux inertes tant qu'aucun compte Twitch n'est connecté :
// le relevé des spectateurs (une mesure par minute, pendant le direct seulement) et la
// suppression automatique des rediffusions (désactivée par défaut).
demarrerEchantillonnage();
demarrerSurveillanceArchivage();

journal.info({ port: PORT, hote: HOTE }, "centre de contrôle en écoute");
