/**
 * Connexion du compte Twitch par code d'appareil.
 * L'interface ne voit jamais un jeton : elle sait qu'une application est enregistrée, qu'un
 * compte est connecté, et quel code l'utilisateur doit saisir sur twitch.tv.
 */
import { useState, type ReactNode } from "react";
import type { ConnexionAppareil, EtatTwitch } from "../../twitch/types.ts";
import { Alerte, Bouton, Champ, Section, Texte } from "../commun/composants.tsx";
import { dateLisible } from "../commun/format.ts";
import { dureeRestante } from "./format-twitch.ts";
import type { Twitch } from "./useTwitch.ts";

const CONSOLE_TWITCH = "https://dev.twitch.tv/console/apps";

interface ApplicationProps { enregistree: boolean; occupe: boolean; onEnregistrer: (id: string) => void; }

function Application({ enregistree, occupe, onEnregistrer }: ApplicationProps): ReactNode {
  const [saisie, setSaisie] = useState<string | null>(null);
  if (saisie === null) {
    return (
      <div className="ligne-actions">
        <Bouton petit desactive={occupe} onClick={() => setSaisie("")}>
          {enregistree ? "Remplacer le Client ID" : "Saisir le Client ID"}
        </Bouton>
        <span className="discret">
          Application à créer sur <a className="lien" href={CONSOLE_TWITCH} target="_blank" rel="noreferrer">
            la console développeur Twitch</a>, type « Application publique ». Aucune URL de redirection
          n'est nécessaire, aucun Client Secret non plus.
        </span>
      </div>
    );
  }
  return (
    <Champ libelle="Client ID" indice="30 caractères, visible sur la fiche de l'application">
      <span className="saisie-cle">
        <Texte mono valeur={saisie} onChange={setSaisie} placeholder="abcdefghij0123456789klmnopqrst" />
        <Bouton petit variante="principal" desactive={occupe || saisie.trim() === ""}
          onClick={() => { onEnregistrer(saisie.trim()); setSaisie(null); }}>Enregistrer</Bouton>
        <Bouton petit variante="discret" onClick={() => setSaisie(null)}>Annuler</Bouton>
      </span>
    </Champ>
  );
}

function CodeActivation({ connexion, occupe, onAnnuler }: {
  connexion: ConnexionAppareil; occupe: boolean; onAnnuler: () => void;
}): ReactNode {
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
    <div className="twitch-activation">
      <p className="discret">
        1. Ouvrir <a className="lien" href={connexion.urlVerification} target="_blank" rel="noreferrer">
          la page d'activation Twitch</a> — 2. y saisir ce code :
      </p>
      <div className="twitch-code">
        <output className="twitch-code-valeur">{connexion.codeUtilisateur}</output>
        <Bouton petit onClick={() => void copier()}>Copier</Bouton>
        <Bouton petit variante="discret" desactive={occupe} onClick={onAnnuler}>Annuler</Bouton>
      </div>
      <p className="discret">
        {copie === "fait" ? "Code copié. " : null}
        {copie === "echec" ? "Copie refusée par le navigateur : sélectionner le code à la main. " : null}
        En attente de la validation sur Twitch{restant ? ` — code valable encore ${restant}` : ""}…
      </p>
    </div>
  );
}

function Connecte({ etat, twitch }: { etat: EtatTwitch; twitch: Twitch }): ReactNode {
  const [cleDeposee, setCleDeposee] = useState(false);
  const recuperer = async (): Promise<void> => {
    setCleDeposee(await twitch.recupererCle());
  };
  return (
    <div className="twitch-connecte">
      <p>
        Chaîne <strong>{etat.utilisateurLogin}</strong>
        {etat.jetonExpireA
          ? <span className="discret"> · jeton valable jusqu'à {dateLisible(etat.jetonExpireA)}</span>
          : null}
      </p>
      <p className="discret mono">{etat.portees.join(" · ")}</p>
      <div className="ligne-actions">
        <Bouton variante="principal" desactive={twitch.occupe} onClick={() => void recuperer()}>
          Récupérer la clé de diffusion
        </Bouton>
        <span className={cleDeposee ? "etiquette ok" : "discret"}>
          {cleDeposee
            ? "Clé déposée dans le .env — visible dans l'onglet Diffusion."
            : "Elle est écrite dans le .env, jamais affichée."}
        </span>
        <Bouton variante="danger" petit desactive={twitch.occupe} onClick={() => void twitch.deconnecter()}>
          Déconnecter
        </Bouton>
      </div>
    </div>
  );
}

/** Ce qu'il reste d'une tentative terminée : le message de Twitch, sans enjolivure. */
function Verdict({ connexion }: { connexion: ConnexionAppareil }): ReactNode {
  if (connexion.statut === "attente" || connexion.statut === "reussie") return null;
  const niveau = connexion.statut === "annulee" ? "info" : "erreur";
  return <Alerte niveau={niveau} message={connexion.message ?? "Connexion interrompue."} />;
}

export function Compte({ twitch }: { twitch: Twitch }): ReactNode {
  const etat = twitch.etat;
  if (!etat) return <Section titre="Compte Twitch"><p className="discret">Lecture de l'état…</p></Section>;
  const attente = etat.connexion?.statut === "attente";
  const etiquette = etat.compteConnecte ? "Compte connecté" : "Compte non connecté";
  return (
    <Section titre="Compte Twitch"
      actions={<span className={etat.compteConnecte ? "etiquette ok" : "etiquette attention"}>{etiquette}</span>}>
      <div className="twitch-compte">
        <Application enregistree={etat.applicationEnregistree} occupe={twitch.occupe}
          onEnregistrer={(id) => void twitch.enregistrerApplication(id)} />
        {etat.connexion ? <Verdict connexion={etat.connexion} /> : null}
        {etat.compteConnecte ? <Connecte etat={etat} twitch={twitch} /> : null}
        {!etat.compteConnecte && attente && etat.connexion
          ? <CodeActivation connexion={etat.connexion} occupe={twitch.occupe}
              onAnnuler={() => void twitch.annuler()} />
          : null}
        {!etat.compteConnecte && !attente && etat.applicationEnregistree
          ? <Bouton variante="principal" desactive={twitch.occupe} onClick={() => void twitch.connecter()}>
              Connecter le compte Twitch
            </Bouton>
          : null}
      </div>
    </Section>
  );
}
