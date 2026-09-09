/**
 * Onglet Twitch : compte, état de la chaîne, réglages du live, rediffusions.
 * Tant qu'aucun compte n'est connecté, seul le bloc de connexion est monté — les autres
 * appelleraient l'API de Twitch sans jeton.
 */
import type { ReactNode } from "react";
import { Alerte } from "../commun/composants.tsx";
import { useTwitch } from "./useTwitch.ts";
import { Compte } from "./Compte.tsx";
import { Direct } from "./Direct.tsx";
import { ChaineTwitch } from "./Chaine.tsx";
import { Rediffusions } from "./Rediffusions.tsx";

export function PanneauTwitch(): ReactNode {
  const twitch = useTwitch();
  const connecte = twitch.etat?.compteConnecte === true;
  return (
    <div className="panneau-twitch">
      <Alerte message={twitch.erreur} onFermer={twitch.effacerErreur} />
      <Compte twitch={twitch} />
      {connecte ? <Direct /> : null}
      {connecte ? <ChaineTwitch /> : null}
      {connecte ? <Rediffusions /> : null}
    </div>
  );
}
