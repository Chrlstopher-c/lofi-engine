/**
 * État réel de la chaîne vu depuis Twitch — en direct ou non.
 * Relu toutes les 30 s au plus, et sur demande. Hors direct, rien n'est affiché de ce que
 * Twitch ne donne pas : pas de zéro de complaisance.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { DirectTwitch } from "../../twitch/types.ts";
import { Alerte, Bouton, Section } from "../commun/composants.tsx";
import { dureeDepuis, messageErreur } from "../commun/format.ts";
import { apiTwitch } from "./api-twitch.ts";
import { nombreLisible } from "./format-twitch.ts";

const INTERVALLE_MS = 30_000;

function Details({ direct }: { direct: DirectTwitch }): ReactNode {
  if (!direct.enDirect) return <p className="discret">La chaîne n'émet pas en ce moment.</p>;
  const duree = dureeDepuis(direct.depuis);
  return (
    <dl className="twitch-direct">
      {direct.titre ? <div><dt>Titre</dt><dd>{direct.titre}</dd></div> : null}
      {direct.categorieNom ? <div><dt>Catégorie</dt><dd>{direct.categorieNom}</dd></div> : null}
      {direct.spectateurs !== null
        ? <div><dt>Spectateurs</dt><dd className="mono">{nombreLisible(direct.spectateurs)}</dd></div>
        : null}
      {duree ? <div><dt>En direct depuis</dt><dd className="mono">{duree}</dd></div> : null}
    </dl>
  );
}

export function Direct(): ReactNode {
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

  const voyant = direct?.enDirect === true;
  return (
    <Section titre="État de la chaîne"
      actions={<Bouton petit variante="discret" onClick={() => void rafraichir()}>Actualiser</Bouton>}>
      <div className="twitch-etat-ligne">
        <span className={voyant ? "voyant actif" : "voyant"} aria-hidden="true" />
        <span className="statut">{voyant ? "En direct" : "Hors ligne"}</span>
      </div>
      <Alerte message={erreur} onFermer={() => setErreur(null)} />
      {direct ? <Details direct={direct} /> : <p className="discret">Lecture…</p>}
    </Section>
  );
}
