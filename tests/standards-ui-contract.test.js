'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'standards.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'standards.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'standards.js'), 'utf8');

assert.doesNotMatch(html, /id="(?:voicingNotes|scaleNotes|playVoicing)"/);
assert.match(html, /id="toggleNoteNames"/);
assert.match(html, /Two-octave piano/);
assert.match(html, /root-swatch[\s\S]*chord-swatch[\s\S]*scale-swatch/);

assert.match(css, /--paper:\s*#080b10/);
assert.match(css, /\.chart-scroll\s*\{[^}]*overflow-x:\s*hidden/);
assert.match(css, /\.realbook-chart\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/);
assert.doesNotMatch(css, /min-width:\s*(?:485|520|560)px/);
assert.match(css, /\.realbook-chart\s*\{[^}]*grid-template-columns:\s*repeat\(4/);
assert.match(css, /@media \(max-width:\s*379px\)[\s\S]*\.dense-measure \.measure-chords[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(css, /\.piano\s*\{[^}]*height:\s*106px/);
assert.match(css, /--root-tone:\s*#ffd36e/);
assert.match(css, /--chord-tone:\s*#ff5964/);
assert.match(css, /--scale-tone:\s*#4aa8ff/);

assert.match(js, /const LOW = 48;\s*\n\s*const HIGH = 72;/);
assert.match(js, /Theory\.fitVoicingToRange\(voicing, LOW, HIGH\)/);
assert.match(js, /const voicing = state\.displayVoicing\.length \? state\.displayVoicing : state\.voicing;/);
assert.match(js, /measure\.getBoundingClientRect\(\)/);
assert.match(js, /view\.getBoundingClientRect\(\)/);
assert.doesNotMatch(js, /measure\.offsetTop/);
assert.match(css, /\.chart-scroll\s*\{[^}]*scroll-behavior:\s*auto/);
assert.match(js, /key\.classList\.add\('root-tone'\)/);
assert.match(js, /key\.classList\.add\('chord-tone'\)/);
assert.match(js, /key\.classList\.add\('scale-tone'\)/);
assert.doesNotMatch(js, /elements\.(?:voicingNotes|scaleNotes|playVoicing)/);

console.log('Jazz standards UI contract tests passed.');
