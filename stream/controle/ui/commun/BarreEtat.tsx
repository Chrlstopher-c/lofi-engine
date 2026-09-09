/** Bandeau d'état permanent : diffusion, site, corpus. Rien n'y figure que l'API ne fournisse. */
import type { ReactNode } from "react";
import type { EtatDiffusion } from "../../types.ts";
import type { Etat } from "./useEtat.ts";
import { dureeDepuis, octetsLisibles } from "../commun/format.ts";

function Voyant({ actif, libelle, detail }: { actif: boolean | null; libelle: string; detail?: string }): ReactNode {
  const classe = actif === null ? "voyant inconnu" : actif ? "voyant actif" : "voyant";
  return (
    <span className="etat-item">
      <span className={classe} aria-hidden="true" />
      <span>{libelle}</span>
      {detail ? <span className="discret">{detail}</span> : null}
    </span>
  );
}

function resumeCorpus(etat: EtatDiffusion): string {
  const pluriel = etat.corpusFichiers > 1 ? "s" : "";
  return `${etat.corpusFichiers} fichier${pluriel} · ${octetsLisibles(etat.corpusOctets)}`;
}

export function BarreEtat({ etat, erreur }: Etat): ReactNode {
  if (erreur && !etat) {
    return <div className="barre-etat"><span className="etat-item erreur">État indisponible : {erreur}</span></div>;
  }
  const diffusion = etat ? etat.enMarche : null;
  const duree = etat?.enMarche ? dureeDepuis(etat.depuis) : "";
  return (
    <div className="barre-etat">
      <Voyant actif={diffusion} libelle={diffusion ? "Diffusion en marche" : "Diffusion à l'arrêt"}
        detail={duree ? `depuis ${duree}` : undefined} />
      <Voyant actif={etat ? etat.siteEnMarche : null} libelle={etat?.siteEnMarche ? "Site actif" : "Site arrêté"} />
      <span className="etat-item">
        <span className="discret">Corpus</span>
        <span className="mono">
          {etat ? resumeCorpus(etat) : "…"}
        </span>
      </span>
      {erreur ? <span className="etat-item erreur">{erreur}</span> : null}
    </div>
  );
}
