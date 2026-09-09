/**
 * Pile des calques : le dernier du tableau est au premier plan, donc en tête de la liste.
 * Le glisser-déposer réordonne ; Ctrl + flèches fait la même chose au clavier.
 */
import { useState, type DragEvent, type ReactNode } from "react";
import type { Calque, TypeCalque } from "../../types.ts";
import { Section, Selection, Vide } from "../commun/composants.tsx";
import { TYPES } from "./calques.ts";
import { RangeeCalque, type GestesPile } from "./RangeeCalque.tsx";
import type { ActionsCalques, Verrous } from "./etatCalques.ts";

interface Props {
  calques: Calque[];
  selection: string | null;
  verrous: Verrous;
  actions: ActionsCalques;
  onSelectionner: (id: string) => void;
}

interface Depot { id: string; avant: boolean; }

/** La pile s'affiche à l'envers du tableau : déposer « avant » une rangée est un rang plus haut. */
function useGestesPile(reordonner: ActionsCalques["reordonner"]): GestesPile {
  const [glisse, setGlisse] = useState<string | null>(null);
  const [depot, setDepot] = useState<Depot | null>(null);
  const terminer = (): void => { setGlisse(null); setDepot(null); };
  return {
    glisse, depot, terminer,
    commencer: (id, e) => {
      setGlisse(id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    },
    survoler: (id, e) => {
      if (glisse === null || glisse === id) return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      setDepot({ id, avant: e.clientY < rect.top + rect.height / 2 });
    },
    quitter: (id) => setDepot((actuel) => (actuel?.id === id ? null : actuel)),
    deposer: (e: DragEvent<HTMLLIElement>) => {
      e.preventDefault();
      if (glisse !== null && depot !== null) reordonner(glisse, depot.id, depot.avant);
      terminer();
    },
  };
}

function AjoutCalque({ onAjouter }: { onAjouter: (type: TypeCalque) => void }): ReactNode {
  return (
    <Selection<TypeCalque | ""> valeur="" petit
      options={[{ valeur: "", libelle: "Ajouter…" }, ...TYPES]}
      onChange={(type) => { if (type) onAjouter(type); }} />
  );
}

interface RangeesProps extends Props { gestes: GestesPile; renomme: string | null;
  onRenomme: (id: string | null) => void; }

function Rangees(props: RangeesProps): ReactNode {
  const { calques, selection, verrous, actions, onSelectionner, gestes, renomme, onRenomme } = props;
  // Avant-plan en tête : la liste est le tableau lu à l'envers.
  return (
    <>
      {[...calques].reverse().map((calque) => (
        <RangeeCalque
          key={calque.id} calque={calque} gestes={gestes} actif={calque.id === selection}
          verrou={verrous.verrouille(calque.id)} renomme={renomme === calque.id}
          onChoisir={() => onSelectionner(calque.id)}
          onVisible={() => actions.basculerVisible(calque.id)}
          onVerrou={() => verrous.basculer(calque.id)}
          onDupliquer={() => actions.dupliquer(calque.id)}
          onSupprimer={() => actions.supprimer(calque.id)}
          onOuvrirRenommage={() => onRenomme(calque.id)}
          onFermerRenommage={() => onRenomme(null)}
          onRenommer={(nom) => { actions.modifier(calque.id, (c) => ({ ...c, nom })); onRenomme(null); }}
          onDecaler={(delta) => actions.decaler(calque.id, delta)}
        />
      ))}
    </>
  );
}

export function ListeCalques(props: Props): ReactNode {
  const { calques, actions } = props;
  const [renomme, setRenomme] = useState<string | null>(null);
  const gestes = useGestesPile(actions.reordonner);
  const pied = (
    <span className="t-xs fg-2">
      Glisser pour réordonner · <kbd>Ctrl</kbd> + flèches au clavier · double-clic pour renommer
    </span>
  );
  return (
    <Section
      titre="Calques" compte={`${calques.length} · avant-plan en haut`} serre pied={pied}
      actions={<AjoutCalque onAjouter={actions.ajouter} />}
    >
      <ul className="pile" role="listbox" aria-label="Pile de calques">
        <Rangees {...props} gestes={gestes} renomme={renomme} onRenomme={setRenomme} />
      </ul>
      {calques.length === 0
        ? <Vide icone="scene" message="Aucun calque. La scène n'affiche que le fond." />
        : null}
    </Section>
  );
}
