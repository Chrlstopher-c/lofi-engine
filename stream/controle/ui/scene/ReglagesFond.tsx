/** Réglages du fond et du thème de la scène. */
import type { ReactNode } from "react";
import type { Fond, Scene } from "../../types.ts";
import { Bascule, Champ, Curseur, Selection } from "../commun/composants.tsx";

interface Props {
  fond: Fond;
  theme: Scene["theme"];
  onFond: (transformer: (f: Fond) => Fond) => void;
  onTheme: (theme: Scene["theme"]) => void;
}

const AJUSTEMENTS = [
  { valeur: "cover", libelle: "Remplir (cover)" },
  { valeur: "contain", libelle: "Contenir (contain)" },
] as const;

const THEMES = [
  { valeur: "nuit", libelle: "Nuit — neutre" },
  { valeur: "ambre", libelle: "Ambre — chaud" },
  { valeur: "brume", libelle: "Brume — froid" },
] as const;

export function ReglagesFond({ fond, theme, onFond, onTheme }: Props): ReactNode {
  return (
    <div className="grille-champs">
      <Champ libelle="Thème">
        <Selection valeur={theme} options={THEMES} onChange={onTheme} />
      </Champ>
      <Champ libelle="Ajustement">
        <Selection
          valeur={fond.ajustement}
          options={AJUSTEMENTS}
          onChange={(ajustement) => onFond((f) => ({ ...f, ajustement }))}
        />
      </Champ>
      <Champ libelle="Voile sombre" indice="0 = image nue, 1 = noir">
        <Curseur valeur={fond.voile} min={0} max={1} pas={0.05}
          onChange={(voile) => onFond((f) => ({ ...f, voile }))} />
      </Champ>
      <div className="ligne-bascules">
        <Bascule libelle="Dérive lente" actif={fond.mouvement}
          onChange={(mouvement) => onFond((f) => ({ ...f, mouvement }))} />
        <Bascule libelle="Vignettage" actif={fond.vignettage}
          onChange={(vignettage) => onFond((f) => ({ ...f, vignettage }))} />
      </div>
    </div>
  );
}
