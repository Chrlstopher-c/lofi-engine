/**
 * En-tête de la chaîne connectée : qui est connecté, avec quelles autorisations, et les deux
 * gestes qui s'y rattachent — déposer la clé de diffusion dans le `.env`, ou se déconnecter.
 * Aucun jeton ne franchit l'API : seule la liste des portées obtenues est lisible ici.
 */
import { useState, type ReactNode } from "react";
import type { EtatTwitch } from "../../twitch/types.ts";
import { Badge, Bouton } from "../commun/composants.tsx";
import type { Twitch } from "./useTwitch.ts";

/**
 * Portées demandées à l'autorisation. Copie de la liste du serveur (`twitch/appareil.ts`) :
 * ce module-là parle à Twitch et n'a rien à faire dans le paquet du navigateur.
 */
const PORTEES_ATTENDUES = [
  "channel:read:stream_key", "channel:manage:broadcast", "channel:manage:videos", "chat:read", "chat:edit",
];

/** Silhouette neutre : l'API ne donne pas l'image de profil, on n'en invente pas une. */
function Avatar(): ReactNode {
  return (
    <div className="avatar fg-2" aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <circle cx="24" cy="18" r="9" fill="currentColor" />
        <path d="M5 48c1-11 9-17 19-17s18 6 19 17Z" fill="currentColor" />
      </svg>
    </div>
  );
}

function Droits({ portees }: { portees: string[] }): ReactNode {
  const manquantes = PORTEES_ATTENDUES.filter((portee) => !portees.includes(portee));
  return (
    <div className="droits">
      {portees.map((portee) => <Badge key={portee}>{portee}</Badge>)}
      {manquantes.map((portee) => (
        <Badge key={portee} sens="warn" voyant>{portee} manquante</Badge>
      ))}
    </div>
  );
}

export function EnteteChaine({ etat, twitch }: { etat: EtatTwitch; twitch: Twitch }): ReactNode {
  const [cleDeposee, setCleDeposee] = useState(false);
  const recuperer = async (): Promise<void> => {
    setCleDeposee(await twitch.recupererCle());
  };
  return (
    <section className="panneau chaine-tete">
      <Avatar />
      <div>
        <h2>
          {etat.utilisateurLogin || "compte connecté"}
          <Badge sens="ok" voyant>compte connecté</Badge>
          {cleDeposee ? <Badge sens="ok">clé déposée dans le .env</Badge> : null}
        </h2>
        <Droits portees={etat.portees} />
      </div>
      <div className="ligne">
        <Bouton petit desactive={twitch.occupe} titre="Écrit la clé dans le .env du diffuseur, sans l'afficher"
          onClick={() => void recuperer()}>Récupérer la clé</Bouton>
        <Bouton petit variante="danger" desactive={twitch.occupe}
          onClick={() => void twitch.deconnecter()}>Déconnecter</Bouton>
      </div>
    </section>
  );
}
