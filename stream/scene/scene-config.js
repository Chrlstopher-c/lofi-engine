// Configuration de la scène, lue dans les paramètres de l'URL, avec des valeurs par défaut.
// Expose window.SCENE_CONFIG (objet gelé). Aucun paramètre n'est obligatoire : sans rien,
// la page est complète. Un paramètre texte vide (« &credits= ») masque le bloc correspondant.
(function () {
  "use strict";

  // Les crédits par défaut reprennent l'obligation d'attribution de CREDITS.md (CC BY 3.0).
  const DEFAUTS = Object.freeze({
    titre: "LoFi Engine",
    sousTitre: "Musique lofi générée en direct, note par note",
    credits: "Piano : Salamander Grand Piano V3, Alexander Holm (CC BY 3.0) · " +
      "Vent : Mark DiAngelo, SoundBible (CC BY 3.0)",
    fond: "/assets/background/bg9.webp",
    horloge: true,
    accords: true,
    theme: "nuit",
    moteur: false,
    mouvement: true,
  });

  const THEMES = ["nuit", "ambre", "brume"];
  const VRAI = ["1", "true", "oui", "on"];
  const FAUX = ["0", "false", "non", "off"];
  const TEXTE_MAX = 240;
  // Caractères admis dans l'URL du fond : elle finit dans un url(...) CSS, rien d'autre n'y entre.
  const FOND_ADMIS = /^[\w\-./:%?&=#+~,@]+$/;

  function lireTexte(params, nom) {
    const valeur = params.get(nom);
    if (valeur === null) return DEFAUTS[nom];
    return valeur.trim().slice(0, TEXTE_MAX);
  }

  function lireBooleen(params, nom) {
    const valeur = params.get(nom);
    if (valeur === null) return DEFAUTS[nom];
    const v = valeur.trim().toLowerCase();
    if (VRAI.includes(v)) return true;
    if (FAUX.includes(v)) return false;
    return DEFAUTS[nom];
  }

  function lireTheme(params) {
    const valeur = (params.get("theme") || "").trim().toLowerCase();
    return THEMES.includes(valeur) ? valeur : DEFAUTS.theme;
  }

  function lireFond(params) {
    const valeur = (params.get("fond") || "").trim();
    if (!valeur || !FOND_ADMIS.test(valeur)) return DEFAUTS.fond;
    if (/^javascript:/i.test(valeur)) return DEFAUTS.fond;
    return valeur;
  }

  function lire() {
    const params = new URLSearchParams(window.location.search);
    return Object.freeze({
      titre: lireTexte(params, "titre"),
      sousTitre: lireTexte(params, "sousTitre"),
      credits: lireTexte(params, "credits"),
      fond: lireFond(params),
      horloge: lireBooleen(params, "horloge"),
      accords: lireBooleen(params, "accords"),
      theme: lireTheme(params),
      moteur: lireBooleen(params, "moteur"),
      mouvement: lireBooleen(params, "mouvement"),
    });
  }

  window.SCENE_CONFIG = lire();
  window.SCENE_CONFIG_DEFAUTS = DEFAUTS;
})();
