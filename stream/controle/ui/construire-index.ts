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

async function construire(): Promise<void> {
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
