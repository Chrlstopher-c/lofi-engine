/**
 * Aperçu de la scène réelle, telle que le direct la capte. La scène en cours d'édition lui est
 * envoyée à chaque modification (postMessage), donc sans passer par l'enregistrement.
 * Deux modes : « Rendu », ce qui part à l'antenne ; « Composition », les cadres manipulables.
 */
import { useState, type ReactNode } from "react";
import type { Scene } from "../../types.ts";
import { origineScene } from "../commun/api.ts";
import { Alerte } from "../commun/composants.tsx";
import { CoucheComposition } from "./CoucheComposition.tsx";
import { useApercuDirect } from "./apercuDirect.ts";
import { useRatiosImages } from "./ratiosImages.ts";
import type { Position } from "./composition.ts";

type Mode = "rendu" | "composition";

const MODES: ReadonlyArray<{ id: Mode; libelle: string; titre: string }> = [
  { id: "rendu", libelle: "Rendu", titre: "La scène telle qu'elle part à l'antenne" },
  { id: "composition", libelle: "Composition", titre: "Cadres cliquables et déplaçables par-dessus l'aperçu" },
];

interface Props {
  scene: Scene;
  modifie: boolean;
  selection: string | null;
  onSelectionner: (id: string) => void;
  onDeplacer: (id: string, position: Position) => void;
}

function etatAffiche(pilote: boolean, modifie: boolean): { texte: string; attention: boolean } {
  if (!pilote) return { texte: "Aperçu de la version enregistrée", attention: false };
  if (modifie) return { texte: "Aperçu de l'édition en cours, non enregistrée", attention: true };
  return { texte: "Aperçu de l'édition en cours, identique à l'enregistré", attention: false };
}

function BarreModes({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }): ReactNode {
  return (
    <div className="apercu-modes" role="group" aria-label="Mode d'aperçu">
      {MODES.map((m) => (
        <button key={m.id} type="button" title={m.titre} aria-pressed={m.id === mode}
          className={m.id === mode ? "mode-apercu actif" : "mode-apercu"} onClick={() => onMode(m.id)}>
          {m.libelle}
        </button>
      ))}
    </div>
  );
}

export function Apercu({ scene, modifie, selection, onSelectionner, onDeplacer }: Props): ReactNode {
  const [mode, setMode] = useState<Mode>("rendu");
  const direct = useApercuDirect(scene);
  const ratios = useRatiosImages(scene.calques);
  // apercu=1 : la scène s'affiche sans charger le moteur, donc sans jouer de son ici
  const url = `${origineScene()}/scene/scene.html?apercu=1`;
  const affiche = etatAffiche(direct.pilote, modifie);
  return (
    <div className="apercu">
      <Alerte message={direct.erreur} />
      <div className="apercu-barre">
        <BarreModes mode={mode} onMode={setMode} />
        <span className="discret">
          {mode === "composition"
            ? "Cliquer un cadre pour sélectionner le calque, le glisser pour le déplacer — cadres approchés."
            : "Aperçu sans son ; le moteur audio n'est pas chargé ici."}
        </span>
      </div>
      <div className="apercu-cadre">
        <iframe ref={direct.cadre} src={url} title="Aperçu de la scène" allow="autoplay"
          onLoad={direct.surCharge} />
        {mode === "composition"
          ? <CoucheComposition calques={scene.calques} selection={selection} ratios={ratios}
              onSelectionner={onSelectionner} onDeplacer={onDeplacer} />
          : null}
      </div>
      <div className="apercu-pied">
        <span className="mono discret">{url}</span>
        <span className={affiche.attention ? "etiquette attention" : "etiquette"}>{affiche.texte}</span>
      </div>
    </div>
  );
}
