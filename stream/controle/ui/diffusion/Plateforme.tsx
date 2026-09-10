/**
 * Une destination de diffusion : activation, serveur d'ingestion, clé de stream.
 * Le serveur ne renvoie jamais la clé — on affiche son existence, jamais sa valeur, et une
 * saisie ne part que si l'utilisateur en tape une nouvelle.
 */
import { useState, type ReactNode } from "react";
import { Badge, Bascule, Bouton, BoutonIcone, Champ, Texte } from "../commun/composants.tsx";

export type Marque = "twitch" | "youtube";

/** Logos des plateformes, en tracé plein : la couleur suit celle du texte. */
const LOGOS: Readonly<Record<Marque, ReactNode>> = {
  twitch: (
    <path d="M4 2 2 6v14h5v3h3l3-3h4l5-5V2H4Zm16 12-3 3h-5l-3 3v-3H6V4h14v10Zm-4-7h2v5h-2V7Zm-5
      0h2v5h-2V7Z" />
  ),
  youtube: (
    <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12
      31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.4-1.6.5-3.2.5-4.8s-.1
      -3.2-.5-4.8ZM9.8 15.1V8.9l6 3.1-6 3.1Z" />
  ),
};

interface Props {
  nom: string;
  marque: Marque;
  actif: boolean;
  cleEnregistree: boolean;
  ingest: string;
  /** Nouvelle clé en attente d'enregistrement, ou `undefined` si on conserve l'existante. */
  nouvelleCle: string | undefined;
  /** L'état de cette destination dans le flux en cours. null quand rien ne diffuse. */
  etatFlux: "active" | "refusee" | null;
  onActif: (actif: boolean) => void;
  onIngest: (ingest: string) => void;
  onNouvelleCle: (cle: string | undefined) => void;
}

type PropsCle = Pick<Props, "cleEnregistree" | "nouvelleCle" | "onNouvelleCle">;

function Saisie({ cleEnregistree, nouvelleCle, onNouvelleCle }: PropsCle): ReactNode {
  const [voir, setVoir] = useState(false);
  if (nouvelleCle === undefined) return null;
  return (
    <Champ libelle={cleEnregistree ? "Nouvelle clé (remplace l'actuelle)" : "Clé de stream"}
      indice="Envoyée à l'enregistrement, jamais réaffichée ensuite.">
      <span className="ligne">
        <Texte mono type={voir ? "text" : "password"} valeur={nouvelleCle} onChange={onNouvelleCle}
          placeholder="live_…" />
        <BoutonIcone nom={voir ? "oeil-barre" : "oeil"} titre={voir ? "Masquer la clé" : "Voir la clé"}
          variante="discret" onClick={() => setVoir((v) => !v)} />
        <BoutonIcone nom="croix" titre="Abandonner la saisie" variante="discret"
          onClick={() => onNouvelleCle(undefined)} />
      </span>
    </Champ>
  );
}

function EtatCle({ cleEnregistree, nouvelleCle, onNouvelleCle }: PropsCle): ReactNode {
  if (nouvelleCle !== undefined) return null;
  return (
    <div className="cle">
      <Badge sens={cleEnregistree ? "ok" : "warn"} voyant>
        {cleEnregistree ? "clé enregistrée" : "aucune clé"}
      </Badge>
      <Bouton petit onClick={() => onNouvelleCle("")}>
        {cleEnregistree ? "Remplacer la clé…" : "Saisir la clé…"}
      </Bouton>
    </div>
  );
}

/**
 * Le muxer `tee` abandonne une sortie qui refuse et continue sur l'autre, sans rien dire. Ce
 * badge est le seul endroit où ça se voit : « refusée » veut dire que cette plateforme est
 * sortie du flux pour toute sa durée, et qu'il faut relancer la diffusion pour la reprendre.
 */
function EtatFlux({ etatFlux }: { etatFlux: Props["etatFlux"] }): ReactNode {
  if (etatFlux === null) return null;
  return (
    <Badge sens={etatFlux === "active" ? "live" : "danger"} voyant>
      {etatFlux === "active" ? "reçoit le flux" : "refusée — relancer pour reprendre"}
    </Badge>
  );
}

export function Plateforme(props: Props): ReactNode {
  const { nom, marque, actif, cleEnregistree, ingest, nouvelleCle, onActif, onIngest, onNouvelleCle } = props;
  return (
    <div className={actif ? "destination" : "destination inactive"}>
      <div className="destination-tete">
        <span className="nom">
          <svg viewBox="0 0 24 24" aria-hidden="true">{LOGOS[marque]}</svg>
          {nom}
        </span>
        <span className="pousse">
          <EtatFlux etatFlux={props.etatFlux} />
          <Bascule libelle="Diffuser" petit actif={actif} onChange={onActif} />
        </span>
      </div>
      <Champ libelle="Serveur d'ingestion" note="rtmp(s)">
        <Texte mono valeur={ingest} onChange={onIngest} />
      </Champ>
      <EtatCle cleEnregistree={cleEnregistree} nouvelleCle={nouvelleCle} onNouvelleCle={onNouvelleCle} />
      <Saisie cleEnregistree={cleEnregistree} nouvelleCle={nouvelleCle} onNouvelleCle={onNouvelleCle} />
      <span className="aide">Écrite dans le .env du diffuseur, jamais réaffichée.</span>
    </div>
  );
}
