import * as Tone from 'tone';

/**
 * La basse : la fondamentale de l'accord, deux octaves sous le piano.
 *
 * Le moteur n'avait aucun grave en dehors du kick — le piano commence à l'octave 3, la mélodie
 * à la 5. Il manquait l'assise. Une onde triangulaire suffit : elle a l'harmonique juste ce
 * qu'il faut pour s'entendre sur un petit haut-parleur, sans la dureté d'une dent de scie.
 *
 * Synthétisée, et pas échantillonnée, pour une raison qui n'est pas technique : aucun fichier
 * à télécharger, donc aucune licence à tracer ni crédit à afficher sur un flux public.
 */
const filtre = new Tone.Filter(320, 'lowpass');
// Mesuré : à -11 dB la basse prenait 31 % de l'énergie du morceau contre 12 % avant son
// arrivée, et l'ensemble gagnait presque 5 dB. Elle doit porter, pas régner.
const vol = new Tone.Volume(-16);

class Bass {
  constructor() {
    this.synth = new Tone.MonoSynth({
      oscillator: { type: 'triangle' },
      // Attaque douce : une basse qui claque casserait le côté traînant du reste.
      envelope: { attack: 0.06, decay: 0.3, sustain: 0.55, release: 0.9 },
      filterEnvelope: { attack: 0.05, decay: 0.4, sustain: 0.4, release: 1.2, baseFrequency: 90, octaves: 2 },
    }).chain(filtre, vol, Tone.Master);
    // Un léger glissé d'une note à l'autre : c'est ce qui fait « joué » plutôt que « déclenché ».
    this.synth.portamento = 0.04;
  }
}

export default Bass;
