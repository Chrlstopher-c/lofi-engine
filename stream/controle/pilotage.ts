/**
 * Démarrage, arrêt et état des conteneurs de diffusion.
 * Les commandes sont fixes : rien de ce que fournit l'interface n'entre dans une ligne de commande.
 */
import { resolve } from "node:path";
import type { EtatDiffusion } from "./types.ts";
import { journal } from "./journal.ts";

const RACINE = resolve(process.env.RACINE_PROJET ?? resolve(import.meta.dir, "../.."));
const CORPUS = resolve(process.env.CORPUS_DIR ?? resolve(RACINE, "corpus"));
const CONTENEUR = "lofi-direct";
const DELAI_MS = 180_000;

interface Resultat { ok: boolean; sortie: string; }

async function executer(args: string[]): Promise<Resultat> {
  try {
    const proc = Bun.spawn(args, { cwd: RACINE, stdout: "pipe", stderr: "pipe" });
    const minuteur = setTimeout(() => proc.kill(), DELAI_MS);
    const [sortie, erreurs, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    clearTimeout(minuteur);
    return { ok: code === 0, sortie: `${sortie}${erreurs}`.trim() };
  } catch (erreur) {
    journal.error({ erreur, args }, "commande impossible à lancer");
    return { ok: false, sortie: String(erreur) };
  }
}

async function conteneurActif(nom: string): Promise<{ actif: boolean; depuis: string | null }> {
  const r = await executer(["docker", "inspect", "-f", "{{.State.Running}} {{.State.StartedAt}}", nom]);
  if (!r.ok) return { actif: false, depuis: null };
  const [running, demarre] = r.sortie.split(" ");
  return { actif: running === "true", depuis: running === "true" ? (demarre ?? null) : null };
}

async function mesurerCorpus(): Promise<{ fichiers: number; octets: number }> {
  try {
    const glob = new Bun.Glob("*.{flac,wav,ogg}");
    let fichiers = 0;
    let octets = 0;
    for await (const nom of glob.scan({ cwd: CORPUS })) {
      fichiers += 1;
      octets += Bun.file(resolve(CORPUS, nom)).size;
    }
    return { fichiers, octets };
  } catch (erreur) {
    journal.warn({ erreur, CORPUS }, "corpus illisible");
    return { fichiers: 0, octets: 0 };
  }
}

export async function lireEtat(): Promise<EtatDiffusion> {
  const [direct, site, corpus] = await Promise.all([
    conteneurActif(CONTENEUR),
    conteneurActif("lofi-engine"),
    mesurerCorpus(),
  ]);
  return {
    enMarche: direct.actif,
    conteneur: direct.actif ? CONTENEUR : null,
    depuis: direct.depuis,
    corpusFichiers: corpus.fichiers,
    corpusOctets: corpus.octets,
    siteEnMarche: site.actif,
  };
}

export async function demarrerDiffusion(): Promise<Resultat> {
  journal.info("démarrage de la diffusion");
  return executer(["docker", "compose", "--profile", "direct", "up", "-d", "direct"]);
}

export async function arreterDiffusion(): Promise<Resultat> {
  journal.info("arrêt de la diffusion");
  return executer(["docker", "compose", "--profile", "direct", "stop", "direct"]);
}

export async function lireJournalDiffusion(lignes = 80): Promise<string> {
  const n = Math.min(400, Math.max(10, Math.trunc(lignes)));
  const r = await executer(["docker", "logs", "--tail", String(n), CONTENEUR]);
  return r.ok ? r.sortie : "La diffusion n'a pas encore tourné.";
}
