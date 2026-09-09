/**
 * Profils enregistrés : liste, enregistrement de l'édition en cours sous un nom, chargement
 * (qui remplace la scène diffusée) et suppression. Rien n'y figure que l'API ne fournisse.
 */
import { useState, type ReactNode } from "react";
import type { Scene } from "../../types.ts";
import type { Profil } from "../../profils.ts";
import { Alerte, Bouton, Section, Texte } from "../commun/composants.tsx";
import { dateLisible } from "../commun/format.ts";
import { useProfils, type Profils } from "./useProfils.ts";

interface Props {
  /** Scène en cours d'édition : c'est elle qu'un enregistrement met dans le profil. */
  scene: Scene;
  modifie: boolean;
  /** Appelé avec la scène renvoyée par le serveur après un chargement. */
  onCharge: (scene: Scene) => void;
}

interface LigneProps {
  profil: Profil;
  occupe: boolean;
  onCharger: () => void;
  onSupprimer: () => void;
}

function LigneProfil({ profil, occupe, onCharger, onSupprimer }: LigneProps): ReactNode {
  const pluriel = profil.calques > 1 ? "s" : "";
  return (
    <li className="profil">
      <span className="profil-nom" title={profil.nom}>{profil.nom}</span>
      <span className="discret">{profil.calques} calque{pluriel} · {dateLisible(profil.modifie)}</span>
      <span className="profil-outils">
        <Bouton petit desactive={occupe} titre="Ce profil devient la scène diffusée" onClick={onCharger}>
          Charger
        </Bouton>
        <Bouton petit variante="discret" desactive={occupe} titre="Supprimer ce profil" onClick={onSupprimer}>
          ×
        </Bouton>
      </span>
    </li>
  );
}

function useEnregistrement(profils: Profils, scene: Scene): {
  nom: string; setNom: (n: string) => void; enregistrer: () => void;
} {
  const [nom, setNom] = useState("");
  const enregistrer = (): void => {
    const propre = nom.trim();
    if (propre === "") return;
    const existant = profils.liste.some((p) => p.nom === propre);
    if (existant && !window.confirm(`Le profil « ${propre} » existe déjà. L'écraser ?`)) return;
    void profils.enregistrer(propre, scene).then((ecrit) => { if (ecrit) setNom(""); });
  };
  return { nom, setNom, enregistrer };
}

/** Chargement et suppression, chacun derrière sa confirmation : les deux perdent quelque chose. */
function actionsProfils(profils: Profils, modifie: boolean, onCharge: Props["onCharge"]): {
  charger: (cible: string) => void; supprimer: (cible: string) => void;
} {
  return {
    charger: (cible) => {
      const avertissement = `Charger « ${cible} » remplace la scène courante.`
        + (modifie ? " Les modifications non enregistrées seront perdues." : "")
        + " Continuer ?";
      if (!window.confirm(avertissement)) return;
      void profils.charger(cible).then((chargee) => { if (chargee) onCharge(chargee); });
    },
    supprimer: (cible) => {
      if (!window.confirm(`Supprimer le profil « ${cible} » ? La scène diffusée n'est pas touchée.`)) return;
      void profils.supprimer(cible);
    },
  };
}

export function PanneauProfils({ scene, modifie, onCharge }: Props): ReactNode {
  const profils = useProfils();
  const { nom, setNom, enregistrer } = useEnregistrement(profils, scene);
  const { charger, supprimer } = actionsProfils(profils, modifie, onCharge);

  return (
    <Section titre="Profils">
      <Alerte message={profils.erreur} onFermer={profils.effacerErreur} />
      {profils.liste.length === 0
        ? <p className="discret vide">Aucun profil enregistré.</p>
        : (
          <ul className="liste-profils">
            {profils.liste.map((p) => (
              <LigneProfil key={p.nom} profil={p} occupe={profils.occupe}
                onCharger={() => charger(p.nom)} onSupprimer={() => supprimer(p.nom)} />
            ))}
          </ul>
        )}
      <div className="profil-ajout">
        <Texte valeur={nom} onChange={setNom} placeholder="Nom du profil" />
        <Bouton petit desactive={profils.occupe || nom.trim() === ""} onClick={enregistrer}>
          Enregistrer l'édition en cours
        </Bouton>
      </div>
    </Section>
  );
}
