/** Champs de l'éditeur : identité, position, taille, apparence, puis le propre à chaque type. */
import { useState, type ReactNode } from "react";
import type { Ancre, Calque } from "../../types.ts";
import { Bascule, Champ, Curseur, Nombre, Selection, Texte } from "../commun/composants.tsx";
import { Icone } from "../commun/Icones.tsx";
import { libelleAncre, libelleType } from "./calques.ts";
import { TAILLE_MAX, TAILLE_MIN } from "./composition.ts";
import type { Media } from "./useFonds.ts";

export interface ChampsProps {
  calque: Calque;
  fonds: Media[];
  verrou: boolean;
  onModifier: (transformer: (c: Calque) => Calque) => void;
}

type Modif = ChampsProps["onModifier"];

/** Grille 3×3 ; les deux cases latérales du milieu n'existent pas dans le modèle de la scène. */
const GRILLE: Array<Ancre | null> = [
  "haut-gauche", "haut-centre", "haut-droite",
  null, "centre", null,
  "bas-gauche", "bas-centre", "bas-droite",
];

interface AncresProps { ancre: Ancre; verrou: boolean; onChange: (a: Ancre) => void; }

function Ancres({ ancre, verrou, onChange }: AncresProps): ReactNode {
  return (
    <div className="champ">
      <span className="libelle"><span>Ancre</span></span>
      <div className="ancres" role="radiogroup" aria-label="Ancre">
        {GRILLE.map((a, rang) => a === null
          ? <span key={rang} className="ancre absente" aria-hidden="true" />
          : (
            <button
              key={a} type="button" role="radio" aria-checked={a === ancre} className="ancre"
              title={libelleAncre(a)} disabled={verrou} onClick={() => onChange(a)}
            />
          ))}
      </div>
    </div>
  );
}

function Position({ calque, verrou, onModifier }: Omit<ChampsProps, "fonds">): ReactNode {
  return (
    <>
      <p className="section-titre">Position</p>
      <div className="bloc-position">
        <Ancres ancre={calque.ancre} verrou={verrou}
          onChange={(ancre) => onModifier((c) => ({ ...c, ancre }))} />
        <div className="grille-2">
          <Champ libelle="Décalage X" note="% larg.">
            <Nombre valeur={calque.x} min={-50} max={150} pas={0.5} unite="%" desactive={verrou}
              onChange={(x) => onModifier((c) => ({ ...c, x }))} />
          </Champ>
          <Champ libelle="Décalage Y" note="% haut.">
            <Nombre valeur={calque.y} min={-50} max={150} pas={0.5} unite="%" desactive={verrou}
              onChange={(y) => onModifier((c) => ({ ...c, y }))} />
          </Champ>
        </div>
      </div>
      <p className="section-titre">Taille</p>
      <Champ libelle="Taille de base" note="% de la largeur">
        <Curseur valeur={calque.taille} min={TAILLE_MIN} max={TAILLE_MAX} pas={0.1} desactive={verrou}
          onChange={(taille) => onModifier((c) => ({ ...c, taille }))} />
      </Champ>
    </>
  );
}

const HEXADECIMAL = /^#[0-9a-f]{6}$/i;

/** La couleur ne part dans le modèle que valide : une saisie en cours n'écrase rien. */
function ChampCouleur({ calque, onModifier }: { calque: Calque; onModifier: Modif }): ReactNode {
  const enregistree = calque.couleur ?? "#ffffff";
  const [saisie, setSaisie] = useState(enregistree);
  const valide = HEXADECIMAL.test(saisie);
  const poser = (couleur: string): void => {
    setSaisie(couleur);
    if (HEXADECIMAL.test(couleur)) onModifier((c) => ({ ...c, couleur }));
  };
  return (
    <Champ libelle="Couleur" erreur={!valide} indice={valide ? undefined : "Format attendu : #rrggbb"}>
      <span className="couleur">
        <input type="color" value={valide ? saisie : enregistree} aria-label="Choisir la couleur"
          onChange={(e) => poser(e.target.value)} />
        <Texte mono valeur={saisie} onChange={poser} />
      </span>
    </Champ>
  );
}

const GRAISSES = [
  { valeur: "legere", libelle: "Légère" },
  { valeur: "normale", libelle: "Normale" },
] as const;

function ChampsTexte({ calque, onModifier }: { calque: Calque; onModifier: Modif }): ReactNode {
  const contenu = calque.texte ?? "";
  return (
    <>
      <p className="section-titre">Texte</p>
      <Champ libelle="Contenu" note={`${contenu.length} / 240`}>
        <textarea
          className="ctrl" rows={2} value={contenu} maxLength={240}
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

function optionsMedias(fonds: Media[], video: boolean): Array<{ valeur: string; libelle: string }> {
  const vide = video ? "— choisir une vidéo —" : "— choisir une image —";
  return [
    { valeur: "", libelle: vide },
    ...fonds.filter((f) => f.video === video).map((f) => ({ valeur: f.fichier, libelle: f.fichier })),
  ];
}

function ChampFichier({ calque, fonds, onModifier }: Omit<ChampsProps, "verrou">): ReactNode {
  const video = calque.type === "video";
  return (
    <>
      <p className="section-titre">{video ? "Vidéo" : "Image"}</p>
      <Champ libelle="Fichier" note="/fonds/"
        indice={video ? "Parmi les vidéos déposées" : "Parmi les images déposées — un GIF s'anime seul"}>
        <Selection valeur={calque.fichier ?? ""} options={optionsMedias(fonds, video)}
          onChange={(fichier) => onModifier((c) => ({ ...c, fichier }))} />
      </Champ>
      {video ? (
        <Bascule libelle="Lire en boucle" description="Le son est toujours coupé"
          actif={calque.boucle !== false} onChange={(boucle) => onModifier((c) => ({ ...c, boucle }))} />
      ) : null}
    </>
  );
}

function ChampsSpecifiques(props: ChampsProps): ReactNode {
  const { calque, onModifier } = props;
  switch (calque.type) {
    case "texte": return <ChampsTexte calque={calque} onModifier={onModifier} />;
    case "horloge": return (
      <>
        <p className="section-titre">Horloge</p>
        <Bascule libelle="Afficher la date" description="Sous l'heure, en petit"
          actif={calque.date !== false} onChange={(date) => onModifier((c) => ({ ...c, date }))} />
        <p className="aide">Heure du poste de diffusion, format 24 h.</p>
      </>
    );
    case "accords": return (
      <>
        <p className="section-titre">Accords</p>
        <Bascule libelle="Cadre autour des accords" description="Fond translucide et bordure fine"
          actif={calque.cadre !== false} onChange={(cadre) => onModifier((c) => ({ ...c, cadre }))} />
        <p className="aide">Suit la progression en cours du générateur.</p>
      </>
    );
    default: return <ChampFichier calque={calque} fonds={props.fonds} onModifier={onModifier} />;
  }
}

function Identite({ calque, verrou, onModifier, onVerrou }: ChampsProps & { onVerrou: () => void }): ReactNode {
  return (
    <>
      <Champ libelle="Nom" note={libelleType(calque.type)}>
        <Texte valeur={calque.nom} onChange={(nom) => onModifier((c) => ({ ...c, nom }))} />
      </Champ>
      <div className="grille-2">
        <Bascule libelle="Visible" actif={calque.visible}
          onChange={(visible) => onModifier((c) => ({ ...c, visible }))} />
        <Bascule libelle="Verrouillé" actif={verrou} onChange={onVerrou} />
      </div>
    </>
  );
}

export function ChampsCalque(props: ChampsProps & { onVerrou: () => void }): ReactNode {
  const { calque, verrou, onModifier } = props;
  const media = calque.type === "image" || calque.type === "video";
  return (
    <>
      {verrou ? (
        <div className="avis warn">
          <Icone nom="cadenas" />
          <span><strong>Calque verrouillé.</strong> Position et taille ne se modifient pas.</span>
        </div>
      ) : null}
      <Identite {...props} />
      <Position calque={calque} verrou={verrou} onModifier={onModifier} />
      <p className="section-titre">Apparence</p>
      <Champ libelle="Opacité" note="0 – 1">
        <Curseur valeur={calque.opacite} min={0} max={1} pas={0.05}
          onChange={(opacite) => onModifier((c) => ({ ...c, opacite }))} />
      </Champ>
      {media ? null : <ChampCouleur key={calque.id} calque={calque} onModifier={onModifier} />}
      <ChampsSpecifiques {...props} />
    </>
  );
}
