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

  function findInterval(chord, choices, fallback = null) {
    if (!chord || !Array.isArray(chord.intervals)) return fallback;
    const list = Array.isArray(choices) ? choices : [choices];
    for (const choice of list) {
      const exact = chord.intervals.find(interval => interval === choice);
      if (exact != null) return exact;
    }
    for (const choice of list) {
      const match = chord.intervals.find(interval => mod(interval) === mod(choice));
      if (match != null) return match;
    }
    return fallback;
  }

  function findExactInterval(chord, choices, fallback = null) {
    if (!chord || !Array.isArray(chord.intervals)) return fallback;
    const list = Array.isArray(choices) ? choices : [choices];
    return chord.intervals.find(interval => list.includes(interval)) ?? fallback;
  }

  function normalizeMelodyMidis(melodyMidis) {
    return (Array.isArray(melodyMidis) ? melodyMidis : [melodyMidis])
      .map(note => note && typeof note === 'object' ? note.midi : note)
      .filter(note => note != null && note !== '')
      .map(Number)
      .filter(Number.isFinite);
  }

  function scaleIntervalsForVoicing(chord, scaleOption) {
    if (typeof scaleOption === 'string' && SCALES[scaleOption]) return SCALES[scaleOption].intervals.slice();
    if (Array.isArray(scaleOption)) return scaleOption.slice();
    if (Array.isArray(scaleOption?.intervals)) return scaleOption.intervals.slice();
    return suggestScale(chord, {}).intervals.slice();
  }

  function compactInterval(interval) {
    let value = Number(interval);
    while (value > 11) value -= 12;
    while (value < 0) value += 12;
    return value;
  }

  function nearestMidiForPc(pc, preferred, low, high) {
    let best = null;
    for (let midi = Math.trunc(Number(low)); midi <= Math.trunc(Number(high)); midi += 1) {
      if (mod(midi) !== mod(pc)) continue;
      const score = Math.abs(midi - preferred);
      if (!best || score < best.score || (score === best.score && midi < best.midi)) best = { midi, score };
    }
    return best?.midi ?? null;
  }

  function chooseBassTargetMidi(pc, low, high) {
    const preferred = Math.min(Math.max(Number(low) + 2, 36 + mod(pc)), Number(low) + 10, Number(high));
    return nearestMidiForPc(pc, preferred, low, high);
  }

  function intervalPalette(chord, scaleIntervals) {
    const scale = Array.isArray(scaleIntervals) ? scaleIntervals : [];
    const scaleSet = new Set(scale.map(interval => mod(interval)));
    const chordSet = new Set((chord?.intervals || []).map(interval => mod(interval)));
    const plainEleventh = findInterval(chord, [17], null);
    const palette = {
      root: 0,
      third: findInterval(chord, [4, 3, 5], 4),
      fifth: findInterval(chord, [7, 6, 8], 7),
      seventh: findInterval(chord, [11, 10, 9], null),
      ninth: findExactInterval(chord, [14, 13, 15], null),
      eleventh: findExactInterval(chord, [18, 17, 16], null),
      suspension: findInterval(chord, [5, 17, 18], null),
      thirteenth: findExactInterval(chord, [21, 20, 22, 9, 8], null)
    };
    const scaleColors = scale
      .filter(interval => interval !== 0 && !chordSet.has(mod(interval)))
      .filter(interval => interval !== 7 || chord.family !== 'dom')
      .filter(interval => interval !== 5 || chord.family !== 'dom' || /11|sus/.test(chord?.quality?.low || '') || findInterval(chord, [18], null) != null);
    const preferredChordColors = [];
    if (chord.family === 'dom') {
      preferredChordColors.push(
        palette.thirteenth,
        findInterval(chord, [18, 20, 22, 8, 6], null),
        palette.ninth,
        findInterval(chord, [13, 15], null),
        palette.fifth,
        plainEleventh
      );
    } else if (chord.family === 'maj') {
      preferredChordColors.push(palette.ninth, palette.thirteenth, findInterval(chord, [18], null), palette.fifth, findInterval(chord, [9], null));
    } else if (chord.family === 'min' || chord.family === 'minmaj') {
      preferredChordColors.push(palette.ninth, plainEleventh, palette.thirteenth, palette.fifth, findInterval(chord, [9], null));
    } else if (chord.family === 'sus') {
      preferredChordColors.push(palette.ninth, palette.thirteenth, plainEleventh, palette.fifth, findInterval(chord, [4], null));
    } else if (chord.family === 'hdim' || chord.family === 'dim') {
      preferredChordColors.push(palette.ninth, plainEleventh, palette.fifth, palette.seventh);
    } else {
      preferredChordColors.push(palette.ninth, palette.thirteenth, palette.eleventh, palette.fifth);
    }
    const unique = values => [...new Set(values.filter(value => value != null))];
    return {
      ...palette,
      chordColors: unique(preferredChordColors),
      scaleColors: unique(scaleColors)
    };
  }

  function resolveTokenInterval(token, palette, style) {
    const clusterNeighbor = palette.scaleColors.find(interval => {
      const reduced = compactInterval(interval);
      return reduced === 1 || reduced === 2 || reduced === 5 || reduced === 6 || reduced === 8 || reduced === 9 || reduced === 10;
    });
    const dissonantColor = findInterval({ intervals: palette.chordColors.concat(palette.scaleColors) }, [15, 13, 18, 16, 20, 22, 6, 8], null);
    switch (token) {
      case 'root': return palette.root;
      case 'third': return palette.third;
      case 'fifth': return palette.fifth;
      case 'seventh': return palette.seventh ?? palette.fifth;
      case 'ninth': {
        const color = palette.ninth ?? palette.scaleColors.find(interval => compactInterval(interval) === 1 || compactInterval(interval) === 2 || compactInterval(interval) === 3);
        return color != null ? color < 12 ? color + 12 : color : palette.chordColors[0] ?? palette.fifth;
      }
      case 'eleventh': {
        const color = palette.eleventh
          ?? palette.suspension
          ?? palette.scaleColors.find(interval => compactInterval(interval) === 5 || compactInterval(interval) === 6);
        return color != null ? color < 12 ? color + 12 : color : palette.fifth;
      }
      case 'thirteenth': {
        const color = palette.thirteenth ?? palette.scaleColors.find(interval => compactInterval(interval) === 8 || compactInterval(interval) === 9 || compactInterval(interval) === 10);
        return color != null ? color < 12 ? color + 12 : color : palette.ninth ?? palette.fifth;
      }
      case 'color1': return palette.chordColors[0] ?? palette.ninth ?? palette.fifth;
      case 'color2': return palette.chordColors[1] ?? palette.scaleColors[0] ?? palette.fifth;
      case 'scale1': return palette.scaleColors[0] ?? palette.chordColors[0] ?? palette.ninth ?? palette.fifth;
      case 'scale2': return palette.scaleColors[1] ?? palette.scaleColors[0] ?? palette.chordColors[1] ?? palette.fifth;
      case 'neighbor': return clusterNeighbor ?? palette.scaleColors[0] ?? palette.ninth ?? palette.fifth;
      case 'outside': return dissonantColor ?? palette.scaleColors[0] ?? palette.chordColors[0] ?? palette.fifth;
      default: return Number.isFinite(Number(token)) ? Number(token) : null;
    }
  }

  function pianoStylePlan(style, chord, scaleIntervals) {
    const family = chord?.family || 'maj';
    const palette = intervalPalette(chord, scaleIntervals);
    const isExtended = chord?.extended || definingExtension(chord) != null;
    const normalizedStyle = String(style || 'root-shell').trim().toLowerCase();
    const templates = {
      'root-shell': ['seventh', 'third', isExtended ? 'color1' : 'fifth'],
      shell: ['seventh', 'third', isExtended ? 'color1' : 'fifth'],
      rootless: ['seventh', 'third', 'ninth', family === 'dom' ? 'thirteenth' : 'color1'],
      closed: ['third', 'fifth', 'seventh', isExtended ? 'color1' : null],
      spread: ['fifth', 'seventh', 'third', isExtended ? 'color1' : 'root'],
      'upper-structure': ['seventh', 'ninth', 'eleventh', 'thirteenth'],
      modern: ['seventh', 'ninth', 'eleventh', 'thirteenth'],
      cluster: ['seventh', 'neighbor', 'third', family === 'sus' ? 'ninth' : 'scale1'],
      'avant-garde': ['seventh', 'outside', 'third', 'scale2']
    };
    const tokens = (templates[normalizedStyle] || templates['root-shell']).filter(Boolean);
    const seen = new Set();
    const intervals = [];
    tokens.forEach(token => {
      const interval = resolveTokenInterval(token, palette, normalizedStyle);
      const pitchClass = interval == null ? null : compactInterval(interval);
      if (interval == null || seen.has(pitchClass)) return;
      seen.add(pitchClass);
      intervals.push(interval);
    });
    const desiredUpperCount = ['root-shell', 'shell', 'cluster'].includes(normalizedStyle)
      || (normalizedStyle === 'closed' && !isExtended)
      ? 3
      : 4;
    [
      palette.third, palette.seventh, palette.fifth, palette.ninth, palette.eleventh, palette.thirteenth,
      ...palette.chordColors, ...palette.scaleColors
    ].filter(value => value != null).forEach(interval => {
      const pitchClass = compactInterval(interval);
      if (intervals.length < desiredUpperCount && !seen.has(pitchClass)) {
        seen.add(pitchClass);
        intervals.push(interval);
      }
    });
    return {
      style: normalizedStyle,
      maxUpperSpan: normalizedStyle === 'cluster' ? 7 : 12,
      includeRootBass: ['root-shell', 'closed', 'spread', 'upper-structure', 'avant-garde'].includes(normalizedStyle),
      separateBass: ['spread', 'upper-structure', 'avant-garde'].includes(normalizedStyle),
      upperIntervals: intervals.slice(0, desiredUpperCount)
    };
  }

  function targetMidisForPlan(chord, upperIntervals, low, high, melodyMidis, plan) {
    const floor = Math.trunc(Number(low));
    const ceiling = Math.trunc(Number(high));
    const melody = normalizeMelodyMidis(melodyMidis);
    const bassPc = chord.slash == null ? chord.root : chord.slash;
    const includeBass = Boolean(plan?.includeRootBass || chord.slash != null);
    const bassMidi = includeBass ? chooseBassTargetMidi(bassPc, floor, ceiling) : null;
    const melodyLimit = melody.length ? Math.min(...melody) - 4 : ceiling - 4;
    const lowerAnchor = bassMidi == null ? Math.max(floor, 48) : bassMidi + (plan?.separateBass ? 12 : 2);
    const anchorPreferred = Math.min(Math.max(lowerAnchor, 50 + mod(chord.root - 0)), melodyLimit, ceiling - 2);
    const rootAnchor = nearestMidiForPc(chord.root, anchorPreferred, floor, ceiling) ?? Math.min(Math.max(floor + 12, 48 + chord.root), ceiling);
    let previous = bassMidi == null ? floor - 1 : bassMidi + 1;
    return {
      bassMidi,
      upperMidis: upperIntervals.map(interval => {
        let midi = rootAnchor + compactInterval(interval);
        while (midi <= previous) midi += 12;
        while (midi > ceiling && (bassMidi == null || midi - 12 > bassMidi)) midi -= 12;
        previous = midi;
        return midi;
      })
    };
  }

  function finalizeVoicingNotes(chord, notes) {
    return notes.map(note => {
      const harmonicBass = note.bass && !note.anchorOnly;
      const tone = harmonicBass ? null : spellChordTone(chord, note.interval);
      const spelling = harmonicBass
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

  function fitPianoVoicing(voicing, melodyMidis, low = 36, high = 72, options = {}) {
    const notes = Array.isArray(voicing) ? voicing.filter(note => Number.isFinite(note?.midi)) : [];
    const floor = Math.trunc(Number(low));
    const ceiling = Math.trunc(Number(high));
    if (!notes.length || !Number.isFinite(floor) || !Number.isFinite(ceiling) || ceiling < floor) return [];

    const melody = normalizeMelodyMidis(melodyMidis);
    const lowestMelody = melody.length ? Math.min(...melody) : null;
    const maxUpperSpan = Math.max(1, Math.trunc(Number(options.maxUpperSpan) || 12));
    const candidates = notes.map(note => {
      const values = [];
      for (let midi = floor; midi <= ceiling; midi += 1) {
        if (mod(midi) === mod(note.pc ?? note.midi)) values.push(midi);
      }
      return values;
    });
    if (candidates.some(values => !values.length)) return [];

    const bassIndex = notes.findIndex(note => note.bass && !note.anchorOnly);
    const targets = notes.map(note => {
      let midi = note.midi;
      while (midi < floor) midi += 12;
      while (midi > ceiling) midi -= 12;
      return midi;
    });
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

      const bassMidi = bassIndex >= 0 ? assigned[bassIndex] : null;
      if (bassIndex >= 0 && assigned.some((midi, noteIndex) => noteIndex !== bassIndex && midi <= bassMidi)) return;
      const upper = (bassIndex >= 0
        ? assigned.filter((_, noteIndex) => noteIndex !== bassIndex)
        : assigned.slice()
      ).sort((a, b) => a - b);
      if (!upper.length) return;
      const grip = bassIndex >= 0 && options.separateBass ? upper : assigned.slice().sort((a, b) => a - b);
      if (grip[grip.length - 1] - grip[0] > maxUpperSpan) return;
      if (Math.max(...assigned) - Math.min(...assigned) > 23) return;

      const topMidi = upper[upper.length - 1];
      let score = assigned.reduce((sum, midi, noteIndex) => sum + Math.abs(midi - targets[noteIndex]), 0);
      score += (topMidi - upper[0]) * 0.45;
      if (bassMidi != null) {
        score += (topMidi - bassMidi) * 0.08;
        score += Math.max(0, bassMidi - (floor + 8)) * 0.25;
      } else {
        score += Math.max(0, upper[0] - (floor + 12)) * 0.08;
      }
      if (options.style === 'cluster') {
        score += upper.slice(1).reduce((sum, midi, upperIndex) => sum + Math.abs(midi - upper[upperIndex] - 2), 0) * 0.12;
      }
      if (lowestMelody != null) {
        const melodyGap = lowestMelody - topMidi;
        score += melodyGap < 1 ? 24 : 0;
        score += Math.abs(Math.min(6, Math.max(1, melodyGap)) - 4) * 0.15;
      }

      if (!bestCompact || score < bestCompact.score || (score === bestCompact.score && topMidi < bestCompact.topMidi)) {
        bestCompact = { score, topMidi, midis: assigned.slice() };
      }

      if (lowestMelody == null) return;
      [3, 2, 1].forEach(clearance => {
        if (topMidi > lowestMelody - clearance) return;
        const current = bestByClearance.get(clearance);
        if (!current || score < current.score || (score === current.score && topMidi < current.topMidi)) {
          bestByClearance.set(clearance, { score, topMidi, midis: assigned.slice() });
        }
      });
    }

    visit(0, new Array(notes.length), new Set());
    const best = bestByClearance.get(3) || bestByClearance.get(2) || bestByClearance.get(1) || bestCompact;
    if (!best) return [];
    return notes.map((note, index) => ({
      ...note,
      midi: best.midis[index],
      display: spelledMidiName(best.midis[index], note.spelling)
    }));
  }

  function makePianoVoicing(chord, options = {}) {
    if (!chord) return [];
    const low = Number.isFinite(Number(options.low)) ? Math.trunc(Number(options.low)) : 36;
    const high = Number.isFinite(Number(options.high)) ? Math.trunc(Number(options.high)) : 72;
    if (high < low) return [];
    const style = String(options.style || 'root-shell').trim().toLowerCase();
    const scaleIntervals = scaleIntervalsForVoicing(chord, options.scale);
    const plan = pianoStylePlan(style, chord, scaleIntervals);
    // A written slash bass is a separate, literal bass instruction. Keep it
    // exact without forcing a compact shell/cluster to stretch down to that
    // register with the same hand.
    if (chord.slash != null) plan.separateBass = true;
    const includeBass = Boolean(plan.includeRootBass || chord.slash != null);
    const targets = targetMidisForPlan(chord, plan.upperIntervals, low, high, options.melodyMidis, plan);
    if (includeBass && targets.bassMidi == null) return [];
    const bassPc = chord.slash == null ? chord.root : chord.slash;
    const upperSource = plan.upperIntervals.map((interval, index) => ({
        midi: targets.upperMidis[index],
        pc: mod(chord.root + interval),
        role: roleForInterval(interval, chord),
        interval,
        bass: false
      })).filter(note => note.midi != null);
    const sourceNotes = includeBass
      ? [{ midi: targets.bassMidi, pc: bassPc, role: chord.slash != null && chord.slash !== chord.root ? 'Bass' : 'R', bass: true }, ...upperSource]
      : upperSource.sort((left, right) => left.midi - right.midi).map(note => ({ ...note, bass: false, anchorOnly: false }));
    const source = finalizeVoicingNotes(chord, sourceNotes);
    return fitPianoVoicing(source, options.melodyMidis, low, high, plan);
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
    makePianoVoicing,
    fitVoicingToRange,
    fitVoicingForMelody,
    suggestScale,
    parseSongKey,
    inferSectionContext,
    contextName,
    roleForInterval
  };
});
