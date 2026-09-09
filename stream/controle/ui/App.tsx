/** Racine de l'interface : en-tête avec l'état, puis l'onglet Scène, Diffusion ou Twitch. */
import { useState, type ReactNode } from "react";
import { BarreEtat } from "./commun/BarreEtat.tsx";
import { useEtat } from "./commun/useEtat.ts";
import { PanneauScene } from "./scene/PanneauScene.tsx";
import { PanneauDiffusion } from "./diffusion/PanneauDiffusion.tsx";
import { PanneauTwitch } from "./twitch/PanneauTwitch.tsx";

type Onglet = "scene" | "diffusion" | "twitch";

const ONGLETS: ReadonlyArray<{ id: Onglet; libelle: string }> = [
  { id: "scene", libelle: "Scène" },
  { id: "diffusion", libelle: "Diffusion" },
  { id: "twitch", libelle: "Twitch" },
];

export function App(): ReactNode {
  const [onglet, setOnglet] = useState<Onglet>("scene");
  const etat = useEtat();
  return (
    <div className="application">
      <header className="entete">
        <div className="entete-titre">
          <h1>LoFi Engine</h1>
          <span className="discret">Centre de contrôle</span>
        </div>
        <nav className="onglets" aria-label="Sections">
          {ONGLETS.map((o) => (
            <button key={o.id} type="button" className={o.id === onglet ? "onglet actif" : "onglet"}
              aria-current={o.id === onglet ? "page" : undefined} onClick={() => setOnglet(o.id)}>
              {o.libelle}
            </button>
          ))}
        </nav>
        <BarreEtat {...etat} />
      </header>
      <main className="contenu">
        {/* Les deux panneaux restent montés : changer d'onglet ne perd pas une édition en cours. */}
        <div hidden={onglet !== "scene"}><PanneauScene /></div>
        <div hidden={onglet !== "diffusion"}><PanneauDiffusion etat={etat} /></div>
        <div hidden={onglet !== "twitch"}><PanneauTwitch /></div>
      </main>
    </div>
  );
}
