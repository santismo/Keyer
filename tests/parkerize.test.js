'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Parkerize = require('../parkerize.js');
const ParkerCorpus = require('../parkerize-corpus.js');
const Theory = require('../jazz-theory.js');
const MiditarMidi = require('../miditar-midi.js');

function eventsForSong(song) {
  const events = [];
  let beat = 0;
  song.bars.forEach((bar, barIndex) => {
    const duration = 4 / bar.chords.length;
    bar.chords.forEach((item, chordIndex) => {
      const chord = Theory.parseChordSymbol(item.raw);
      assert.ok(chord, `Generated chord ${item.raw} should parse.`);
      events.push({
        kind: 'chord',
        barIndex,
        chordIndex,
        chord,
        playbackStartBeat: beat + duration * chordIndex,
        playbackEndBeat: beat + duration * (chordIndex + 1)
      });
    });
    beat += 4;
  });
  return events;
}

const corpusSongs = [
  {
    key: 'C',
    bars: [
      { chords: [{ raw: 'Cmaj7' }, { raw: 'A7' }] },
      { chords: [{ raw: 'Dm7' }, { raw: 'G7' }] },
      { chords: [{ raw: 'Cmaj7' }] },
      { chords: [{ raw: 'Fmaj7' }, { raw: 'Fm7' }] }
    ]
  },
  {
    key: 'Bb',
    bars: [
      { chords: [{ raw: 'Bbmaj7' }, { raw: 'G7b9' }] },
      { chords: [{ raw: 'Cm7' }, { raw: 'F7' }] },
      { chords: [{ raw: 'Dm7' }, { raw: 'G7' }] },
      { chords: [{ raw: 'Cm7' }, { raw: 'F7' }] }
    ]
  }
];

test('learns a compact harmonic profile from jazz charts', () => {
  const corpus = Parkerize.learnHarmonyCorpus(corpusSongs);
  assert.equal(corpus.songCount, 2);
  assert.ok(corpus.chordCount >= 15);
  assert.ok(corpus.transitions['0:maj']['9:dom'] > 0);
  assert.ok(corpus.transitions['2:min']['7:dom'] > 0);
  assert.ok(Object.keys(corpus.trigrams).length > 0);
  assert.ok(Object.keys(corpus.barCells).length > 0);
  assert.ok(corpus.chordCounts[2] > 0);
});

test('ships an aggregate performance model built from every Parker transcription', () => {
  assert.equal(ParkerCorpus.soloCount, 50);
  assert.ok(ParkerCorpus.noteCount > 20000);
  assert.ok(ParkerCorpus.phraseCount > 1500);
  assert.equal(ParkerCorpus.jazzLegendSupport.soloCount, 441);
  assert.ok(ParkerCorpus.jazzLegendSupport.noteCount > 190000);
  assert.ok(ParkerCorpus.jazzLegendSupport.phraseCount > 15000);
  assert.ok(Object.keys(ParkerCorpus.stepTransitions).length >= 6);
  assert.ok(Object.keys(ParkerCorpus.intervalTransitions).length >= 20);
  assert.equal(Parkerize.corpusModel.parkerSoloCount, 50);
  assert.equal(Parkerize.corpusModel.parkerNoteCount, ParkerCorpus.noteCount);
  assert.equal(Parkerize.corpusModel.jazzLegendSupportSoloCount, 441);
});

test('creates deterministic original forms with independent chart complexity', () => {
  const corpus = Parkerize.learnHarmonyCorpus(corpusSongs);
  const simple = Parkerize.generateChart({ complexity: 1, seed: 'form-42', corpus });
  const simpleAgain = Parkerize.generateChart({ complexity: 1, seed: 'form-42', corpus });
  const advanced = Parkerize.generateChart({ complexity: 5, seed: 'form-42', corpus });

  assert.deepEqual(simple, simpleAgain);
  assert.equal(simple.parkerizeGenerated, true);
  assert.equal(advanced.parkerizeChartComplexity, 5);
  assert.equal(advanced.parkerizeCorpusSongs, 2);
  assert.match(advanced.parkerizeForm, /^[A-F]+ · (?:\d+-?)+$/);
  assert.notDeepEqual(advanced.bars.map(bar => bar.chords.map(chord => chord.raw)), simple.bars.map(bar => bar.chords.map(chord => chord.raw)));
  assert.ok(advanced.bars.length >= 25 && advanced.bars.length <= 50);
  assert.ok(advanced.bars.reduce((sum, bar) => sum + bar.chords.length, 0) / advanced.bars.length
    > simple.bars.reduce((sum, bar) => sum + bar.chords.length, 0) / simple.bars.length);
  eventsForSong(simple);
  eventsForSong(advanced);
  const finalChord = Theory.parseChordSymbol(advanced.bars.at(-1).chords.at(-1).raw);
  const tonic = Theory.parseChordSymbol(`${advanced.key}maj7`);
  assert.equal(finalChord.root, tonic.root);
});

test('solo complexity increases density without changing the chart', () => {
  const chart = Parkerize.generateChart({ complexity: 3, seed: 'solo-chart' });
  const events = eventsForSong(chart);
  const simple = Parkerize.generateSolo({ events, complexity: 1, seed: 'take-9', bpm: chart.bpm, title: chart.title });
  const advanced = Parkerize.generateSolo({ events, complexity: 5, seed: 'take-9', bpm: chart.bpm, title: chart.title });

  assert.ok(advanced.notes.length > simple.notes.length * 2);
  assert.equal(simple.durationBeats, advanced.durationBeats);
  assert.equal(simple.midi.durationTicks, simple.durationBeats * Parkerize.PPQ);
  advanced.notes.forEach(note => {
    assert.ok(note.midi >= 55 && note.midi <= 91);
    assert.ok(note.startBeat >= 0 && note.endBeat > note.startBeat);
    assert.ok(note.endBeat <= advanced.durationBeats + 0.001);
  });
});

test('uses Parker-derived phrasing, swing placement, contour, and human articulation', () => {
  const chart = Parkerize.generateChart({ complexity: 4, seed: 'human-chart' });
  const events = eventsForSong(chart);
  const solo = Parkerize.generateSolo({ events, complexity: 4, seed: 'human-take', bpm: chart.bpm, title: chart.title });
  const rests = solo.notes.slice(1).map((note, index) => note.startBeat - solo.notes[index].endBeat).filter(gap => gap > 0.2);
  const swung = solo.notes.filter(note => {
    const phase = ((note.startBeat % 1) + 1) % 1;
    return phase > 0.59 && phase < 0.72;
  });
  const offQuarterGrid = solo.notes.filter(note => Math.abs(note.startBeat * 4 - Math.round(note.startBeat * 4)) > 0.025);
  const velocities = new Set(solo.notes.map(note => note.velocity));

  assert.equal(solo.corpusSoloCount, 50);
  assert.equal(solo.jazzLegendSupportSoloCount, 441);
  assert.ok(rests.length >= 5, 'phrases should breathe instead of filling every subdivision');
  assert.ok(swung.length >= 10, 'straight eighths should receive Parker-style swing placement');
  assert.ok(offQuarterGrid.length > solo.notes.length * 0.2, 'timing should not remain locked to a robotic sixteenth grid');
  assert.ok(velocities.size > solo.notes.length * 0.5, 'phrase dynamics and accents should vary');
  solo.notes.slice(1).forEach((note, index) => {
    assert.ok(solo.notes[index].endBeat <= note.startBeat + 0.000001, 'the generated sax line should stay monophonic');
  });
});

test('exports a format-1 MIDI with conductor chord markers and alto-sax solo', () => {
  const chart = Parkerize.generateChart({ complexity: 4, seed: 'export-chart' });
  const events = eventsForSong(chart);
  const solo = Parkerize.generateSolo({ events, complexity: 4, seed: 'export-take', bpm: chart.bpm, title: chart.title });
  const bytes = Parkerize.exportMidi({
    title: chart.title,
    key: chart.key,
    bpm: chart.bpm,
    events,
    notes: solo.notes
  });
  const midi = MiditarMidi.parseMidi(bytes, `${chart.title}.mid`);

  assert.equal(midi.format, 1);
  assert.equal(midi.tracks.length, 2);
  assert.equal(midi.tracks[1].programs[1], 65);
  assert.equal(midi.tracks[1].notes.length, solo.notes.length);
  assert.equal(midi.markers.filter(marker => marker.type === 'marker').length, events.length);
  assert.ok(Math.abs(midi.tempos[0].bpm - chart.bpm) < 0.01);
  assert.equal(Parkerize.fileNameForTitle('Blue Test · Solo 5'), 'blue-test-solo-5.mid');
});
