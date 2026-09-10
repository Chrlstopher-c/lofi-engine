/** La grille de résultats, et la barre de recherche qui la remplit. */
import { useState, type ReactNode } from "react";
import type { Media } from "../../pixabay/types.ts";
import { Bouton, Champ, Section, Segments, Texte, Vide } from "../commun/composants.tsx";
import type { Genre } from "./api-pixabay.ts";
import { Vignette } from "./Vignette.tsx";

const GENRES: ReadonlyArray<{ valeur: Genre; libelle: string }> = [
  { valeur: "video", libelle: "Vidéos" },
  { valeur: "image", libelle: "Images" },
];

/** Quelques départs qui donnent des résultats exploitables — pas une liste fermée. */
const PISTES = ["rain window", "night city rain", "cozy room", "bokeh lights", "fireplace",
  "clouds timelapse", "neon night", "train window"];

interface PropsRecherche {
  occupe: boolean;
  onChercher: (q: string, genre: Genre, page: number) => void;
}

export function BarreRecherche({ occupe, onChercher }: PropsRecherche): ReactNode {
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState<Genre>("video");
  const lancer = (terme: string): void => { setQ(terme); onChercher(terme, genre, 1); };

  return (
    <Section titre="Chercher sur Pixabay"
      actions={<Segments valeur={genre} options={GENRES} etiquette="Type de média" petit
        onChange={(g) => { setGenre(g); if (q.trim()) onChercher(q, g, 1); }} />}>
      <Champ libelle="Termes de recherche" indice="En anglais : le fonds y est bien plus large.">
        <span className="ligne">
          <Texte valeur={q} onChange={setQ} placeholder="rain window"
            onEntree={() => onChercher(q, genre, 1)} />
          <Bouton petit encours={occupe} desactive={q.trim() === ""}
            onClick={() => onChercher(q, genre, 1)}>Chercher</Bouton>
        </span>
      </Champ>
      <div className="pixabay-pistes">
        {PISTES.map((p) => (
          <button key={p} type="button" className="btn discret sm" onClick={() => lancer(p)}>{p}</button>
        ))}
      </div>
    </Section>
  );
}

interface PropsGrille {
  titre: string;
  medias: Media[];
  total: number;
  occupe: boolean;
  vide: string;
  onFavori: (media: Media) => void;
  onTelecharger: (media: Media) => void;
}

export function Grille(props: PropsGrille): ReactNode {
  const { titre, medias, total, occupe, vide, onFavori, onTelecharger } = props;
  return (
    <Section titre={titre} compte={total > 0 ? `${total} trouvé(s)` : undefined}>
      {medias.length === 0
        ? <Vide message={vide} icone="image" />
        : <div className="pixabay-grille">
            {medias.map((m) => (
              <Vignette key={`${m.genre}-${m.id}`} media={m} occupe={occupe}
                onFavori={onFavori} onTelecharger={onTelecharger} />
            ))}
          </div>}
    </Section>
  );
}
