/**
 * Les groupes de curseurs du moteur. Chaque réglage est décrit une fois — libellé, bornes, pas,
 * et ce qu'il fait à l'oreille — et la grille se déduit de cette table.
 */
import type { ReactNode } from "react";
import type { Reglages as Valeurs } from "../../../../src/lib/engine/Reglages.ts";
import { Champ, Curseur, Section, Selection } from "../commun/composants.tsx";

type Champ = keyof Valeurs;

interface Definition {
  champ: Champ;
  libelle: string;
  min: number;
  max: number;
  pas: number;
  unite?: string;
  note: string;
}

const SONORITE: Definition[] = [
  { champ: "tempo", libelle: "Tempo", min: 70, max: 200, pas: 1, unite: "BPM",
    note: "Glisse sur six secondes plutôt que de sauter." },
  { champ: "swing", libelle: "Swing", min: 0, max: 1, pas: 0.05,
    note: "0 = droit et carré, 1 = traînant." },
  { champ: "voile", libelle: "Voile", min: 400, max: 12000, pas: 100, unite: "Hz",
    note: "Le passe-bas de sortie : bas = cassette étouffée, haut = net." },
  { champ: "souffle", libelle: "Souffle", min: -60, max: -12, pas: 1, unite: "dB",
    note: "Le bruit rose permanent, la texture bande magnétique." },
];

const GENERATION: Definition[] = [
  { champ: "notesParAccord", libelle: "Notes par accord", min: 3, max: 6, pas: 1,
    note: "Tirées parmi les sept de l'empilement, puis réempilées au hasard." },
  { champ: "densiteMelodie", libelle: "Densité de mélodie", min: 0, max: 1, pas: 0.02,
    note: "0 = piano seul, 1 = elle parle sans arrêt." },
  { champ: "penchantAccord", libelle: "Penchant vers l'accord", min: 1, max: 6, pas: 0.5,
    note: "1 = la mélodie ignore l'harmonie. Au-delà de 4 elle arpège." },
  { champ: "partMineur", libelle: "Part de mineur", min: 0, max: 1, pas: 0.05,
    note: "Chance qu'une nouvelle section parte en mineur." },
  { champ: "sectionMin", libelle: "Section la plus courte", min: 4, max: 96, pas: 1, unite: "mes.",
    note: "En mesures. Une mesure vaut un accord." },
  { champ: "sectionMax", libelle: "Section la plus longue", min: 4, max: 128, pas: 1, unite: "mes.",
    note: "Au-delà, l'arrangement devient très patient." },
];

const COUPURES: Definition[] = [
  { champ: "coupureKick", libelle: "Retrait du kick", min: 0, max: 0.9, pas: 0.01,
    note: "Chance que l'instrument se taise sur une section entière." },
  { champ: "coupureCaisse", libelle: "Retrait de la caisse", min: 0, max: 0.9, pas: 0.01, note: "" },
  { champ: "coupureCharleston", libelle: "Retrait du charleston", min: 0, max: 0.9, pas: 0.01, note: "" },
];

const VOIX: Definition[] = [
  { champ: "voixNiveau", libelle: "Niveau de la voix", min: -48, max: -8, pas: 1, unite: "dB",
    note: "Très en dessous du reste : une voix vit là où vivent le piano et la mélodie." },
  { champ: "voixVoile", libelle: "Voile de la voix", min: 500, max: 8000, pas: 100, unite: "Hz",
    note: "Bas = une couleur sans consonnes. Haut = on entend quelqu'un chanter." },
  { champ: "voixEsquive", libelle: "Esquive sous le piano", min: 0, max: 0.9, pas: 0.05,
    note: "De combien elle s'efface à chaque attaque, pour vivre dans les creux." },
];

const MODES = [
  { valeur: "auto" as const, libelle: "Au gré des sections" },
  { valeur: "toujours" as const, libelle: "Toujours" },
  { valeur: "jamais" as const, libelle: "Jamais" },
];

const INSTRUMENTS: Array<{ champ: Champ; libelle: string; note: string }> = [
  { champ: "basse", libelle: "Basse", note: "L'assise. Se retire rarement d'elle-même." },
  { champ: "pad", libelle: "Pad", note: "Comble le creux entre deux accords." },
  { champ: "voix", libelle: "Voix", note: "Nappe de formants, fondamentale et quinte." },
];

interface Props {
  valeurs: Valeurs;
  modifier: (champ: Champ, valeur: Valeurs[Champ]) => void;
}

function Groupe({ definitions, valeurs, modifier }: Props & { definitions: Definition[] }): ReactNode {
  return (
    <>
      {definitions.map((d) => (
        <Champ key={d.champ} libelle={d.libelle} note={d.note}>
          <Curseur
            valeur={valeurs[d.champ] as number}
            onChange={(v: number) => modifier(d.champ, v as Valeurs[Champ])}
            min={d.min} max={d.max} pas={d.pas} unite={d.unite}
          />
        </Champ>
      ))}
    </>
  );
}

export function Sonorite(props: Props): ReactNode {
  return (
    <Section titre="Sonorité">
      <div className="grille-2">
        <Groupe definitions={SONORITE} {...props} />
      </div>
    </Section>
  );
}

export function Generation(props: Props): ReactNode {
  return (
    <Section titre="Génération">
      <div className="grille-2">
        <Groupe definitions={GENERATION} {...props} />
      </div>
    </Section>
  );
}

export function MixageVoix(props: Props): ReactNode {
  return (
    <Section titre="Mixage de la voix">
      <Groupe definitions={VOIX} {...props} />
      <p className="indice">
        Les nappes sont de vraies tenues, générées en local puis isolées. Le moteur choisit
        celle dont la note est la plus proche de l'accord et ne la transpose que du strict
        minimum — au-delà de deux ou trois demi-tons, une voix se déforme.
      </p>
    </Section>
  );
}

export function Instruments({ valeurs, modifier }: Props): ReactNode {
  return (
    <Section titre="Instruments">
      <div className="grille-3">
        {INSTRUMENTS.map((i) => (
          <Champ key={i.champ} libelle={i.libelle} note={i.note}>
            <Selection
              valeur={valeurs[i.champ] as "auto" | "toujours" | "jamais"}
              options={MODES}
              onChange={(v) => modifier(i.champ, v as Valeurs[Champ])}
            />
          </Champ>
        ))}
      </div>
      <div className="grille-3">
        <Groupe definitions={COUPURES} valeurs={valeurs} modifier={modifier} />
      </div>
    </Section>
  );
}
