/**
 * Lecture des lignes IRC de Twitch. Tout ce qui arrive par la socket est une entrée écrite
 * par des inconnus : rien n'en sort d'ici sans avoir été mesuré et nettoyé — même esprit
 * que `valider.ts` pour les réponses HTTP.
 *
 * Le texte rendu est du texte, jamais du balisage : les caractères de contrôle sautent, la
 * longueur est bornée, et l'interface l'affiche tel quel sans jamais l'interpréter.
 */

const MAX_TEXTE = 500;
const MAX_AUTEUR = 40;
const FORME_COULEUR = /^#[0-9a-f]{6}$/i;
const CONTROLES = /[\u0000-\u001f\u007f]/g;

export interface LigneIrc {
  etiquettes: Record<string, string>;
  prefixe: string;
  commande: string;
  parametres: string[];
}

export type EvenementChat =
  | { genre: "ping"; jeton: string }
  | { genre: "bienvenue" }
  | { genre: "message"; auteur: string; couleur: string | null; texte: string; horodatage: string }
  | { genre: "avis"; texte: string; authentification: boolean }
  | { genre: "reconnexion" }
  | { genre: "ignore" };

function caractereEchappe(code: string): string {
  if (code === "s") return " ";
  if (code === ":") return ";";
  if (code === "r") return "\r";
  if (code === "n") return "\n";
  return code; // « \\ » compris : le caractère suivant est rendu tel quel
}

/** Les étiquettes IRCv3 échappent l'espace et le point-virgule ; sans cela, un pseudo mentirait. */
function desechapper(valeur: string): string {
  return valeur.replace(/\\(.)/g, (_entier: string, code: string) => caractereEchappe(code));
}

function lireEtiquettes(brut: string): Record<string, string> {
  const etiquettes: Record<string, string> = {};
  for (const paire of brut.split(";")) {
    const separateur = paire.indexOf("=");
    const nom = separateur === -1 ? paire : paire.slice(0, separateur);
    if (nom.length === 0) continue;
    etiquettes[nom] = separateur === -1 ? "" : desechapper(paire.slice(separateur + 1));
  }
  return etiquettes;
}

/** Découpe une ligne IRC ; `null` si elle n'a pas la forme attendue (commande absente). */
export function analyserLigne(brut: string): LigneIrc | null {
  let reste = brut.replace(/[\r\n]+$/, "");
  let etiquettes: Record<string, string> = {};
  let prefixe = "";
  if (reste.startsWith("@")) {
    const fin = reste.indexOf(" ");
    if (fin === -1) return null;
    etiquettes = lireEtiquettes(reste.slice(1, fin));
    reste = reste.slice(fin + 1);
  }
  if (reste.startsWith(":")) {
    const fin = reste.indexOf(" ");
    if (fin === -1) return null;
    prefixe = reste.slice(1, fin);
    reste = reste.slice(fin + 1);
  }
  const coupe = reste.indexOf(" :");
  const final = coupe === -1 ? null : reste.slice(coupe + 2);
  const tetes = (coupe === -1 ? reste : reste.slice(0, coupe)).split(" ").filter((mot) => mot.length > 0);
  const commande = tetes.shift();
  if (!commande) return null;
  const parametres = final === null ? tetes : [...tetes, final];
  return { etiquettes, prefixe, commande: commande.toUpperCase(), parametres };
}

/** Un `/me` arrive emballé dans des caractères de contrôle : on garde le texte, pas l'emballage. */
function nettoyerTexte(brut: string): string {
  const action = /^\u0001ACTION ([\s\S]*)\u0001$/.exec(brut);
  return (action?.[1] ?? brut).replace(CONTROLES, " ").trim().slice(0, MAX_TEXTE);
}

function nettoyerAuteur(brut: string): string {
  return brut.replace(CONTROLES, "").trim().slice(0, MAX_AUTEUR);
}

/** Couleur telle que Twitch la fournit, ou rien : aucune couleur n'est inventée. */
function lireCouleur(etiquettes: Record<string, string>): string | null {
  const brut = etiquettes.color ?? "";
  return FORME_COULEUR.test(brut) ? brut.toLowerCase() : null;
}

/** Horodatage de Twitch s'il est fourni, heure de réception sinon — jamais une date inventée. */
function lireHorodatage(etiquettes: Record<string, string>): string {
  const brut = etiquettes["tmi-sent-ts"] ?? "";
  const instant = /^\d{10,16}$/.test(brut) ? Number(brut) : NaN;
  return Number.isFinite(instant) ? new Date(instant).toISOString() : new Date().toISOString();
}

function pseudoDe(prefixe: string): string {
  const separateur = prefixe.indexOf("!");
  return separateur === -1 ? prefixe : prefixe.slice(0, separateur);
}

const MARQUEURS_AUTH = ["login authentication failed", "improperly formatted auth", "login unsuccessful"];

function lireMessage(ligne: LigneIrc): EvenementChat {
  const texte = nettoyerTexte(ligne.parametres[ligne.parametres.length - 1] ?? "");
  const auteur = nettoyerAuteur(ligne.etiquettes["display-name"] || pseudoDe(ligne.prefixe));
  if (texte.length === 0 || auteur.length === 0) return { genre: "ignore" };
  return {
    genre: "message",
    auteur,
    couleur: lireCouleur(ligne.etiquettes),
    texte,
    horodatage: lireHorodatage(ligne.etiquettes),
  };
}

function lireAvis(ligne: LigneIrc): EvenementChat {
  const texte = nettoyerTexte(ligne.parametres[ligne.parametres.length - 1] ?? "");
  const bas = texte.toLowerCase();
  return { genre: "avis", texte, authentification: MARQUEURS_AUTH.some((marqueur) => bas.includes(marqueur)) };
}

/** Traduit une ligne en évènement du domaine ; tout ce qui n'est pas compris est ignoré. */
export function evenementDe(brut: string): EvenementChat {
  const ligne = analyserLigne(brut);
  if (!ligne) return { genre: "ignore" };
  if (ligne.commande === "PING") return { genre: "ping", jeton: ligne.parametres[0] ?? "tmi.twitch.tv" };
  if (ligne.commande === "001") return { genre: "bienvenue" };
  if (ligne.commande === "RECONNECT") return { genre: "reconnexion" };
  if (ligne.commande === "PRIVMSG") return lireMessage(ligne);
  if (ligne.commande === "NOTICE") return lireAvis(ligne);
  return { genre: "ignore" };
}
