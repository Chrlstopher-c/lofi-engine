import * as Tone from 'tone';

/**
 * La nappe de voix : de vraies tenues, choisies dans une banque, posées sur l'accord en cours.
 *
 * La synthèse par formants a été essayée et écartée à l'écoute — ça sonnait comme une scie
 * filtrée, pas comme une voyelle. Les échantillons sont maintenant générés en local par
 * ACE-Step (Apache 2.0), la voix isolée par demucs, et seule la fenêtre où le chant TIENT une
 * note est conservée. Une phrase chantée se bagarrerait avec la mélodie du moteur ; une note
 * tenue s'y pose.
 *
 * Chaque échantillon est rangé à sa hauteur mesurée : Tone.Sampler prend le plus proche de la
 * note demandée et ne le transpose que de ce qu'il faut. Au-delà de deux ou trois demi-tons une
 * voix se déforme, d'où une banque étalée sur quatre tonalités.
 *
 * Le mixage compte autant que le choix de la note. Une voix vit exactement là où vivent le
 * piano et la mélodie : à niveau égal elle les masque. D'où trois précautions — très en dessous,
 * coupée dans l'aigu pour lui ôter ses consonnes, et effacée à chaque attaque de piano.
 */

const RACINE = 'assets/engine/VoixSamples/';
const MANIFESTE = `${RACINE}manifeste.json`;

export interface Nappe {
  nom: string;
  fichier: string;
  couleur: string;
  types: string[];
  hauteur: string;
  hauteurDemiTon: number;
  tenueDuree: number;
}

interface Manifeste { nappes: Nappe[] }

/** Une couleur, découpée en jeux : plusieurs jeux permettent de varier sans réentendre le même. */
interface Jeu { couleur: string; types: string[]; sampler: Tone.Sampler }

class Voix {
  constructor(auChargement?: () => void) {
    this.jeux = [];
    this.pret = false;

    this.esquive = new Tone.Gain(1);
    // 1,8 kHz : au-delà on entend les consonnes et le grain du chanteur, donc « quelqu'un qui
    // chante ». En dessous il ne reste que la voyelle, c'est-à-dire une couleur.
    this.voile = new Tone.Filter(1800, 'lowpass');
    this.largeur = new Tone.StereoWidener(0.85);
    this.volume = new Tone.Volume(-26);
    // Pas de réverbération ajoutée : les nappes ont été générées avec, elle est déjà dans le
    // fichier. En remettre une coûtait du calcul pour épaissir ce qui l'était déjà.
    this.esquive.chain(this.voile, this.largeur, this.volume, Tone.Master);

    void this.charger(auChargement);
  }

  /** Lit le manifeste et construit un sampler par jeu. Sans banque, la voix reste muette. */
  async charger(auChargement?: () => void): Promise<void> {
    let manifeste: Manifeste;
    try {
      const reponse = await fetch(MANIFESTE, { cache: 'force-cache' });
      if (!reponse.ok) return;
      manifeste = await reponse.json();
    } catch {
      return;
    }
    // Un sampler par COULEUR, et pas un par variante : huit samplers polyphoniques dans le même
    // navigateur faisaient décrocher le fil audio — mesuré à quatorze coupures par minute contre
    // une demie avant. La variété vient de ce qu'on choisit dans le sampler, pas de leur nombre.
    const groupes = new Map<string, Nappe[]>();
    for (const nappe of manifeste.nappes ?? []) {
      const liste = groupes.get(nappe.couleur) ?? [];
      liste.push(nappe);
      groupes.set(nappe.couleur, liste);
    }
    for (const nappes of groupes.values()) {
      const jeu = this.construireJeu(nappes);
      if (jeu) this.jeux.push(jeu);
    }
    this.pret = this.jeux.length > 0;
    if (this.pret && auChargement) auChargement();
  }

  construireJeu(nappes: Nappe[]): Jeu | null {
    const urls: Record<string, string> = {};
    for (const nappe of nappes) {
      // La clé est le numéro MIDI, pas un nom de note : le manifeste nomme les hauteurs en
      // français (Sol4) et Tone n'accepte que l'anglais. Le nombre ne se traduit pas.
      const midi = String(Math.round(nappe.hauteurDemiTon));
      if (!urls[midi]) urls[midi] = nappe.fichier;
    }
    if (Object.keys(urls).length === 0) return null;
    const sampler = new Tone.Sampler({ urls, baseUrl: RACINE, release: 3, curve: 'linear' });
    sampler.maxPolyphony = 4;
    sampler.connect(this.esquive);
    return { couleur: nappes[0].couleur, types: nappes[0].types, sampler };
  }

  /** Les jeux utilisables pour ce type de génération, ou tous si aucun ne le revendique. */
  jeuxPour(type: string): Jeu[] {
    const compatibles = this.jeux.filter((j) => j.types.includes(type));
    return compatibles.length > 0 ? compatibles : this.jeux;
  }

  /**
   * Efface la voix sous l'attaque, puis la laisse revenir. C'est ce qui la fait vivre dans les
   * creux du piano au lieu de lui disputer la place.
   */
  ecarter(profondeur: number, duree: number): void {
    if (profondeur <= 0) return;
    const maintenant = Tone.now();
    const gain = this.esquive.gain;
    gain.cancelScheduledValues(maintenant);
    gain.setValueAtTime(gain.value, maintenant);
    gain.linearRampToValueAtTime(Math.max(0, 1 - profondeur), maintenant + 0.05);
    gain.linearRampToValueAtTime(1, maintenant + Math.max(0.2, duree));
  }

  regler(niveauDb: number, voileHz: number): void {
    if (this.volume.volume.value !== niveauDb) this.volume.volume.rampTo(niveauDb, 1);
    if (this.voile.frequency.value !== voileHz) this.voile.frequency.rampTo(voileHz, 1);
  }
}

export default Voix;
