/**
 * Onglet Moteur : les réglages de la génération musicale, appliqués à l'antenne sans arrêt
 * de la diffusion. Un type nommé pose tout d'un coup ; les curseurs affinent ensuite.
 */
import type { ReactNode } from "react";
import { Alerte, Badge, Champ, Section, Segments, Vide } from "../commun/composants.tsx";
import { useMoteur } from "./useMoteur.ts";
import { Generation, Instruments, Sonorite } from "./Reglages.tsx";

const LIBELLES: Record<string, string> = {
  equilibre: "Équilibré",
  nocturne: "Nocturne",
  atmospherique: "Atmosphérique",
  energique: "Énergique",
};

const DESCRIPTIONS: Record<string, string> = {
  equilibre: "Le réglage d'origine : 156 BPM, swing au maximum, une section sur deux en mineur.",
  nocturne: "Lent, sombre et clairsemé. Accords à trois notes, batterie souvent absente, voile bas.",
  atmospherique: "Presque sans batterie. Accords larges, mélodie rare, voix et pad tenus en permanence.",
  energique: "Rapide, swing réduit, mélodie bavarde, batterie qui ne lâche jamais. Sans voix.",
};

function Entete({ type, types, enVol, choisir }: {
  type: string; types: string[]; enVol: boolean; choisir: (nom: string) => void;
}): ReactNode {
  const options = types.map((t) => ({ valeur: t, libelle: LIBELLES[t] ?? t }));
  return (
    <Section
      titre="Type de génération"
      actions={
        <Badge sens={enVol ? "warn" : "ok"} voyant>
          {enVol ? "envoi…" : "appliqué à l'antenne"}
        </Badge>
      }
    >
      <Champ
        libelle="Couleur d'ensemble"
        note="Un type pose tous les réglages d'un coup. Les affiner ensuite ne casse rien."
      >
        <Segments valeur={type} options={options} onChange={choisir} etiquette="Type de génération" />
      </Champ>
      <p className="indice">{DESCRIPTIONS[type] ?? ""}</p>
      <p className="indice">
        Aucun bouton à valider : le moteur relit ses réglages toutes les secondes et demie.
        Un curseur déplacé s'entend dans les deux secondes, sans couper la diffusion.
      </p>
    </Section>
  );
}

export function PanneauMoteur(): ReactNode {
  const { reglages, types, erreur, enVol, modifier, choisirType } = useMoteur();

  if (erreur && !reglages) {
    return <div className="moteur"><Alerte message={`Réglages illisibles — ${erreur}`} /></div>;
  }
  if (!reglages) {
    return <div className="moteur"><Vide message="Lecture des réglages du moteur…" /></div>;
  }

  return (
    <div className="moteur">
      <div className="colonne">
        {erreur ? <Alerte message={erreur} /> : null}
        <Entete type={reglages.type} types={types} enVol={enVol} choisir={choisirType} />
        <Sonorite valeurs={reglages} modifier={modifier} />
        <Generation valeurs={reglages} modifier={modifier} />
      </div>
      <div className="colonne">
        <Instruments valeurs={reglages} modifier={modifier} />
      </div>
    </div>
  );
}
