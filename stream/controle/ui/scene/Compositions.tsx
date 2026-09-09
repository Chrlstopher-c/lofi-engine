/**
 * Compositions : les profils de scène enregistrés. Appliquer une composition remplace la scène
 * diffusée, l'enregistrer prend l'édition en cours. L'API ne renvoie d'un profil que son nom,
 * sa date d'écriture et son nombre de calques — la carte ne montre rien de plus.
 */
import { useState, type ReactNode } from "react";
import type { Scene } from "../../types.ts";
import type { Profil } from "../../profils.ts";
import { Alerte, Badge, Bouton, BoutonIcone, Section, Texte, Vide } from "../commun/composants.tsx";
import { Icone } from "../commun/Icones.tsx";
import { dateLisible } from "../commun/format.ts";
import { useProfils, type Profils } from "../profils/useProfils.ts";

interface Props {
  /** Scène en cours d'édition : c'est elle qu'un enregistrement met dans la composition. */
  scene: Scene;
  modifie: boolean;
  /** Appelé avec la scène renvoyée par le serveur après une application. */
  onCharge: (scene: Scene) => void;
}

interface CarteProps {
  profil: Profil;
  occupe: boolean;
  onAppliquer: () => void;
  onSupprimer: () => void;
}

function Carte({ profil, occupe, onAppliquer, onSupprimer }: CarteProps): ReactNode {
  const pluriel = profil.calques > 1 ? "s" : "";
  return (
    <div className="composition-carte">
      <div className="composition-apercu">
        <span className="badges"><Badge>{profil.calques} calque{pluriel}</Badge></span>
      </div>
      <div className="composition-corps">
        <span className="composition-nom" title={profil.nom}>{profil.nom}</span>
        <span className="composition-meta">Enregistrée {dateLisible(profil.modifie)}</span>
      </div>
      <span className="composition-actions">
        <BoutonIcone nom="lecture" titre="Appliquer à la scène diffusée" taille="sm"
          desactive={occupe} onClick={onAppliquer} />
        <BoutonIcone nom="corbeille" titre="Supprimer cette composition" taille="sm" variante="danger"
          desactive={occupe} onClick={onSupprimer} />
      </span>
    </div>
  );
}

interface NommageProps { occupe: boolean; onEnregistrer: (nom: string) => void; onFermer: () => void; }

function Nommage({ occupe, onEnregistrer, onFermer }: NommageProps): ReactNode {
  const [nom, setNom] = useState("");
  return (
    <div className="ligne">
      <Texte valeur={nom} onChange={setNom} placeholder="Nom de la composition" />
      <Bouton variante="principal" desactive={occupe || nom.trim() === ""}
        onClick={() => onEnregistrer(nom.trim())}>
        Enregistrer
      </Bouton>
      <Bouton variante="discret" onClick={onFermer}>Annuler</Bouton>
    </div>
  );
}

/** Appliquer et supprimer perdent chacun quelque chose : les deux passent par une confirmation. */
function gestes(profils: Profils, modifie: boolean, onCharge: Props["onCharge"]): {
  appliquer: (nom: string) => void; supprimer: (nom: string) => void;
} {
  return {
    appliquer: (nom) => {
      const avertissement = `Appliquer « ${nom} » remplace la scène courante.`
        + (modifie ? " Les modifications non enregistrées seront perdues." : "")
        + " Continuer ?";
      if (!window.confirm(avertissement)) return;
      void profils.charger(nom).then((chargee) => { if (chargee) onCharge(chargee); });
    },
    supprimer: (nom) => {
      if (!window.confirm(`Supprimer la composition « ${nom} » ? La scène diffusée n'est pas touchée.`)) return;
      void profils.supprimer(nom);
    },
  };
}

function useNommage(profils: Profils, scene: Scene): {
  ouvert: boolean; ouvrir: () => void; fermer: () => void; enregistrer: (nom: string) => void;
} {
  const [ouvert, setOuvert] = useState(false);
  const enregistrer = (nom: string): void => {
    const existant = profils.liste.some((p) => p.nom === nom);
    if (existant && !window.confirm(`La composition « ${nom} » existe déjà. L'écraser ?`)) return;
    void profils.enregistrer(nom, scene).then((ecrit) => { if (ecrit) setOuvert(false); });
  };
  return { ouvert, ouvrir: () => setOuvert(true), fermer: () => setOuvert(false), enregistrer };
}

export function Compositions({ scene, modifie, onCharge }: Props): ReactNode {
  const profils = useProfils();
  const nommage = useNommage(profils, scene);
  const { appliquer, supprimer } = gestes(profils, modifie, onCharge);
  const action = (
    <Bouton taille="sm" onClick={nommage.ouvrir}><Icone nom="plus" />Depuis la scène</Bouton>
  );
  return (
    <Section titre="Compositions" compte={String(profils.liste.length)} actions={action}>
      <Alerte message={profils.erreur} onFermer={profils.effacerErreur} />
      {nommage.ouvert
        ? <Nommage occupe={profils.occupe} onEnregistrer={nommage.enregistrer} onFermer={nommage.fermer} />
        : null}
      {profils.liste.length === 0 && !nommage.ouvert
        ? <Vide icone="scene" message="Aucune composition enregistrée." />
        : null}
      <div className="compositions">
        {profils.liste.map((p) => (
          <Carte key={p.nom} profil={p} occupe={profils.occupe}
            onAppliquer={() => appliquer(p.nom)} onSupprimer={() => supprimer(p.nom)} />
        ))}
        <button type="button" className="composition-carte nouvelle" onClick={nommage.ouvrir}>
          <Icone nom="plus" />
          <span className="t-sm">Enregistrer la scène comme composition</span>
        </button>
      </div>
    </Section>
  );
}
