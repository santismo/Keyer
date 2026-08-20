'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Theory = require('../jazz-theory.js');
const catalog = require('../wjazzd-solo-catalog.js');

const root = path.resolve(__dirname, '..');
const midiDirectory = path.join(root, 'jazz-solo-midi', 'wjazzd');

test('ships a compact, playable WJazzD legend-solo catalog with source harmony', () => {
  assert.equal(catalog.entryCount, 441);
  assert.equal(catalog.parkerCount, 17);
  assert.ok(catalog.performerCount >= 75);
  assert.ok(catalog.releaseMidiCount >= catalog.entryCount);
  assert.equal(catalog.unreadableMidiCount, 3);
  assert.match(catalog.license, /ODbL/);
  assert.match(catalog.sourceUrl, /jazzomat\.hfm-weimar\.de/);

  const parker = catalog.entries.filter(entry => entry.performer === 'Charlie Parker');
  assert.equal(parker.length, 17);
  assert.ok(parker.some(entry => entry.title === 'Ko-Ko'));

  catalog.entries.forEach(entry => {
    assert.ok(fs.existsSync(path.join(midiDirectory, entry.file)), `Missing bundled solo MIDI: ${entry.file}`);
    assert.ok(entry.chart.length > 0, `${entry.name} needs chart rows`);
    assert.equal(entry.chart.length, entry.barCount);
    assert.ok(entry.chart.some(row => row[3].length), `${entry.name} needs source harmony`);
    entry.chart.forEach(row => {
      assert.ok(Number(row[0]) > 0 && Number(row[1]) > 0, `${entry.name} has a readable meter`);
      row[3].forEach(cell => {
        assert.ok(Theory.parseChordSymbol(cell[0]), `${entry.name} has a parseable chord: ${cell[0]}`);
        assert.ok(Number(cell[2]) > Number(cell[1]), `${entry.name} has a positive chord span`);
      });
    });
  });
});
