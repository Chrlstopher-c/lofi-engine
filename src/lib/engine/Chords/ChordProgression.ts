import Chords from './Chords';
import ChordsMinor from './ChordsMinor';
import Chord from './Chord';
import { aleaEntier } from '../Alea';

class ChordProgression {
    /** `mode` vaut "major" ou "minor" : deux tables de degrés, deux couleurs. */
    static generate(length, mode = 'major') {
        if(length < 2)
            return null;

        const table = mode === 'minor' ? ChordsMinor : Chords;
        const progression = [];
        let chord = table[aleaEntier(table.length)];

        for(let i = 0; i < length; i++) {
            progression.push(new Chord(
                chord.degree,
                [...chord.intervals],
                [...chord.nextChordIdxs],
                chord.semitoneDist));
            chord = table[chord.nextChordIdx()];
        }

        return progression;
    }
}

export default ChordProgression;