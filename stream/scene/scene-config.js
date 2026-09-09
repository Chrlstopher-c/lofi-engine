// Modèle de la scène : valeurs par défaut, assainissement d'un JSON reçu, surcharges d'URL.
// Expose window.SCENE_CONFIG = { DEFAUTS, nettoyerScene, surcharger, cheminScene, moteurVisible }.
// Le fichier /fonds/scene.json est écrit par le centre de contrôle ; il n'est pas de confiance
// pour autant (édition à la main possible) : tout passe par nettoyerScene avant affichage.
(function () {
  "use strict";

  // Miroir de stream/controle/scene-defaut.json : ce qui s'affiche tant qu'aucun fichier n'est lu.
  const DEFAUTS = Object.freeze({
    version: 1,
    theme: "nuit",
    fond: { fichier: "", ajustement: "cover", mouvement: true, voile: 0.55, vignettage: true },
    calques: [
      { id: "titre", nom: "Titre", type: "texte", visible: true, ancre: "bas-gauche", x: 4.5, y: 14,
        taille: 4.2, opacite: 1, couleur: "#f2f4f8", texte: "LoFi Engine", graisse: "legere" },
      { id: "sous-titre", nom: "Sous-titre", type: "texte", visible: true, ancre: "bas-gauche", x: 4.5,
        y: 9, taille: 1.5, opacite: 0.78, couleur: "#d5dae4",
        texte: "Musique lofi générée en direct, note par note", graisse: "normale" },
      { id: "horloge", nom: "Horloge", type: "horloge", visible: true, ancre: "haut-droite", x: 4.5,
        y: 6, taille: 3.2, opacite: 0.9, couleur: "#e8ebf2", date: true },
      { id: "accords", nom: "Tonalité et accords", type: "accords", visible: true, ancre: "bas-droite",
        x: 4.5, y: 9, taille: 1.1, opacite: 1, couleur: "#e8ebf2", cadre: true },
    ],
  });

  const ANCRES = ["haut-gauche", "haut-centre", "haut-droite", "centre", "bas-gauche", "bas-centre", "bas-droite"];
  const TYPES = ["texte", "horloge", "accords", "image", "video"];
  const THEMES = ["nuit", "ambre", "brume"];
  const VRAI = ["1", "true", "oui", "on"];
  const FAUX = ["0", "false", "non", "off"];
  const TEXTE_MAX = 240;
  const CALQUES_MAX = 40;
  // Un nom de fichier sous /fonds/, ou (par l'URL seulement) un chemin absolu de la même origine.
  const NOM_FICHIER = /^[\w][\w .-]{0,120}$/;
  const CHEMIN_LOCAL = /^\/[\w\-./%?&=#+~,@ ]{1,300}$/;

  // ---- Assainissement ------------------------------------------------------------------

  function borner(valeur, min, max, defaut) {
    const n = typeof valeur === "number" ? valeur : Number(valeur);
    if (!Number.isFinite(n)) return defaut;
    return Math.min(max, Math.max(min, n));
  }

  function texte(valeur, defaut) {
    return typeof valeur === "string" ? valeur.slice(0, TEXTE_MAX) : defaut;
  }

  function booleen(valeur, defaut) {
    if (typeof valeur === "boolean") return valeur;
    const v = String(valeur === undefined ? "" : valeur).trim().toLowerCase();
    if (VRAI.includes(v)) return true;
    if (FAUX.includes(v)) return false;
    return defaut;
  }

  function fichier(valeur) {
    const v = texte(valeur, "");
    if (v.includes("..")) return "";
    if (NOM_FICHIER.test(v)) return v;
    if (CHEMIN_LOCAL.test(v) && !v.startsWith("//")) return v;
    return "";
  }

  function couleur(valeur, defaut) {
    const v = texte(valeur, "");
    return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : defaut;
  }

  function nettoyerCalque(brut, rang) {
    const b = brut && typeof brut === "object" ? brut : {};
    if (!TYPES.includes(b.type)) return null;
    const id = texte(b.id, "").replace(/[^\w-]/g, "").slice(0, 40) || "calque-" + rang;
    return {
      id,
      nom: texte(b.nom, id).slice(0, 60),
      type: b.type,
      visible: booleen(b.visible, true),
      ancre: ANCRES.includes(b.ancre) ? b.ancre : "bas-gauche",
      x: borner(b.x, -50, 150, 4.5),
      y: borner(b.y, -50, 150, 10),
      taille: borner(b.taille, 0.2, 40, 2),
      opacite: borner(b.opacite, 0, 1, 1),
      couleur: couleur(b.couleur, "#f2f4f8"),
      texte: texte(b.texte, ""),
      graisse: b.graisse === "legere" ? "legere" : "normale",
      date: booleen(b.date, true),
      cadre: booleen(b.cadre, true),
      boucle: booleen(b.boucle, true),
      fichier: fichier(b.fichier),
    };
  }

  function nettoyerFond(brut) {
    const b = brut && typeof brut === "object" ? brut : {};
    return {
      fichier: fichier(b.fichier),
      ajustement: b.ajustement === "contain" ? "contain" : "cover",
      mouvement: booleen(b.mouvement, true),
      voile: borner(b.voile, 0, 1, 0.55),
      vignettage: booleen(b.vignettage, true),
    };
  }

  // Rend toujours une scène complète, quel que soit ce qu'on lui donne.
  function nettoyerScene(brut) {
    const o = brut && typeof brut === "object" ? brut : {};
    const calques = (Array.isArray(o.calques) ? o.calques : [])
      .slice(0, CALQUES_MAX)
      .map(nettoyerCalque)
      .filter((c) => c !== null);
    return {
      version: 1,
      theme: THEMES.includes(o.theme) ? o.theme : "nuit",
      fond: nettoyerFond(o.fond),
      calques,
    };
  }

  // ---- Surcharges d'URL ----------------------------------------------------------------
  // Un paramètre présent et non vide l'emporte sur le fichier ; absent ou vide, le fichier prime.

  const PARAMS = new URLSearchParams(window.location.search);

  function param(nom) {
    const v = PARAMS.get(nom);
    return v === null || v.trim() === "" ? null : v.trim();
  }

  // « fond=/fonds/ » (nom vide, tel que direct.sh l'émet sans STREAM_FOND) vaut absence.
  function paramFond() {
    const v = param("fond");
    if (v === null || /^\/fonds\/?$/.test(v)) return null;
    return v.startsWith("/fonds/") ? v.slice("/fonds/".length) : v;
  }

  // Emplacements des calques créés par titre= / sousTitre= / credits= quand le fichier n'en a pas.
  const CALQUES_URL = {
    titre: { id: "titre", y: 14, taille: 4.2, opacite: 1, graisse: "legere" },
    sousTitre: { id: "sous-titre", y: 9, taille: 1.5, opacite: 0.78, graisse: "normale" },
    credits: { id: "credits", y: 5, taille: 0.95, opacite: 0.5, graisse: "normale" },
  };

  function surchargerTexte(scene, nomParam) {
    const valeur = param(nomParam);
    if (valeur === null) return;
    const gabarit = CALQUES_URL[nomParam];
    const existant = scene.calques.find((c) => c.id === gabarit.id && c.type === "texte");
    if (existant) { existant.texte = valeur; existant.visible = true; return; }
    scene.calques.push(nettoyerCalque(Object.assign({ type: "texte", texte: valeur }, gabarit), 0));
  }

  function surchargerVisibilite(scene, nomParam, type) {
    const v = param(nomParam);
    if (v === null) return;
    scene.calques.forEach((c) => { if (c.type === type) c.visible = booleen(v, c.visible); });
  }

  // calque.<id>.<champ>=valeur : tout champ d'un calque existant, repassé par l'assainissement.
  function surchargerCalques(scene) {
    PARAMS.forEach((valeur, cle) => {
      const m = /^calque\.([\w-]+)\.(\w+)$/.exec(cle);
      if (!m || valeur.trim() === "") return;
      const cible = scene.calques.find((c) => c.id === m[1]);
      if (!cible) return;
      const brut = Object.assign({}, cible);
      brut[m[2]] = valeur;
      Object.assign(cible, nettoyerCalque(brut, 0) || cible);
    });
  }

  function surchargerFond(scene) {
    const fondUrl = paramFond();
    if (fondUrl !== null) scene.fond.fichier = fichier(fondUrl);
    const f = scene.fond;
    if (param("ajustement") === "contain" || param("ajustement") === "cover") f.ajustement = param("ajustement");
    if (param("mouvement") !== null) f.mouvement = booleen(param("mouvement"), f.mouvement);
    if (param("voile") !== null) f.voile = borner(param("voile"), 0, 1, f.voile);
    if (param("vignettage") !== null) f.vignettage = booleen(param("vignettage"), f.vignettage);
  }

  // Applique les paramètres d'URL sur une scène déjà assainie. Retourne une copie.
  function surcharger(sceneAssainie) {
    const scene = JSON.parse(JSON.stringify(sceneAssainie));
    const theme = param("theme");
    if (theme !== null && THEMES.includes(theme.toLowerCase())) scene.theme = theme.toLowerCase();
    surchargerFond(scene);
    Object.keys(CALQUES_URL).forEach((nom) => surchargerTexte(scene, nom));
    surchargerVisibilite(scene, "horloge", "horloge");
    surchargerVisibilite(scene, "accords", "accords");
    surchargerCalques(scene);
    return scene;
  }

  // scene=/chemin/autre.json : un autre fichier de scène, même origine, pour tester une variante.
  function cheminScene() {
    const v = param("scene");
    return v !== null && CHEMIN_LOCAL.test(v) && !v.startsWith("//") ? v : "/fonds/scene.json";
  }

  window.SCENE_CONFIG = Object.freeze({
    DEFAUTS,
    nettoyerScene,
    surcharger,
    cheminScene: cheminScene(),
    moteurVisible: booleen(param("moteur"), false),
  });
})();
