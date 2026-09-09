// Logique de la scène : applique la configuration, tient l'horloge et lit l'accord courant
// dans le DOM du moteur (iframe même origine). Deux minuteries fixes, créées une seule fois ;
// le DOM n'est modifié que quand une valeur change. Rien n'est inventé : lecture impossible → bloc masqué.
(function () {
  "use strict";

  const CONFIG = window.SCENE_CONFIG;
  const CADENCE_HORLOGE_MS = 1000;
  const CADENCE_ACCORDS_MS = 300;
  const ROMAINS = ["I", "II", "III", "IV", "V", "VI", "VII"];
  const FORMAT_HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const el = (id) => document.getElementById(id);

  // ---- Couche fond et thème -------------------------------------------------------------

  function appliquerTheme() {
    document.documentElement.dataset.theme = CONFIG.theme;
    document.body.classList.toggle("moteur-visible", CONFIG.moteur);
  }

  function appliquerFond() {
    const fond = el("fond");
    fond.style.backgroundImage = 'url("' + CONFIG.fond + '")';
    const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    fond.classList.toggle("derive", CONFIG.mouvement && !mouvementReduit);
  }

  // ---- Couche texte ---------------------------------------------------------------------

  function appliquerTexte(id, valeur) {
    const cible = el(id);
    cible.textContent = valeur;
    cible.hidden = valeur.length === 0;
  }

  function appliquerTextes() {
    appliquerTexte("titre", CONFIG.titre);
    appliquerTexte("sousTitre", CONFIG.sousTitre);
    appliquerTexte("credits", CONFIG.credits);
  }

  // ---- Couche info : horloge -------------------------------------------------------------

  function demarrerHorloge() {
    const bloc = el("horloge");
    if (!CONFIG.horloge) return;
    const heure = el("horlogeHeure");
    const date = el("horlogeDate");
    const rafraichir = () => {
      const maintenant = new Date();
      const h = FORMAT_HEURE.format(maintenant);
      const d = FORMAT_DATE.format(maintenant);
      if (heure.textContent !== h) heure.textContent = h;
      if (date.textContent !== d) date.textContent = d;
    };
    rafraichir();
    bloc.hidden = false;
    setInterval(rafraichir, CADENCE_HORLOGE_MS);
  }

  // ---- Couche info : accord courant ------------------------------------------------------

  // Lit la progression dans le DOM du moteur. Retourne null dès que quelque chose manque.
  function lireProgression() {
    try {
      const doc = el("moteur").contentDocument;
      const liste = doc && doc.querySelector("ol.progressionList");
      if (!liste) return null;
      const cle = liste.querySelector("li.key");
      const degres = Array.from(liste.querySelectorAll("li:not(.key)"), (li) => ({
        texte: li.textContent.trim(),
        actif: li.classList.contains("live"),
      }));
      if (!cle || degres.length === 0) return null;
      return { cle: cle.textContent.trim(), degres };
    } catch (_erreur) {
      // Iframe non lisible (origine différente, document en cours de rechargement) : on masque.
      return null;
    }
  }

  // Le moteur affiche le degré en chiffre (1-7) ; on le transcrit en chiffre romain, sinon tel quel.
  function enRomain(texte) {
    const n = Number(texte);
    return Number.isInteger(n) && n >= 1 && n <= ROMAINS.length ? ROMAINS[n - 1] : texte;
  }

  function signature(progression) {
    const degres = progression.degres.map((d) => d.texte + (d.actif ? "*" : "")).join(",");
    return progression.cle + "|" + degres;
  }

  function ajusterNombreDeCellules(liste, nombre) {
    while (liste.children.length > nombre) liste.removeChild(liste.lastElementChild);
    while (liste.children.length < nombre) liste.appendChild(document.createElement("li"));
  }

  function afficherProgression(progression) {
    el("accordsCle").textContent = progression.cle;
    const liste = el("accordsListe");
    ajusterNombreDeCellules(liste, progression.degres.length);
    progression.degres.forEach((degre, i) => {
      const cellule = liste.children[i];
      const texte = enRomain(degre.texte);
      if (cellule.textContent !== texte) cellule.textContent = texte;
      cellule.classList.toggle("actif", degre.actif);
    });
  }

  function demarrerAccords() {
    const bloc = el("accords");
    if (!CONFIG.accords) return;
    let derniere = "";
    const sonder = () => {
      const progression = lireProgression();
      if (!progression) {
        bloc.hidden = true;
        derniere = "";
        return;
      }
      const actuelle = signature(progression);
      if (actuelle === derniere) return;
      derniere = actuelle;
      afficherProgression(progression);
      bloc.hidden = false;
    };
    setInterval(sonder, CADENCE_ACCORDS_MS);
  }

  // ---- Démarrage ------------------------------------------------------------------------

  appliquerTheme();
  appliquerFond();
  appliquerTextes();
  demarrerHorloge();
  demarrerAccords();
})();
