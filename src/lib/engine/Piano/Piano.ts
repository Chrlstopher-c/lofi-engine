import * as Tone from 'tone';
import Samples from './Samples';

const lpf = new Tone.Filter(1000, "lowpass");
const sw = new Tone.StereoWidener(0.5);

class Piano {
	constructor(cb) {
		// Le piano attaque puis meurt : entre deux accords il ne restait que la batterie. Un pad
		// de synthé comblait ce creux — c'était le son de scie bon marché, écarté à l'écoute.
		// Laisser la vraie queue du piano déborder sur l'accord suivant fait le même travail,
		// avec le timbre qui est déjà là et sans une voix de plus à calculer.
		this.sampler = new Tone.Sampler({ urls: Samples, release: 1.6, onload: () => cb() })
			.chain(lpf,sw,Tone.Master);
	}

	sampler() {
		return this.sampler;
	}
}

export default Piano;