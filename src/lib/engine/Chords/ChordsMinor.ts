import Chord from './Chord';
import { minorSingleOct } from './MinorScale';

/**
 * Les sept degrés du mineur, dans le même esprit que le majeur : jamais un accord de trois
 * notes, toujours un empilement jusqu'à la treizième. C'est de là que vient la couleur.
 *
 * Le cinquième degré est pris en dominante (tierce majeure) plutôt qu'en mineur naturel :
 * c'est le seul accord qui donne une vraie résolution vers le i, et sans lui le mineur tourne
 * en rond sans jamais se poser.
 */
const versIdx = (arr) => arr.map((n) => n - 1);

const i = new Chord(1, [0, 3, 7, 10, 14, 17, 21], versIdx([3, 4, 5, 6, 7]), minorSingleOct[0]);
const iiDim = new Chord(2, [0, 3, 6, 10, 13, 17, 20], versIdx([1, 5]), minorSingleOct[1]);
const III = new Chord(3, [0, 4, 7, 11, 14, 17, 21], versIdx([4, 6, 7]), minorSingleOct[2]);
const iv = new Chord(4, [0, 3, 7, 10, 14, 17, 21], versIdx([1, 2, 5, 7]), minorSingleOct[3]);
const V = new Chord(5, [0, 4, 7, 10, 14, 17, 21], versIdx([1, 6]), minorSingleOct[4]);
const VI = new Chord(6, [0, 4, 7, 11, 14, 18, 21], versIdx([2, 4, 5, 7]), minorSingleOct[5]);
const VII = new Chord(7, [0, 4, 7, 10, 14, 17, 21], versIdx([1, 3, 6]), minorSingleOct[6]);

const ChordsMinor = [i, iiDim, III, iv, V, VI, VII];

export default ChordsMinor;
