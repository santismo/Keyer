'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'standards.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'standards.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'standards.js'), 'utf8');
const desktopHtml = fs.readFileSync(path.join(root, 'standards-desktop.html'), 'utf8');
const desktopCss = fs.readFileSync(path.join(root, 'standards-desktop.css'), 'utf8');

function ancestorsForElementId(markup, id) {
  const tags = /<\/?([a-z][\w:-]*)(?:\s[^<>]*)?>/gi;
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const idExpression = new RegExp(`\\bid=(["'])${id}\\1`);
  const stack = [];
  let tag;

  while ((tag = tags.exec(markup))) {
    const source = tag[0];
    const tagName = tag[1].toLowerCase();
    if (source.startsWith('</')) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        const open = stack.pop();
        if (open.tagName === tagName) break;
      }
      continue;
    }

    if (idExpression.test(source)) return stack.slice();
    if (!voidTags.has(tagName) && !source.endsWith('/>')) stack.push({ tagName, source });
  }

  throw new Error(`Could not find #${id} in standards markup`);
}

function assertMelodySliderLivesWithChordIdentity(markup, label) {
  const sliderAncestors = ancestorsForElementId(markup, 'melodySlider');
  assert.ok(
    sliderAncestors.some(ancestor => /\bchord-identity\b/.test(ancestor.source)),
    `${label} melody slider should live directly inside the selected chord identity`
  );
  assert.ok(
    sliderAncestors.some(ancestor => /\bmelody-panel\b/.test(ancestor.source)),
    `${label} melody slider should remain grouped in its melody panel`
  );
  assert.ok(
    markup.indexOf('id="selectedChord"') < markup.indexOf('id="scaleName"')
      && markup.indexOf('id="scaleName"') < markup.indexOf('id="melodySlider"'),
    `${label} melody slider should follow the current chord and scale readout`
  );
}

assert.doesNotMatch(html, /id="(?:voicingNotes|scaleNotes|playVoicing)"/);
assert.match(html, /id="toggleNoteNames"/);
assert.match(html, /id="toggleMelody"/);
assert.match(html, /id="randomSong"[^>]*>Random<\/button>/);
assert.match(html, /id="songAvailabilityFilter"/);
assert.doesNotMatch(html, /id="loadMidi"/);
assert.doesNotMatch(html, /id="midiFileInput"/);
assert.match(html, /id="melodySlider"/);
assert.match(html, /id="melodyWheel"/);
assert.match(html, /id="melodyWheelLabel"[^>]*>Melody wheel/);
assert.match(html, /<output class="sr-only" id="melodyReadout"/);
assert.match(html, /class="melody-wheel-drum"/);
assert.match(html, /class="melody-wheel-tread"/);
assert.match(html, /class="melody-wheel-surface"/);
assert.doesNotMatch(html, /melody-wheel-note|melody-wheel-previous|melody-wheel-current|melody-wheel-next/);
assertMelodySliderLivesWithChordIdentity(html, 'Phone');
assert.match(html, /id="playChart"/);
assert.match(html, /id="tempoRange"/);
assert.match(html, /id="chartSource"/);
assert.match(html, /id="instrumentView"/);
assert.match(html, /id="keyboardRangeMode"/);
assert.match(html, /option value="split">Split · 2 \+ 2<\/option>/);
assert.match(html, /option value="wide">Wide keyboard<\/option>/);
assert.match(html, /id="keyboardToneMode"/);
assert.match(html, /id="fretboardToneMode"/);
assert.match(html, /id="melodyPiano"/);
assert.match(html, /id="melodyKeyboardPane"/);
assert.match(html, /id="fretboard"/);
assert.match(html, /src="miditar-midi\.js"/);
assert.match(html, /Two-octave piano/);
assert.match(html, /root-swatch[\s\S]*chord-swatch[\s\S]*scale-swatch[\s\S]*melody-swatch/);
assert.ok(
  html.indexOf('id="chartScroll"') < html.indexOf('id="piano"')
    && html.indexOf('id="piano"') < html.indexOf('id="previousChord"'),
  'On phones the practice flow should be chart, keyboard, then chord navigation.'
);

assert.match(css, /--paper:\s*#080b10/);
assert.match(css, /\.chart-scroll\s*\{[^}]*overflow-x:\s*hidden/);
assert.match(css, /\.realbook-chart\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/);
assert.doesNotMatch(css, /min-width:\s*(?:485|520|560)px/);
assert.match(css, /\.realbook-chart\s*\{[^}]*grid-template-columns:\s*repeat\(4/);
assert.match(css, /@media \(max-width:\s*379px\)[\s\S]*\.dense-measure \.measure-chords[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(css, /\.piano\s*\{[^}]*height:\s*106px/);
assert.match(css, /@media \(max-width:\s*780px\)[\s\S]*\.workspace\s*\{[^}]*gap:\s*6px/);
assert.match(css, /--root-tone:\s*#ffd36e/);
assert.match(css, /--chord-tone:\s*#ff5964/);
assert.match(css, /--scale-tone:\s*#4aa8ff/);
assert.match(css, /--melody-tone:\s*#a566ff/);
assert.match(css, /\.melody-wheel\s*\{/);
assert.match(css, /\.melody-wheel-surface\s*\{[^}]*touch-action:\s*pan-y/);
assert.match(css, /\.melody-wheel-tread\s*\{[^}]*translate3d\(var\(--melody-wheel-roll\)/);
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.melody-wheel-tread\s*\{[^}]*transition:\s*none/);
assert.match(css, /html, body\s*\{[^}]*touch-action:\s*manipulation/);
assert.match(css, /\.instrument-stage\s*\{[^}]*overflow-x:\s*auto/);
assert.match(css, /\.piano:is\(\[data-range-mode="full"\]/);
assert.match(css, /\.keyboard-stack\[data-range-mode="split"\]/);
assert.match(css, /\.fretboard-grid\s*\{[^}]*grid-template-rows:\s*repeat\(6/);
assert.match(css, /\.fretboard\[data-extended="true"\]\s*\{[^}]*width:\s*var\(--fretboard-min-width\)/);
assert.match(css, /\.fretboard-string\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--fretboard-column-count,\s*13\)/);
assert.match(css, /\.fretboard-position-markers/);
assert.doesNotMatch(css, /\.fretboard-fret-label/);
assert.match(css, /\.library-filter/);
assert.match(css, /\.piano-key\.white\.melody-tone,\s*\.piano-key\.black\.melody-tone\s*\{[^}]*background:\s*var\(--melody-tone\)/);

assert.match(js, /const DISPLAY_LOW = 48;\s*\n\s*const DISPLAY_HIGH = 72;/);
assert.match(js, /const ACCOMPANIMENT_LOW = 24;\s*\n\s*const ACCOMPANIMENT_HIGH = 72;/);
assert.match(js, /Theory\.fitVoicingForMelody\(voicing, melodyMidis, ACCOMPANIMENT_LOW, ACCOMPANIMENT_HIGH\)/);
assert.match(js, /function displayRangeForVoicing\(/);
assert.match(js, /function fullSongKeyboardData\(/);
assert.match(js, /function snapFullKeyboardRange\(/);
assert.match(js, /function renderFretboard\(/);
assert.match(js, /const FRETBOARD_MAX_FRET = 12;/);
assert.match(js, /function fretboardMaxFret\(/);
assert.match(js, /function fretboardMarkerFrets\(/);
assert.match(js, /dataset\.lastFret/);
assert.match(js, /state\.keyboardRangeMode === 'full'/);
assert.match(js, /const literalRegister = rangeMode === 'full';/);
assert.match(js, /function renderKeyboardSurface\(/);
assert.match(js, /function splitMelodyRangeFor\(/);
assert.match(js, /function navigateDesktopMelody\(/);
assert.match(js, /function melodyWheelEntries\(/);
assert.match(js, /function selectMelodyWheelIndex\(/);
assert.match(js, /function bindMelodyWheel\(/);
assert.match(js, /function paintMelodyWheelRoll\(/);
assert.match(js, /function settleMelodyWheelVisual\(/);
assert.match(js, /function guitarChordMelodyShape\(/);
assert.match(js, /function visualTargets\(/);
assert.doesNotMatch(js, /function oneOctaveRangeForVoicing\(/);
assert.match(js, /state\.keyboardToneMode/);
assert.match(js, /state\.fretboardToneMode/);
assert.match(js, /const voicing = state\.displayVoicing\.length \? state\.displayVoicing : state\.voicing;/);
assert.match(js, /measure\.getBoundingClientRect\(\)/);
assert.match(js, /view\.getBoundingClientRect\(\)/);
assert.doesNotMatch(js, /measure\.offsetTop/);
assert.match(css, /\.chart-scroll\s*\{[^}]*scroll-behavior:\s*auto/);
assert.match(js, /element\.classList\.add\('root-tone'\)/);
assert.match(js, /element\.classList\.add\('chord-tone'\)/);
assert.match(js, /element\.classList\.add\('scale-tone'\)/);
assert.match(js, /key\.classList\.add\('melody-tone'\)/);
assert.match(js, /function startChartPlayback\(/);
assert.match(js, /function buildMidiChart\(/);
assert.match(js, /pickupNotes/);
assert.doesNotMatch(js, /source\.slice\(0, 60\)/);
assert.match(js, /function buildMelodyNotes\(/);
assert.match(js, /function toggleMelody\(/);
assert.match(js, /document\.addEventListener\('dblclick'/);
assert.match(js, /deferredFullKeyboardTaps/);
assert.match(js, /holdOnly: span\.startTick < barStartTick/);
assert.match(js, /button\.className = 'chart-hold'/);
assert.match(js, /function scheduleMelodyForSegment\(/);
assert.match(js, /chartEndBeat/);
assert.doesNotMatch(js, /Math\.min\(note\.durationBeats, segmentEnd - note\.startBeat\)/);
assert.doesNotMatch(js, /elements\.(?:voicingNotes|scaleNotes|playVoicing)/);
assert.doesNotMatch(js, /elements\.(?:loadMidi|midiFileInput)/);

assert.match(desktopHtml, /<body class="desktop-mode">/);
assert.match(desktopHtml, /href="standards-desktop\.css"/);
assert.match(desktopHtml, /id="keyboardRangeMode"/);
assert.match(desktopHtml, /id="songAvailabilityFilter"/);
assert.doesNotMatch(desktopHtml, /id="loadMidi"/);
assert.match(desktopHtml, /id="melodyWheel"/);
assert.match(desktopHtml, /id="melodyWheelLabel"[^>]*>Melody wheel/);
assert.match(desktopHtml, /class="melody-wheel-tread"/);
assert.doesNotMatch(desktopHtml, /melody-wheel-note|melody-wheel-previous|melody-wheel-current|melody-wheel-next/);
assertMelodySliderLivesWithChordIdentity(desktopHtml, 'Desktop');
assert.match(desktopCss, /\.desktop-mode \.workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(desktopCss, /\.desktop-mode \.fretboard\s*\{[^}]*min-height:\s*240px/);

console.log('Jazz standards UI contract tests passed.');
