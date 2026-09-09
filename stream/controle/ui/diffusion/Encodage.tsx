/**
 * Réglages d'encodage. Ces valeurs sont relues par le diffuseur à son démarrage : les changer
 * pendant un direct n'a aucun effet avant la prochaine mise en route.
 */
import type { ReactNode } from "react";
import type { Diffusion } from "../../types.ts";
import { Badge, BarreEnregistrement, Champ, Section, Selection, Texte } from "../commun/composants.tsx";
import type { Editeur } from "../commun/useEditeur.ts";

const FPS = [24, 25, 30, 48, 50, 60].map((n) => ({ valeur: String(n), libelle: `${n} i/s` }));

interface Props {
  conf: Diffusion;
  definir: Editeur<Diffusion>["definir"];
  modifie: boolean;
  enregistrement: boolean;
  onAnnuler: () => void;
  onEnregistrer: () => void;
}

export function Encodage({ conf, definir, modifie, enregistrement, onAnnuler, onEnregistrer }: Props): ReactNode {
  const pied = (
    <>
      <span className="pousse" />
      <BarreEnregistrement modifie={modifie} enregistrement={enregistrement} libelle="Enregistrer"
        onAnnuler={onAnnuler} onEnregistrer={onEnregistrer} />
    </>
  );
  return (
    <Section titre="Encodage" pied={pied}
      actions={<Badge voyant>relu au démarrage</Badge>}>
      <div className="grille-2">
        <Champ libelle="Résolution" note="l×h" indice="ex. 1920x1080">
          <Texte mono valeur={conf.resolution} onChange={(resolution) => definir((c) => ({ ...c, resolution }))} />
        </Champ>
        <Champ libelle="Images par seconde">
          <Selection valeur={String(conf.fps)} options={FPS}
            onChange={(v) => definir((c) => ({ ...c, fps: Number(v) }))} />
        </Champ>
        <Champ libelle="Débit vidéo" indice="ex. 4500k">
          <Texte mono valeur={conf.bitrateVideo}
            onChange={(bitrateVideo) => definir((c) => ({ ...c, bitrateVideo }))} />
        </Champ>
        <Champ libelle="Débit audio" indice="ex. 160k">
          <Texte mono valeur={conf.bitrateAudio}
            onChange={(bitrateAudio) => definir((c) => ({ ...c, bitrateAudio }))} />
        </Champ>
      </div>
    </Section>
  );
}
