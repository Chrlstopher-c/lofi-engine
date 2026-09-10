/**
 * Ce que la machine offre comme encodeur matériel — et, quand elle n'offre rien, pourquoi.
 *
 * « Aucune puce vidéo accessible » recouvrait trois situations qui n'ont pas le même remède :
 * pas de puce du tout, une puce que le noyau n'expose pas (la signature d'une machine
 * virtuelle), et une puce exposée que le conteneur ne peut pas ouvrir. Sans cette distinction,
 * l'exploitant voit son flux tomber en 1280x720 sans savoir quoi faire pour en sortir.
 */
import type { ReactNode } from "react";
import type { MaterielEncodage } from "../../types.ts";
import { Badge, Section } from "../commun/composants.tsx";

const NOMS: Readonly<Record<string, string>> = {
  nvidia: "Carte NVIDIA — NVENC disponible",
  dri: "Nœud de rendu ouvert — VAAPI disponible",
};

export function Materiel({ materiel }: { materiel: MaterielEncodage }): ReactNode {
  const disponible = materiel.nom !== "aucun";
  return (
    <Section titre="Puce vidéo"
      actions={<Badge sens={disponible ? "ok" : "warn"} voyant>
        {disponible ? "encodage matériel" : "encodage logiciel"}
      </Badge>}>
      <p>{NOMS[materiel.nom] ?? materiel.cause}</p>
      {disponible
        ? <p className="aide">Le processeur n'encode plus : la pleine définition reste accessible.</p>
        : null}
      {!disponible && materiel.remede ? <p className="aide">{materiel.remede}</p> : null}
      {!disponible && materiel.puce
        ? <p className="aide">Vue sur le bus PCI : {materiel.puce}.</p>
        : null}
      {!disponible
        ? <p className="aide">
            Pour un diagnostic complet et une correction guidée, lancer
            {" "}<code>./scripts/verifier-gpu.sh</code> sur la machine qui diffuse.
          </p>
        : null}
    </Section>
  );
}
