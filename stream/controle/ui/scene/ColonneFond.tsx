/** Colonne de gauche : le fond de la scène, sa galerie et ses réglages. */
import { useRef, type ChangeEvent, type ReactNode } from "react";
import type { Scene } from "../../types.ts";
import type { Editeur } from "../commun/useEditeur.ts";
import { Alerte, BoutonIcone, Section } from "../commun/composants.tsx";
import { Galerie } from "./Galerie.tsx";
import { ReglagesFond } from "./ReglagesFond.tsx";
import type { Fonds } from "./useFonds.ts";

/** Extensions acceptées par le serveur (stream/controle/fonds.ts). */
const ACCEPTE = ".png,.jpg,.jpeg,.webp,.avif,.gif,.mp4,.webm,.m4v";

interface Props {
  scene: Scene;
  fonds: Fonds;
  editeur: Editeur<Scene>;
}

interface OutilsProps { choisi: string; occupe: boolean; onImporter: () => void; onSupprimer: () => void; }

function OutilsFond({ choisi, occupe, onImporter, onSupprimer }: OutilsProps): ReactNode {
  return (
    <>
      <BoutonIcone nom="televerser" titre="Importer un fichier" taille="sm"
        desactive={occupe} onClick={onImporter} />
      <BoutonIcone nom="corbeille" titre="Supprimer le fond choisi" taille="sm" variante="danger"
        desactive={occupe || choisi === ""} onClick={onSupprimer} />
    </>
  );
}

export function ColonneFond({ scene, fonds, editeur }: Props): ReactNode {
  const saisie = useRef<HTMLInputElement>(null);
  const choisi = fonds.liste.find((m) => m.fichier === scene.fond.fichier) ?? null;
  const surSelection = (e: ChangeEvent<HTMLInputElement>): void => {
    const fichiers = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (fichiers.length > 0) void fonds.deposer(fichiers);
  };
  const outils = (
    <OutilsFond choisi={scene.fond.fichier} occupe={fonds.occupe}
      onImporter={() => saisie.current?.click()}
      onSupprimer={() => void fonds.supprimer(scene.fond.fichier)} />
  );
  return (
    <div className="colonne">
      <Section titre="Fond" compte={`${fonds.liste.length} fichiers`} actions={outils}
        pied={<span className="t-xs fg-2">Images 25 Mo max · vidéos mp4, webm, m4v 400 Mo max</span>}>
        <Alerte message={fonds.erreur} onFermer={fonds.effacerErreur} />
        <Galerie
          fonds={fonds.liste} choisi={scene.fond.fichier} chargement={fonds.chargement}
          onChoisir={(fichier) => editeur.definir((s) => ({ ...s, fond: { ...s.fond, fichier } }))}
          onDeposer={(f) => void fonds.deposer(f)}
          onImporter={() => saisie.current?.click()}
        />
        <input ref={saisie} type="file" accept={ACCEPTE} multiple hidden onChange={surSelection} />
        <ReglagesFond
          fond={scene.fond} theme={scene.theme} video={choisi?.video === true}
          onFond={(t) => editeur.definir((s) => ({ ...s, fond: t(s.fond) }))}
          onTheme={(theme) => editeur.definir((s) => ({ ...s, theme }))}
        />
      </Section>
    </div>
  );
}
