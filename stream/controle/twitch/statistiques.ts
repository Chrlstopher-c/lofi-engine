/**
 * Statistiques de la chaîne : spectateurs, abonnés, et ce que l'API ne donne pas — le pic,
 * la moyenne et la courbe, tous trois calculés sur les relevés échantillonnés localement.
 *
 * Une valeur absente vaut `null` et ne s'affiche pas. Aucun zéro n'est fabriqué pour
 * remplir une case.
 */
import type { PointSpectateurs, StatistiquesTwitch } from "./types.ts";
import { appelHelix, identifiantChaine } from "./client.ts";
import { lireDirect } from "./chaine.ts";
import { lireReleves, type Releve } from "./historique.ts";
import { objet, entier } from "./valider.ts";
import { journal } from "../journal.ts";

/** Assez de points pour une courbe lisible, assez peu pour une réponse légère. */
const MAX_POINTS = 240;

/**
 * `total` est le seul champ utile ici, et il est lisible avec les portées déjà accordées.
 * Un échec ne fait pas tomber le reste : le nombre devient absent, pas faux.
 */
async function compterAbonnes(): Promise<number | null> {
  try {
    const corps = await appelHelix("/channels/followers", {
      requete: { broadcaster_id: await identifiantChaine(), first: "1" },
    });
    return entier(objet(corps), "total");
  } catch (erreur) {
    journal.warn({ erreur }, "nombre d'abonnés Twitch indisponible");
    return null;
  }
}

/** Garde un point sur n, en conservant le dernier : la courbe reste fidèle, la réponse bornée. */
function reduire(liste: Releve[], max: number): Releve[] {
  if (liste.length <= max) return liste;
  const pas = Math.ceil(liste.length / max);
  const gardes = liste.filter((_releve, rang) => rang % pas === 0);
  const dernier = liste[liste.length - 1];
  if (dernier && gardes[gardes.length - 1] !== dernier) gardes.push(dernier);
  return gardes;
}

interface Resume {
  pic: number | null;
  moyenne: number | null;
}

function resumer(valeurs: number[]): Resume {
  if (valeurs.length === 0) return { pic: null, moyenne: null };
  const somme = valeurs.reduce((total, valeur) => total + valeur, 0);
  const pic = valeurs.reduce((haut, valeur) => (valeur > haut ? valeur : haut), valeurs[0] ?? 0);
  return { pic, moyenne: Math.round(somme / valeurs.length) };
}

function enPoints(liste: Releve[]): PointSpectateurs[] {
  return liste.map((releve) => ({ instant: new Date(releve.t).toISOString(), spectateurs: releve.v }));
}

export async function lireStatistiques(): Promise<StatistiquesTwitch> {
  const direct = await lireDirect();
  const abonnes = await compterAbonnes();
  const releves = await lireReleves();
  const debutMs = direct.depuis ? Date.parse(direct.depuis) : Number.NaN;
  const sessionEnCours = direct.enDirect && Number.isFinite(debutMs);
  const session = sessionEnCours ? releves.filter((releve) => releve.t >= debutMs) : [];
  // Le relevé courant n'est pas encore dans l'historique : il compte quand même pour le pic.
  const mesures = sessionEnCours && direct.spectateurs !== null
    ? [...session.map((releve) => releve.v), direct.spectateurs]
    : session.map((releve) => releve.v);
  const { pic, moyenne } = resumer(mesures);
  return {
    enDirect: direct.enDirect,
    spectateurs: direct.spectateurs,
    abonnes,
    depuis: direct.depuis,
    pic,
    moyenne,
    points: enPoints(reduire(sessionEnCours ? session : releves.slice(-MAX_POINTS), MAX_POINTS)),
    sessionEnCours,
  };
}
