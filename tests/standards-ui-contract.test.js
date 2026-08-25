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
const soloCatalog = require(path.join(root, 'jazz-solo-catalog.js'));
const wjazzdCatalog = require(path.join(root, 'wjazzd-solo-catalog.js'));
const azMidiCatalog = require(path.join(root, 'a-z-midi-catalog.js'));
const parkerCorpus = require(path.join(root, 'parkerize-corpus.js'));

function sourceForFunction(name) {
  const startPattern = new RegExp(`\\n  (?:async )?function ${name}\\(`);
  const match = startPattern.exec(js);
  assert.ok(match, `Expected ${name}() in standards.js.`);
  const nextPattern = /\n  (?:async )?function [A-Za-z_$][\w$]*\(/g;
  nextPattern.lastIndex = match.index + match[0].length;
  const next = nextPattern.exec(js);
  return js.slice(match.index, next ? next.index : js.length);
}

assert.doesNotMatch(html, /id="(?:voicingNotes|scaleNotes|playVoicing)"/);
assert.match(html, /id="toggleNoteNames"/);
assert.match(html, /id="toggleMelody"/);
assert.match(html, /id="randomSong"[^>]*>Random<\/button>/);
assert.match(html, /class="library-actions"[\s\S]*id="randomSong"[\s\S]*id="playChart"/);
assert.match(html, /id="songAvailabilityFilter"/);
assert.match(html, /option value="solos">Jazz solos<\/option>/);
assert.match(html, /option value="parker">Charlie Parker solos<\/option>/);
assert.match(html, /option value="legends">Jazz legend solos<\/option>/);
assert.match(html, /option value="az-midi">A–Z MIDI songs<\/option>/);
assert.match(html, /option value="tab-files">Tab files<\/option>/);
assert.match(html, /id="openTabFile"/);
assert.match(html, /id="tabFileInput"[^>]*accept="\.gp,\.gpx,\.gp3,\.gp4,\.gp5,\.musicxml,\.xml,\.ptb,\.pt2"/);
assert.match(html, /id="tabTrack"/);
assert.match(html, /id="tabPlayAllTracks"/);
assert.match(html, /src="vendor\/score-reader\/alphaTab\.min\.js"\><\/script>\s*<script src="score-import\.js"\><\/script>\s*<script src="personal-scores-catalog\.js"/);
assert.match(html, /option value="parkerize">Parkerize<\/option>/);
assert.match(html, /id="parkerizePanel"/);
assert.match(html, /id="parkerizeHarmonyMode"/);
assert.match(html, /id="parkerizeChartComplexity"[^>]*type="range"[^>]*min="1"[^>]*max="5"/);
assert.match(html, /id="parkerizeSoloComplexity"[^>]*type="range"[^>]*min="1"[^>]*max="5"/);
assert.match(html, /id="generateParkerize"/);
assert.match(html, /id="regenerateParkerizeSolo"/);
assert.match(html, /id="exportParkerizeMidi"/);
assert.match(html, /<script src="parkerize-corpus\.js"><\/script>\s*<script src="parkerize\.js"><\/script>/);
assert.match(html, /option value="favorites">Favorites<\/option>/);
assert.match(html, /id="favoriteSong"/);
assert.doesNotMatch(html, /id="loadMidi"/);
assert.doesNotMatch(html, /id="midiFileInput"/);
assert.doesNotMatch(html, /melodySlider|melodyWheel|melody-wheel|melodyReadout|melody-panel/);
assert.match(html, /id="previousChord"/);
assert.match(html, /id="nextChord"/);
assert.match(html, /id="playChart"/);
assert.match(html, /id="tempoRange"/);
assert.match(html, /id="autoAdvanceRandom"/);
assert.match(html, /id="streamMode"[^>]*type="checkbox"/);
assert.match(html, /title="Use a single stable rendered audio stream for car and Bluetooth playback\."[^>]*><input id="streamMode"[^>]*> Stream mode<\/label>/);
assert.match(html, /id="streamVisualDelay"[^>]*type="range"/);
assert.match(html, /id="streamVisualDelay"[^>]*min="0"/);
assert.match(html, /id="streamVisualDelay"[^>]*max="1500"/);
assert.match(html, /id="streamVisualDelay"[^>]*step="25"/);
assert.match(html, /id="streamVisualDelayValue"/);
assert.match(html, /id="chartSource"/);
assert.match(html, /id="instrumentView"/);
assert.match(html, /id="keyboardRangeMode"/);
assert.match(html, /option value="split">Split · 2 \+ 2<\/option>/);
assert.match(html, /option value="wide">Wide keyboard<\/option>/);
assert.match(html, /id="keyboardToneMode"/);
assert.match(html, /id="fretboardToneMode"/);
assert.match(html, /id="fretboardSoloOctave"/);
assert.match(html, /id="pianoVoicingStyle"/);
assert.match(html, /id="guitarVoicingStyle"/);
assert.match(html, /option value="root-shell"(?: selected)?>Root \+ shell<\/option>/);
assert.match(html, /option value="avant-garde">Avant-garde<\/option>/);
assert.match(html, /option value="chord-melody" selected>Chord melody<\/option>/);
assert.match(html, /option value="adjacent-strings">Adjacent strings<\/option>/);
assert.match(html, /option value="drop-2">Drop 2<\/option>/);
assert.match(html, /id="reharmLevel"/);
assert.match(html, /option value="0" selected>0 · Original<\/option>/);
assert.match(html, /option value="5">5 · Advanced<\/option>/);
assert.match(html, /id="melodyPiano"/);
assert.match(html, /id="melodyKeyboardPane"/);
assert.match(html, /id="fretboard"/);
assert.match(html, /src="miditar-midi\.js"/);
assert.match(html, /src="jazz-solo-catalog\.js"/);
assert.match(html, /src="wjazzd-solo-catalog\.js"/);
assert.match(html, /src="a-z-midi-catalog\.js"/);
assert.match(html, /src="standards-reharm\.js"/);
assert.match(html, /src="parkerize\.js"/);
assert.match(html, /id="midiAttribution"/);
assert.match(html, /id="midiStudy"/);
assert.match(html, /id="midiChorus"/);
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
assert.doesNotMatch(css, /melody-wheel|melody-panel/);
assert.match(css, /\.chord-navigator > button\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px[^}]*border:\s*1px solid/);
assert.match(css, /\.reharm-control select\s*\{[^}]*min-height:\s*28px/);
assert.match(css, /\.piano-voicing-control\s*\{[^}]*grid-column:\s*1 \/ -1/);
assert.match(css, /\.guitar-voicing-control/);
assert.match(css, /html, body\s*\{[^}]*touch-action:\s*manipulation/);
assert.match(css, /\.instrument-stage\s*\{[^}]*overflow-x:\s*auto/);
assert.match(css, /\.piano:is\(\[data-range-mode="full"\]/);
assert.match(css, /\.keyboard-stack\[data-range-mode="split"\]/);
assert.match(css, /\.fretboard-grid\s*\{[^}]*grid-template-rows:\s*repeat\(var\(--fretboard-string-count,\s*6\)/);
assert.match(css, /\.fretboard\[data-extended="true"\]\s*\{[^}]*width:\s*var\(--fretboard-min-width\)/);
assert.match(css, /\.fretboard-string\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--fretboard-column-count,\s*13\)/);
assert.match(css, /\.fretboard-position-markers/);
assert.match(css, /\.fret-position-selector\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--fretboard-column-count/);
assert.match(css, /\.fret-position-button\s*\{[^}]*min-height:\s*28px/);
assert.match(css, /\.fret-position-button\[aria-pressed="true"\]/);
assert.match(css, /\.library-filter/);
assert.match(css, /\.parkerize-panel/);
assert.match(css, /\.parkerize-controls/);
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
assert.match(js, /function navigateChord\(/);
assert.doesNotMatch(js, /melodyWheel|melodySlider|MELODY_WHEEL/);
assert.match(js, /function guitarChordMelodyShape\(/);
assert.match(js, /const FRETBOARD_MAX_FRETTED_SPAN = 4;/);
assert.match(js, /if \(span > FRETBOARD_MAX_FRETTED_SPAN\) return Infinity;/);
assert.match(js, /if \(fingerEstimate > 4\) return Infinity;/);
assert.match(js, /if \(!Number\.isFinite\(score\)\) return;/);
assert.match(js, /FRETBOARD_POSITION_STORAGE_KEY/);
assert.match(js, /FRETBOARD_SOLO_OCTAVE_STORAGE_KEY/);
assert.match(js, /state\.fretboardPositionAnchor/);
assert.match(js, /function fretboardSoloDisplayMidi\(/);
assert.match(js, /position\.fret >= anchor/);
assert.match(js, /voice\?\.kind === 'melody' \|\| anchor == null \|\| position\.fret >= anchor/);
assert.match(js, /positionButton\.className = 'fret-position-button'/);
assert.match(js, /positionButton\.setAttribute\('aria-pressed'/);
assert.match(js, /for \(let fret = 0; fret <= maxFret; fret \+= 1\)/);
assert.match(js, /state\.fretboardPositionAnchor === fret \? null : fret/);
assert.match(js, /localStorage\.removeItem\(FRETBOARD_POSITION_STORAGE_KEY\)/);
assert.match(js, /function visualTargets\(/);
assert.doesNotMatch(js, /function oneOctaveRangeForVoicing\(/);
assert.match(js, /state\.keyboardToneMode/);
assert.match(js, /state\.fretboardToneMode/);
assert.match(js, /state\.pianoVoicingStyle/);
assert.match(js, /state\.guitarVoicingStyle/);
assert.match(js, /GUITAR_VOICING_STORAGE_KEY/);
assert.match(js, /function guitarVoicesForStyle\(/);
assert.match(js, /adjacent-strings/);
assert.match(js, /stringsSpread !== selected\.length - 1/);
assert.match(js, /adjacentFallback/);
assert.match(js, /Theory\.makePianoVoicing/);
assert.match(js, /state\.reharmLevel/);
assert.match(js, /function chartForSource\(/);
assert.match(js, /Reharm\.reharmonizeBars/);
assert.match(js, /PIANO_VOICING_STORAGE_KEY/);
assert.match(js, /REHARM_LEVEL_STORAGE_KEY/);
assert.match(js, /voicing: state\.displayVoicing\.length \? state\.displayVoicing : state\.voicing/);
assert.match(js, /voicing: state\.fretboardVoicing, visual: 'fretboard-chord'/);
assert.match(js, /measure\.getBoundingClientRect\(\)/);
assert.match(js, /view\.getBoundingClientRect\(\)/);
assert.doesNotMatch(js, /measure\.offsetTop/);
assert.match(css, /\.chart-scroll\s*\{[^}]*scroll-behavior:\s*auto/);
assert.match(js, /element\.classList\.add\('root-tone'\)/);
assert.match(js, /element\.classList\.add\('chord-tone'\)/);
assert.match(js, /element\.classList\.add\('scale-tone'\)/);
assert.match(js, /key\.classList\.add\('melody-tone'\)/);
assert.match(js, /function startChartPlayback\(/);
assert.match(js, /const AUDIO_LATENCY_HINT = 'playback';/);
assert.match(js, /new AudioContextClass\(\{ latencyHint: AUDIO_LATENCY_HINT \}\)/);
assert.match(js, /const STREAM_MODE_STORAGE_KEY = 'keyer-jazz-stream-mode';/);
assert.match(js, /const STREAM_VISUAL_DELAY_STORAGE_KEY = 'keyer-jazz-stream-visual-delay-ms';/);
assert.match(js, /const STREAM_RENDER_TAIL_SECONDS = 0;/);
assert.match(js, /function streamModeAvailable\(/);
assert.match(js, /function renderStreamAudio\(/);
assert.match(js, /new OfflineAudioContextClass\(STREAM_CHANNELS, frameLength, STREAM_SAMPLE_RATE\)/);
assert.match(js, /function audioBufferToWavBlob\(/);
assert.match(js, /function waitForStreamMediaReady\(/);
assert.match(js, /deferStreamPreparation/);
assert.match(js, /audio\.addEventListener\('ended', handleStreamEnded\)/);
assert.match(js, /state\.transport\.streamMode/);
assert.match(js, /audio\.loop = !state\.transport\.autoAdvanceRandom/);
assert.match(js, /transitioning: false/);
assert.match(js, /!streamTransport\.transitioning/);
assert.match(js, /const DEFAULT_STREAM_VISUAL_DELAY_MS = 250;/);
assert.match(js, /streamVisualDelayMs:\s*DEFAULT_STREAM_VISUAL_DELAY_MS/);
assert.match(js, /localStorage\.getItem\(STREAM_VISUAL_DELAY_STORAGE_KEY\)/);
assert.match(js, /localStorage\.setItem\(STREAM_VISUAL_DELAY_STORAGE_KEY/);
assert.match(js, /elements\.streamVisualDelay\?\.addEventListener\('input'/);
assert.match(js, /state\.transport\.streamVisualDelayMs\s*\/\s*1000/);
assert.match(js, /const chord = event\?\.chord\?\.raw \|\| event\?\.chord\?\.display \|\| '';/);
assert.match(js, /function startLiveChartPlayback\(\{ startIndex = null \} = \{\}\)/);
const streamPlaybackSource = sourceForFunction('startStreamChartPlayback');
assert.doesNotMatch(
  streamPlaybackSource,
  /if \(!ready\) \{[\s\S]*?startLiveChartPlayback\(/,
  'A failed Stream render must remain a Stream-mode error, never silently fall back to the live Web Audio scheduler.'
);
assert.match(streamPlaybackSource, /if \(!ready\) \{[\s\S]*?streamTransport\.error/);
const streamAssetSource = sourceForFunction('prepareStreamAsset');
assert.match(
  streamAssetSource,
  /audio\.load\(\);[\s\S]*?await waitForStreamMediaReady\(audio\);/,
  'The replacement media source must be ready before an automatic stream handoff attempts playback.'
);
const streamVisualSource = sourceForFunction('syncStreamVisuals');
assert.match(
  streamVisualSource,
  /audioSeconds[\s\S]*?state\.transport\.streamVisualDelayMs\s*\/\s*1000/
);
assert.match(streamVisualSource, /visualSeconds\s*\/\s*secondsPerBeat/);
const restartStreamSource = sourceForFunction('restartStreamChartFromBeginning');
assert.match(restartStreamSource, /audio\.loop = !state\.transport\.autoAdvanceRandom/);
assert.match(restartStreamSource, /audio\.currentTime = 0;[\s\S]*?await audio\.play\(\);/);
assert.doesNotMatch(restartStreamSource, /audio\.src\s*=/, 'Repeats must reuse the already-buffered stream source.');
assert.doesNotMatch(restartStreamSource, /audio\.load\(\)/, 'Repeats must not tear down the media route.');
const streamEndedSource = sourceForFunction('handleStreamEnded');
assert.match(streamEndedSource, /if \(streamTransport\.audio\?\.loop\) return;/);
const streamRecoverySource = sourceForFunction('recoverAudioOutput');
assert.match(
  streamRecoverySource,
  /if \(state\.transport\.playing && state\.transport\.streamMode\) \{[\s\S]*?return;/,
  'Route recovery must not revive Web Audio underneath an active Stream session.'
);
const randomContinuationSource = sourceForFunction('continueWithRandomChart');
assert.match(randomContinuationSource, /await requestMidiSource\(\{ showAfterLoad: true, transport: true \}\);/);
assert.match(randomContinuationSource, /await startStreamChartPlayback\(\{ session, startIndex, continuation: true \}\);/);
assert.ok(
  randomContinuationSource.indexOf('await requestMidiSource({ showAfterLoad: true, transport: true })')
    < randomContinuationSource.indexOf('await startStreamChartPlayback({ session, startIndex, continuation: true })'),
  'Random-next must settle its MIDI/chart state before rendering and starting the next Stream asset.'
);
const loadedSongSource = sourceForFunction('applyLoadedSong');
assert.match(loadedSongSource, /const deferStreamPreparation = Boolean\(/);
assert.match(
  loadedSongSource,
  /if \(state\.transport\.streamMode && !deferStreamPreparation\) void prepareStreamAsset\(\)/,
  'A transition must not launch a competing background stream render before the final MIDI/chart state is known.'
);
assert.match(
  loadedSongSource,
  /state\.midiEntry && !preloadedMidi && !deferStreamPreparation\) \{\s*void requestMidiSource/,
  'A transition must not launch a competing MIDI download before Random-next awaits the final source.'
);
assert.match(js, /navigator\?\.audioSession/);
assert.doesNotMatch(js, /createMediaElementSource\(/);
assert.match(js, /function resumeAudioContext\(/);
assert.match(js, /function recoverAudioOutput\(/);
assert.match(js, /keepAliveSource = audioContext\.createConstantSource\(\)/);
assert.match(js, /window\.addEventListener\('pageshow', recoverAudioOutput\)/);
assert.match(js, /window\.addEventListener\('focus', recoverAudioOutput\)/);
assert.match(js, /AUDIO_START_LEAD_SECONDS/);
assert.match(js, /function restartChartFromBeginning\(/);
assert.match(js, /function continueWithRandomChart\(/);
assert.match(js, /function continueAfterChart\(/);
assert.match(js, /state\.transport\.autoAdvanceRandom/);
assert.match(js, /AUTO_ADVANCE_RANDOM_STORAGE_KEY/);
assert.match(js, /function buildMidiChart\(/);
assert.match(js, /pickupNotes/);
assert.doesNotMatch(js, /source\.slice\(0, 60\)/);
assert.match(js, /function buildMelodyNotes\(/);
assert.match(js, /const TabImport = window\.KeyerTabImport;/);
assert.match(js, /function activeFretboardStrings\(/);
assert.match(js, /function exactTabPositionsForNote\(/);
assert.match(js, /function tabPositionsForNote\(/);
assert.match(js, /function setTabPlayAllTracks\(/);
assert.match(js, /tabBarMarker \? `Bar \$\{bar\.barIndex \+ 1\}`/);
assert.match(js, /function loadTabCatalogSong\(/);
assert.match(js, /function loadLocalTabFile\(/);
assert.match(js, /state\.tabSource\?\.exactPositions/);
assert.match(js, /authored tab fingering/);
assert.match(js, /function midiChorusesForNotes\(/);
assert.match(js, /function selectMidiStudy\(/);
assert.match(js, /function selectMidiChorus\(/);
assert.match(js, /function soloStudyActive\(/);
assert.match(js, /function hydrateAzMidiSong\(/);
assert.match(js, /state\.azMidiSongs/);
assert.match(js, /song\.azMidiEntry/);
assert.match(js, /type: 'az-midi'/);
assert.match(js, /function parkerizeActive\(/);
assert.match(js, /const WJazzDSoloCatalog = window\.KeyerWJazzDSoloCatalog;/);
assert.match(js, /function inflateWJazzdBars\(/);
assert.match(js, /type: 'wjazzd-solo'/);
assert.match(js, /function installParkerizedSolo\(/);
assert.match(js, /function generateParkerizedChart\(/);
assert.match(js, /function exportParkerizedMidi\(/);
assert.match(js, /state\.midiEntry\?\.type === 'parkerize'/);
assert.match(js, /SoloCatalog\?\.findParkerSolo/);
assert.match(js, /showing only the solo line, \$\{positionDescription\}/);
assert.match(js, /visual octave down is on while MIDI playback remains at the written octave/);
assert.match(js, /if \(soloStudyActive\(\)\) return \{ voicing: state\.voicing, visual: 'chord' \}/);
assert.match(js, /function toggleMelody\(/);
assert.match(js, /function randomSelectionSongs\(\)\s*\{[\s\S]*const songs = matchingSongs\(''\);/);
assert.match(js, /FAVORITES_STORAGE_KEY/);
assert.match(js, /MELODY_VISIBILITY_STORAGE_KEY/);
assert.match(js, /function setMelodyVisibility\(/);
assert.doesNotMatch(js, /state\.showMelody = false;\s*state\.midiEntry/);
assert.match(js, /function toggleFavoriteSong\(/);
assert.match(js, /searchPickerPrimed/);
assert.match(js, /document\.addEventListener\('dblclick'/);
assert.match(js, /deferredFullKeyboardTaps/);
assert.match(js, /holdOnly: span\.startTick < barStartTick/);
assert.match(js, /button\.className = 'chart-hold'/);
assert.match(js, /function scheduleMelodyForSegment\(/);
assert.match(js, /chartEndBeat/);
assert.match(js, /event\.key === ' '[^\n]*event\.code === 'Space'[^\n]*event\.keyCode === 32/);
assert.doesNotMatch(js, /Math\.min\(note\.durationBeats, segmentEnd - note\.startBeat\)/);
assert.doesNotMatch(js, /elements\.(?:voicingNotes|scaleNotes|playVoicing)/);
assert.doesNotMatch(js, /elements\.(?:loadMidi|midiFileInput)/);

assert.match(desktopHtml, /<body class="desktop-mode">/);
assert.match(desktopHtml, /href="standards-desktop\.css"/);
assert.match(desktopHtml, /id="keyboardRangeMode"/);
assert.match(desktopHtml, /id="songAvailabilityFilter"/);
assert.match(desktopHtml, /option value="solos">Jazz solos<\/option>/);
assert.match(desktopHtml, /option value="parker">Charlie Parker solos<\/option>/);
assert.match(desktopHtml, /option value="legends">Jazz legend solos<\/option>/);
assert.match(desktopHtml, /option value="az-midi">A–Z MIDI songs<\/option>/);
assert.match(desktopHtml, /option value="tab-files">Tab files<\/option>/);
assert.match(desktopHtml, /id="openTabFile"/);
assert.match(desktopHtml, /id="tabFileInput"/);
assert.match(desktopHtml, /id="tabTrack"/);
assert.match(desktopHtml, /id="tabPlayAllTracks"/);
assert.match(desktopHtml, /src="vendor\/score-reader\/alphaTab\.min\.js"/);
assert.match(desktopHtml, /option value="parkerize">Parkerize<\/option>/);
assert.match(desktopHtml, /id="parkerizePanel"/);
assert.match(desktopHtml, /id="parkerizeChartComplexity"/);
assert.match(desktopHtml, /id="parkerizeSoloComplexity"/);
assert.match(desktopHtml, /id="exportParkerizeMidi"/);
assert.match(desktopHtml, /<script src="parkerize-corpus\.js"><\/script>\s*<script src="parkerize\.js"><\/script>/);
assert.match(desktopHtml, /option value="favorites">Favorites<\/option>/);
assert.match(desktopHtml, /id="favoriteSong"/);
assert.doesNotMatch(desktopHtml, /id="loadMidi"/);
assert.doesNotMatch(desktopHtml, /melodySlider|melodyWheel|melody-wheel|melodyReadout|melody-panel/);
assert.match(desktopHtml, /id="previousChord"/);
assert.match(desktopHtml, /id="nextChord"/);
assert.match(desktopHtml, /id="pianoVoicingStyle"/);
assert.match(desktopHtml, /id="guitarVoicingStyle"/);
assert.match(desktopHtml, /option value="adjacent-strings">Adjacent strings<\/option>/);
assert.match(desktopHtml, /class="library-actions"[\s\S]*id="randomSong"[\s\S]*id="playChart"/);
assert.match(desktopHtml, /id="reharmLevel"/);
assert.match(desktopHtml, /src="standards-reharm\.js"/);
assert.match(desktopHtml, /src="parkerize\.js"/);
assert.match(desktopHtml, /src="wjazzd-solo-catalog\.js"/);
assert.match(desktopHtml, /src="jazz-solo-catalog\.js"/);
assert.match(desktopHtml, /src="a-z-midi-catalog\.js"/);
assert.match(desktopHtml, /id="midiAttribution"/);
assert.match(desktopHtml, /id="midiStudy"/);
assert.match(desktopHtml, /id="midiChorus"/);
assert.match(desktopHtml, /id="autoAdvanceRandom"/);
assert.match(desktopHtml, /id="streamMode"[^>]*type="checkbox"/);
assert.match(desktopHtml, /title="Use a single stable rendered audio stream for car and Bluetooth playback\."[^>]*><input id="streamMode"[^>]*> Stream mode<\/label>/);
assert.match(desktopHtml, /id="streamVisualDelay"[^>]*type="range"/);
assert.match(desktopHtml, /id="streamVisualDelay"[^>]*min="0"/);
assert.match(desktopHtml, /id="streamVisualDelay"[^>]*max="1500"/);
assert.match(desktopHtml, /id="streamVisualDelay"[^>]*step="25"/);
assert.match(desktopHtml, /id="streamVisualDelayValue"/);
assert.doesNotMatch(desktopCss, /melody-wheel|melody-panel/);
assert.match(desktopCss, /\.desktop-mode \.workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(desktopCss, /\.desktop-mode \.fretboard\s*\{[^}]*min-height:\s*240px/);
assert.match(desktopCss, /\.desktop-mode \.display-options\s*\{[^}]*grid-template-columns:\s*repeat\(5/);

assert.equal(soloCatalog.parkerSolos.length, 50);
assert.equal(soloCatalog.findParkerSolo('The Anthropology')?.title, 'Anthropology');
assert.equal(soloCatalog.findParkerSolo("Billie’s Bounce")?.title, "Billie's Bounce");
assert.deepEqual(soloCatalog.findParkerSolos('I Got Rhythm').map(entry => entry.soloTitle), ['Chasing The Bird', 'Red Cross', 'Steeplechase']);
assert.deepEqual(soloCatalog.findParkerSolos('Honeysuckle Rose').map(entry => entry.soloTitle), ['Marmaduke']);
assert.equal(soloCatalog.findParkerSolos('Au Privave').length, 2);
assert.equal(wjazzdCatalog.entryCount, 441);
assert.equal(wjazzdCatalog.parkerCount, 17);
assert.equal(new Set(soloCatalog.parkerSolos.map(entry => entry.id)).size, 50);
assert.equal(soloCatalog.parkerSupplementalSongs().length, 24);
assert.equal(soloCatalog.isMiditarMultiChorus('Autumn Leaves'), true);
assert.ok(soloCatalog.multiChorusCount >= 300);

assert.equal(azMidiCatalog.fileCount, 2868);
assert.equal(azMidiCatalog.playableCount, 2844);
assert.equal(azMidiCatalog.entries.length, 2868);
assert.equal(azMidiCatalog.playableEntries.every(entry => entry.playable && entry.chordMarkers > 0 && entry.melodyNotes > 0), true);
assert.equal(new Set(azMidiCatalog.entries.map(entry => entry.file)).size, 2868);
azMidiCatalog.entries.forEach(entry => {
  assert.equal(fs.existsSync(path.join(root, 'a-z-midi', entry.file)), true, `Missing A–Z MIDI file: ${entry.file}`);
});

assert.equal(parkerCorpus.soloCount, 50);
assert.ok(parkerCorpus.noteCount > 20000);
assert.ok(parkerCorpus.phraseCount > 1500);

console.log('Jazz standards UI contract tests passed.');
