import Chords from './Chords';
import Chord from './Chord';
import { aleaEntier } from '../Alea';

class ChordProgression {
    static generate(length) {
        if(length < 2)
            return null;

        const progression = [];
        let chord = Chords[aleaEntier(Chords.length)];
        
        for(let i = 0; i < length; i++) {
            progression.push(new Chord(
                chord.degree,
                [...chord.intervals],
                [...chord.nextChordIdxs]));
            chord = Chords[chord.nextChordIdx()];
        }
        
        return progression;
    }
}

export default ChordProgression;