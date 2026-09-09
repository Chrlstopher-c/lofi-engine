// Logique de la scène : lit /fonds/scene.json à chaud, construit les calques depuis le tableau,
// tient l'horloge et lit l'accord courant dans le DOM du moteur (iframe même origine).
// Trois minuteries fixes, créées une seule fois ; le DOM n'est modifié que quand une valeur change.
// Rien n'est inventé : fichier illisible → dernière scène valide ; accords illisibles → calque masqué.
(function () {
  "use strict";

  const CONFIG = window.SCENE_CONFIG;
  const CALQUES = window.SCENE_CALQUES;
  const CADENCE_SCENE_MS = 3000;
  const DELAI_LECTURE_MS = 2500;
  const CADENCE_HORLOGE_MS = 1000;
  const CADENCE_ACCORDS_MS = 300;
  const ROMAINS = ["I", "II", "III", "IV", "V", "VI", "VII"];
  const FORMAT_HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const el = (id) => document.getElementById(id);
  // Éléments de calque vivants, par id, avec la signature du calque qui les a produits.
  const vivants = new Map();
  let fondCourant = null;
  let chargementFond = 0;

  // ---- Thème et fond ---------------------------------------------------------------------

  // ?apercu=1 : la scène est affichée pour être réglée, pas diffusée.
  function estApercu() {
    const v = new URLSearchParams(location.search).get("apercu");
    return ["1", "true", "oui", "on"].includes((v ?? "").toLowerCase());
  }

  function appliquerTheme(scene) {
    if (document.documentElement.dataset.theme !== scene.theme) document.documentElement.dataset.theme = scene.theme;
    document.body.classList.toggle("moteur-visible", CONFIG.moteurVisible);

    // ?apercu=1 : la scène est affichée pour être réglée, pas diffusée. On ne charge pas
    // le moteur, sinon le navigateur de l'utilisateur se met à jouer la musique.
    const moteur = el("moteur");
    if (moteur && !moteur.src && !estApercu()) {
      moteur.src = moteur.dataset.src ?? "/?autoplay=1";
    }
  }

  // L'image est préchargée avant d'être posée : pas de trou noir entre deux fonds.
  function poserImageDeFond(url) {
    const fond = el("fond");
    const numero = ++chargementFond;
    if (!url) { fond.style.backgroundImage = "none"; return; }
    const image = new Image();
    image.onload = () => { if (numero === chargementFond) fond.style.backgroundImage = 'url("' + url + '")'; };
    image.onerror = () => { /* fichier absent : on garde ce qui est affiché */ };
    image.src = url;
  }

  const EXT_VIDEO = /\.(mp4|webm|m4v)$/i;

  // Un fond vidéo remplace l'image : on n'affiche jamais les deux.
  function poserFond(url) {
    const video = el("fondVideo");
    const image = el("fond");
    if (url && EXT_VIDEO.test(url)) {
      image.style.backgroundImage = "none";
      video.hidden = false;
      if (video.getAttribute("src") !== url) {
        video.src = url;
        const lecture = video.play();
        if (lecture && typeof lecture.catch === "function") lecture.catch(() => {});
      }
      return;
    }
    video.hidden = true;
    video.removeAttribute("src");
    poserImageDeFond(url);
  }

  function appliquerFond(scene) {
    const f = scene.fond;
    const url = CALQUES.urlFichier(f.fichier);
    if (url !== fondCourant) { fondCourant = url; poserFond(url); }
    const fond = el("fond");
    const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    fond.classList.toggle("derive", f.mouvement && !mouvementReduit);
    fond.classList.toggle("contain", f.ajustement === "contain");
    el("fondVideo").classList.toggle("contain", f.ajustement === "contain");
    const voile = el("voile");
    voile.style.setProperty("--voile", String(f.voile));
    voile.classList.toggle("vignette", f.vignettage);
  }

  // ---- Calques : construits depuis le tableau, réconciliés par id ------------------------

  function retirerDisparus(ids) {
    vivants.forEach((entree, id) => {
      if (ids.has(id)) return;
      entree.el.remove();
      vivants.delete(id);
    });
  }

  function obtenirElement(calque) {
    const entree = vivants.get(calque.id);
    if (entree && entree.type === calque.type) return entree;
    if (entree) entree.el.remove();
    const nouveau = CALQUES.creer(calque);
    if (!nouveau) return null;
    const cree = { el: nouveau, type: calque.type, signature: "" };
    vivants.set(calque.id, cree);
    return cree;
  }

  // L'ordre du DOM est l'ordre d'empilement : on ne déplace un élément que s'il n'est pas à sa place.
  function ordonner(conteneur, elements) {
    elements.forEach((element, i) => {
      if (conteneur.children[i] !== element) conteneur.insertBefore(element, conteneur.children[i] || null);
    });
  }

  function appliquerCalques(scene) {
    const conteneur = el("calques");
    const visibles = scene.calques.filter((c) => c.visible);
    retirerDisparus(new Set(visibles.map((c) => c.id)));
    const elements = [];
    visibles.forEach((calque) => {
      const entree = obtenirElement(calque);
      if (!entree) return;
      const signature = JSON.stringify(calque);
      if (entree.signature !== signature) {
        CALQUES.appliquer(entree.el, calque);
        entree.signature = signature;
      }
      elements.push(entree.el);
    });
    ordonner(conteneur, elements);
  }

  function appliquerScene(sceneAssainie) {
    const scene = CONFIG.surcharger(sceneAssainie);
    appliquerTheme(scene);
    // En mode audio seul, le moteur joue et rien d'autre n'est dessiné : ni fond à décoder,
    // ni calque à composer. Le thème reste appliqué, il ne coûte rien.
    if (CONFIG.audioSeul) return;
    appliquerFond(scene);
    appliquerCalques(scene);
  }

  // ---- Rechargement à chaud --------------------------------------------------------------

  let dernierTexte = "";
  let lectureEnCours = false;

  async function lireFichier() {
    const controleur = new AbortController();
    const minuterie = setTimeout(() => controleur.abort(), DELAI_LECTURE_MS);
    try {
      const reponse = await fetch(CONFIG.cheminScene, { cache: "no-store", signal: controleur.signal });
      return reponse.ok ? await reponse.text() : null;
    } catch (_erreur) {
      // Réseau, délai ou fichier absent : la scène en place reste affichée.
      return null;
    } finally {
      clearTimeout(minuterie);
    }
  }

  async function rafraichirScene() {
    // Une édition en cours prime sur le fichier : sinon la relecture écraserait l'aperçu.
    if (lectureEnCours || apercuPilote) return;
    lectureEnCours = true;
    try {
      const texte = await lireFichier();
      if (texte === null || texte === dernierTexte) return;
      let brut;
      try { brut = JSON.parse(texte); } catch (_erreur) { return; }
      if (!brut || typeof brut !== "object") return;
      appliquerScene(CONFIG.nettoyerScene(brut));
      dernierTexte = texte;
    } catch (_erreur) {
      // Une application ratée ne doit pas tuer la boucle : la prochaine lecture retentera.
    } finally {
      lectureEnCours = false;
    }
  }

  // ---- Aperçu piloté depuis le centre de contrôle ---------------------------------------
  // En mode aperçu seulement : la scène applique la configuration qu'on lui envoie, sans
  // passer par le fichier. C'est ce qui permet de voir une modification avant de l'enregistrer.
  // La scène diffusée, elle, n'écoute rien — sinon n'importe quelle page pourrait la détourner.
  let apercuPilote = false;

  function ecouterApercu() {
    if (!estApercu()) return;
    window.addEventListener("message", function (evenement) {
      const donnees = evenement.data;
      if (!donnees || donnees.type !== "scene-apercu" || typeof donnees.scene !== "object") return;
      try {
        appliquerScene(CONFIG.nettoyerScene(donnees.scene));
        apercuPilote = true;
      } catch (_erreur) {
        // Une configuration illisible ne doit pas casser l'aperçu : on garde l'affichage courant.
      }
    });
  }

  // ---- Horloge : une minuterie pour tous les calques de ce type --------------------------

  function tenirHorloge() {
    const maintenant = new Date();
    const h = FORMAT_HEURE.format(maintenant);
    const d = FORMAT_DATE.format(maintenant);
    document.querySelectorAll(".calque-horloge").forEach((calque) => {
      const heure = calque.querySelector(".horloge-heure");
      const date = calque.querySelector(".horloge-date");
      if (heure.textContent !== h) heure.textContent = h;
      if (date.textContent !== d) date.textContent = d;
    });
  }

  // ---- Accords : lus dans le DOM du moteur ----------------------------------------------

  // Retourne null dès que quelque chose manque : le calque sera masqué, jamais rempli d'un repli.
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
      return null;
    }
  }

  // Le moteur affiche le degré en chiffre (1-7) ; on le transcrit en chiffre romain, sinon tel quel.
  function enRomain(texte) {
    const n = Number(texte);
    return Number.isInteger(n) && n >= 1 && n <= ROMAINS.length ? ROMAINS[n - 1] : texte;
  }

  function signatureProgression(progression) {
    const degres = progression.degres.map((d) => d.texte + (d.actif ? "*" : "")).join(",");
    return progression.cle + "|" + degres;
  }

  function ajusterNombreDeCellules(liste, nombre) {
    while (liste.children.length > nombre) liste.removeChild(liste.lastElementChild);
    while (liste.children.length < nombre) liste.appendChild(document.createElement("li"));
  }

  function afficherProgression(calque, progression) {
    calque.querySelector(".accords-cle").textContent = progression.cle;
    const liste = calque.querySelector(".accords-liste");
    ajusterNombreDeCellules(liste, progression.degres.length);
    progression.degres.forEach((degre, i) => {
      const cellule = liste.children[i];
      const texte = enRomain(degre.texte);
      if (cellule.textContent !== texte) cellule.textContent = texte;
      cellule.classList.toggle("actif", degre.actif);
    });
  }

  function sonderAccords() {
    const progression = lireProgression();
    const actuelle = progression ? signatureProgression(progression) : "";
    document.querySelectorAll(".calque-accords").forEach((calque) => {
      if (!progression) { calque.hidden = true; calque.dataset.signature = ""; return; }
      if (calque.dataset.signature !== actuelle) {
        afficherProgression(calque, progression);
        calque.dataset.signature = actuelle;
      }
      calque.hidden = false;
    });
  }

  // ---- Démarrage ------------------------------------------------------------------------

  appliquerScene(CONFIG.nettoyerScene(CONFIG.DEFAUTS));
  ecouterApercu();
  tenirHorloge();
  setInterval(tenirHorloge, CADENCE_HORLOGE_MS);
  setInterval(sonderAccords, CADENCE_ACCORDS_MS);
  setInterval(rafraichirScene, CADENCE_SCENE_MS);
  // Première lecture sans attendre la cadence ; ses erreurs sont déjà absorbées dans la fonction.
  void rafraichirScene();
})();
