#!/usr/bin/env node
'use strict';

/*
 * Build the browser-ready index for the Weimar Jazz Database MIDI release.
 *
 * Usage:
 *   node scripts/build-wjazzd-solo-catalog.js /path/to/wjazzd.db /path/to/midi-dir
 *
 * The release's unquantized MIDI files contain the solo line.  WJazzD's
 * SQLite data supplies the corresponding beat-level chord annotations, which
 * lets Keyer keep the solo on the fretboard while it plays the original
 * accompaniment underneath it.  The generated catalog contains source data
 * only; it does not manufacture new notes.
 */

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const Theory = require('../jazz-theory.js');
const Midi = require('../miditar-midi.js');

const root = path.resolve(__dirname, '..');
const databasePath = path.resolve(process.argv[2] || path.join(root, 'wjazzd.db'));
const midiDirectory = path.resolve(process.argv[3] || path.join(root, 'jazz-solo-midi', 'wjazzd'));
const outputPath = path.resolve(process.argv[4] || path.join(root, 'wjazzd-solo-catalog.js'));

function query(sql) {
  const output = childProcess.execFileSync('sqlite3', ['-json', databasePath, sql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(output || '[]');
}

function safeText(value) {
  return String(value == null ? '' : value).trim();
}

function meterFor(value, fallback) {
  const match = safeText(value || fallback).match(/^(\d+)\s*\/\s*(\d+)$/);
  const beats = Number(match && match[1]) || 4;
  const beatUnit = Number(match && match[2]) || 4;
  return { beats, beatUnit };
}

function keyFor(value) {
  const match = safeText(value).match(/^([A-G](?:#|b)?)/i);
  return match ? match[1].replace('b', 'b') : '';
}

function fileFor(sourceName) {
  return safeText(sourceName).replace(/\.sv$/i, '.mid');
}

function fileKey(value) {
  return safeText(value)
    .replace(/\.mid$/i, '')
    .replace(/[=-]/g, '=')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();
}

function canonicalChord(value) {
  const chord = safeText(value);
  if (!chord || chord.toUpperCase() === 'NC') return null;
  // The Jazzomat spelling is also accepted by Keyer's iReal-compatible chord
  // parser. Preserve it so the supplied annotation remains inspectable.
  return Theory.parseChordSymbol(chord) ? chord : null;
}

function barsForSolo(solo, beatRows) {
  if (!beatRows.length) return [];
  const byBar = new Map();
  beatRows.forEach(row => {
    const bar = Number(row.bar);
    if (!Number.isFinite(bar)) return;
    const rows = byBar.get(bar) || [];
    rows.push(row);
    byBar.set(bar, rows);
  });
  const indexes = [...byBar.keys()].sort((left, right) => left - right);
  if (!indexes.length) return [];

  const startBar = indexes[0];
  const endBar = indexes[indexes.length - 1];
  const bars = [];
  let cursor = 0;
  let activeChord = null;
  let currentSection = 'Solo';

  for (let sourceBar = startBar; sourceBar <= endBar; sourceBar += 1) {
    const rows = (byBar.get(sourceBar) || []).slice().sort((left, right) => (
      Number(left.beat) - Number(right.beat) || Number(left.beatid) - Number(right.beatid)
    ));
    const meter = meterFor(rows.find(row => safeText(row.signature))?.signature, solo.signature);
    const duration = meter.beats * 4 / meter.beatUnit;
    const changes = [];
    let marker = '';
    rows.forEach(row => {
      const form = safeText(row.form);
      if (form) marker = form;
      const raw = safeText(row.chord);
      if (!raw) return;
      const beat = Math.max(1, Math.min(meter.beats, Number(row.beat) || 1));
      changes.push({ offset: (beat - 1) * 4 / meter.beatUnit, chord: canonicalChord(raw) });
    });
    if (marker) currentSection = marker;
    const chords = [];
    let active = activeChord;
    let segmentStart = 0;
    changes.forEach(change => {
      const changeOffset = Math.max(0, Math.min(duration, change.offset));
      if (active && changeOffset > segmentStart + 0.0001) {
        chords.push({ raw: active, startBeat: cursor + segmentStart, endBeat: cursor + changeOffset });
      }
      active = change.chord;
      segmentStart = changeOffset;
    });
    if (active && duration > segmentStart + 0.0001) {
      chords.push({ raw: active, startBeat: cursor + segmentStart, endBeat: cursor + duration });
    }
    activeChord = active;
    bars.push({
      index: bars.length,
      sourceBar,
      chords,
      overflowChords: [],
      section: currentSection,
      sectionMarker: marker || null,
      timeSignature: meter,
      timeSignatureChange: bars.length === 0 || safeText(rows.find(row => safeText(row.signature))?.signature)
        ? meter
        : null,
      annotations: [],
      comments: [],
      repeatStart: false,
      repeatEnd: false,
      noChord: !chords.length,
      pause: false
    });
    cursor += duration;
  }
  return bars;
}

function compactChart(bars) {
  let cursor = 0;
  return bars.map(bar => {
    const meter = meterFor(bar.timeSignature);
    const encoded = [
      meter.beats,
      meter.beatUnit,
      safeText(bar.sectionMarker),
      bar.chords.map(chord => [
        chord.raw,
        Number((chord.startBeat - cursor).toFixed(6)),
        Number((chord.endBeat - cursor).toFixed(6))
      ])
    ];
    cursor += meter.beats * 4 / meter.beatUnit;
    return encoded;
  });
}

function main() {
  if (!fs.existsSync(databasePath)) throw new Error(`WJazzD database not found: ${databasePath}`);
  if (!fs.existsSync(midiDirectory)) throw new Error(`WJazzD MIDI directory not found: ${midiDirectory}`);
  const availableFiles = new Map(fs.readdirSync(midiDirectory)
    .filter(file => /\.mid$/i.test(file))
    .map(file => [fileKey(file), file]));
  const solos = query(`
    SELECT si.melid, si.performer, si.title, si.titleaddon, si.instrument,
           si.style, si.avgtempo, si.key, si.signature, ti.filename_sv
    FROM solo_info si
    JOIN transcription_info ti ON ti.melid = si.melid
    WHERE ti.status = 'FINAL'
    ORDER BY si.performer COLLATE NOCASE, si.title COLLATE NOCASE, si.melid
  `);
  const beats = query(`
    SELECT beatid, melid, bar, beat, signature, chord, form
    FROM beats
    ORDER BY melid, bar, beat, beatid
  `);
  const beatsBySolo = new Map();
  beats.forEach(beat => {
    const rows = beatsBySolo.get(beat.melid) || [];
    rows.push(beat);
    beatsBySolo.set(beat.melid, rows);
  });

  const missing = [];
  const malformed = [];
  const unreadable = [];
  const entries = solos.flatMap(solo => {
    const sourceFile = fileFor(solo.filename_sv);
    const file = availableFiles.get(fileKey(sourceFile));
    if (!file) {
      missing.push(sourceFile);
      return [];
    }
    try {
      Midi.parseMidi(fs.readFileSync(path.join(midiDirectory, file)), file);
    } catch (error) {
      unreadable.push(`${file}: ${error.message}`);
      return [];
    }
    const bars = barsForSolo(solo, beatsBySolo.get(solo.melid) || []);
    if (!bars.length || !bars.some(bar => bar.chords.length)) {
      malformed.push(`${solo.performer} — ${solo.title}`);
      return [];
    }
    const performer = safeText(solo.performer) || 'Unknown soloist';
    const title = safeText(solo.title) || file.replace(/_FINAL\.mid$/i, '').replace(/_/g, ' ');
    const titleAddon = safeText(solo.titleaddon);
    return [{
      id: `wjazzd-${solo.melid}`,
      file,
      name: `${performer} — ${title}${titleAddon ? ` (${titleAddon})` : ''}.mid`,
      performer,
      title,
      titleAddon,
      instrument: safeText(solo.instrument),
      style: safeText(solo.style),
      bpm: Math.round(Number(solo.avgtempo) || 0),
      key: keyFor(solo.key),
      signature: safeText(solo.signature) || '4/4',
      chart: compactChart(bars),
      barCount: bars.length
    }];
  });
  const performerCount = new Set(entries.map(entry => entry.performer)).size;
  const parkerCount = entries.filter(entry => entry.performer === 'Charlie Parker').length;
  const generated = {
    version: 1,
    source: 'Weimar Jazz Database (WJazzD) v2.1 · Jazzomat Research Project',
    sourceUrl: 'https://jazzomat.hfm-weimar.de/download/download.html',
    license: 'ODbL 1.0 / Database Contents License 1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1.0/',
    entryCount: entries.length,
    sourceCatalogCount: solos.length,
    releaseMidiCount: availableFiles.size,
    unavailableSoloCount: missing.length,
    unannotatedSoloCount: malformed.length,
    unreadableMidiCount: unreadable.length,
    performerCount,
    parkerCount,
    entries
  };
  const source = `/* Generated by scripts/build-wjazzd-solo-catalog.js from the WJazzD v2.1 release. */\n(function attachKeyerWJazzDSoloCatalog(root, factory) {\n  var api = factory();\n  if (typeof module === 'object' && module.exports) module.exports = api;\n  if (root) root.KeyerWJazzDSoloCatalog = api;\n})(typeof globalThis !== 'undefined' ? globalThis : this, function buildKeyerWJazzDSoloCatalog() {\n  'use strict';\n  return Object.freeze(${JSON.stringify(generated)});\n});\n`;
  fs.writeFileSync(outputPath, source);
  console.log(`Wrote ${entries.length} WJazzD solo studies by ${performerCount} performers (${parkerCount} Charlie Parker) to ${path.relative(root, outputPath)}. Skipped ${malformed.length} release files with no source chord annotation, ${missing.length} source rows without a matching release MIDI, and ${unreadable.length} unsupported MIDI files.`);
}

main();
