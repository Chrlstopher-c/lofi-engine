/**
 * Les trois services dont dépend un direct : le site qui produit l'audio, le corpus de repli,
 * et l'encodage tel qu'il est configuré. Rien ici n'est mesuré côté machine — seul l'état que
 * le serveur renvoie est affiché.
 */
import type { ReactNode } from "react";
import type { Diffusion, EtatDiffusion } from "../../types.ts";
import { origineScene } from "../commun/api.ts";
import { Voyant } from "../commun/composants.tsx";
import { octetsLisibles } from "../commun/format.ts";

interface Props { etat: EtatDiffusion | null; conf: Diffusion; }

function Service({ libelle, valeur, detail }: { libelle: string; valeur: ReactNode; detail: string }): ReactNode {
  return (
    <div className="service">
      <span className="l">{libelle}</span>
      <span className="v">{valeur}</span>
      <span className="d" title={detail}>{detail}</span>
    </div>
  );
}

function corpus(etat: EtatDiffusion): string {
  const pluriel = etat.corpusFichiers > 1 ? "s" : "";
  return `${etat.corpusFichiers} fichier${pluriel}`;
}

export function Services({ etat, conf }: Props): ReactNode {
  const site = etat?.siteEnMarche === true;
  return (
    <div className="services-grille">
      <Service libelle="Site générateur"
        valeur={<><Voyant sens={etat ? (site ? "ok" : "danger") : "neutre"} />{site ? "Actif" : "Arrêté"}</>}
        detail={origineScene()} />
      <Service libelle="Corpus de repli"
        valeur={etat ? corpus(etat) : "…"}
        detail={etat ? `${octetsLisibles(etat.corpusOctets)} · pris si le générateur se tait` : ""} />
      <Service libelle="Encodage"
        valeur={`${conf.resolution} · ${conf.fps} i/s`}
        detail={`${conf.bitrateVideo} vidéo · ${conf.bitrateAudio} audio`} />
    </div>
  );
}
