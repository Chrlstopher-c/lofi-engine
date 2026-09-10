/**
 * Lecture et écriture du `.env` du projet.
 *
 * Partagé par la diffusion et Pixabay : les deux y déposent un secret, et deux implémentations
 * du même format finiraient par ne plus écrire pareil. L'écriture conserve les commentaires et
 * l'ordre du fichier — un `.env` réécrit à plat est illisible le lendemain.
 *
 * Rien de ce qui est lu ici ne ressort par l'API : une clé enregistrée n'est jamais renvoyée,
 * seule son existence l'est.
 */
import { resolve } from "node:path";
import { journal } from "./journal.ts";

const RACINE = resolve(process.env.RACINE_PROJET ?? resolve(import.meta.dir, "../.."));
const ENV = resolve(RACINE, ".env");

export async function lireEnv(): Promise<Map<string, string>> {
  const valeurs = new Map<string, string>();
  try {
    const f = Bun.file(ENV);
    if (!(await f.exists())) return valeurs;
    for (const ligne of (await f.text()).split("\n")) {
      const nette = ligne.trim();
      if (!nette || nette.startsWith("#")) continue;
      const sep = nette.indexOf("=");
      if (sep > 0) valeurs.set(nette.slice(0, sep).trim(), nette.slice(sep + 1).trim());
    }
  } catch (erreur) {
    journal.error({ erreur, chemin: ENV }, "lecture du .env impossible");
  }
  return valeurs;
}

/** Réécrit les clés demandées en conservant commentaires et ordre du fichier. */
export async function ecrireEnv(modifs: Map<string, string>): Promise<void> {
  const f = Bun.file(ENV);
  const source = (await f.exists()) ? await f.text() : "";
  const restantes = new Map(modifs);
  const lignes = source.split("\n").map((ligne) => {
    const nette = ligne.trim();
    if (!nette || nette.startsWith("#")) return ligne;
    const sep = nette.indexOf("=");
    if (sep <= 0) return ligne;
    const nom = nette.slice(0, sep).trim();
    if (!restantes.has(nom)) return ligne;
    const valeur = restantes.get(nom) as string;
    restantes.delete(nom);
    return `${nom}=${valeur}`;
  });
  for (const [nom, valeur] of restantes) lignes.push(`${nom}=${valeur}`);
  await Bun.write(ENV, lignes.join("\n"));
  journal.info({ clefs: [...modifs.keys()] }, "écriture dans le .env");
}
