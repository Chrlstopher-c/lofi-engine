/** État de l'antenne, lisible de loin. Rien n'y figure que l'API ne fournisse. */
import type { ReactNode } from "react";
import type { EtatDiffusion } from "../../types.ts";
import type { Etat } from "./useEtat.ts";
import { Voyant } from "./composants.tsx";
import { dureeDepuis, octetsLisibles } from "./format.ts";

interface Antenne {
  classe: string;
  sens: "neutre" | "ok" | "warn" | "live" | "danger";
  libelle: string;
  detail: string;
}

function resumeCorpus(etat: EtatDiffusion): string {
  const pluriel = etat.corpusFichiers > 1 ? "s" : "";
  return `${etat.corpusFichiers} fichier${pluriel} · ${octetsLisibles(etat.corpusOctets)}`;
}

/** Le conteneur n'est affiché que si le serveur l'a nommé : rien d'inventé. */
function detailDirect(etat: EtatDiffusion): string {
  const duree = dureeDepuis(etat.depuis);
  return [duree, etat.conteneur].filter(Boolean).join(" · ");
}

function lireAntenne(etat: EtatDiffusion | null, erreur: string | null): Antenne {
  if (!etat) {
    const indisponible = erreur !== null;
    return {
      classe: indisponible ? "antenne erreur" : "antenne",
      sens: indisponible ? "danger" : "neutre",
      libelle: indisponible ? "État indisponible" : "Lecture…",
      detail: indisponible && erreur ? erreur : "",
    };
  }
  if (etat.construction) {
    return { classe: "antenne construction", sens: "warn", libelle: "Construction", detail: "image du diffuseur" };
  }
  if (etat.enMarche) {
    return { classe: "antenne", sens: "live", libelle: "En direct", detail: detailDirect(etat) };
  }
  return { classe: "antenne", sens: "neutre", libelle: "À l'arrêt", detail: "" };
}

export function BarreEtat({ etat, erreur }: Etat): ReactNode {
  const antenne = lireAntenne(etat, erreur);
  return (
    <>
      <div className="services" aria-label="Services">
        <span title={etat?.siteEnMarche ? "Site générateur en marche" : "Site générateur arrêté"}>
          <Voyant sens={etat ? (etat.siteEnMarche ? "ok" : "danger") : "neutre"} />
          Site
        </span>
        <span title="Corpus musical servi au diffuseur">
          <Voyant sens={etat && etat.corpusFichiers > 0 ? "ok" : "neutre"} />
          <span className="mono">{etat ? resumeCorpus(etat) : "…"}</span>
        </span>
      </div>
      <div className={antenne.classe} role="status" aria-live="polite">
        <Voyant sens={antenne.sens} />
        <span>{antenne.libelle}</span>
        {antenne.detail ? <span className="detail">{antenne.detail}</span> : null}
      </div>
    </>
  );
}
