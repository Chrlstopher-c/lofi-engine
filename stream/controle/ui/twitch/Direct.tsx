/**
 * État réel de la chaîne vu depuis Twitch — en direct ou non.
 * Relu toutes les 30 s au plus, et sur demande. Hors direct, rien n'est affiché de ce que
 * Twitch ne donne pas : pas de zéro de complaisance.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { DirectTwitch } from "../../twitch/types.ts";
import { dureeDepuis, messageErreur } from "../commun/format.ts";
import { apiTwitch } from "./api-twitch.ts";
import { heureLisible, nombreLisible } from "./format-twitch.ts";

const INTERVALLE_MS = 30_000;

export interface LectureDirect {
  direct: DirectTwitch | null;
  erreur: string | null;
  rafraichir: () => Promise<void>;
  effacerErreur: () => void;
}

export function useDirect(): LectureDirect {
  const [direct, setDirect] = useState<DirectTwitch | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const rafraichir = useCallback(async (): Promise<void> => {
    try {
      setDirect(await apiTwitch.lireDirect());
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);

  useEffect(() => {
    void rafraichir(); // première lecture ; l'erreur éventuelle va dans l'état
    const minuteur = window.setInterval(() => void rafraichir(), INTERVALLE_MS);
    return () => window.clearInterval(minuteur);
  }, [rafraichir]);

  return { direct, erreur, rafraichir, effacerErreur: () => setErreur(null) };
}

/** Depuis quand la chaîne émet : l'heure de départ et la durée écoulée. */
function depuisQuand(direct: DirectTwitch): string {
  const heure = direct.depuis ? heureLisible(direct.depuis) : "";
  const duree = dureeDepuis(direct.depuis);
  return [heure, duree].filter(Boolean).join(" · ");
}

interface ConstatProps { direct: DirectTwitch | null; langue: string; }

/** Ce que Twitch renvoie de la chaîne, à côté de ce qui est en cours d'édition. */
export function Constat({ direct, langue }: ConstatProps): ReactNode {
  if (!direct) return <p className="chargement">Lecture de l'état de la chaîne…</p>;
  if (!direct.enDirect) {
    return (
      <dl className="kv">
        <dt>État</dt><dd>La chaîne n'émet pas en ce moment.</dd>
        {langue ? <><dt>Langue</dt><dd>{langue}</dd></> : null}
      </dl>
    );
  }
  const emission = depuisQuand(direct);
  return (
    <dl className="kv">
      {direct.titre ? <><dt>Titre</dt><dd title={direct.titre}>{direct.titre}</dd></> : null}
      {direct.categorieNom ? <><dt>Catégorie</dt><dd>{direct.categorieNom}</dd></> : null}
      {emission ? <><dt>En direct depuis</dt><dd className="mono">{emission}</dd></> : null}
      {direct.spectateurs !== null
        ? <><dt>Spectateurs</dt><dd className="mono">{nombreLisible(direct.spectateurs)}</dd></>
        : null}
      {langue ? <><dt>Langue</dt><dd>{langue}</dd></> : null}
    </dl>
  );
}
