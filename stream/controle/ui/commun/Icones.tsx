/** Jeu d'icônes de la maquette : un sprite SVG posé une fois, référencé par <Icone nom="…" />. */
import type { ReactNode } from "react";

const DESSINS = {
  oeil: <><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  "oeil-barre": <path d="M3 3l18 18M10.6 6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.1 9.5 6.1s-1 1.8-2.9 3.5M6.6 6.7C4 8.6 2.5 12 2.5 12s3.5 6.1 9.5 6.1c1.5 0 2.8-.4 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  cadenas: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  "cadenas-ouvert": <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></>,
  chevron: <path d="M6 9l6 6 6-6" />,
  poignee: <><circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" /></>,
  copier: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  corbeille: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  annuler: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>,
  refaire: <><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></>,
  historique: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5M12 7v5l3 2" /></>,
  grille: <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />,
  "zone-sure": <><rect x="3" y="4" width="18" height="16" rx="2" /><rect x="7" y="8" width="10" height="8" strokeDasharray="2 2" /></>,
  aimant: <path d="M6 3v8a6 6 0 0 0 12 0V3M6 3h4v8a2 2 0 0 0 4 0V3h4" />,
  "zoom-plus": <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M11 8v6M8 11h6" /></>,
  "zoom-moins": <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8 11h6" /></>,
  ajuster: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  clavier: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></>,
  soleil: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  lune: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  texte: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
  horloge: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  accords: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m21 16-5-5-8 8" /></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
  groupe: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  degrouper: <><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /><path d="M11 7h2M7 11v2" /></>,
  "align-gauche": <><path d="M4 3v18" /><rect x="7" y="6" width="12" height="4" /><rect x="7" y="14" width="7" height="4" /></>,
  "align-centre": <><path d="M12 3v18" /><rect x="5" y="6" width="14" height="4" /><rect x="8" y="14" width="8" height="4" /></>,
  "align-droite": <><path d="M20 3v18" /><rect x="5" y="6" width="12" height="4" /><rect x="10" y="14" width="7" height="4" /></>,
  "align-haut": <><path d="M3 4h18" /><rect x="6" y="7" width="4" height="12" /><rect x="14" y="7" width="4" height="7" /></>,
  "align-milieu": <><path d="M3 12h18" /><rect x="6" y="5" width="4" height="14" /><rect x="14" y="8" width="4" height="8" /></>,
  "align-bas": <><path d="M3 20h18" /><rect x="6" y="5" width="4" height="12" /><rect x="14" y="10" width="4" height="7" /></>,
  "repartir-h": <><path d="M3 4v16M21 4v16" /><rect x="8" y="8" width="3" height="8" /><rect x="13" y="8" width="3" height="8" /></>,
  "repartir-v": <><path d="M4 3h16M4 21h16" /><rect x="8" y="8" width="8" height="3" /><rect x="8" y="13" width="8" height="3" /></>,
  recherche: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  televerser: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  telecharger: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  etoile: <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9L12 3.5Z" />,
  "etoile-pleine": <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9L12 3.5Z" fill="currentColor" />,
  options: <><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" /></>,
  coche: <path d="m5 12 5 5 9-10" />,
  croix: <path d="M6 6l12 12M18 6 6 18" />,
  alerte: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  rafraichir: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></>,
  externe: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  bannir: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>,
  comparer: <><path d="M12 3v18" /><rect x="3" y="6" width="7" height="12" rx="1" /><rect x="14" y="6" width="7" height="12" rx="1" strokeDasharray="2 2" /></>,
  renommer: <path d="M4 20h4l10-10-4-4L4 16v4ZM13 7l4 4" />,
  lecture: <path d="M7 5v14l11-7L7 5Z" />,
  scene: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 21h8M6 14l4-4 3 3 2-2 3 3" /></>,
} satisfies Record<string, ReactNode>;

export type NomIcone = keyof typeof DESSINS;

/** Sprite à monter une seule fois, à la racine de l'application. */
export function SpriteIcones(): ReactNode {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        {Object.entries(DESSINS).map(([nom, dessin]) => (
          <symbol key={nom} id={`ic-${nom}`} viewBox="0 0 24 24">{dessin}</symbol>
        ))}
      </defs>
    </svg>
  );
}

/** Icône 16 px, couleur héritée du parent. Décorative par défaut. */
export function Icone({ nom, titre }: { nom: NomIcone; titre?: string }): ReactNode {
  return (
    <svg className="ic" role={titre ? "img" : undefined} aria-hidden={titre ? undefined : true}>
      {titre ? <title>{titre}</title> : null}
      <use href={`#ic-${nom}`} />
    </svg>
  );
}
