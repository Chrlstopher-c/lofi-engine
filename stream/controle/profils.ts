/**
 * Profils de scène : plusieurs configurations nommées, dont une seule est diffusée.
 * Enregistrer un profil ne change pas la scène en cours ; il faut le charger pour cela.
 */
import { resolve, basename } from "node:path";
import type { Scene } from "./types.ts";
import { nettoyerScene, lireScene, ecrireScene } from "./scene.ts";
import { journal } from "./journal.ts";

const CORPUS = resolve(process.env.CORPUS_DIR ?? resolve(import.meta.dir, "../../corpus"));
const DOSSIER = resolve(CORPUS, "profils");

export interface Profil { nom: string; modifie: string; calques: number; }

/** Un nom de profil devient un nom de fichier : rien qui puisse sortir du dossier. */
function nomSur(brut: string): string | null {
  const nom = basename(String(brut ?? "")).trim().replace(/[^\w -]/g, "").slice(0, 60);
  return nom.length > 0 && !nom.startsWith(".") ? nom : null;
}

function chemin(nom: string): string {
  const cible = resolve(DOSSIER, `${nom}.json`);
  if (!cible.startsWith(DOSSIER + "/")) throw new Error("nom de profil refusé");
  return cible;
}

export async function listerProfils(): Promise<Profil[]> {
  try {
    const glob = new Bun.Glob("*.json");
    const profils: Profil[] = [];
    for await (const fichier of glob.scan({ cwd: DOSSIER })) {
      const f = Bun.file(resolve(DOSSIER, fichier));
      const scene = nettoyerScene(await f.json());
      profils.push({
        nom: fichier.replace(/\.json$/, ""),
        modifie: new Date(f.lastModified).toISOString(),
        calques: scene.calques.length,
      });
    }
    return profils.sort((a, b) => a.nom.localeCompare(b.nom));
  } catch (erreur) {
    journal.warn({ erreur, DOSSIER }, "aucun profil lisible");
    return [];
  }
}

/** Enregistre la scène fournie (ou la scène courante) sous un nom. */
export async function enregistrerProfil(nomBrut: string, scene?: unknown): Promise<Profil> {
  const nom = nomSur(nomBrut);
  if (!nom) throw new Error("nom de profil vide ou refusé");
  const contenu = scene === undefined ? await lireScene() : nettoyerScene(scene);
  try {
    await Bun.write(chemin(nom), JSON.stringify(contenu, null, 2));
    journal.info({ nom, calques: contenu.calques.length }, "profil enregistré");
    return { nom, modifie: new Date().toISOString(), calques: contenu.calques.length };
  } catch (erreur) {
    journal.error({ erreur, nom }, "écriture du profil impossible");
    throw new Error(`écriture du profil « ${nom} » impossible`);
  }
}

export async function lireProfil(nomBrut: string): Promise<Scene> {
  const nom = nomSur(nomBrut);
  if (!nom) throw new Error("nom de profil refusé");
  const f = Bun.file(chemin(nom));
  if (!(await f.exists())) throw new Error(`profil « ${nom} » introuvable`);
  return nettoyerScene(await f.json());
}

/** Charge un profil : il devient la scène diffusée. */
export async function chargerProfil(nomBrut: string): Promise<Scene> {
  const scene = await lireProfil(nomBrut);
  const ecrite = await ecrireScene(scene);
  journal.info({ nom: nomBrut }, "profil chargé, il est maintenant diffusé");
  return ecrite;
}

export async function supprimerProfil(nomBrut: string): Promise<void> {
  const nom = nomSur(nomBrut);
  if (!nom) throw new Error("nom de profil refusé");
  try {
    await Bun.file(chemin(nom)).delete();
    journal.info({ nom }, "profil supprimé");
  } catch (erreur) {
    journal.error({ erreur, nom }, "suppression du profil impossible");
    throw new Error(`suppression du profil « ${nom} » impossible`);
  }
}
