#!/usr/bin/env node
'use strict';

/*
 * Build a compact statistical performance model from the 50 MIDI
 * transcriptions in the MIT-licensed Charlie Parker Aligned Omnibook.
 *
 * The generated file contains aggregate histograms and first-order
 * transitions only. It deliberately stores no source melody or long phrase.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Midi = require('../miditar-midi.js');
const catalog = require('../jazz-solo-catalog.js');

const root = path.resolve(__dirname, '..');
const outputPath = path.resolve(process.argv[2] || path.join(root, 'parkerize-corpus.js'));
const cacheDirectory = path.resolve(process.argv[3] || path.join(os.tmpdir(), 'keyer-parkerize-corpus-cache'));
const STEP_BUCKETS = [1 / 6, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 4 / 3, 1.5, 2, 3, 4];
const REST_BUCKETS = [1 / 4, 1 / 2, 3 / 4, 1, 1.5, 2, 3, 4, 6, 8];
const GATE_BUCKETS = [0.42, 0.55, 0.68, 0.8, 0.9, 0.98];

function nearestBucket(value, buckets) {
  return buckets.reduce((best, candidate) => (
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
  ), buckets[0]);
}

function numberKey(value) {
  return Number(value.toFixed(6)).toString();
}

function add(histogram, key, amount = 1) {
  const safeKey = String(key);
  histogram[safeKey] = (histogram[safeKey] || 0) + amount;
}

function addTransition(table, from, to) {
  const fromKey = String(from);
  if (!table[fromKey]) table[fromKey] = {};
  add(table[fromKey], to);
}

function sortHistogram(histogram) {
  return Object.fromEntries(Object.entries(histogram).sort(([left], [right]) => {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    return Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
      ? leftNumber - rightNumber
      : left.localeCompare(right);
  }));
}

function compactTransitions(table, limit = 20) {
  return Object.fromEntries(Object.keys(table).sort((left, right) => Number(left) - Number(right)).map(from => {
    const entries = Object.entries(table[from])
      .sort((left, right) => right[1] - left[1] || Number(left[0]) - Number(right[0]))
      .slice(0, limit);
    return [from, Object.fromEntries(entries)];
  }));
}

async function fetchCached(entry) {
  fs.mkdirSync(cacheDirectory, { recursive: true });
  const target = path.join(cacheDirectory, `${entry.id}.mid`);
  if (fs.existsSync(target) && fs.statSync(target).size > 32) return fs.readFileSync(target);
  const response = await fetch(entry.urls[0], { redirect: 'follow' });
  if (!response.ok) throw new Error(`Could not fetch ${entry.soloTitle}: ${response.status}`);
  const payload = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(target, payload);
  return payload;
}

function phraseBreak(previous, note, phrase) {
  if (!previous) return false;
  const onsetGap = note.startBeat - previous.startBeat;
  const soundingGap = note.startBeat - previous.endBeat;
  const phraseLength = note.startBeat - phrase[0].startBeat;
  return onsetGap >= 1.5
    || soundingGap >= 0.72
    || phrase.length >= 30 && (onsetGap >= 0.72 || Math.abs(note.startBeat % 4) < 0.04)
    || phraseLength >= 16 && onsetGap >= 0.5;
}

function phrasesForNotes(notes) {
  const phrases = [];
  let phrase = [];
  notes.forEach(note => {
    const previous = phrase[phrase.length - 1];
    if (phrase.length && phraseBreak(previous, note, phrase)) {
      phrases.push(phrase);
      phrase = [];
    }
    phrase.push(note);
  });
  if (phrase.length) phrases.push(phrase);
  return phrases.filter(items => items.length >= 2);
}

function contourKey(phrase) {
  const pitches = phrase.map(note => note.midi);
  const intervals = pitches.slice(1).map((midi, index) => midi - pitches[index]);
  const peakIndex = pitches.indexOf(Math.max(...pitches));
  const troughIndex = pitches.indexOf(Math.min(...pitches));
  const segment = index => Math.min(3, Math.floor(index / Math.max(1, pitches.length - 1) * 4));
  let turns = 0;
  for (let index = 1; index < intervals.length; index += 1) {
    if (Math.sign(intervals[index]) && Math.sign(intervals[index - 1]) && Math.sign(intervals[index]) !== Math.sign(intervals[index - 1])) turns += 1;
  }
  const net = pitches[pitches.length - 1] - pitches[0];
  const range = Math.max(...pitches) - Math.min(...pitches);
  return [
    Math.max(-12, Math.min(12, Math.round(net / 2) * 2)),
    nearestBucket(range, [3, 5, 7, 9, 12, 16, 20]),
    segment(peakIndex),
    segment(troughIndex),
    Math.min(8, turns)
  ].join(':');
}

function inspectMidi(entry, payload, model) {
  const midi = Midi.parseMidi(payload, entry.name);
  const track = midi.tracks.reduce((best, candidate) => (
    !best || candidate.notes.length > best.notes.length ? candidate : best
  ), null);
  if (!track || track.notes.length < 8) throw new Error(`${entry.soloTitle} has no readable solo track.`);
  const notes = track.notes.slice().sort((left, right) => left.tick - right.tick).map(note => ({
    midi: note.midi,
    velocity: note.velocity,
    startBeat: note.tick / midi.ppq,
    endBeat: note.endTick / midi.ppq
  }));
  model.noteCount += notes.length;
  model.pitchLow = Math.min(model.pitchLow, ...notes.map(note => note.midi));
  model.pitchHigh = Math.max(model.pitchHigh, ...notes.map(note => note.midi));

  const phrases = phrasesForNotes(notes);
  model.phraseCount += phrases.length;
  phrases.forEach((phrase, phraseIndex) => {
    const start = phrase[0].startBeat;
    const end = phrase[phrase.length - 1].endBeat;
    const noteCount = Math.min(32, phrase.length);
    add(model.phraseNoteCounts, noteCount);
    add(model.phraseLengths, numberKey(nearestBucket(end - start, [1, 1.5, 2, 3, 4, 6, 8, 12, 16])));
    add(model.phraseStartPhases, numberKey(nearestBucket(((start % 4) + 4) % 4, [0, 1 / 3, 1 / 2, 2 / 3, 1, 4 / 3, 1.5, 5 / 3, 2, 7 / 3, 2.5, 8 / 3, 3, 10 / 3, 3.5, 11 / 3])));
    add(model.contours, contourKey(phrase));
    if (phraseIndex > 0) {
      const previous = phrases[phraseIndex - 1];
      const rest = start - previous[previous.length - 1].endBeat;
      if (rest > 0.05) add(model.rests, numberKey(nearestBucket(rest, REST_BUCKETS)));
    }

    let previousStep = null;
    let previousInterval = null;
    for (let index = 0; index < phrase.length - 1; index += 1) {
      const note = phrase[index];
      const next = phrase[index + 1];
      const rawStep = Math.max(1 / 12, next.startBeat - note.startBeat);
      const step = nearestBucket(rawStep, STEP_BUCKETS);
      const interval = Math.max(-12, Math.min(12, next.midi - note.midi));
      const gate = Math.max(0.2, Math.min(1.05, (note.endBeat - note.startBeat) / rawStep));
      const phase = ((note.startBeat % 1) + 1) % 1;
      const phaseName = Math.abs(phase) < 0.04 ? 'strong' : Math.abs(phase - 0.5) < 0.08 ? 'offbeat' : 'triplet';
      add(model.steps, numberKey(step));
      add(model.intervals, interval);
      add(model.intervalsByPhase[phaseName], interval);
      if (previousStep != null) addTransition(model.stepTransitions, numberKey(previousStep), numberKey(step));
      if (previousInterval != null) addTransition(model.intervalTransitions, previousInterval, interval);
      const stepKey = numberKey(step);
      if (!model.gatesByStep[stepKey]) model.gatesByStep[stepKey] = {};
      add(model.gatesByStep[stepKey], numberKey(nearestBucket(gate, GATE_BUCKETS)));
      previousStep = step;
      previousInterval = interval;
    }
  });
}

async function main() {
  const model = {
    noteCount: 0,
    phraseCount: 0,
    pitchLow: 127,
    pitchHigh: 0,
    steps: {},
    stepTransitions: {},
    intervals: {},
    intervalTransitions: {},
    intervalsByPhase: { strong: {}, offbeat: {}, triplet: {} },
    gatesByStep: {},
    phraseNoteCounts: {},
    phraseLengths: {},
    phraseStartPhases: {},
    rests: {},
    contours: {}
  };
  const failures = [];
  for (const entry of catalog.parkerSolos) {
    try {
      const payload = await fetchCached(entry);
      inspectMidi(entry, payload, model);
      process.stdout.write('.');
    } catch (error) {
      failures.push(`${entry.soloTitle}: ${error.message}`);
      process.stdout.write('x');
    }
  }
  process.stdout.write('\n');
  if (failures.length) throw new Error(`Could not build the complete corpus:\n${failures.join('\n')}`);

  const generated = {
    version: 2,
    source: 'Charlie Parker Aligned Omnibook · aggregate performance statistics',
    license: 'MIT',
    soloCount: catalog.parkerSolos.length,
    noteCount: model.noteCount,
    phraseCount: model.phraseCount,
    pitchRange: [model.pitchLow, model.pitchHigh],
    steps: sortHistogram(model.steps),
    stepTransitions: compactTransitions(model.stepTransitions),
    intervals: sortHistogram(model.intervals),
    intervalTransitions: compactTransitions(model.intervalTransitions),
    intervalsByPhase: Object.fromEntries(Object.entries(model.intervalsByPhase).map(([key, value]) => [key, sortHistogram(value)])),
    gatesByStep: Object.fromEntries(Object.entries(model.gatesByStep).sort(([left], [right]) => Number(left) - Number(right)).map(([key, value]) => [key, sortHistogram(value)])),
    phraseNoteCounts: sortHistogram(model.phraseNoteCounts),
    phraseLengths: sortHistogram(model.phraseLengths),
    phraseStartPhases: sortHistogram(model.phraseStartPhases),
    rests: sortHistogram(model.rests),
    contours: Object.fromEntries(Object.entries(model.contours).sort((left, right) => right[1] - left[1]).slice(0, 80))
  };
  const source = `/* Generated by scripts/build-parkerize-solo-model.js. Aggregate statistics only. */\n(function attachKeyerParkerizeCorpus(root, factory) {\n  var api = factory();\n  if (typeof module === 'object' && module.exports) module.exports = api;\n  if (root) root.KeyerParkerizeCorpus = api;\n})(typeof globalThis !== 'undefined' ? globalThis : this, function buildKeyerParkerizeCorpus() {\n  'use strict';\n  return Object.freeze(${JSON.stringify(generated, null, 2)});\n});\n`;
  fs.writeFileSync(outputPath, source);
  console.log(`Wrote ${generated.soloCount} solos, ${generated.noteCount} notes, and ${generated.phraseCount} phrases to ${path.relative(root, outputPath)}.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
