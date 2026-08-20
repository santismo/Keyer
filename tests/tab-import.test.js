'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const TabImport = require('../score-import.js');

test('recognizes Guitar Pro direct-import formats and routes Power Tab files to conversion', () => {
  ['study.gp', 'study.gpx', 'study.gp3', 'study.gp4', 'study.gp5', 'study.musicxml', 'study.xml'].forEach(file => {
    assert.equal(TabImport.isDirectlySupported(file), true, file);
  });
  ['study.ptb', 'study.pt2'].forEach(file => {
    assert.equal(TabImport.requiresConversion(file), true, file);
    assert.match(TabImport.supportedFileMessage(file), /export.*Guitar Pro.*MusicXML/i);
  });
});

test('keeps authored string and fret positions when constructing a tab MIDI track', () => {
  const parsed = {
    title: 'Position fixture',
    artist: 'Keyer test',
    bpm: 120,
    preferredTrackIndex: 0,
    tracks: [{ index: 0, name: 'Lead', fretted: true, tuning: [64, 59, 55, 50, 45, 40], stringCount: 6 }],
    score: {
      masterBars: [{ start: 0, timeSignatureNumerator: 4, timeSignatureDenominator: 4 }],
      tracks: [{
        name: 'Lead',
        playbackInfo: { program: 29 },
        staves: [{
          tuning: [64, 59, 55, 50, 45, 40],
          bars: [{ voices: [{ beats: [{
            playbackStart: 0,
            playbackDuration: 960,
            notes: [
              { string: 1, fret: 5, realValue: 45, velocity: 96 },
              { string: 6, fret: 3, realValue: 67, velocity: 96 }
            ]
          }] }] }]
        }]
      }]
    }
  };

  const midi = TabImport.midiForTrack(parsed, 0);
  assert.equal(midi.tabSource.exactPositions, true);
  assert.deepEqual(midi.tabSource.tuning, [64, 59, 55, 50, 45, 40]);
  assert.deepEqual(midi.tracks[0].notes.map(note => note.tabPosition), [
    { stringIndex: 0, sourceString: 6, fret: 3, midi: 67, exact: true, trackIndex: 0, trackName: 'Lead', techniques: { dead: false, palmMute: false, letRing: false, hammerPull: false, tieDestination: false } },
    { stringIndex: 5, sourceString: 1, fret: 5, midi: 45, exact: true, trackIndex: 0, trackName: 'Lead', techniques: { dead: false, palmMute: false, letRing: false, hammerPull: false, tieDestination: false } }
  ]);

  const song = TabImport.songForParsedTab({
    ...parsed,
    bars: [{
      index: 0,
      chords: [{ raw: 'C5', startBeat: 0, endBeat: 4 }],
      timeSignature: { beats: 4, beatUnit: 4 },
      startBeat: 0,
      endBeat: 4
    }]
  }, { type: 'tab-file', name: 'fixture.gp' }, 0);
  assert.equal(song.tabTiming, true);
  assert.equal(song.bars[0].chords[0].startBeat, 0);
  assert.equal(song.bars[0].chords[0].endBeat, 4);
});

test('combines selected guitar tracks while retaining the selected track for fretboard display', () => {
  const parsed = {
    title: 'Two guitars',
    artist: 'Keyer test',
    bpm: 120,
    preferredTrackIndex: 0,
    tracks: [
      { index: 0, name: 'Lead Guitar', fretted: true, tuning: [64, 59, 55, 50, 45, 40], stringCount: 6 },
      { index: 1, name: 'Rhythm Guitar', fretted: true, tuning: [64, 59, 55, 50, 45, 40], stringCount: 6 }
    ],
    score: {
      masterBars: [{ start: 0, timeSignatureNumerator: 4, timeSignatureDenominator: 4 }],
      tracks: [
        {
          name: 'Lead Guitar', playbackInfo: { program: 29 }, staves: [{ tuning: [64, 59, 55, 50, 45, 40], bars: [{ voices: [{ beats: [{ playbackStart: 0, playbackDuration: 960, notes: [{ string: 6, fret: 5, realValue: 69 }] }] }] }] }]
        },
        {
          name: 'Rhythm Guitar', playbackInfo: { program: 27 }, staves: [{ tuning: [64, 59, 55, 50, 45, 40], bars: [{ voices: [{ beats: [{ playbackStart: 0, playbackDuration: 960, notes: [{ string: 5, fret: 3, realValue: 62 }] }] }] }] }]
        }
      ]
    }
  };

  const midi = TabImport.midiForTracks(parsed, [0, 1], 0);
  assert.equal(midi.tracks.length, 1);
  assert.equal(midi.tracks[0].notes.length, 2);
  assert.deepEqual(midi.tabSource.playbackTrackIndexes, [0, 1]);
  assert.equal(midi.tabSource.displayTrackIndex, 0);
  assert.equal(midi.tabSource.mixedPlayback, true);
  assert.deepEqual(midi.tracks[0].notes.map(note => note.tabPosition.trackIndex), [0, 1]);
});
