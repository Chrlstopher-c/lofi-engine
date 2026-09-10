import { singleOct } from './MajorScale';
import { alea, aleaEntier } from '../Alea';

class Chord {
    // `semitoneDist` n'est fourni que pour le mineur : la table majeure ne convient pas,
    // ses troisième, sixième et septième degrés sont un demi-ton plus haut.
    constructor(degree,intervals,nextChordIdxs,semitoneDist) {
        this.degree = degree;
        this.semitoneDist = semitoneDist === undefined ? singleOct[degree-1] : semitoneDist;
        this.intervals = intervals;
        this.nextChordIdxs = nextChordIdxs;
    }
    
    degree() {
    	return this.degree;
    }

    semitoneDist() {
        return this.semitoneDist;
    }

    intervals() {
        return this.intervals;
    }

    nextChordIdxs() {
        return this.nextChordIdxs;
    }

    nextChordIdx() {
        return this.nextChordIdxs[aleaEntier(this.nextChordIdxs.length)];
    }

    generateVoicing(size) {
        if(size<3)
            return this.intervals.slice(0,3);
        let voicing = this.intervals.slice(1,size);
        voicing.sort(() => alea()-0.5);
        for(let i = 1; i<voicing.length; i++) {
            while(voicing[i] < voicing[i-1]){
                voicing[i] += 12;
            }
        }
        voicing.unshift(0);
        return voicing;
    }

    generateMode() {
        return this.intervals.map(n => {
            if(n>=12)
                return n-12;
            else
                return n;
        });
    }
}

export default Chord;