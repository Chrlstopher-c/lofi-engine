/**
 * Réglages d'encodage. Ces valeurs sont relues par le diffuseur à son démarrage : les changer
 * pendant un direct n'a aucun effet avant la prochaine mise en route.
 */
import type { ReactNode } from "react";
import type { Diffusion } from "../../types.ts";
import { Badge, BarreEnregistrement, Champ, Section, Selection, Texte } from "../commun/composants.tsx";
import type { Editeur } from "../commun/useEditeur.ts";

/**
 * 25 et 50 sont des cadences PAL. YouTube les accepte à l'ingestion, puis construit une échelle
 * de qualités entièrement CARRÉE — mesuré le 2026-09-10 : en 25 i/s, les sept rendus produits
 * allaient de 1440x1440 à 144x144, sans un seul 16:9 ; en 30 i/s, sur la même diffusion et la
 * même clé, ils repassent tous en 16:9. Elles restent proposées, mais annoncées.
 */
const FPS = [24, 25, 30, 48, 50, 60].map((n) => ({
  valeur: String(n),
  libelle: [25, 50].includes(n) ? `${n} i/s — carre le flux YouTube` : `${n} i/s`,
}));

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
        <Champ libelle="Images par seconde"
          indice="30 ou 60. En 25 ou 50, YouTube produit une image carrée — mesuré.">
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
