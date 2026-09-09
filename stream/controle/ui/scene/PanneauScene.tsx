/** Onglet Scène : le fond à gauche, l'aperçu au centre, la pile de calques et l'éditeur à droite. */
import { useState, type ReactNode } from "react";
import type { Calque, Scene } from "../../types.ts";
import { api } from "../commun/api.ts";
import { Alerte, Vide } from "../commun/composants.tsx";
import { useEditeur } from "../commun/useEditeur.ts";
import { Canevas } from "./Canevas.tsx";
import { ColonneFond } from "./ColonneFond.tsx";
import { EditeurCalque } from "./EditeurCalque.tsx";
import { ListeCalques } from "./ListeCalques.tsx";
import { useCalques, useVerrous, type ActionsCalques, type Verrous } from "./etatCalques.ts";
import { useFonds, type Fonds } from "./useFonds.ts";

interface ColonneProps {
  scene: Scene;
  calque: Calque | null;
  selection: string | null;
  fonds: Fonds;
  verrous: Verrous;
  actions: ActionsCalques;
  onSelectionner: (id: string) => void;
}

function ColonneCalques(props: ColonneProps): ReactNode {
  const { scene, calque, selection, fonds, verrous, actions, onSelectionner } = props;
  return (
    <div className="colonne">
      <ListeCalques calques={scene.calques} selection={selection} verrous={verrous}
        actions={actions} onSelectionner={onSelectionner} />
      <EditeurCalque
        calque={calque} fonds={fonds.liste} verrou={calque !== null && verrous.verrouille(calque.id)}
        onModifier={(t) => { if (calque) actions.modifier(calque.id, t); }}
        onVerrou={() => { if (calque) verrous.basculer(calque.id); }}
        onDupliquer={() => { if (calque) actions.dupliquer(calque.id); }}
        onSupprimer={() => { if (calque) actions.supprimer(calque.id); }}
      />
    </div>
  );
}

export function PanneauScene(): ReactNode {
  const editeur = useEditeur<Scene>({ lire: api.lireScene, ecrire: api.enregistrerScene });
  const fonds = useFonds();
  const [selection, setSelection] = useState<string | null>(null);
  const verrous = useVerrous();
  const actions = useCalques(editeur, selection, setSelection);
  const scene = editeur.valeur;

  if (!scene) {
    return editeur.chargement
      ? <Vide icone="rafraichir" message="Chargement de la scène…" />
      : <Alerte message={editeur.erreur ?? "Scène indisponible."} />;
  }

  const calque = scene.calques.find((c) => c.id === selection) ?? null;
  return (
    <div className="scene">
      <ColonneFond scene={scene} fonds={fonds} editeur={editeur} />
      <Canevas scene={scene} editeur={editeur} selection={selection} calque={calque}
        verrous={verrous} actions={actions} onSelectionner={setSelection} />
      <ColonneCalques scene={scene} calque={calque} selection={selection} fonds={fonds}
        verrous={verrous} actions={actions} onSelectionner={setSelection} />
    </div>
  );
}
