/**
 * Bloc d'une plateforme (Twitch ou YouTube) : activation, serveur d'ingestion, clé de stream.
 * Le serveur ne renvoie jamais la clé : on affiche « enregistrée » ou « absente », et une
 * saisie ne part que si l'utilisateur en tape une nouvelle.
 */
import { useState, type ReactNode } from "react";
import { Bascule, Bouton, Champ, Texte } from "../commun/composants.tsx";

interface Props {
  nom: string;
  actif: boolean;
  cleEnregistree: boolean;
  ingest: string;
  /** Nouvelle clé en attente d'enregistrement, ou `undefined` si on conserve l'existante. */
  nouvelleCle: string | undefined;
  onActif: (actif: boolean) => void;
  onIngest: (ingest: string) => void;
  onNouvelleCle: (cle: string | undefined) => void;
}

type PropsCle = Pick<Props, "cleEnregistree" | "nouvelleCle" | "onNouvelleCle">;

function SaisieCle({ cleEnregistree, nouvelleCle, onNouvelleCle }: PropsCle): ReactNode {
  const [voir, setVoir] = useState(false);
  if (nouvelleCle === undefined) {
    return (
      <div className="ligne-actions">
        <Bouton petit onClick={() => onNouvelleCle("")}>{cleEnregistree ? "Remplacer la clé" : "Saisir la clé"}</Bouton>
        {cleEnregistree
          ? <span className="discret">La clé actuelle est conservée tant qu'on ne la remplace pas.</span>
          : null}
      </div>
    );
  }
  return (
    <Champ libelle={cleEnregistree ? "Nouvelle clé (remplace l'actuelle)" : "Clé de stream"}
      indice="envoyée à l'enregistrement, jamais réaffichée ensuite">
      <span className="saisie-cle">
        <Texte mono type={voir ? "text" : "password"} valeur={nouvelleCle} onChange={onNouvelleCle}
          placeholder="live_…" />
        <Bouton petit variante="discret" onClick={() => setVoir((v) => !v)}>{voir ? "Masquer" : "Voir"}</Bouton>
        <Bouton petit variante="discret" onClick={() => onNouvelleCle(undefined)}>Annuler</Bouton>
      </span>
    </Champ>
  );
}

export function Plateforme(props: Props): ReactNode {
  const { nom, actif, cleEnregistree, ingest, onActif, onIngest } = props;
  return (
    <div className={actif ? "plateforme active" : "plateforme"}>
      <div className="plateforme-entete">
        <Bascule libelle={nom} actif={actif} onChange={onActif} />
        <span className={cleEnregistree ? "etiquette ok" : "etiquette attention"}>
          {cleEnregistree ? "Clé enregistrée" : "Aucune clé"}
        </span>
      </div>
      <Champ libelle="Serveur d'ingestion" indice="rtmp:// ou rtmps://">
        <Texte mono valeur={ingest} onChange={onIngest} />
      </Champ>
      <SaisieCle cleEnregistree={cleEnregistree} nouvelleCle={props.nouvelleCle} onNouvelleCle={props.onNouvelleCle} />
    </div>
  );
}
