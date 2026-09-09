/**
 * Aperçu de la scène réelle, telle que le direct la capte : la page de scène dans une iframe,
 * nourrie à chaque modification par postMessage, donc sans passer par l'enregistrement.
 * Par-dessus viennent les aides à l'édition — grille, zone sûre, guides, zones de saisie et
 * poignées — que le mode « Rendu direct » retire toutes.
 */
import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { Calque, Scene } from "../../types.ts";
import { origineScene } from "../commun/api.ts";
import { SANS_GUIDE, type Guides } from "./aimants.ts";
import { boiteCalque, type Position } from "./composition.ts";
import { CoucheComposition } from "./CoucheComposition.tsx";
import { Poignees } from "./Poignees.tsx";
import { RATIO_INCONNU, type Ratios } from "./ratiosImages.ts";
import type { ApercuDirect } from "./apercuDirect.ts";
import type { OptionsCanevas } from "./optionsCanevas.ts";
import type { Verrous } from "./etatCalques.ts";

interface Props {
  scene: Scene;
  direct: ApercuDirect;
  options: OptionsCanevas;
  selection: string | null;
  calque: Calque | null;
  verrous: Verrous;
  ratios: Ratios;
  onSelectionner: (id: string) => void;
  onDeplacer: (id: string, position: Position) => void;
  onTaille: (id: string, taille: number) => void;
  onCurseur: (position: Position | null) => void;
}

/** Le zoom ne réduit que la largeur : `.espace-canevas` recentre, rien ne dépasse. */
function styleZoom(zoom: number): CSSProperties {
  return zoom === 100 ? {} : { width: `${zoom}%` };
}

function Surcouches({ grille, zone }: { grille: boolean; zone: boolean }): ReactNode {
  return (
    <>
      {grille ? <div className="surcouche grille" /> : null}
      {zone ? <div className="surcouche zone-sure" /> : null}
    </>
  );
}

function Traits({ guides }: { guides: Guides }): ReactNode {
  return (
    <>
      {guides.v === null ? null : <i className="guide v visible" style={{ left: `${guides.v}%` }} />}
      {guides.h === null ? null : <i className="guide h visible" style={{ top: `${guides.h}%` }} />}
    </>
  );
}

/** Position du pointeur dans le cadre, en % ; hors cadre, rien à afficher. */
function positionCurseur(rect: DOMRect | undefined, e: PointerEvent<HTMLDivElement>): Position | null {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10,
    y: Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10,
  };
}

interface AidesProps extends Props {
  zone: () => DOMRect | undefined;
  guides: Guides;
  onGuides: (guides: Guides) => void;
}

/** Tout ce que le mode « Rendu direct » retire : surcouches, guides, saisie, poignées. */
function AidesEdition(props: AidesProps): ReactNode {
  const { scene, options, selection, calque, verrous, ratios, zone, guides, onGuides } = props;
  const choisi = calque !== null && calque.visible ? calque : null;
  return (
    <>
      <Surcouches grille={options.grille} zone={options.zone} />
      <Traits guides={guides} />
      <CoucheComposition
        calques={scene.calques} selection={selection} ratios={ratios} aimant={options.aimant}
        verrouille={verrous.verrouille} zone={zone} onSelectionner={props.onSelectionner}
        onDeplacer={props.onDeplacer} onGuides={onGuides}
      />
      {choisi ? (
        <Poignees
          calque={choisi} verrou={verrous.verrouille(choisi.id)} zone={zone}
          boite={boiteCalque(choisi, ratios[choisi.fichier ?? ""] ?? RATIO_INCONNU)}
          onTaille={(taille) => props.onTaille(choisi.id, taille)}
        />
      ) : null}
    </>
  );
}

export function Apercu(props: Props): ReactNode {
  const { direct, options, onCurseur } = props;
  const cadre = useRef<HTMLDivElement | null>(null);
  const [guides, setGuides] = useState<Guides>(SANS_GUIDE);
  const zone = (): DOMRect | undefined => cadre.current?.getBoundingClientRect();
  // apercu=1 : la scène s'affiche sans charger le moteur, donc sans jouer de son ici
  const url = `${origineScene()}/scene/scene.html?apercu=1`;
  return (
    <div className="espace-canevas">
      <div className="cadre-zoom" style={styleZoom(options.zoom)}>
        <div
          className="cadre" ref={cadre}
          onPointerMove={(e) => onCurseur(positionCurseur(zone(), e))}
          onPointerLeave={() => onCurseur(null)}
        >
          <iframe ref={direct.cadre} src={url} title="Aperçu de la scène" allow="autoplay"
            onLoad={direct.surCharge} />
          {options.mode === "composition"
            ? <AidesEdition {...props} zone={zone} guides={guides} onGuides={setGuides} />
            : null}
        </div>
      </div>
    </div>
  );
}
