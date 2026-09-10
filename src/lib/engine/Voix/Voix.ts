import * as Tone from 'tone';

/**
 * Une nappe de voix, synthétisée par formants.
 *
 * Ce qui fait qu'une voyelle s'entend comme une voix, ce n'est pas la hauteur, ce sont les
 * **formants** : trois bosses de résonance que la bouche et la gorge impriment au son. Une
 * source riche en harmoniques passée dans trois filtres en cloche placés à ces fréquences-là
 * s'entend comme un « aah » chanté. Les valeurs ci-dessous sont celles d'un /a/ de voix
 * féminine ; les descendre vers 730 / 1090 / 2440 donne une voix d'homme.
 *
 * Pourquoi synthétisé plutôt qu'échantillonné : je n'ai pas trouvé de jeu de voix féminine
 * tenue, échantillonné note par note, sous une licence qui autorise un flux public. Ce qui
 * existe en CC0 est une voix d'homme (voir CREDITS.md). Ici, aucun fichier, donc aucune
 * licence à tracer — et les formants se règlent, ce qu'un échantillon ne permet pas.
 */
const FORMANTS = [
  { frequence: 850, q: 9, gain: -3 },    // F1 : l'ouverture de la voyelle
  { frequence: 1220, q: 11, gain: -9 },  // F2 : ce qui distingue un /a/ d'un /o/
  { frequence: 2810, q: 14, gain: -17 }, // F3 : la présence, le côté « proche »
];

class Voix {
  constructor() {
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      // Une voix ne démarre pas d'un coup et ne s'arrête pas net.
      envelope: { attack: 1.8, decay: 1.2, sustain: 0.8, release: 3.5 },
    });
    this.synth.maxPolyphony = 4;

    // Le vibrato est ce qui sépare une nappe de synthé d'une nappe de voix : lent et discret,
    // autour de cinq oscillations par seconde. Plus profond, ça devient une sirène.
    const vibrato = new Tone.Vibrato(5, 0.07);
    const entree = new Tone.Gain(1);
    const somme = new Tone.Gain(1);
    this.synth.chain(vibrato, entree);

    // Les trois formants sont en parallèle, pas en série : ce sont trois résonances
    // simultanées de la même source, pas trois filtrages successifs.
    for (const { frequence, q, gain } of FORMANTS) {
      const cloche = new Tone.Filter({ frequency: frequence, type: 'bandpass', Q: q });
      entree.chain(cloche, new Tone.Volume(gain), somme);
    }

    // Freeverb plutôt que Tone.Reverb : pas de réponse impulsionnelle à générer au démarrage,
    // et bien moins de calcul — le navigateur tourne dans le conteneur, à côté de l'encodeur.
    const reverb = new Tone.Freeverb({ roomSize: 0.92, dampening: 2400 });
    const largeur = new Tone.StereoWidener(0.9);
    const vol = new Tone.Volume(-19);
    somme.chain(reverb, largeur, vol, Tone.Master);
  }
}

export default Voix;
