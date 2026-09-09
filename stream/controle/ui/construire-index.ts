/**
 * Étape finale du build : copie index.html dans dist/ en y inscrivant l'empreinte du bundle,
 * pour que le navigateur recharge les fichiers à chaque déploiement.
 */
import { resolve } from "node:path";

const UI = import.meta.dir;
const DIST = resolve(UI, "dist");

async function empreinte(): Promise<string> {
  const bundle = Bun.file(resolve(DIST, "main.js"));
  if (!(await bundle.exists())) throw new Error("dist/main.js absent : le bundle n'a pas été produit");
  const hachage = new Bun.CryptoHasher("sha1");
  hachage.update(await bundle.arrayBuffer());
  return hachage.digest("hex").slice(0, 10);
}

/**
 * styles.css n'est qu'une liste d'@import : si le bundler ne les replie pas, la feuille servie
 * pointe vers des fichiers absents de dist/ et la page sort sans aucun style. Panne muette,
 * donc contrôlée ici.
 */
async function verifierFeuille(): Promise<void> {
  const feuille = Bun.file(resolve(DIST, "main.css"));
  if (!(await feuille.exists())) throw new Error("dist/main.css absent : la feuille n'a pas été produite");
  const contenu = await feuille.text();
  if (contenu.includes("@import")) {
    throw new Error("dist/main.css contient encore un @import : les feuilles de ui/styles/ ne sont pas repliées");
  }
}

async function construire(): Promise<void> {
  await verifierFeuille();
  const modele = await Bun.file(resolve(UI, "index.html")).text();
  if (!modele.includes("__VERSION__")) throw new Error("index.html sans marqueur __VERSION__");
  const version = await empreinte();
  await Bun.write(resolve(DIST, "index.html"), modele.replaceAll("__VERSION__", version));
  console.log(`dist/index.html écrit (version ${version})`);
}

construire().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : String(erreur));
  process.exit(1);
});
