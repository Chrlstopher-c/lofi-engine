/** Barre d'outils du canevas : état d'enregistrement, mode d'aperçu, surcouches et zoom. */
import type { ReactNode } from "react";
import { Badge, BoutonIcone, Segments } from "../commun/composants.tsx";
import { ZOOMS, zoomVoisin, type Mode, type OptionsCanevas } from "./optionsCanevas.ts";

interface Props {
  modifie: boolean;
  options: OptionsCanevas;
}

const MODES: ReadonlyArray<{ valeur: Mode; libelle: string }> = [
  { valeur: "composition", libelle: "Composition" },
  { valeur: "direct", libelle: "Rendu direct" },
];

function Surcouches({ options }: { options: OptionsCanevas }): ReactNode {
  const inactif = options.mode !== "composition";
  return (
    <>
      <BoutonIcone nom="grille" titre="Grille" variante="secondaire" desactive={inactif}
        presse={options.grille} onClick={options.basculerGrille} />
      <BoutonIcone nom="zone-sure" titre="Zone sûre Twitch" variante="secondaire" desactive={inactif}
        presse={options.zone} onClick={options.basculerZone} />
      <BoutonIcone nom="aimant" titre="Aimantation aux repères du cadre" variante="secondaire"
        desactive={inactif} presse={options.aimant} onClick={options.basculerAimant} />
    </>
  );
}

function Zoom({ options }: { options: OptionsCanevas }): ReactNode {
  const premier = ZOOMS[0] ?? 100;
  const dernier = ZOOMS[ZOOMS.length - 1] ?? 100;
  return (
    <>
      <BoutonIcone nom="zoom-moins" titre="Réduire l'aperçu" desactive={options.zoom === premier}
        onClick={() => options.zoomer(zoomVoisin(options.zoom, -1))} />
      <span className="zoom">{options.zoom} %</span>
      <BoutonIcone nom="zoom-plus" titre="Agrandir l'aperçu" desactive={options.zoom === dernier}
        onClick={() => options.zoomer(zoomVoisin(options.zoom, 1))} />
      <BoutonIcone nom="ajuster" titre="Taille réelle du panneau" desactive={options.zoom === 100}
        onClick={() => options.zoomer(100)} />
    </>
  );
}

export function BarreCanevas({ modifie, options }: Props): ReactNode {
  return (
    <div className="canevas-toolbar">
      <span className="titre">
        Scène
        <Badge sens={modifie ? "warn" : "ok"} voyant>{modifie ? "Non enregistré" : "À jour"}</Badge>
      </span>
      <Segments valeur={options.mode} options={MODES} onChange={options.setMode}
        etiquette="Mode d'aperçu" />
      <span className="barre-outils pousse">
        <Surcouches options={options} />
        <i className="sep" />
        <Zoom options={options} />
      </span>
    </div>
  );
}
