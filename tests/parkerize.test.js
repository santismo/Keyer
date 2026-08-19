'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Parkerize = require('../parkerize.js');
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
  assert.notDeepEqual(advanced.bars.map(bar => bar.chords.map(chord => chord.raw)), simple.bars.map(bar => bar.chords.map(chord => chord.raw)));
  assert.ok(advanced.bars.length >= 25 && advanced.bars.length <= 50);
  assert.ok(advanced.bars.reduce((sum, bar) => sum + bar.chords.length, 0) / advanced.bars.length
    > simple.bars.reduce((sum, bar) => sum + bar.chords.length, 0) / simple.bars.length);
  eventsForSong(simple);
  eventsForSong(advanced);
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
