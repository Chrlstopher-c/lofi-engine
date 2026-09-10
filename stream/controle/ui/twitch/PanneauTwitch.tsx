/**
 * Onglet Twitch : la chaîne à gauche, le chat en colonne pleine hauteur à droite.
 * Tant qu'aucun compte n'est connecté, seul le bloc de connexion est monté — les autres
 * appelleraient l'API de Twitch sans jeton.
 */
import type { ReactNode } from "react";
import { Alerte } from "../commun/composants.tsx";
import { useTwitch } from "./useTwitch.ts";
import { Aptitude } from "./Aptitude.tsx";
import { Compte } from "./Compte.tsx";
import { EnteteChaine } from "./Entete.tsx";
import { ChaineTwitch } from "./Chaine.tsx";
import { Rediffusions } from "./Rediffusions.tsx";
import { Statistiques } from "./Statistiques.tsx";
import { Chat } from "./Chat.tsx";

export function PanneauTwitch(): ReactNode {
  const twitch = useTwitch();
  const etat = twitch.etat;
  const avis = <Alerte message={twitch.erreur} onFermer={twitch.effacerErreur} />;

  if (etat?.compteConnecte !== true) {
    return <div className="colonne">{avis}<Compte twitch={twitch} /></div>;
  }
  return (
    <div className="twitch">
      <div className="colonne">
        {avis}
        <Aptitude />
        <EnteteChaine etat={etat} twitch={twitch} />
        <Statistiques />
        <div className="grille-2">
          {/* Chaque panneau dans sa colonne : sinon la marge entre panneaux voisins s'ajoute. */}
          <div className="colonne"><ChaineTwitch /></div>
          <div className="colonne"><Rediffusions /></div>
        </div>
      </div>
      <Chat portees={etat.portees} moi={etat.utilisateurLogin} />
    </div>
  );
}
