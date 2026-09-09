/**
 * Barre d'alignement : pose le calque choisi contre un bord du cadre, sans toucher à son ancre.
 * À droite, l'abandon et l'enregistrement de la scène.
 */
import type { ReactNode } from "react";
import type { NomIcone } from "../commun/Icones.tsx";
import { Bouton, BoutonIcone } from "../commun/composants.tsx";
import type { Alignement } from "./aimants.ts";

interface Props {
  /** Nom du calque choisi, ou null : la barre dit alors pourquoi elle est inerte. */
  nom: string | null;
  verrou: boolean;
  modifie: boolean;
  enregistrement: boolean;
  onAligner: (cible: Alignement) => void;
  onAnnuler: () => void;
  onEnregistrer: () => void;
}

interface Commande { cible: Alignement; icone: NomIcone; titre: string; }

const HORIZONTAL: ReadonlyArray<Commande> = [
  { cible: "gauche", icone: "align-gauche", titre: "Aligner à gauche" },
  { cible: "centre", icone: "align-centre", titre: "Centrer horizontalement" },
  { cible: "droite", icone: "align-droite", titre: "Aligner à droite" },
];

const VERTICAL: ReadonlyArray<Commande> = [
  { cible: "haut", icone: "align-haut", titre: "Aligner en haut" },
  { cible: "milieu", icone: "align-milieu", titre: "Centrer verticalement" },
  { cible: "bas", icone: "align-bas", titre: "Aligner en bas" },
];

interface GroupeProps {
  commandes: ReadonlyArray<Commande>;
  etiquette: string;
  inactif: boolean;
  onAligner: (cible: Alignement) => void;
}

function Groupe({ commandes, etiquette, inactif, onAligner }: GroupeProps): ReactNode {
  return (
    <span className="groupe-btn" role="group" aria-label={etiquette}>
      {commandes.map((c) => (
        <BoutonIcone key={c.cible} nom={c.icone} titre={c.titre} desactive={inactif}
          onClick={() => onAligner(c.cible)} />
      ))}
    </span>
  );
}

function legende(nom: string | null, verrou: boolean): string {
  if (nom === null) return "Aucun calque choisi : l'alignement porte sur la sélection.";
  if (verrou) return `« ${nom} » est verrouillé : déverrouiller pour l'aligner.`;
  return `« ${nom} » : alignement sur le cadre.`;
}

export function BarreAlignement(props: Props): ReactNode {
  const { nom, verrou, modifie, enregistrement, onAligner, onAnnuler, onEnregistrer } = props;
  const inactif = nom === null || verrou;
  return (
    <div className="alignement">
      <Groupe commandes={HORIZONTAL} etiquette="Aligner horizontalement" inactif={inactif}
        onAligner={onAligner} />
      <Groupe commandes={VERTICAL} etiquette="Aligner verticalement" inactif={inactif}
        onAligner={onAligner} />
      <span className="legende">{legende(nom, verrou)}</span>
      <span className="pousse ligne">
        <Bouton variante="discret" desactive={!modifie || enregistrement} onClick={onAnnuler}>
          Abandonner
        </Bouton>
        <Bouton variante="principal" desactive={!modifie} encours={enregistrement} onClick={onEnregistrer}>
          Enregistrer la scène
        </Bouton>
      </span>
    </div>
  );
}
