import * as Tone from 'tone';

const lpf = new Tone.Filter(2000, "lowshelf");
const vol = new Tone.Volume(-32);
const noise = new Tone.Noise("pink").chain(lpf,vol,Tone.Master);

// Le niveau du souffle se règle depuis le centre de contrôle : c'est lui qui fait la texture
// cassette, et selon le type de génération on le veut plus ou moins présent.
export const volumeSouffle = vol;
export default noise;