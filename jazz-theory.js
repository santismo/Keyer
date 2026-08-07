(function initKeyerJazzTheory(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.KeyerJazzTheory = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function buildKeyerJazzTheory() {
  'use strict';

  const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const NOTE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const NATURAL_NOTE_PCS = [0, 2, 4, 5, 7, 9, 11];
  const NOTE_TO_PC = {
    C: 0, 'B#': 0,
    'C#': 1, Db: 1,
    D: 2,
    'D#': 3, Eb: 3,
    E: 4, Fb: 4,
    'E#': 5, F: 5,
    'F#': 6, Gb: 6,
    G: 7,
    'G#': 8, Ab: 8,
    A: 9,
    'A#': 10, Bb: 10,
    B: 11, Cb: 11
  };

  const SCALES = {
    ionian: { name: 'Ionian / major', intervals: [0, 2, 4, 5, 7, 9, 11], formula: '1 2 3 4 5 6 7' },
    dorian: { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], formula: '1 2 ♭3 4 5 6 ♭7' },
    phrygian: { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], formula: '1 ♭2 ♭3 4 5 ♭6 ♭7' },
    aeolian: { name: 'Aeolian / natural minor', intervals: [0, 2, 3, 5, 7, 8, 10], formula: '1 2 ♭3 4 5 ♭6 ♭7' },
    melodicMinor: { name: 'Melodic minor', intervals: [0, 2, 3, 5, 7, 9, 11], formula: '1 2 ♭3 4 5 6 7' },
    mixolydian: { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], formula: '1 2 3 4 5 6 ♭7' },
    mixolydianB13: { name: 'Mixolydian ♭13', intervals: [0, 2, 4, 5, 7, 8, 10], formula: '1 2 3 4 5 ♭6 ♭7' },
    lydian: { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], formula: '1 2 3 ♯4 5 6 7' },
    lydianAugmented: { name: 'Lydian augmented', intervals: [0, 2, 4, 6, 8, 9, 11], formula: '1 2 3 ♯4 ♯5 6 7' },
    lydianDominant: { name: 'Lydian dominant', intervals: [0, 2, 4, 6, 7, 9, 10], formula: '1 2 3 ♯4 5 6 ♭7' },
    altered: { name: 'Altered', intervals: [0, 1, 3, 4, 6, 8, 10], formula: '1 ♭9 ♯9 3 ♭5 ♯5 ♭7' },
    phrygianDominant: { name: 'Phrygian dominant', intervals: [0, 1, 4, 5, 7, 8, 10], formula: '1 ♭2 3 4 5 ♭6 ♭7' },
    locrianNatural2: { name: 'Locrian ♮2', intervals: [0, 2, 3, 5, 6, 8, 10], formula: '1 2 ♭3 4 ♭5 ♭6 ♭7' },
    wholeHalfDiminished: { name: 'Whole-half diminished', intervals: [0, 2, 3, 5, 6, 8, 9, 11], formula: '1 2 ♭3 4 ♭5 ♭6 6 7' },
    halfWholeDiminished: { name: 'Half-whole diminished', intervals: [0, 1, 3, 4, 6, 7, 9, 10], formula: '1 ♭9 ♯9 3 ♭5 5 13 ♭7' },
    wholeTone: { name: 'Whole tone', intervals: [0, 2, 4, 6, 8, 10], formula: '1 2 3 ♯4 ♯5 ♭7' }
  };

  const mod = (value, base = 12) => ((value % base) + base) % base;

  function asciiAccidentals(value) {
    return String(value || '')
      .replace(/𝄫/g, 'bb')
      .replace(/𝄪/g, '##')
      .replace(/[♭]/g, 'b')
      .replace(/[♯]/g, '#')
      .replace(/[♮]/g, '')
      .replace(/[−–—]/g, '-');
  }

  function displayNoteSpelling(value) {
    return asciiAccidentals(value)
      .replace(/b/g, '♭')
      .replace(/#/g, '♯');
  }

  function parseNoteSpelling(value) {
    const clean = asciiAccidentals(value).trim();
    const match = clean.match(/^([A-Ga-g])([#b]*)$/);
    if (!match) return null;
    const letter = match[1].toUpperCase();
    const accidentalText = match[2] || '';
    const accidental = [...accidentalText].reduce((sum, char) => sum + (char === '#' ? 1 : -1), 0);
    const letterIndex = NOTE_LETTERS.indexOf(letter);
    return {
      text: `${letter}${accidentalText}`,
      display: displayNoteSpelling(`${letter}${accidentalText}`),
      letter,
      letterIndex,
      accidental,
      pc: mod(NATURAL_NOTE_PCS[letterIndex] + accidental)
    };
  }

  function rootSpelling(rootValue, preferFlats = true) {
    if (rootValue && typeof rootValue === 'object') {
      const written = rootValue.rootText || rootValue.spelling || rootValue.rootSpelling;
      const parsedWritten = parseNoteSpelling(written);
      if (parsedWritten) return parsedWritten;
      const pcValue = Number.isFinite(rootValue.root) ? rootValue.root : rootValue.pc;
      if (Number.isFinite(pcValue)) return parseNoteSpelling(noteName(pcValue, preferFlats));
    }
    const parsed = parseNoteSpelling(rootValue);
    if (parsed) return parsed;
    if (Number.isFinite(rootValue)) return parseNoteSpelling(noteName(rootValue, preferFlats));
    return null;
  }

  function accidentalForPitch(letterIndex, targetPc) {
    let accidental = mod(targetPc - NATURAL_NOTE_PCS[letterIndex]);
    if (accidental > 6) accidental -= 12;
    return accidental;
  }

  function accidentalGlyphs(accidental) {
    if (accidental > 0) return '♯'.repeat(accidental);
    if (accidental < 0) return '♭'.repeat(-accidental);
    return '';
  }

  /**
   * Spell a pitch relative to a written root and a diatonic degree.
   * Degree may be compound (9, 11, 13); semitones is measured from the root.
   */
  function spellPitchForDegree(rootValue, degree, semitones, options = {}) {
    const root = rootSpelling(rootValue, options.preferFlats !== false);
    const degreeNumber = Math.max(1, Math.trunc(Number(degree) || 1));
    if (!root || !Number.isFinite(Number(semitones))) return noteName(Number(semitones) || 0, options.preferFlats !== false);
    const letterIndex = mod(root.letterIndex + degreeNumber - 1, NOTE_LETTERS.length);
    const targetPc = mod(root.pc + Number(semitones));
    const accidental = accidentalForPitch(letterIndex, targetPc);
    return `${NOTE_LETTERS[letterIndex]}${accidentalGlyphs(accidental)}`;
  }

  function degreeForRole(role) {
    const clean = asciiAccidentals(role).replace(/[^0-9]/g, '');
    if (!clean) return String(role || '').toUpperCase() === 'R' ? 1 : null;
    return mod(Number(clean) - 1, 7) + 1;
  }

  function scaleDegreeNumbers(scale, strategy = 'auto') {
    const intervals = Array.isArray(scale?.intervals) ? scale.intervals : [];
    if (strategy === 'diatonic' && intervals.length === 7) return [1, 2, 3, 4, 5, 6, 7];
    const formulaDegrees = String(scale?.formula || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(degreeForRole);
    if (formulaDegrees.length === intervals.length && formulaDegrees.every(Number.isFinite)) return formulaDegrees;
    if (intervals.length === 7) return [1, 2, 3, 4, 5, 6, 7];
    return intervals.map((interval, index) => index + 1);
  }

  /**
   * Return correctly written scale notes. Accepted forms:
   *   spellScaleNotes('F#', 'ionian')
   *   spellScaleNotes(chord, scaleResult)
   *   spellScaleNotes(scaleResult)
   */
  function spellScaleNotes(rootValue, scaleValue, options = {}) {
    let root = rootValue;
    let scale = scaleValue;
    const settings = options;
    if (rootValue && typeof rootValue === 'object' && Array.isArray(rootValue.intervals) && scaleValue == null) {
      scale = rootValue;
      root = rootValue.rootText ?? rootValue.root;
    }
    if (typeof scale === 'string') scale = SCALES[scale];
    if (Array.isArray(scale)) scale = { intervals: scale };
    if (!scale || !Array.isArray(scale.intervals)) return [];
    const degrees = scaleDegreeNumbers(scale, settings.strategy || 'auto');
    return scale.intervals.map((interval, index) => spellPitchForDegree(root, degrees[index], interval, settings));
  }

  function spelledMidiName(midi, spelling, preferFlats = true) {
    const parsed = parseNoteSpelling(spelling);
    if (!parsed) return midiName(midi, preferFlats);
    const octave = Math.round((Number(midi) - NATURAL_NOTE_PCS[parsed.letterIndex] - parsed.accidental) / 12) - 1;
    return `${parsed.display}${octave}`;
  }

  function noteName(pc, preferFlats = true) {
    return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod(pc)];
  }

  function midiName(midi, preferFlats = true) {
    return `${noteName(midi, preferFlats)}${Math.floor(midi / 12) - 1}`;
  }

  function preferFlatsForKey(key) {
    const clean = asciiAccidentals(key).trim();
    if (clean.includes('b')) return true;
    if (clean.includes('#')) return false;
    return /^(F|Bb|Eb|Ab|Db|Gb|Cb)/.test(clean) || !/^(G|D|A|E|B)/.test(clean);
  }

  function displaySuffix(suffix) {
    let value = asciiAccidentals(suffix).trim();
    if (value === '69') value = '6/9';
    value = value.replace(/^\^/, 'maj');
    value = value.replace(/^-(?=\^)/, 'm');
    value = value.replace(/\^/g, 'maj');
    value = value.replace(/^-(?!$)/, 'm');
    if (value === '-') value = 'm';
    value = value.replace(/^h(?=7|$)/i, 'ø');
    value = value.replace(/^o(?=7|$)/i, 'dim');
    value = value.replace(/b(?=\d)/g, '♭').replace(/#(?=\d)/g, '♯');
    return value;
  }

  function qualityForSuffix(rawSuffix) {
    const raw = asciiAccidentals(rawSuffix).replace(/\s+/g, '');
    const low = raw.toLowerCase().replace(/[()]/g, '');
    const halfDiminished = /^(?:-?h|ø)|m7b5|-7b5|halfdim/.test(low);
    const diminished = !halfDiminished && (/^(o|°|dim)/.test(low));
    const sus = /sus/.test(low);
    const minorMajor = /-\^|m\^|mmaj|minmaj/.test(low);
    const minor = !minorMajor && (/^-/.test(low) || /^m(?!aj)/.test(low) || /^min/.test(low));
    const explicitMajor = /\^|maj/.test(low);
    const augmented = /aug|^\+/.test(low) || (/#5/.test(low) && !/7|9|11|13/.test(low));
    const sixNine = /69|6\/9/.test(low);
    const hasSix = /(^|[^1])6/.test(low) || /69|6\/9/.test(low);
    const hasSeven = /7|9|11|13|\^/.test(low);
    let family = 'dom';
    if (halfDiminished) family = 'hdim';
    else if (diminished) family = 'dim';
    else if (sus) family = 'sus';
    else if (minorMajor) family = 'minmaj';
    else if (minor) family = 'min';
    else if (augmented) family = 'aug';
    else if (explicitMajor || !raw || low === '2' || sixNine || (hasSix && !hasSeven) || /add/.test(low)) family = 'maj';
    return { raw, low, family, halfDiminished, diminished, sus, minorMajor, minor, explicitMajor, augmented };
  }

  function uniqueIntervals(intervals) {
    const seen = new Set();
    return intervals.filter(interval => {
      const signature = Number(interval);
      if (!Number.isFinite(signature) || seen.has(signature)) return false;
      seen.add(signature);
      return true;
    }).sort((a, b) => a - b);
  }

  function intervalsForQuality(quality) {
    const { low, family } = quality;
    if (family === 'hdim') return /9/.test(low) ? [0, 3, 6, 10, 14] : [0, 3, 6, 10];
    if (family === 'dim') {
      if (/\^7|maj7/.test(low)) return [0, 3, 6, 11];
      return /7/.test(low) ? [0, 3, 6, 9] : [0, 3, 6];
    }

    let intervals;
    if (family === 'min' || family === 'minmaj') intervals = [0, 3, 7];
    else if (family === 'sus') intervals = [0, /sus2/.test(low) ? 2 : 5, 7];
    else if (family === 'aug') intervals = [0, 4, 8];
    else intervals = [0, 4, 7];

    const has69 = /69|6\/9/.test(low);
    const has13 = /13/.test(low);
    const has11 = /11/.test(low);
    const has9 = /9/.test(low);
    const has7 = /7/.test(low) || (!has69 && !/add/.test(low) && (has9 || has11 || has13));
    const has6 = !has13 && /6/.test(low);
    const add9 = /add9|add2|^2$/.test(low);

    if (family === 'minmaj') intervals.push(11);
    else if (has7) intervals.push(family === 'maj' && quality.explicitMajor ? 11 : 10);
    if (has6 || has69) intervals.push(9);
    if (has9 || has69 || add9) intervals.push(/b9/.test(low) ? 13 : /#9/.test(low) ? 15 : 14);
    if (has11) intervals.push(/#11/.test(low) ? 18 : /b11/.test(low) ? 16 : 17);
    if (has13) intervals.push(/b13/.test(low) ? 20 : /#13/.test(low) ? 22 : 21);

    if (/b5/.test(low)) intervals = intervals.filter(interval => mod(interval) !== 7).concat(6);
    if (/#5|\+/.test(low)) intervals = intervals.filter(interval => mod(interval) !== 7).concat(8);
    if (/b6/.test(low)) intervals = intervals.filter(interval => mod(interval) !== 9).concat(8);
    if (/b9/.test(low) && !intervals.includes(13)) intervals.push(13);
    if (/#9/.test(low) && !intervals.includes(15)) intervals.push(15);
    if (/#11/.test(low) && !intervals.includes(18)) intervals.push(18);
    if (/b13/.test(low) && !intervals.includes(20)) intervals.push(20);
    if (family === 'sus' && /add3/.test(low)) intervals.push(4);
    // "alt" means the altered fifths, not a perfect fifth plus extensions.
    // A b9/b13 dominant likewise belongs to altered harmony; keeping an
    // unmarked perfect fifth would make its displayed chord tones disagree
    // with the chord-scale overlay.
    if (/alt/.test(low)) intervals = intervals.filter(interval => mod(interval) !== 7).concat(6, 8, 13, 15);
    if (/b9/.test(low) && /b13/.test(low)) intervals = intervals.filter(interval => mod(interval) !== 7);
    return uniqueIntervals(intervals);
  }

  function parseChordSymbol(symbol) {
    const original = String(symbol || '').trim();
    if (!original) return null;
    const clean = asciiAccidentals(original).replace(/6\/9/gi, '69');
    const match = clean.match(/^([A-Ga-g])([#b]?)(.*?)(?:\/([A-Ga-g])([#b]?))?$/);
    if (!match) return null;
    const rootText = match[1].toUpperCase() + (match[2] || '');
    const rootPc = NOTE_TO_PC[rootText];
    if (rootPc == null) return null;
    const suffix = match[3] || '';
    const slashText = match[4] ? match[4].toUpperCase() + (match[5] || '') : '';
    const slashPc = slashText ? NOTE_TO_PC[slashText] : null;
    const quality = qualityForSuffix(suffix);
    const intervals = intervalsForQuality(quality);
    const displayRoot = rootText.replace('b', '♭').replace('#', '♯');
    const displaySlash = slashText.replace('b', '♭').replace('#', '♯');
    const suffixDisplay = quality.family === 'hdim' && /^-?h/i.test(suffix)
      ? `ø${/9/.test(suffix) ? '9' : '7'}`
      : displaySuffix(suffix);
    const display = `${displayRoot}${suffixDisplay}${displaySlash ? `/${displaySlash}` : ''}`;
    const chord = {
      raw: original,
      rootText,
      root: rootPc,
      suffix,
      slashText: slashText || null,
      slash: slashPc == null ? null : slashPc,
      display,
      family: quality.family,
      intervals,
      extended: /9|11|13|alt|add|69|6\/9|^2$/i.test(quality.low),
      altered: /alt|b9|#9|b5|#5|#11|b13/i.test(quality.low),
      quality
    };
    chord.spelledTones = spellChordTones(chord);
    return chord;
  }

  function chordPitchClasses(chord) {
    if (!chord) return [];
    const pcs = chord.intervals.map(interval => mod(chord.root + interval));
    if (chord.slash != null) pcs.push(mod(chord.slash));
    return [...new Set(pcs)];
  }

  function roleForInterval(interval, chord) {
    if (interval === 0) return 'R';
    if (interval === 12) return 'R';
    if (interval === 3) return chord?.quality?.low.includes('#9') ? '♯9' : '♭3';
    if (interval === 4) return '3';
    if (interval === 5) return '4';
    if (interval === 6) return /#11/.test(chord?.quality?.low || '') ? '♯11' : '♭5';
    if (interval === 7) return '5';
    if (interval === 8) {
      if (/b13/.test(chord?.quality?.low || '')) return '♭13';
      if (/b6/.test(chord?.quality?.low || '')) return '♭6';
      return '♯5';
    }
    if (interval === 9) {
      if (chord?.family === 'dim' && /7/.test(chord?.quality?.low || '')) return '♭♭7';
      return /13/.test(chord?.quality?.low || '') ? '13' : '6';
    }
    if (interval === 10) return '♭7';
    if (interval === 11) return '7';
    if (interval === 13) return '♭9';
    if (interval === 14) return /^(?:2|add2)$/.test(chord?.quality?.low || '') ? '2' : '9';
    if (interval === 15) return '♯9';
    if (interval === 16) return '♭11';
    if (interval === 17) return '11';
    if (interval === 18) return '♯11';
    if (interval === 20) return '♭13';
    if (interval === 21) return '13';
    if (interval === 22) return '♯13';
    return String(interval);
  }

  function spellChordTone(chord, interval) {
    if (!chord || !Number.isFinite(Number(interval))) return null;
    const numericInterval = Number(interval);
    const role = roleForInterval(numericInterval, chord);
    const degree = degreeForRole(role) || 1;
    const spelling = spellPitchForDegree(chord.rootText || chord.root, degree, numericInterval, {
      preferFlats: preferFlatsForKey(chord.rootText || '')
    });
    return {
      interval: numericInterval,
      pc: mod(chord.root + numericInterval),
      role,
      degree,
      spelling,
      name: spelling
    };
  }

  function spellChordTones(chord) {
    if (!chord || !Array.isArray(chord.intervals)) return [];
    return chord.intervals.map(interval => spellChordTone(chord, interval)).filter(Boolean);
  }

  function definingExtension(chord) {
    const intervals = chord.intervals;
    const priorities = [21, 20, 18, 17, 15, 14, 13, 9, 8, 6];
    return priorities.find(interval => intervals.includes(interval));
  }

  function makeVoicing(chord) {
    if (!chord) return [];
    const bassPc = chord.slash == null ? chord.root : chord.slash;
    const bassMidi = 36 + bassPc;
    let chordRootMidi = 48 + chord.root;

    const available = chord.intervals;
    const third = available.find(interval => [3, 4, 5].includes(mod(interval))) ?? available[1] ?? 4;
    const fifth = available.find(interval => [6, 7, 8].includes(mod(interval))) ?? 7;
    const seventh = available.find(interval => [9, 10, 11].includes(mod(interval)));
    const ninth = available.find(interval => [13, 14, 15].includes(interval)) ?? 14;
    const extension = definingExtension(chord);
    let upper;

    if (chord.slash != null && chord.slash !== chord.root) {
      const guide = seventh ?? fifth;
      upper = chord.extended ? [0, third, guide, extension ?? fifth] : [0, third, guide];
    } else if (chord.extended || extension != null && extension > 11) {
      if (/11/.test(chord.quality.low) && chord.family === 'dom') {
        upper = [fifth, seventh ?? 10, ninth, extension ?? 17];
      } else if (/13/.test(chord.quality.low)) {
        upper = [third, seventh ?? 10, ninth, extension ?? 21];
      } else if (seventh == null) {
        const color = available.includes(9) ? 9 : 12;
        upper = [third, fifth, color, extension ?? 14];
      } else {
        upper = [third, fifth, seventh ?? 10, extension ?? 14];
      }
    } else if (seventh != null) {
      upper = [third, fifth, seventh];
    } else if (available.length >= 4 && extension != null) {
      upper = [third, fifth, extension];
    } else {
      upper = [third, fifth, 12];
    }

    while (chordRootMidi + Math.max(...upper) > 72) chordRootMidi -= 12;
    while (chordRootMidi + Math.min(...upper) <= bassMidi) chordRootMidi += 12;

    const notes = [{ midi: bassMidi, pc: bassPc, role: chord.slash != null && chord.slash !== chord.root ? 'Bass' : 'R', bass: true }];
    upper.forEach(interval => {
      let midi = chordRootMidi + interval;
      while (midi > 72 && midi - 12 > bassMidi && !notes.some(note => note.midi === midi - 12)) midi -= 12;
      while (midi <= bassMidi) midi += 12;
      while (notes.some(note => note.midi === midi)) {
        if (midi + 12 <= 72) midi += 12;
        else if (midi - 12 > bassMidi && !notes.some(note => note.midi === midi - 12)) midi -= 12;
        else midi += 12;
      }
      notes.push({ midi, pc: mod(chord.root + interval), role: roleForInterval(interval, chord), interval, bass: false });
    });
    notes.sort((a, b) => a.midi - b.midi);
    return notes.slice(0, chord.extended ? 5 : 4).map(note => {
      const tone = note.bass
        ? null
        : spellChordTone(chord, note.interval);
      const spelling = note.bass
        ? displayNoteSpelling(chord.slashText || chord.rootText || noteName(note.pc, true))
        : tone?.spelling || noteName(note.pc, preferFlatsForKey(chord.rootText));
      return {
        ...note,
        spelling,
        name: spelling,
        display: spelledMidiName(note.midi, spelling)
      };
    });
  }

  function fitVoicingToRange(voicing, low = 48, high = 72) {
    const notes = Array.isArray(voicing) ? voicing.filter(note => Number.isFinite(note?.midi)) : [];
    const floor = Math.trunc(Number(low));
    const ceiling = Math.trunc(Number(high));
    if (!notes.length || !Number.isFinite(floor) || !Number.isFinite(ceiling) || ceiling < floor) return [];

    const candidates = notes.map(note => {
      const values = [];
      for (let midi = floor; midi <= ceiling; midi += 1) {
        if (mod(midi) === mod(note.pc ?? note.midi)) values.push(midi);
      }
      return values;
    });
    if (candidates.some(values => !values.length)) return [];

    const bassIndex = Math.max(0, notes.findIndex(note => note.bass));
    const targets = notes.map(note => {
      let midi = note.midi;
      while (midi < floor) midi += 12;
      while (midi > ceiling) midi -= 12;
      return midi;
    });
    let best = null;

    function visit(index, assigned, used) {
      if (index < notes.length) {
        candidates[index].forEach(midi => {
          if (used.has(midi)) return;
          assigned[index] = midi;
          used.add(midi);
          visit(index + 1, assigned, used);
          used.delete(midi);
        });
        return;
      }

      const bassMidi = assigned[bassIndex];
      if (assigned.some((midi, noteIndex) => noteIndex !== bassIndex && midi <= bassMidi)) return;
      let score = assigned.reduce((sum, midi, noteIndex) => sum + Math.abs(midi - targets[noteIndex]), 0);
      score += (Math.max(...assigned) - Math.min(...assigned)) * .12;
      score += (bassMidi - floor) * .08;
      for (let left = 0; left < assigned.length; left += 1) {
        for (let right = left + 1; right < assigned.length; right += 1) {
          if (notes[left].midi < notes[right].midi && assigned[left] > assigned[right]) score += 1.25;
        }
      }
      if (!best || score < best.score) best = { score, midis: assigned.slice() };
    }

    visit(0, new Array(notes.length), new Set());
    if (!best) return [];
    return notes.map((note, index) => ({
      ...note,
      midi: best.midis[index],
      display: spelledMidiName(best.midis[index], note.spelling)
    }));
  }

  /**
   * Fit a chord voicing to a keyboard range while leaving room below a melody.
   *
   * `melodyMidis` intentionally accepts either MIDI numbers or note-shaped
   * objects with a `midi` value.  The card may fold an out-of-range melody
   * note visually, but this helper uses its real register when it chooses the
   * accompaniment register.  It never changes chord roles or pitch classes.
   */
  function fitVoicingForMelody(voicing, melodyMidis, low = 48, high = 72) {
    const melody = (Array.isArray(melodyMidis) ? melodyMidis : [melodyMidis])
      .map(note => note && typeof note === 'object' ? note.midi : note)
      .filter(note => note != null && note !== '')
      .map(Number)
      .filter(Number.isFinite);
    if (!melody.length) return fitVoicingToRange(voicing, low, high);

    const notes = Array.isArray(voicing) ? voicing.filter(note => Number.isFinite(note?.midi)) : [];
    const floor = Math.trunc(Number(low));
    const ceiling = Math.trunc(Number(high));
    if (!notes.length || !Number.isFinite(floor) || !Number.isFinite(ceiling) || ceiling < floor) return [];

    const candidates = notes.map(note => {
      const values = [];
      for (let midi = floor; midi <= ceiling; midi += 1) {
        if (mod(midi) === mod(note.pc ?? note.midi)) values.push(midi);
      }
      return values;
    });
    if (candidates.some(values => !values.length)) return [];

    const bassIndex = Math.max(0, notes.findIndex(note => note.bass));
    const targets = notes.map(note => {
      let midi = note.midi;
      while (midi < floor) midi += 12;
      while (midi > ceiling) midi -= 12;
      return midi;
    });
    const lowestMelody = Math.min(...melody);
    // Three semitones is the preferred cushion. Two is still a useful
    // separation for compact five-note extensions; one is the graceful
    // last-resort when the melody sits directly above the required bass.
    const bestByClearance = new Map([[3, null], [2, null], [1, null]]);
    let bestCompact = null;

    function visit(index, assigned, used) {
      if (index < notes.length) {
        candidates[index].forEach(midi => {
          if (used.has(midi)) return;
          assigned[index] = midi;
          used.add(midi);
          visit(index + 1, assigned, used);
          used.delete(midi);
        });
        return;
      }

      const bassMidi = assigned[bassIndex];
      if (assigned.some((midi, noteIndex) => noteIndex !== bassIndex && midi <= bassMidi)) return;

      const topMidi = Math.max(...assigned);
      // The Standards card is two octaves wide. Keep the sounding
      // root-bass voicing compact enough that the same real keys can be shown
      // on that card instead of silently using a different display inversion.
      // Keep one semitone inside the literal two-octave edge. That guarantees
      // there is a white-key-to-same-white-key display window containing all
      // of the real sounding keys (a 24-semitone black-key endpoint span has
      // no such 15-white/10-black window).
      if (topMidi - bassMidi > 23) return;
      let score = assigned.reduce((sum, midi, noteIndex) => sum + Math.abs(midi - targets[noteIndex]), 0);
      score += (topMidi - Math.min(...assigned)) * .12;
      score += (bassMidi - floor) * .08;
      for (let left = 0; left < assigned.length; left += 1) {
        for (let right = left + 1; right < assigned.length; right += 1) {
          if (notes[left].midi < notes[right].midi && assigned[left] > assigned[right]) score += 1.25;
        }
      }

      if (!bestCompact || topMidi < bestCompact.topMidi || (topMidi === bestCompact.topMidi && score < bestCompact.score)) {
        bestCompact = { score, topMidi, midis: assigned.slice() };
      }

      [3, 2, 1].forEach(clearance => {
        if (topMidi > lowestMelody - clearance) return;
        const best = bestByClearance.get(clearance);
        if (!best || score < best.score) bestByClearance.set(clearance, { score, midis: assigned.slice() });
      });
    }

    visit(0, new Array(notes.length), new Set());
    // Very low melodies can make any useful separation impossible (for
    // example, a melody just one semitone above the required bass root). In
    // that case keep the accompaniment compact and low rather than jumping to
    // an unrelated high inversion that hides the melody and no longer fits
    // the same two-octave display window.
    const best = bestByClearance.get(3) || bestByClearance.get(2) || bestByClearance.get(1) || bestCompact;
    if (!best) return fitVoicingToRange(voicing, low, high);
    return notes.map((note, index) => ({
      ...note,
      midi: best.midis[index],
      display: spelledMidiName(best.midis[index], note.spelling)
    }));
  }

  function resolvesToMinor(chord, nextChord) {
    if (!chord || !nextChord || chord.family !== 'dom') return false;
    return mod(chord.root + 5) === nextChord.root && ['min', 'minmaj', 'hdim', 'dim'].includes(nextChord.family);
  }

  function suggestScale(chord, context = {}) {
    const low = chord?.quality?.low || '';
    const nextChord = context.nextChord || null;
    const section = context.section || null;
    let id = 'mixolydian';
    let rootPc = chord?.root ?? 0;

    if (!chord) id = 'ionian';
    else if (chord.family === 'hdim') id = 'locrianNatural2';
    else if (chord.family === 'dim') id = 'wholeHalfDiminished';
    else if (chord.family === 'aug') id = 'wholeTone';
    else if (chord.family === 'sus') {
      if (/b9/.test(low)) id = 'phrygian';
      else if (/b13/.test(low)) id = 'mixolydianB13';
      else id = 'mixolydian';
    }
    else if (chord.family === 'minmaj' || /mmaj|-\^|m\^/.test(low) || (chord.family === 'min' && /6/.test(low) && !/b6/.test(low))) id = 'melodicMinor';
    else if (chord.family === 'min') {
      const isSectionTonic = section && section.mode === 'minor' && section.root === chord.root;
      id = /b6|#5/.test(low) || isSectionTonic ? 'aeolian' : 'dorian';
    } else if (chord.family === 'maj') {
      const sectionFourth = section && section.mode === 'major' && mod(section.root + 5) === chord.root;
      if (/#5/.test(low)) id = 'lydianAugmented';
      else id = /#11/.test(low) || sectionFourth ? 'lydian' : 'ionian';
    } else if (chord.family === 'dom') {
      const hasNaturalFive = chord.intervals.some(interval => mod(interval) === 7);
      if (/alt/.test(low)) id = 'altered';
      else if (/b9/.test(low) && /#5|b13/.test(low)) id = 'altered';
      else if (/#9/.test(low)) id = hasNaturalFive ? 'halfWholeDiminished' : 'altered';
      else if (/#5/.test(low)) id = /9/.test(low) ? 'wholeTone' : 'altered';
      else if (/b9/.test(low) && /13/.test(low)) id = 'halfWholeDiminished';
      else if (/b9/.test(low)) id = resolvesToMinor(chord, nextChord) ? 'phrygianDominant' : 'halfWholeDiminished';
      else if (/#11|b5/.test(low)) id = 'lydianDominant';
      else if (/b13/.test(low)) id = 'mixolydianB13';
      else if (resolvesToMinor(chord, nextChord)) id = 'mixolydianB13';
      else id = 'mixolydian';
    }

    const scale = SCALES[id] || SCALES.mixolydian;
    let formula = scale.formula;
    if (id === 'altered' && /b13/.test(low) && !/#5/.test(low)) {
      formula = '1 ♭9 ♯9 3 ♭5 ♭13 ♭7';
    } else if (id === 'halfWholeDiminished' && /#11/.test(low)) {
      formula = '1 ♭9 ♯9 3 ♯11 5 13 ♭7';
    }
    const rootText = chord?.rootText || noteName(rootPc, context.preferFlats !== false);
    const result = {
      id,
      name: scale.name,
      root: rootPc,
      rootText,
      intervals: scale.intervals,
      formula,
      pcs: scale.intervals.map(interval => mod(rootPc + interval))
    };
    result.notes = spellScaleNotes(rootText, result);
    return result;
  }

  const KEY_MODE_FAMILIES = {
    major: ['maj', 'min', 'min', 'maj', 'dom', 'min', 'hdim'],
    minor: ['min', 'hdim', 'maj', 'min', 'min', 'maj', 'dom']
  };

  function parseSongKey(key) {
    const clean = asciiAccidentals(key).replace(/\s+/g, '');
    const rootMatch = clean.match(/^([A-Ga-g])([#b]?)/);
    if (!rootMatch) return null;
    const rootText = rootMatch[1].toUpperCase() + (rootMatch[2] || '');
    return {
      root: NOTE_TO_PC[rootText],
      rootText,
      rootSpelling: displayNoteSpelling(rootText),
      mode: /-|m(?!aj)/i.test(clean.slice(rootMatch[0].length)) ? 'minor' : 'major'
    };
  }

  function scoreKeyCandidate(chords, rootPc, mode, originalKey) {
    const scale = mode === 'minor' ? SCALES.aeolian.intervals : SCALES.ionian.intervals;
    const families = KEY_MODE_FAMILIES[mode];
    const degreeByPc = new Map(scale.map((interval, index) => [mod(rootPc + interval), index]));
    let score = 0;
    chords.forEach((chord, index) => {
      const degree = degreeByPc.get(chord.root);
      if (degree != null) {
        score += 1.2;
        const expected = families[degree];
        if (chord.family === expected) score += 3.2;
        if (expected === 'min' && chord.family === 'minmaj') score += 2;
        if (expected === 'maj' && chord.family === 'aug') score += .5;
      }
      const scalePcs = new Set(scale.map(interval => mod(rootPc + interval)));
      chordPitchClasses(chord).forEach(pc => { if (scalePcs.has(pc)) score += .35; });
      if (chord.root === rootPc && index === 0) score += 2.5;
      if (chord.root === rootPc && index === chords.length - 1) score += 5;
      if (chord.family === 'dom' && mod(chord.root + 5) === rootPc) score += 1.2;
    });
    if (originalKey && originalKey.root === rootPc && originalKey.mode === mode) score += 3.5;
    return score;
  }

  function inferSectionContext(chords, songKey) {
    const parsed = chords.map(chord => typeof chord === 'string' ? parseChordSymbol(chord) : chord).filter(Boolean);
    const originalKey = typeof songKey === 'string' ? parseSongKey(songKey) : songKey;
    if (!parsed.length) return originalKey || { root: 0, mode: 'major' };
    let best = { root: originalKey?.root ?? parsed[0].root, mode: originalKey?.mode || 'major', score: -Infinity };
    for (let rootPc = 0; rootPc < 12; rootPc += 1) {
      ['major', 'minor'].forEach(mode => {
        const score = scoreKeyCandidate(parsed, rootPc, mode, originalKey);
        if (score > best.score) best = { root: rootPc, mode, score };
      });
    }
    const keepOriginalSpelling = originalKey && originalKey.root === best.root;
    best.rootText = keepOriginalSpelling
      ? originalKey.rootText
      : asciiAccidentals(noteName(best.root, preferFlatsForKey(typeof songKey === 'string' ? songKey : originalKey?.rootText || '')));
    best.rootSpelling = displayNoteSpelling(best.rootText);
    return best;
  }

  function contextName(context, preferFlats = true) {
    if (!context) return '';
    const rootName = context.rootText ? displayNoteSpelling(context.rootText) : noteName(context.root, preferFlats);
    return `${rootName} ${context.mode}`;
  }

  return {
    SHARP_NAMES,
    FLAT_NAMES,
    NOTE_TO_PC,
    SCALES,
    mod,
    asciiAccidentals,
    displayNoteSpelling,
    parseNoteSpelling,
    noteName,
    midiName,
    spelledMidiName,
    spellPitchForDegree,
    spellScaleNotes,
    preferFlatsForKey,
    displaySuffix,
    parseChordSymbol,
    chordPitchClasses,
    spellChordTone,
    spellChordTones,
    makeVoicing,
    fitVoicingToRange,
    fitVoicingForMelody,
    suggestScale,
    parseSongKey,
    inferSectionContext,
    contextName,
    roleForInterval
  };
});
