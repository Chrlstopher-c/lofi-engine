/**
 * Connexion du compte Twitch par code d'appareil.
 * L'interface ne voit jamais un jeton : elle sait qu'une application est enregistrée, et quel
 * code l'utilisateur doit saisir sur twitch.tv. Une fois le compte connecté, ce bloc laisse la
 * place à l'en-tête de chaîne.
 */
import { useState, type ReactNode } from "react";
import type { ConnexionAppareil, EtatTwitch } from "../../twitch/types.ts";
import { Alerte, Bouton, BoutonIcone, Champ, Section, Texte } from "../commun/composants.tsx";
import { dureeRestante } from "./format-twitch.ts";
import type { Twitch } from "./useTwitch.ts";

const CONSOLE_TWITCH = "https://dev.twitch.tv/console/apps";

interface ApplicationProps { enregistree: boolean; occupe: boolean; onEnregistrer: (id: string) => void; }

function Application({ enregistree, occupe, onEnregistrer }: ApplicationProps): ReactNode {
  const [saisie, setSaisie] = useState<string | null>(null);
  if (saisie === null) {
    return (
      <div className="ligne retour">
        <Bouton petit desactive={occupe} onClick={() => setSaisie("")}>
          {enregistree ? "Remplacer le Client ID" : "Saisir le Client ID"}
        </Bouton>
        <span className="aide">
          Application à créer sur <a href={CONSOLE_TWITCH} target="_blank" rel="noreferrer">
            la console développeur Twitch</a>, type « Application publique ». Ni URL de redirection,
          ni Client Secret.
        </span>
      </div>
    );
  }
  return (
    <Champ libelle="Client ID" indice="30 caractères, visible sur la fiche de l'application">
      <span className="ligne">
        <Texte mono valeur={saisie} onChange={setSaisie} placeholder="abcdefghij0123456789klmnopqrst" />
        <Bouton petit variante="principal" desactive={occupe || saisie.trim() === ""}
          onClick={() => { onEnregistrer(saisie.trim()); setSaisie(null); }}>Enregistrer</Bouton>
        <Bouton petit variante="discret" onClick={() => setSaisie(null)}>Annuler</Bouton>
      </span>
    </Champ>
  );
}

interface CodeProps { connexion: ConnexionAppareil; occupe: boolean; onAnnuler: () => void; }

function CodeActivation({ connexion, occupe, onAnnuler }: CodeProps): ReactNode {
  const [copie, setCopie] = useState<"inactif" | "fait" | "echec">("inactif");
  const restant = dureeRestante(connexion.expireA);
  const copier = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(connexion.codeUtilisateur);
      setCopie("fait");
    } catch {
      setCopie("echec"); // presse-papiers refusé hors contexte sécurisé : on le dit, on ne ment pas
    }
  };
  return (
    <Champ libelle="Code à saisir sur Twitch"
      indice={[
        copie === "fait" ? "Code copié." : "",
        copie === "echec" ? "Copie refusée par le navigateur : sélectionner le code à la main." : "",
        `En attente de la validation${restant ? ` — code valable encore ${restant}` : ""}…`,
      ].filter(Boolean).join(" ")}>
      <span className="ligne">
        <Texte mono lectureSeule valeur={connexion.codeUtilisateur} onChange={() => undefined} />
        <BoutonIcone nom="copier" titre="Copier le code" onClick={() => void copier()} />
        <Bouton petit variante="discret" desactive={occupe} onClick={onAnnuler}>Annuler</Bouton>
      </span>
    </Champ>
  );
}

/** Ce qu'il reste d'une tentative terminée : le message de Twitch, sans enjolivure. */
function Verdict({ connexion }: { connexion: ConnexionAppareil }): ReactNode {
  if (connexion.statut === "attente" || connexion.statut === "reussie") return null;
  const niveau = connexion.statut === "annulee" ? "info" : "erreur";
  return <Alerte niveau={niveau} message={connexion.message ?? "Connexion interrompue."} />;
}

function Ouverture({ connexion }: { connexion: ConnexionAppareil }): ReactNode {
  return (
    <p className="aide">
      Ouvrir <a href={connexion.urlVerification} target="_blank" rel="noreferrer">
        la page d'activation Twitch</a>, puis y saisir le code ci-dessous.
    </p>
  );
}

export function Compte({ twitch }: { twitch: Twitch }): ReactNode {
  const etat: EtatTwitch | null = twitch.etat;
  if (!etat) return <Section titre="Compte Twitch"><p className="chargement">Lecture de l'état…</p></Section>;
  const connexion = etat.connexion;
  const attente = connexion?.statut === "attente";
  return (
    <Section titre="Compte Twitch">
      <Application enregistree={etat.applicationEnregistree} occupe={twitch.occupe}
        onEnregistrer={(id) => void twitch.enregistrerApplication(id)} />
      {connexion ? <Verdict connexion={connexion} /> : null}
      {attente && connexion ? <Ouverture connexion={connexion} /> : null}
      {attente && connexion
        ? <CodeActivation connexion={connexion} occupe={twitch.occupe} onAnnuler={() => void twitch.annuler()} />
        : null}
      {!attente && etat.applicationEnregistree
        ? <Bouton variante="principal" desactive={twitch.occupe} onClick={() => void twitch.connecter()}>
            Connecter le compte Twitch
          </Bouton>
        : null}
    </Section>
  );
}
