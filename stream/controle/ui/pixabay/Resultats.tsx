/** La barre de recherche, la grille de résultats, et la pagination sous elle. */
import { useState, type ReactNode } from "react";
import type { Media } from "../../pixabay/types.ts";
import { Bouton, BoutonIcone, Champ, Section, Segments, Texte, Vide } from "../commun/composants.tsx";
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

  return (
    <Section titre="Chercher sur Pixabay" classe="pixabay-recherche"
      actions={<Segments valeur={genre} options={GENRES} etiquette="Type de média" petit
        onChange={(g) => { setGenre(g); if (q.trim()) onChercher(q, g, 1); }} />}>
      <Champ libelle="Termes de recherche" indice="En anglais : le fonds y est bien plus large.">
        <span className="ligne">
          <Texte valeur={q} onChange={setQ} placeholder="rain window"
            onEntree={() => onChercher(q, genre, 1)} />
          <Bouton petit variante="principal" encours={occupe} desactive={q.trim() === ""}
            onClick={() => onChercher(q, genre, 1)}>Chercher</Bouton>
        </span>
      </Champ>
      <div className="pixabay-pistes">
        {PISTES.map((p) => (
          <button key={p} type="button" className="btn discret sm"
            onClick={() => { setQ(p); onChercher(p, genre, 1); }}>{p}</button>
        ))}
      </div>
    </Section>
  );
}

interface PropsPages {
  page: number;
  pages: number;
  occupe: boolean;
  onPage: (page: number) => void;
}

/**
 * Pixabay ne rend que 500 résultats par requête, quel que soit le total annoncé : afficher
 * « page 4 sur 700 » mènerait à des pages vides. Le nombre de pages est donc plafonné, et le
 * total rappelé à côté pour que l'écart se comprenne.
 */
export function Pages({ page, pages, occupe, onPage }: PropsPages): ReactNode {
  if (pages <= 1) return null;
  return (
    <nav className="pixabay-pages" aria-label="Pagination des résultats">
      <BoutonIcone nom="chevron" titre="Page précédente" variante="discret" taille="sm"
        desactive={occupe || page <= 1} onClick={() => onPage(page - 1)} />
      <span>page {page} sur {pages}</span>
      <BoutonIcone nom="chevron" titre="Page suivante" variante="discret" taille="sm"
        desactive={occupe || page >= pages} onClick={() => onPage(page + 1)} />
    </nav>
  );
}

interface PropsGrille {
  titre: string;
  medias: Media[];
  compte?: string;
  occupe: boolean;
  vide: string;
  pied?: ReactNode;
  onOuvrir: (media: Media) => void;
  onFavori: (media: Media) => void;
  onTelecharger: (media: Media) => void;
}

export function Grille(props: PropsGrille): ReactNode {
  const { titre, medias, compte, occupe, vide, pied } = props;
  return (
    <Section titre={titre} compte={compte} pied={pied}>
      {medias.length === 0
        ? <Vide message={vide} icone="image" />
        : <div className="pixabay-grille">
            {medias.map((m) => (
              <Vignette key={`${m.genre}-${m.id}`} media={m} occupe={occupe}
                onOuvrir={props.onOuvrir} onFavori={props.onFavori}
                onTelecharger={props.onTelecharger} />
            ))}
          </div>}
    </Section>
  );
}
