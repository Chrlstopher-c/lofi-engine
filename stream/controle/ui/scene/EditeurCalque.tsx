/** Édition du calque sélectionné : position, apparence, puis les champs propres à son type. */
import type { ReactNode } from "react";
import type { Ancre, Calque } from "../../types.ts";
import type { ImageFond } from "../commun/api.ts";
import { Bascule, Champ, Curseur, Nombre, Selection, Texte } from "../commun/composants.tsx";
import { ANCRES, libelleType } from "./calques.ts";

interface Props {
  calque: Calque;
  fonds: ImageFond[];
  onModifier: (transformer: (c: Calque) => Calque) => void;
}

type Modif = Props["onModifier"];

/** Grille 3×3 ; les deux cases latérales du milieu n'existent pas dans le modèle de la scène. */
const GRILLE: Array<Ancre | null> = [
  "haut-gauche", "haut-centre", "haut-droite",
  null, "centre", null,
  "bas-gauche", "bas-centre", "bas-droite",
];

function GrilleAncres({ ancre, onChange }: { ancre: Ancre; onChange: (a: Ancre) => void }): ReactNode {
  return (
    <div className="grille-ancres" role="radiogroup" aria-label="Ancre">
      {GRILLE.map((a, i) => a === null
        ? <span key={i} className="ancre absente" aria-hidden="true" />
        : (
          <button
            key={a} type="button" role="radio" aria-checked={a === ancre}
            className={a === ancre ? "ancre active" : "ancre"}
            title={ANCRES.find((o) => o.valeur === a)?.libelle}
            onClick={() => onChange(a)}
          />
        ))}
    </div>
  );
}

function ChampsPosition({ calque, onModifier }: { calque: Calque; onModifier: Modif }): ReactNode {
  return (
    <>
      <Champ libelle="Ancre">
        <GrilleAncres ancre={calque.ancre} onChange={(ancre) => onModifier((c) => ({ ...c, ancre }))} />
      </Champ>
      <div className="deux-colonnes">
        <Champ libelle="Décalage X" indice="% de la largeur">
          <Nombre valeur={calque.x} min={-50} max={150} pas={0.5} onChange={(x) => onModifier((c) => ({ ...c, x }))} />
        </Champ>
        <Champ libelle="Décalage Y" indice="% de la hauteur">
          <Nombre valeur={calque.y} min={-50} max={150} pas={0.5} onChange={(y) => onModifier((c) => ({ ...c, y }))} />
        </Champ>
      </div>
      <Champ libelle="Taille" indice="% de la largeur">
        <Curseur valeur={calque.taille} min={0.2} max={40} pas={0.1}
          onChange={(taille) => onModifier((c) => ({ ...c, taille }))} />
      </Champ>
      <Champ libelle="Opacité">
        <Curseur valeur={calque.opacite} min={0} max={1} pas={0.05}
          onChange={(opacite) => onModifier((c) => ({ ...c, opacite }))} />
      </Champ>
      <Champ libelle="Couleur">
        <span className="couleur">
          <input type="color" value={calque.couleur ?? "#f2f4f8"}
            onChange={(e) => onModifier((c) => ({ ...c, couleur: e.target.value }))} />
          <Texte mono valeur={calque.couleur ?? ""} onChange={(couleur) => onModifier((c) => ({ ...c, couleur }))} />
        </span>
      </Champ>
    </>
  );
}

const GRAISSES = [
  { valeur: "legere", libelle: "Légère" },
  { valeur: "normale", libelle: "Normale" },
] as const;

function ChampsTexte({ calque, onModifier }: { calque: Calque; onModifier: Modif }): ReactNode {
  return (
    <>
      <Champ libelle="Texte" indice="240 caractères max">
        <textarea
          className="saisie" rows={3} value={calque.texte ?? ""} maxLength={240}
          onChange={(e) => onModifier((c) => ({ ...c, texte: e.target.value }))}
        />
      </Champ>
      <Champ libelle="Graisse">
        <Selection valeur={calque.graisse ?? "normale"} options={GRAISSES}
          onChange={(graisse) => onModifier((c) => ({ ...c, graisse }))} />
      </Champ>
    </>
  );
}

function optionsMedias(fonds: Props["fonds"], video: boolean) {
  const vide = video ? "— choisir une vidéo —" : "— choisir une image —";
  return [
    { valeur: "", libelle: vide },
    ...fonds.filter((f) => f.video === video).map((f) => ({ valeur: f.fichier, libelle: f.fichier })),
  ];
}

function ChampsImage({ calque, fonds, onModifier }: Props): ReactNode {
  return (
    <Champ libelle="Fichier" indice="parmi les images déposées — un GIF s'anime tout seul">
      <Selection valeur={calque.fichier ?? ""} options={optionsMedias(fonds, false)}
        onChange={(fichier) => onModifier((c) => ({ ...c, fichier }))} />
    </Champ>
  );
}

function ChampsVideo({ calque, fonds, onModifier }: Props): ReactNode {
  return (
    <>
      <Champ libelle="Fichier" indice="parmi les vidéos déposées">
        <Selection valeur={calque.fichier ?? ""} options={optionsMedias(fonds, true)}
          onChange={(fichier) => onModifier((c) => ({ ...c, fichier }))} />
      </Champ>
      <Bascule libelle="Lire en boucle" actif={calque.boucle !== false}
        onChange={(boucle) => onModifier((c) => ({ ...c, boucle }))} />
      <p className="indice">
        Le son est toujours coupé : le stream capte l'audio du navigateur, une bande-son
        se mélangerait à la musique diffusée.
      </p>
    </>
  );
}

function ChampsSpecifiques(props: Props): ReactNode {
  const { calque, onModifier } = props;
  switch (calque.type) {
    case "texte": return <ChampsTexte calque={calque} onModifier={onModifier} />;
    case "horloge":
      return <Bascule libelle="Afficher la date" actif={calque.date !== false}
        onChange={(date) => onModifier((c) => ({ ...c, date }))} />;
    case "accords":
      return <Bascule libelle="Cadre autour du bloc" actif={calque.cadre !== false}
        onChange={(cadre) => onModifier((c) => ({ ...c, cadre }))} />;
    case "image": return <ChampsImage {...props} />;
    case "video": return <ChampsVideo {...props} />;
  }
}

export function EditeurCalque(props: Props): ReactNode {
  const { calque, onModifier } = props;
  return (
    <div className="editeur-calque grille-champs">
      <div className="deux-colonnes">
        <Champ libelle="Nom">
          <Texte valeur={calque.nom} onChange={(nom) => onModifier((c) => ({ ...c, nom }))} />
        </Champ>
        <Champ libelle="Type">
          <span className="saisie lecture">{libelleType(calque.type)}</span>
        </Champ>
      </div>
      <Bascule libelle="Visible" actif={calque.visible}
        onChange={(visible) => onModifier((c) => ({ ...c, visible }))} />
      <ChampsPosition calque={calque} onModifier={onModifier} />
      <h3 className="sous-titre">{libelleType(calque.type)}</h3>
      <ChampsSpecifiques {...props} />
    </div>
  );
}
