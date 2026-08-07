'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const Midi = require('../miditar-midi.js');

function textBytes(value) {
  return Array.from(Buffer.from(value, 'utf8'));
}

function vlq(value) {
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

function meta(delta, type, payload) {
  return [...vlq(delta), 0xff, type, ...vlq(payload.length), ...payload];
}

function track(events) {
  const body = [...events.flat(), 0x00, 0xff, 0x2f, 0x00];
  return [
    ...textBytes('MTrk'),
    (body.length >>> 24) & 0xff,
    (body.length >>> 16) & 0xff,
    (body.length >>> 8) & 0xff,
    body.length & 0xff,
    ...body,
  ];
}

function fixtureMidi() {
  const conductor = track([
    meta(0, 0x03, textBytes('Fixture Standard')),
    meta(0, 0x51, [0x07, 0xa1, 0x20]), // 120 bpm
    meta(0, 0x58, [4, 2, 24, 8]),
    meta(0, 0x06, textBytes('Cmaj7')),
    meta(480, 0x01, textBytes('verse')),
    meta(0, 0x06, textBytes('F7')),
  ]);
  const comp = track([
    meta(0, 0x03, textBytes('Piano Comp')),
    [0x00, 0x90, 48, 90],
    [0x00, 0x90, 52, 90],
    [0x00, 0x90, 55, 90],
    [0x83, 0x60, 0x80, 48, 0],
    [0x00, 0x80, 52, 0],
    [0x00, 0x80, 55, 0],
  ]);
  const melody = track([
    meta(0, 0x03, textBytes('Lead Melody')),
    [0x00, 0x91, 72, 100],
    [0x81, 0x70, 0x81, 72, 0],
    [0x00, 0x91, 74, 100],
    [0x81, 0x70, 0x81, 74, 0],
  ]);
  const header = [
    ...textBytes('MThd'),
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x01, // format one
    0x00, 0x03,
    0x01, 0xe0, // 480 PPQ
  ];
  return Uint8Array.from([...header, ...conductor, ...comp, ...melody]);
}

test('parses standard MIDI tempos, text/marker metadata, and timed track notes', () => {
  const parsed = Midi.parseMidi(fixtureMidi(), 'Fallback Name.mid');

  assert.equal(parsed.title, 'Fixture Standard');
  assert.equal(parsed.format, 1);
  assert.equal(parsed.ppq, 480);
  assert.equal(parsed.durationTicks, 480);
  assert.equal(parsed.tempos.length, 1);
  assert.equal(parsed.tempos[0].bpm, 120);
  assert.deepEqual(parsed.timeSignatures[0], {
    tick: 0,
    time: 0,
    numerator: 4,
    denominator: 4,
    clocksPerClick: 24,
    thirtySecondNotes: 8,
  });
  assert.deepEqual(
    parsed.markers.map((marker) => [marker.tick, marker.type, marker.text]),
    [[0, 'marker', 'Cmaj7'], [480, 'text', 'verse'], [480, 'marker', 'F7']],
  );
  assert.equal(parsed.tracks[1].notes.length, 3);
  assert.equal(parsed.tracks[2].notes.length, 2);
  assert.equal(parsed.tracks[2].notes[0].midi, 72);
  assert.equal(parsed.tracks[2].notes[0].durationTicks, 240);
  assert.equal(parsed.tracks[2].notes[0].time, 0);
  assert.equal(parsed.tracks[2].notes[0].duration, 0.25);
  assert.equal(Midi.midiTicksToSeconds(parsed, 480), 0.5);
  assert.equal(Midi.secondsToMidiTicks(parsed, 0.5), 480);
  assert.equal(Midi.activeMarkerAtTick(parsed.markers, 480).text, 'F7');
});

test('chooses a named, high, mostly monophonic melody track over accompaniment', () => {
  const parsed = Midi.parseMidi(fixtureMidi());
  const ranked = Midi.rankMelodyTracks(parsed);
  const chosen = Midi.chooseMelodyTrack(parsed);

  assert.equal(ranked[0].trackIndex, 2);
  assert.equal(ranked[0].track.name, 'Lead Melody');
  assert.ok(ranked[0].confidence > 0.6);
  assert.equal(chosen.index, 2);
  assert.equal(chosen.notes.length, 2);
});

test('normalizes Miditar-style filenames without allowing fuzzy song matches', () => {
  assert.equal(
    Midi.normalizeCatalogTitle('The Girl from Ipanema - Arrangement 2.mid'),
    'girl from ipanema',
  );
  assert.ok(Midi.catalogTitlesMatch('Girl From Ipanema', 'The Girl from Ipanema - Arrangement 2.mid'));
  assert.equal(Midi.catalogTitlesMatch('Misty', 'Misty Blue'), false);

  const catalog = [
    { title: 'Misty Blue', path: 'Misty Blue.mid' },
    { title: 'The Girl from Ipanema - Arrangement 2', path: 'ipanema.mid' },
  ];
  assert.equal(Midi.findCatalogMatch('Girl From Ipanema', catalog), catalog[1]);
  assert.equal(Midi.findCatalogMatch('Misty', catalog), null);
});
