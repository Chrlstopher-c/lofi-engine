/** Réglages du fond et thème de la scène, sous la galerie. */
import type { ReactNode } from "react";
import type { Fond, Scene } from "../../types.ts";
import { Bascule, Champ, Curseur, Selection } from "../commun/composants.tsx";

interface Props {
  fond: Fond;
  theme: Scene["theme"];
  /** Vrai si le fond choisi est une vidéo : la lecture en boucle ne concerne qu'elles. */
  video: boolean;
  onFond: (transformer: (f: Fond) => Fond) => void;
  onTheme: (theme: Scene["theme"]) => void;
}

const AJUSTEMENTS = [
  { valeur: "cover", libelle: "Couvrir — remplit le cadre" },
  { valeur: "contain", libelle: "Contenir — bandes noires" },
] as const;

const THEMES = [
  { valeur: "nuit", libelle: "Nuit — neutre" },
  { valeur: "ambre", libelle: "Ambre — chaud" },
  { valeur: "brume", libelle: "Brume — froid" },
] as const;

function ChampsFond({ fond, video, onFond }: Omit<Props, "theme" | "onTheme">): ReactNode {
  return (
    <>
      <Champ libelle="Ajustement">
        <Selection valeur={fond.ajustement} options={AJUSTEMENTS}
          onChange={(ajustement) => onFond((f) => ({ ...f, ajustement }))} />
      </Champ>
      <Champ libelle="Voile sombre" note="0 – 1" indice="0 = image nue, 1 = noir">
        <Curseur valeur={fond.voile} min={0} max={1} pas={0.05}
          onChange={(voile) => onFond((f) => ({ ...f, voile }))} />
      </Champ>
      <div className="grille-2">
        <Bascule libelle="Vignettage" actif={fond.vignettage}
          onChange={(vignettage) => onFond((f) => ({ ...f, vignettage }))} />
        <Bascule libelle="Dérive lente" actif={fond.mouvement}
          onChange={(mouvement) => onFond((f) => ({ ...f, mouvement }))} />
      </div>
      <p className="aide">
        {video
          ? "Vidéo de fond : lue en boucle et toujours muette, le stream capte l'audio du navigateur."
          : "Le fond choisi est une image. Une vidéo de fond serait lue en boucle, toujours muette."}
      </p>
    </>
  );
}

export function ReglagesFond({ fond, theme, video, onFond, onTheme }: Props): ReactNode {
  return (
    <>
      <p className="section-titre">Réglages du fond</p>
      <ChampsFond fond={fond} video={video} onFond={onFond} />
      <p className="section-titre">Thème de scène</p>
      <Champ libelle="Palette" indice="Calques texte et accords ; une couleur fixée à la main ne bouge pas.">
        <Selection valeur={theme} options={THEMES} onChange={onTheme} />
      </Champ>
    </>
  );
}
