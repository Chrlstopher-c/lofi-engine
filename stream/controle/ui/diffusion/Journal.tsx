/**
 * Journal du conteneur, relu tant que la diffusion tourne.
 * Le serveur envoie du texte brut, écrit par ffmpeg et par le diffuseur : il est rendu comme
 * du texte, jamais comme du balisage.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "../commun/api.ts";
import { Alerte, BoutonIcone, Section } from "../commun/composants.tsx";
import { messageErreur } from "../commun/format.ts";

const JOURNAL_MS = 3000;

interface Props {
  /** Nom du conteneur, tel que le serveur le donne ; rien n'est affiché sans lui. */
  conteneur: string | null;
  /** Relecture périodique : en marche, ou pendant la construction de l'image. */
  actif: boolean;
}

interface Journal { texte: string; erreur: string | null; relire: () => Promise<void>; }

function useJournal(actif: boolean): Journal {
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const relire = useCallback(async (): Promise<void> => {
    try {
      setTexte(await api.lireJournal());
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);

  useEffect(() => {
    void relire(); // lecture initiale, puis périodique seulement tant que ça tourne
    if (!actif) return undefined;
    const minuteur = window.setInterval(() => void relire(), JOURNAL_MS);
    return () => window.clearInterval(minuteur);
  }, [relire, actif]);

  return { texte, erreur, relire };
}

export function Journal({ conteneur, actif }: Props): ReactNode {
  const journal = useJournal(actif);
  const actions = (
    <BoutonIcone nom="rafraichir" titre="Actualiser le journal" variante="discret" taille="sm"
      onClick={() => void journal.relire()} />
  );
  return (
    <Section titre="Journal" compte={conteneur ?? undefined} actions={actions}>
      <Alerte message={journal.erreur} />
      <pre className="journal" aria-live="polite">{journal.texte || "…"}</pre>
    </Section>
  );
}
