'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const IReal = require('../ireal.js');
const Theory = require('../jazz-theory.js');

function chord(symbol) {
  const parsed = Theory.parseChordSymbol(symbol);
  assert.ok(parsed, `Expected ${symbol} to parse`);
  return parsed;
}

assert.equal(chord('C^7').display, 'Cmaj7');
assert.equal(chord('F-7').display, 'Fm7');
assert.equal(chord('B-h7').family, 'hdim');
assert.equal(chord('G7/B').slash, 11);
assert.equal(chord('D7#11').display, 'D7♯11');
assert.equal(chord('C').family, 'maj');
assert.deepEqual(chord('C').intervals, [0, 4, 7]);
assert.deepEqual(chord('C69').intervals, [0, 4, 7, 9, 14]);
assert.deepEqual(chord('C2').intervals, [0, 4, 7, 14]);
assert.deepEqual(chord('Ch9').intervals, [0, 3, 6, 10, 14]);
assert.deepEqual(chord('Co^7').intervals, [0, 3, 6, 11]);
assert.deepEqual(chord('C-b6').intervals, [0, 3, 7, 8]);
assert.ok(chord('C7susadd3').intervals.includes(4));
assert.ok(chord('C7alt').intervals.includes(15));
assert.ok(chord('C7alt').intervals.includes(6));
assert.ok(chord('C7alt').intervals.includes(8));
assert.ok(!chord('C7alt').intervals.includes(7));
assert.equal(Theory.roleForInterval(12, chord('C')), 'R');

assert.deepEqual(
  Theory.spellChordTones(chord('C#^7')).map(tone => tone.spelling),
  ['C♯', 'E♯', 'G♯', 'B♯']
);
assert.equal(Theory.spellChordTone(chord('C7#9'), 15).spelling, 'D♯');
assert.equal(Theory.spellChordTone(chord('C7b5'), 6).spelling, 'G♭');
assert.equal(Theory.spellChordTone(chord('C7#11'), 18).spelling, 'F♯');
assert.equal(Theory.spellChordTone(chord('C7#5'), 8).spelling, 'G♯');
assert.equal(Theory.spellChordTone(chord('C7b13'), 20).spelling, 'A♭');
assert.equal(Theory.spellChordTone(chord('C7#13'), 22).spelling, 'A♯');
assert.deepEqual(
  Theory.spellChordTones(chord('Co7')).map(tone => tone.spelling),
  ['C', 'E♭', 'G♭', 'B♭♭']
);
assert.equal(Theory.spellChordTone(chord('Co7'), 9).role, '♭♭7');
assert.deepEqual(
  Theory.spellChordTones(chord('C-b6')).map(tone => tone.spelling),
  ['C', 'E♭', 'G', 'A♭']
);

assert.deepEqual(
  Theory.spellScaleNotes('F#', 'ionian'),
  ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯']
);
assert.deepEqual(
  Theory.spellScaleNotes('Gb', 'ionian'),
  ['G♭', 'A♭', 'B♭', 'C♭', 'D♭', 'E♭', 'F']
);
assert.deepEqual(
  Theory.spellScaleNotes('C', 'altered'),
  ['C', 'D♭', 'D♯', 'E', 'G♭', 'G♯', 'B♭']
);
assert.deepEqual(
  Theory.spellScaleNotes('C', 'altered', { strategy: 'diatonic' }),
  ['C', 'D♭', 'E♭', 'F♭', 'G♭', 'A♭', 'B♭']
);
assert.deepEqual(
  Theory.spellScaleNotes('C', 'wholeHalfDiminished'),
  ['C', 'D', 'E♭', 'F', 'G♭', 'A♭', 'A', 'B']
);
assert.deepEqual(
  Theory.spellScaleNotes('C', 'halfWholeDiminished'),
  ['C', 'D♭', 'D♯', 'E', 'G♭', 'G', 'A', 'B♭']
);
assert.equal(Theory.spelledMidiName(60, 'B#'), 'B♯3');
assert.equal(Theory.spelledMidiName(59, 'Cb'), 'C♭4');

const rootPosition = Theory.makeVoicing(chord('Cmaj7'));
assert.equal(rootPosition.length, 4);
assert.equal(rootPosition[0].pc, 0);
assert.equal(rootPosition[0].role, 'R');
assert.deepEqual(rootPosition.map(note => note.role), ['R', '3', '5', '7']);

const extended = Theory.makeVoicing(chord('G13'));
assert.equal(extended.length, 5);
assert.ok(extended.some(note => note.role === '13'));
assert.ok(extended.some(note => note.role === '♭7'));

const minorFlatSix = Theory.makeVoicing(chord('C-b6'));
assert.equal(minorFlatSix.length, 4);
assert.ok(minorFlatSix.some(note => note.spelling === 'A♭'));

const slash = Theory.makeVoicing(chord('Cmaj7/G'));
assert.equal(slash.length, 4);
assert.equal(slash[0].pc, 7);
assert.equal(slash[0].role, 'Bass');

['C', 'Cmaj7', 'G13', 'Cmaj7/G', 'B7b9#5'].forEach(symbol => {
  const source = Theory.makeVoicing(chord(symbol));
  const fitted = Theory.fitVoicingToRange(source, 48, 72);
  assert.equal(fitted.length, source.length, `${symbol} keeps every suggested finger`);
  assert.equal(new Set(fitted.map(note => note.midi)).size, fitted.length, `${symbol} uses distinct keys`);
  assert.ok(fitted.every(note => note.midi >= 48 && note.midi <= 72), `${symbol} fits the two-octave card`);
  assert.deepEqual(fitted.map(note => note.pc), source.map(note => note.pc), `${symbol} preserves pitch classes`);
  const bass = fitted.find(note => note.bass);
  assert.equal(bass.midi, Math.min(...fitted.map(note => note.midi)), `${symbol} keeps bass lowest`);
});

function assertMelodyAwareFit(source, fitted, label, low = 48, high = 72) {
  assert.equal(fitted.length, source.length, `${label} keeps every suggested finger`);
  assert.equal(new Set(fitted.map(note => note.midi)).size, fitted.length, `${label} uses distinct keys`);
  assert.ok(fitted.every(note => note.midi >= low && note.midi <= high), `${label} fits the requested register`);
  assert.deepEqual(fitted.map(note => note.pc), source.map(note => note.pc), `${label} preserves pitch classes`);
  assert.deepEqual(fitted.map(note => note.role), source.map(note => note.role), `${label} preserves chord roles`);
  const bass = fitted.find(note => note.bass);
  assert.equal(bass.midi, Math.min(...fitted.map(note => note.midi)), `${label} keeps bass lowest`);
}

const alteredSource = Theory.makeVoicing(chord('B7b9#5'));
const alteredUnderMelody = Theory.fitVoicingForMelody(alteredSource, [73], 48, 72);
assertMelodyAwareFit(alteredSource, alteredUnderMelody, 'B7b9#5 below C♯5 melody');
assert.ok(
  Math.max(...alteredUnderMelody.map(note => note.midi)) <= 70,
  'A sufficiently high melody leaves a three-semitone cushion above the voicing'
);

const gThirteenSource = Theory.makeVoicing(chord('G13'));
const gThirteenUnderMelody = Theory.fitVoicingForMelody(gThirteenSource, [{ midi: 67 }], 48, 72);
assertMelodyAwareFit(gThirteenSource, gThirteenUnderMelody, 'G13 below G4 melody');
assert.equal(
  Math.max(...gThirteenUnderMelody.map(note => note.midi)),
  65,
  'A compact extended voicing may use the available two-semitone melody cushion when three is impossible'
);

const ebMajorSource = Theory.makeVoicing(chord('Ebmaj7'));
const ebMajorUnderLowMelody = Theory.fitVoicingForMelody(ebMajorSource, [58], 24, 72);
assertMelodyAwareFit(ebMajorSource, ebMajorUnderLowMelody, 'E♭maj7 below B♭3 melody', 24, 72);
assert.ok(
  Math.max(...ebMajorUnderLowMelody.map(note => note.midi)) <= 55,
  'A low melody shifts the root-bass voicing down instead of masking the melody'
);
assert.ok(
  Math.max(...ebMajorUnderLowMelody.map(note => note.midi)) - Math.min(...ebMajorUnderLowMelody.map(note => note.midi)) <= 23,
  'The melody-aware voicing stays compact enough for one two-octave keyboard window'
);

const abSource = Theory.makeVoicing(chord('Ab'));
const abUnderVeryLowMelody = Theory.fitVoicingForMelody(abSource, [45], 24, 72);
assertMelodyAwareFit(abSource, abUnderVeryLowMelody, 'A♭ under A2 melody', 24, 72);
assert.equal(
  Math.max(...abUnderVeryLowMelody.map(note => note.midi)),
  44,
  'A one-semitone melody cushion is preferable to an unrelated high inversion when no two-semitone cushion exists'
);

const cMajorSource = Theory.makeVoicing(chord('Cmaj7'));
assert.deepEqual(
  Theory.fitVoicingForMelody(cMajorSource, [], 48, 72),
  Theory.fitVoicingToRange(cMajorSource, 48, 72),
  'No melody keeps the established range-fitting result exactly'
);
assert.deepEqual(
  Theory.fitVoicingForMelody(cMajorSource, null, 48, 72),
  Theory.fitVoicingToRange(cMajorSource, 48, 72),
  'A missing melody keeps the established range-fitting result exactly'
);
assert.deepEqual(
  Theory.fitVoicingForMelody(cMajorSource, [40], 48, 72),
  Theory.fitVoicingToRange(cMajorSource, 48, 72),
  'An unworkably low melody falls back to the compact range-fitting result'
);

assert.equal(Theory.suggestScale(chord('D-7'), {}).id, 'dorian');
assert.equal(Theory.suggestScale(chord('G7#11'), {}).id, 'lydianDominant');
assert.equal(Theory.suggestScale(chord('G7b5'), {}).id, 'lydianDominant');
assert.equal(Theory.suggestScale(chord('G7alt'), {}).id, 'altered');
assert.equal(Theory.suggestScale(chord('G7#9'), {}).id, 'halfWholeDiminished');
assert.equal(Theory.suggestScale(chord('G13#9'), {}).id, 'halfWholeDiminished');
assert.equal(Theory.suggestScale(chord('G7#9#11'), {}).id, 'halfWholeDiminished');
assert.equal(Theory.suggestScale(chord('G7#9#5'), {}).id, 'altered');
assert.equal(Theory.suggestScale(chord('G7b9#5'), {}).id, 'altered');
assert.equal(Theory.suggestScale(chord('G7b9b13'), {}).id, 'altered');
assert.equal(Theory.suggestScale(chord('G9#5'), {}).id, 'wholeTone');
assert.equal(Theory.suggestScale(chord('G7b9sus'), {}).id, 'phrygian');
assert.equal(Theory.suggestScale(chord('G7b13sus'), {}).id, 'mixolydianB13');
assert.equal(Theory.suggestScale(chord('C^7#5'), {}).id, 'lydianAugmented');
assert.equal(Theory.suggestScale(chord('C13b9'), {}).id, 'halfWholeDiminished');
assert.equal(Theory.suggestScale(chord('B-h7'), {}).id, 'locrianNatural2');
assert.equal(Theory.suggestScale(chord('Cdim7'), {}).id, 'wholeHalfDiminished');
assert.equal(Theory.suggestScale(chord('C-b6'), {}).id, 'aeolian');
assert.deepEqual(
  Theory.suggestScale(chord('F#^7'), {}).notes,
  ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯']
);
const fSharpMajorScale = Theory.suggestScale(chord('F#^7'), {});
assert.deepEqual(Theory.spellScaleNotes(fSharpMajorScale), fSharpMajorScale.notes);
assert.deepEqual(Theory.spellScaleNotes(chord('F#^7'), fSharpMajorScale), fSharpMajorScale.notes);

function assertScaleCovers(symbol, expectedScale) {
  const parsed = chord(symbol);
  const scale = Theory.suggestScale(parsed, {});
  assert.equal(scale.id, expectedScale, symbol);
  const scalePcs = new Set(scale.pcs);
  const missingChordTones = parsed.intervals
    .map(interval => Theory.mod(parsed.root + interval))
    .filter(pc => !scalePcs.has(pc));
  const missingVoicingTones = Theory.makeVoicing(parsed)
    .filter(note => !note.bass && !scalePcs.has(note.pc))
    .map(note => `${note.spelling} (${note.role})`);
  assert.deepEqual(missingChordTones, [], `${symbol} chord tones must be in ${scale.id}`);
  assert.deepEqual(missingVoicingTones, [], `${symbol} voicing must be in ${scale.id}`);
  return scale;
}

assertScaleCovers('C7#9', 'halfWholeDiminished');
assertScaleCovers('C13#9', 'halfWholeDiminished');
const sharpElevenDiminished = assertScaleCovers('C7#9#11', 'halfWholeDiminished');
assert.ok(sharpElevenDiminished.notes.includes('F♯'));
assert.ok(!sharpElevenDiminished.notes.includes('G♭'));
assertScaleCovers('C7alt', 'altered');
const sharpFiveAltered = assertScaleCovers('C7b9#5', 'altered');
assert.ok(sharpFiveAltered.notes.includes('G♯'));
const flatThirteenAltered = assertScaleCovers('C7b9b13', 'altered');
assert.ok(flatThirteenAltered.notes.includes('A♭'));
assertScaleCovers('C9#5', 'wholeTone');
assertScaleCovers('C7b9sus', 'phrygian');
assertScaleCovers('C7b13sus', 'mixolydianB13');
assertScaleCovers('C-#5', 'aeolian');

const cMajorContext = Theory.inferSectionContext(['D-7', 'G7', 'C^7'], 'C');
assert.equal(cMajorContext.root, 0);
assert.equal(cMajorContext.mode, 'major');
assert.equal(Theory.contextName(Theory.parseSongKey('F#')), 'F♯ major');

const catalogPath = path.resolve(__dirname, '../../fakebot/real playlist.txt');
if (fs.existsSync(catalogPath)) {
  const playlist = IReal.parsePlaylist(fs.readFileSync(catalogPath, 'utf8'));
  let catalogChordCount = 0;
  let chromaticSlashBassCount = 0;

  function checkCatalogChord(source, songTitle) {
    if (!source || source.isNoChord || source.isPause || !source.root) return;
    const symbol = `${source.root}${source.quality || ''}${source.bass ? `/${source.bass}` : ''}`;
    const parsed = Theory.parseChordSymbol(symbol);
    assert.ok(parsed, `${songTitle}: ${symbol} must parse`);
    const scale = Theory.suggestScale(parsed, {});
    const scalePcs = new Set(scale.pcs);
    const label = `${songTitle}: ${symbol} over ${scale.id}`;

    parsed.spelledTones.forEach(tone => {
      assert.equal(Theory.parseNoteSpelling(tone.spelling)?.pc, tone.pc, `${label}: ${tone.spelling}`);
      assert.ok(scalePcs.has(tone.pc), `${label}: chord tone ${tone.spelling} is outside the overlay`);
    });
    scale.notes.forEach((note, index) => {
      assert.equal(Theory.parseNoteSpelling(note)?.pc, scale.pcs[index], `${label}: scale note ${note}`);
    });

    const voicing = Theory.makeVoicing(parsed);
    voicing.filter(note => !note.bass).forEach(note => {
      assert.ok(scalePcs.has(note.pc), `${label}: voiced ${note.spelling} (${note.role}) is outside the overlay`);
    });

    // A slash bass may deliberately be a chromatic pedal or the bass of an
    // upper-structure chord. It is labelled "Bass", rather than a chord role,
    // so it is the one allowed overlay exception; every upper voice and every
    // literal chord tone still has to belong to the suggested scale.
    if (parsed.slash != null && !scalePcs.has(parsed.slash)) {
      const bass = voicing.find(note => note.bass);
      assert.equal(bass?.pc, parsed.slash, label);
      assert.equal(bass?.role, 'Bass', label);
      chromaticSlashBassCount += 1;
    }
    catalogChordCount += 1;
  }

  function visitCatalogCell(source, songTitle) {
    if (!source) return;
    if (source.isAlternateOnly) {
      if (source.alternate) checkCatalogChord(source.alternate, songTitle);
      return;
    }
    checkCatalogChord(source, songTitle);
    if (source.alternate) checkCatalogChord(source.alternate, songTitle);
  }

  playlist.songs.forEach(song => {
    song.bars.forEach(bar => [...bar.chords, ...bar.overflowChords].forEach(source => visitCatalogCell(source, song.title)));
  });
  assert.ok(catalogChordCount > 58000, `Expected the full catalog, checked ${catalogChordCount} chords`);
  assert.ok(chromaticSlashBassCount > 0, 'Expected documented chromatic slash-bass exceptions');
}

console.log('Jazz theory tests passed.');
