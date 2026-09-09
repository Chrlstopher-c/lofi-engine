/** Onglet Scène : fond, calques, éditeur du calque sélectionné, aperçu et enregistrement. */
import { useState, type ReactNode } from "react";
import type { Calque, Scene, TypeCalque } from "../../types.ts";
import { api } from "../commun/api.ts";
import { Alerte, BarreEnregistrement, Section } from "../commun/composants.tsx";
import { useEditeur, type Editeur } from "../commun/useEditeur.ts";
import { Apercu } from "./Apercu.tsx";
import { Galerie } from "./Galerie.tsx";
import { ReglagesFond } from "./ReglagesFond.tsx";
import { ListeCalques } from "./ListeCalques.tsx";
import { EditeurCalque } from "./EditeurCalque.tsx";
import { useFonds, type Fonds } from "./useFonds.ts";
import { deplacer, dupliquerCalque, nouveauCalque, remplacerCalque } from "./calques.ts";
import type { Position } from "./composition.ts";
import { PanneauProfils } from "../profils/PanneauProfils.tsx";

interface ActionsCalques {
  ajouter: (type: TypeCalque) => void;
  dupliquer: (id: string) => void;
  supprimer: (id: string) => void;
  deplacer: (index: number, delta: -1 | 1) => void;
  basculerVisible: (id: string) => void;
  modifier: (id: string, transformer: (c: Calque) => Calque) => void;
}

type Choisir = (id: string | null) => void;

function useCalques(editeur: Editeur<Scene>, selection: string | null, choisir: Choisir): ActionsCalques {
  const actuels = editeur.valeur?.calques ?? [];
  const modifierCalques = (transformer: (calques: Calque[]) => Calque[]): void =>
    editeur.definir((s) => ({ ...s, calques: transformer(s.calques) }));
  return {
    ajouter: (type) => {
      const cree = nouveauCalque(type, actuels);
      modifierCalques((l) => [...l, cree]);
      choisir(cree.id);
    },
    dupliquer: (id) => {
      const index = actuels.findIndex((c) => c.id === id);
      const source = actuels[index];
      if (!source) return;
      const copie = dupliquerCalque(source, actuels);
      modifierCalques((l) => [...l.slice(0, index + 1), copie, ...l.slice(index + 1)]);
      choisir(copie.id);
    },
    supprimer: (id) => {
      modifierCalques((l) => l.filter((c) => c.id !== id));
      if (selection === id) choisir(null);
    },
    deplacer: (index, delta) => modifierCalques((l) => deplacer(l, index, delta)),
    basculerVisible: (id) => modifierCalques((l) => remplacerCalque(l, id, (c) => ({ ...c, visible: !c.visible }))),
    modifier: (id, transformer) => modifierCalques((l) => remplacerCalque(l, id, transformer)),
  };
}

function ColonneFond({ scene, fonds, editeur }: { scene: Scene; fonds: Fonds; editeur: Editeur<Scene> }): ReactNode {
  return (
    <div className="colonne">
      <Section titre="Fond">
        <Galerie fonds={fonds.liste} choisi={scene.fond.fichier} occupe={fonds.occupe}
          onChoisir={(fichier) => editeur.definir((s) => ({ ...s, fond: { ...s.fond, fichier } }))}
          onDeposer={(f) => void fonds.deposer(f)} onSupprimer={(f) => void fonds.supprimer(f)} />
        <ReglagesFond fond={scene.fond} theme={scene.theme}
          onFond={(t) => editeur.definir((s) => ({ ...s, fond: t(s.fond) }))}
          onTheme={(theme) => editeur.definir((s) => ({ ...s, theme }))} />
      </Section>
      <PanneauProfils scene={scene} modifie={editeur.modifie} onCharge={editeur.adopter} />
    </div>
  );
}

interface ColonneCalqueProps { calque: Calque | null; fonds: Fonds; actions: ActionsCalques; }

function ColonneCalque({ calque, fonds, actions }: ColonneCalqueProps): ReactNode {
  return (
    <div className="colonne">
      <Section titre={calque ? `Calque — ${calque.nom || calque.id}` : "Calque"}>
        {calque
          ? <EditeurCalque calque={calque} fonds={fonds.liste} onModifier={(t) => actions.modifier(calque.id, t)} />
          : <p className="discret vide">Sélectionner un calque dans la liste pour l'éditer.</p>}
      </Section>
    </div>
  );
}

function BarreScene({ editeur }: { editeur: Editeur<Scene> }): ReactNode {
  return (
    <BarreEnregistrement modifie={editeur.modifie} enregistrement={editeur.enregistrement}
      libelle="Enregistrer la scène" onAnnuler={() => void editeur.recharger()}
      onEnregistrer={() => void editeur.enregistrer()} />
  );
}

export function PanneauScene(): ReactNode {
  const editeur = useEditeur<Scene>({ lire: api.lireScene, ecrire: api.enregistrerScene });
  const fonds = useFonds();
  const [selection, setSelection] = useState<string | null>(null);
  const actions = useCalques(editeur, selection, setSelection);
  const scene = editeur.valeur;
  const calqueActif = scene?.calques.find((c) => c.id === selection) ?? null;
  const positionner = (id: string, p: Position): void => actions.modifier(id, (c) => ({ ...c, x: p.x, y: p.y }));

  if (editeur.chargement && !scene) return <p className="discret chargement">Chargement de la scène…</p>;
  if (!scene) return <Alerte message={editeur.erreur ?? "Scène indisponible."} />;

  return (
    <div className="panneau-scene">
      <Alerte message={editeur.erreur} onFermer={editeur.effacerErreur} />
      <Alerte message={fonds.erreur} onFermer={fonds.effacerErreur} />
      <div className="colonnes-scene">
        <ColonneFond scene={scene} fonds={fonds} editeur={editeur} />
        <div className="colonne colonne-centrale">
          <Section titre="Aperçu" actions={<BarreScene editeur={editeur} />}>
            <Apercu scene={scene} modifie={editeur.modifie} selection={selection}
              onSelectionner={setSelection} onDeplacer={positionner} />
          </Section>
          <Section titre="Calques" classe="section-calques">
            <ListeCalques calques={scene.calques} selection={selection} onSelectionner={setSelection}
              onDeplacer={actions.deplacer} onBasculerVisible={actions.basculerVisible}
              onDupliquer={actions.dupliquer} onSupprimer={actions.supprimer} onAjouter={actions.ajouter} />
          </Section>
        </div>
        <ColonneCalque calque={calqueActif} fonds={fonds} actions={actions} />
      </div>
    </div>
  );
}
