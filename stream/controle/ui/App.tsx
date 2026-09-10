/** Coquille : en-tête, état de l'antenne, basculeur de thème, et les quatre onglets. */
import { useState, type ReactNode } from "react";
import { BarreEtat } from "./commun/BarreEtat.tsx";
import { Segments } from "./commun/composants.tsx";
import { Icone, SpriteIcones } from "./commun/Icones.tsx";
import { useEtat } from "./commun/useEtat.ts";
import { useTheme } from "./commun/useTheme.ts";
import { PanneauScene } from "./scene/PanneauScene.tsx";
import { PanneauDiffusion } from "./diffusion/PanneauDiffusion.tsx";
import { PanneauTwitch } from "./twitch/PanneauTwitch.tsx";
import { PanneauMoteur } from "./moteur/PanneauMoteur.tsx";
import { PanneauPixabay } from "./pixabay/PanneauPixabay.tsx";

type Onglet = "scene" | "moteur" | "diffusion" | "pixabay" | "twitch";

const ONGLETS: ReadonlyArray<{ valeur: Onglet; libelle: string }> = [
  { valeur: "scene", libelle: "Scène" },
  { valeur: "moteur", libelle: "Moteur" },
  { valeur: "diffusion", libelle: "Diffusion" },
  { valeur: "pixabay", libelle: "Pixabay" },
  { valeur: "twitch", libelle: "Twitch" },
];

function Marque(): ReactNode {
  return (
    <div className="marque">
      <div className="marque-logo" aria-hidden="true">
        <svg viewBox="0 0 16 16">
          <rect x="2" y="7" width="2" height="6" rx="1" />
          <rect x="5.5" y="3" width="2" height="10" rx="1" />
          <rect x="9" y="5" width="2" height="8" rx="1" />
          <rect x="12.5" y="8" width="2" height="5" rx="1" />
        </svg>
      </div>
      <h1>LoFi Engine</h1>
      <span>Centre de contrôle</span>
    </div>
  );
}

export function App(): ReactNode {
  const [onglet, setOnglet] = useState<Onglet>("scene");
  const etat = useEtat();
  const { theme, basculer } = useTheme();
  const enDirect = etat.etat?.enMarche === true;
  return (
    <div className={enDirect ? "app direct" : "app"}>
      <SpriteIcones />
      <header className="entete">
        <Marque />
        <Segments valeur={onglet} options={ONGLETS} onChange={setOnglet} etiquette="Sections" onglets />
        <div className="entete-droite">
          <BarreEtat {...etat} />
          <button
            type="button"
            className="btn icone"
            onClick={basculer}
            title={theme === "clair" ? "Passer au thème sombre" : "Passer au thème clair"}
            aria-label="Basculer le thème"
          >
            <Icone nom={theme === "clair" ? "soleil" : "lune"} />
          </button>
        </div>
      </header>
      <main className="contenu">
        {/* Les quatre panneaux restent montés : changer d'onglet ne perd pas une édition en cours. */}
        <div className="page" hidden={onglet !== "scene"}><PanneauScene /></div>
        <div className="page" hidden={onglet !== "moteur"}><PanneauMoteur /></div>
        <div className="page" hidden={onglet !== "diffusion"}><PanneauDiffusion etat={etat} /></div>
        <div className="page" hidden={onglet !== "pixabay"}><PanneauPixabay /></div>
        <div className="page" hidden={onglet !== "twitch"}><PanneauTwitch /></div>
      </main>
    </div>
  );
}
