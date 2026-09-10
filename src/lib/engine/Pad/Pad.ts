import * as Tone from 'tone';

/**
 * Le pad : l'accord tenu, très en dessous du piano, pour combler le silence entre deux frappes.
 *
 * Le piano est percussif — il attaque et meurt. Entre deux accords, il ne restait que la
 * batterie et le souffle. Le pad remplit ce creux sans jamais se faire remarquer : attaque de
 * deux secondes, extinction de quatre, et vingt-six décibels sous le reste.
 *
 * Deux oscillateurs légèrement désaccordés : c'est ce battement lent qui fait la chaleur.
 * Synthétisé, donc aucun échantillon à licencier.
 */
const filtre = new Tone.Filter(900, 'lowpass');
const largeur = new Tone.StereoWidener(0.8);
const vol = new Tone.Volume(-26);

class Pad {
  constructor() {
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 18 },
      envelope: { attack: 2, decay: 1.5, sustain: 0.7, release: 4 },
    }).chain(filtre, largeur, vol, Tone.Master);
    // Trois voix suffisent : le pad ne joue jamais l'accord entier, seulement son ossature.
    this.synth.maxPolyphony = 4;
  }
}

export default Pad;
