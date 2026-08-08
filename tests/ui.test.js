'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

function loadPlaywright() {
  try { return require('playwright'); } catch (_) {}
  const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (runtimeModules) {
    try { return require(path.join(runtimeModules, 'playwright')); } catch (_) {}
  }
  return null;
}

const playwright = loadPlaywright();
if (!playwright) {
  console.log('UI test skipped: Playwright is not installed.');
  process.exit(0);
}
const browserExecutable = playwright.chromium.executablePath();
if (!fs.existsSync(browserExecutable)) {
  console.log('UI test skipped: Playwright Chromium is not installed.');
  process.exit(0);
}

const root = path.resolve(__dirname, '..');
const music = 'T44*A{A-7 B7 C^7 D7|G^7|C^7|F#h7|B7|E-7|A7|D^7|G7|C^7|F7|Bb^7|Eb^7|Ab^7|D7|G-7|C7|F^7|Bb7|Eb^7}';
const fixture = `[url=irealb://Autumn%20Leaves=Kosma%20Joseph==Medium%20Swing=G-=1r34LbKcu7${encodeURIComponent(music)}===Jazz%20Fixture]Jazz Fixture[/url]`;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

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

function textBytes(value) { return Array.from(Buffer.from(value, 'utf8')); }
function meta(delta, type, payload) { return [...vlq(delta), 0xff, type, ...vlq(payload.length), ...payload]; }
function note(delta, status, midi, velocity) { return [...vlq(delta), status, midi, velocity]; }
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

function melodyMidiFixture() {
  const conductor = track([
    meta(0, 0x03, textBytes('Autumn Leaves')),
    meta(0, 0x51, [0x09, 0x27, 0xc0]), // 100 BPM
    meta(0, 0x58, [4, 2, 24, 8]),
    // The first marker is after a pickup. D7 deliberately lasts two full
    // bars, so the marker chart must render a hold rather than N.C.
    meta(960, 0x06, textBytes('Am7')),
    meta(960, 0x06, textBytes('D7')),
    meta(3840, 0x06, textBytes('Gmaj7')),
  ]);
  const melody = track([
    meta(0, 0x03, textBytes('Melody (BB)')),
    // C6 starts before the first marker and sustains across it.
    note(840, 0x90, 84, 100), // C6, deliberately outside the C3–C5 card
    note(720, 0x80, 84, 0),
    note(0, 0x90, 81, 100),
    note(240, 0x80, 81, 0),
    // A second Am7 note keeps the within-chord slider/grip regression
    // meaningful now that the C6 lead-in belongs to its own pickup event.
    note(0, 0x90, 83, 100),
    note(120, 0x80, 83, 0),
    note(240, 0x90, 79, 100),
    note(720, 0x80, 79, 0),
  ]);
  return Buffer.from([
    ...textBytes('MThd'),
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x01,
    0x00, 0x02,
    0x01, 0xe0,
    ...conductor,
    ...melody,
  ]);
}

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const requested = path.resolve(root, `.${pathname}`);
  if (!requested.startsWith(`${root}${path.sep}`) && requested !== root) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  const target = requested === root ? path.join(root, 'index.html') : requested;
  try {
    const body = fs.readFileSync(target);
    response.writeHead(200, { 'content-type': mime[path.extname(target)] || 'application/octet-stream' });
    response.end(body);
  } catch (_) {
    response.writeHead(404).end('Not found');
  }
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: browserExecutable,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.route(/(?:raw\.githubusercontent\.com|cdn\.jsdelivr\.net).*real(?:%20| )playlist\.txt/i, route => {
    route.fulfill({ status: 200, contentType: 'text/plain', body: fixture });
  });
  await page.route(/example-songs\.json/i, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ songs: [{ name: 'Autumn Leaves.mid', size: 1234 }] })
    });
  });
  await page.route(/example(?:%20| )midi(?:%20| )songs\/Autumn(?:%20| )Leaves\.mid/i, route => {
    route.fulfill({ status: 200, contentType: 'audio/midi', body: melodyMidiFixture() });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/standards.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.chart-chord.active');

  assert.equal(await page.locator('#songTitle').textContent(), 'Autumn Leaves');
  assert.match(await page.locator('#libraryStatus').textContent(), /1 jazz-standard chart/);
  assert.ok(await page.locator('.chart-chord').count() >= 4);
  assert.equal(await page.locator('.chart-chord[aria-current="true"]').count(), 1);
  assert.equal(await page.locator('.piano-key.white').count(), 15);
  assert.equal(await page.locator('.piano-key.black').count(), 10);
  assert.ok(await page.locator('.piano-key.root-tone').count() > 0);
  assert.ok(await page.locator('.piano-key.chord-tone').count() > 0);
  assert.ok(await page.locator('.piano-key.scale-tone').count() > 0);
  const voicingCount = Number(await page.locator('#piano').getAttribute('data-voicing-count'));
  assert.ok(voicingCount >= 4 && voicingCount <= 5);
  assert.equal(await page.locator('.piano-key.voicing .key-role').count(), voicingCount);
  assert.equal(await page.locator('.study-details, #voicingNotes, #scaleNotes, #playVoicing').count(), 0);
  const semanticColors = await page.evaluate(() => ['root-tone', 'chord-tone', 'scale-tone'].map(className => {
    const key = document.querySelector(`.piano-key.${className}`);
    return key ? getComputedStyle(key).backgroundColor : '';
  }));
  assert.equal(new Set(semanticColors).size, 3, 'Root, chord, and scale keys need distinct colors');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.piano-key')].every(key => (
    ['root-tone', 'chord-tone', 'scale-tone'].filter(className => key.classList.contains(className)).length <= 1
  ))), true, 'Piano color roles should be mutually exclusive');
  assert.ok(await page.locator('.piano-key .key-name').count() > 0);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.piano-key')].flatMap(key => {
    const label = key.querySelector('.key-name');
    const parsed = label && window.KeyerJazzTheory.parseNoteSpelling(label.textContent);
    return !parsed || parsed.pc === window.KeyerJazzTheory.mod(Number(key.dataset.midi))
      ? []
      : [`${key.dataset.midi}:${label.textContent}`];
  })), [], 'Every note label should name the physical piano key it appears on');
  const rolesBeforeToggle = await page.locator('.piano-key .key-role').count();
  await page.locator('#toggleNoteNames').click();
  assert.equal(await page.locator('.piano-key .key-name').count(), 0);
  assert.equal(await page.locator('.piano-key .key-role').count(), rolesBeforeToggle);
  assert.equal(await page.locator('#toggleNoteNames').getAttribute('aria-pressed'), 'false');
  await page.locator('#toggleNoteNames').click();

  const before = await page.locator('#chordProgress').textContent();
  await page.locator('#nextChord').click();
  const after = await page.locator('#chordProgress').textContent();
  assert.notEqual(after, before);

  await page.locator('.chart-chord').first().click();
  assert.equal(await page.locator('.piano-key.playing').count(), voicingCount, 'A chart click should play and light the whole voicing');

  async function assertMobileLayout(width, columns) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.evaluate(() => {
      const scroller = document.querySelector('#chartScroll');
      const chart = document.querySelector('#chart');
      const target = document.querySelector('.dense-measure .chart-chord');
      return {
        documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
        chartOverflow: scroller.scrollWidth - scroller.clientWidth,
        columns: getComputedStyle(chart).gridTemplateColumns.split(' ').filter(Boolean).length,
        targetWidth: target?.getBoundingClientRect().width || 0,
        targetHeight: target?.getBoundingClientRect().height || 0
      };
    });
    assert.ok(layout.documentOverflow <= 1, `${width}px page has ${layout.documentOverflow}px of horizontal overflow`);
    assert.ok(layout.chartOverflow <= 1, `${width}px chart has ${layout.chartOverflow}px of horizontal overflow`);
    assert.equal(layout.columns, columns, `${width}px chart column count`);
    assert.ok(layout.targetWidth >= 44, `${width}px dense chord target is ${layout.targetWidth}px wide`);
    assert.ok(layout.targetHeight >= 44, `${width}px dense chord target is ${layout.targetHeight}px tall`);
  }

  async function assertSelectedRowVisibility(width) {
    await page.setViewportSize({ width, height: 844 });

    async function selectAndMeasure(index, preScroll) {
      return page.evaluate(({ targetIndex, scroll }) => {
        const scroller = document.querySelector('#chartScroll');
        scroller.scrollTop = scroll === 'bottom' ? scroller.scrollHeight : 0;
        window.KeyerStandardsDebug.selectEvent(targetIndex, false);
        const selected = document.querySelector('.measure.selected');
        const viewRect = scroller.getBoundingClientRect();
        const rowRect = selected.getBoundingClientRect();
        const visibleTop = viewRect.top + scroller.clientTop;
        const visibleBottom = visibleTop + scroller.clientHeight;
        return {
          barIndex: selected.dataset.barIndex,
          topGap: rowRect.top - visibleTop,
          bottomGap: visibleBottom - rowRect.bottom
        };
      }, { targetIndex: index, scroll: preScroll });
    }

    const eventCount = await page.evaluate(() => window.KeyerStandardsDebug.state.events.length);
    const first = await selectAndMeasure(0, 'bottom');
    assert.ok(first.topGap >= -1 && first.bottomGap >= -1, `${width}px first selected row is clipped: ${JSON.stringify(first)}`);
    const last = await selectAndMeasure(eventCount - 1, 'top');
    assert.ok(last.topGap >= -1 && last.bottomGap >= -1, `${width}px last selected row is clipped: ${JSON.stringify(last)}`);

    const rapid = await page.evaluate(() => {
      const debug = window.KeyerStandardsDebug;
      debug.selectEvent(debug.state.events.length - 1, false);
      debug.selectEvent(0, false);
      debug.selectEvent(1, false);
      debug.selectEvent(2, false);
      const scroller = document.querySelector('#chartScroll');
      const selected = document.querySelector('.measure.selected');
      const viewRect = scroller.getBoundingClientRect();
      const rowRect = selected.getBoundingClientRect();
      const visibleTop = viewRect.top + scroller.clientTop;
      const visibleBottom = visibleTop + scroller.clientHeight;
      return { topGap: rowRect.top - visibleTop, bottomGap: visibleBottom - rowRect.bottom };
    });
    assert.ok(rapid.topGap >= -1 && rapid.bottomGap >= -1, `${width}px rapidly selected row is clipped: ${JSON.stringify(rapid)}`);
  }

  await assertMobileLayout(390, 4);
  await assertMobileLayout(320, 4);
  await assertSelectedRowVisibility(390);
  await assertSelectedRowVisibility(320);

  async function assertCompactPracticeLoop(width) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.evaluate(() => {
      window.scrollTo(0, 0);
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      const chart = rect('.chart-panel');
      const piano = rect('#piano');
      const navigator = rect('.chord-navigator');
      return {
        chartBottom: chart.bottom,
        pianoTop: piano.top,
        pianoBottom: piano.bottom,
        navigatorTop: navigator.top,
        navigatorBottom: navigator.bottom,
        viewportHeight: window.innerHeight
      };
    });
    assert.ok(
      layout.pianoTop >= layout.chartBottom - 1 && layout.pianoTop - layout.chartBottom <= 48,
      `${width}px piano should sit immediately below the chart: ${JSON.stringify(layout)}`
    );
    assert.ok(
      layout.navigatorTop >= layout.pianoBottom - 1 && layout.navigatorBottom <= layout.viewportHeight + 1,
      `${width}px keyboard navigation should share the visible practice view: ${JSON.stringify(layout)}`
    );
  }

  await assertCompactPracticeLoop(390);
  await assertCompactPracticeLoop(320);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.KeyerStandardsDebug.state.midiEntry !== null);
  assert.match(await page.locator('#midiStatus').textContent(), /Matching melody MIDI available/);
  await page.locator('#toggleMelody').click();
  await page.waitForFunction(() => (
    window.KeyerStandardsDebug.state.chartSource === 'midi'
    && window.KeyerStandardsDebug.state.melodyNotes.length > 0
  ));
  assert.equal(await page.locator('#chartSource').inputValue(), 'midi');
  assert.equal(await page.locator('#melodyPanel').isVisible(), true);
  assert.equal(await page.locator('#playMelody').isDisabled(), false);
  assert.equal(await page.locator('#tempoValue').textContent(), '100 BPM');
  const melodySliderPlacement = await page.evaluate(() => {
    const identity = document.querySelector('.chord-identity');
    const selectedChord = document.querySelector('#selectedChord');
    const panel = document.querySelector('#melodyPanel');
    const slider = document.querySelector('#melodySlider');
    const chordBounds = selectedChord.getBoundingClientRect();
    const sliderBounds = slider.getBoundingClientRect();
    return {
      panelInIdentity: identity.contains(panel),
      sliderInIdentity: identity.contains(slider),
      afterChord: sliderBounds.top >= chordBounds.bottom - 1
    };
  });
  assert.deepEqual(melodySliderPlacement, {
    panelInIdentity: true,
    sliderInIdentity: true,
    afterChord: true
  }, 'The melody slider should sit directly below the selected chord readout.');
  const melodyWheelChrome = await page.evaluate(() => {
    const wheel = document.querySelector('#melodyWheel');
    const readout = document.querySelector('#melodyReadout');
    return {
      visibleText: wheel.textContent.trim(),
      oldTextLabels: wheel.querySelectorAll('.melody-wheel-note').length,
      hasTread: Boolean(wheel.querySelector('.melody-wheel-tread')),
      hasSurface: Boolean(wheel.querySelector('.melody-wheel-surface')),
      readoutHidden: readout.classList.contains('sr-only'),
      surfaceTouchAction: getComputedStyle(wheel.querySelector('.melody-wheel-surface')).touchAction
    };
  });
  assert.deepEqual(melodyWheelChrome, {
    visibleText: '',
    oldTextLabels: 0,
    hasTread: true,
    hasSurface: true,
    readoutHidden: true,
    surfaceTouchAction: 'pan-y'
  }, 'The melody wheel should be a text-free tactile encoder while retaining hidden accessible status.');
  assert.equal(await page.locator('.piano-key.melody-tone[data-melody-midi="84"]').count(), 1);
  assert.equal(await page.locator('.piano-key.melody-tone .melody-octave').textContent(), 'C6');
  const midiSpans = await page.evaluate(() => {
    const debug = window.KeyerStandardsDebug;
    const { state } = debug;
    const firstChord = state.timeline.find(entry => entry.type === 'chord');
    const crossingPickup = state.melodyNotes.find(note => (
      note.startBeat < firstChord.startBeat && note.endBeat > firstChord.startBeat
    ));
    return {
      firstTimeline: state.timeline.slice(0, 3).map(entry => ({ type: entry.type, start: entry.startBeat, end: entry.endBeat })),
      events: state.events.slice(0, 2).map(event => ({
        kind: event.kind,
        chord: event.chord?.display || null,
        ownedMelody: debug.melodyNotesForEvent(event).map(note => note.midi)
      })),
      ordered: state.timeline.every((entry, index, timeline) => (
        !index || entry.startBeat >= timeline[index - 1].endBeat - .001
      )),
      holds: [...document.querySelectorAll('.chart-hold')].map(button => button.title),
      pickupMeasures: [...document.querySelectorAll('.pickup-measure')].map(measure => measure.textContent),
      crossingPickup: crossingPickup && {
        start: crossingPickup.startBeat,
        end: crossingPickup.endBeat,
        duration: crossingPickup.durationBeats,
        markerStart: firstChord.startBeat
      }
    };
  });
  assert.deepEqual(midiSpans.firstTimeline[0], { type: 'pickup', start: 0, end: 2 }, 'Pickup should be a real lead-in event before the first marker');
  assert.deepEqual(midiSpans.events, [
    { kind: 'pickup', chord: null, ownedMelody: [84] },
    { kind: 'chord', chord: 'Am7', ownedMelody: [81, 83] }
  ], 'Pickup notes must be owned by a zero/pickup event, never by the first chord.');
  assert.equal(midiSpans.ordered, true, 'MIDI marker spans must not create overlapping or zero-time rests');
  assert.ok(midiSpans.holds.some(title => /Hold D7/.test(title)), 'A chord held over a barline should render a carry mark, not N.C.');
  assert.ok(midiSpans.pickupMeasures.some(text => /Pickup.*C6/.test(text)), 'A melody pickup should receive its own labeled chart bar before the first chord');
  assert.ok(midiSpans.crossingPickup && midiSpans.crossingPickup.duration > midiSpans.crossingPickup.markerStart - midiSpans.crossingPickup.start, 'A pickup crossing a marker needs its full held duration');
  await page.locator('.chart-pickup').click();
  assert.deepEqual(await page.evaluate(() => ({
    activeIndex: window.KeyerStandardsDebug.state.activeIndex,
    kind: window.KeyerStandardsDebug.state.events[window.KeyerStandardsDebug.state.activeIndex]?.kind,
    selectedChord: document.querySelector('#selectedChord').textContent,
    scale: document.querySelector('#scaleName').textContent,
    progress: document.querySelector('#chordProgress').textContent,
    pickupActive: document.querySelector('.chart-pickup')?.getAttribute('aria-current')
  })), {
    activeIndex: 0,
    kind: 'pickup',
    selectedChord: 'Pickup',
    scale: 'Melody pickup',
    progress: '0 / 3',
    pickupActive: 'true'
  }, 'The visible blank pickup measure should be selectable as zero/pickup chord.');
  const distantPickup = await page.evaluate(() => {
    const chart = window.KeyerStandardsDebug.buildMidiChart({
      title: 'Distant pickup',
      ppq: 480,
      durationTicks: 7680,
      markers: [
        { type: 'marker', text: 'Ebmaj7', tick: 3840 },
        { type: 'marker', text: 'Ab7', tick: 5760 }
      ],
      tempos: [],
      timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }]
    }, [{ midi: 70, tick: 3360, endTick: 3840 }]);
    return chart.bars.slice(0, 3).map(bar => ({
      pickup: bar.pickup,
      startTick: bar.startTick,
      endTick: bar.endTick,
      chords: bar.chords.map(chord => chord.raw)
    }));
  });
  assert.deepEqual(distantPickup, [
    { pickup: false, startTick: 0, endTick: 1920, chords: [] },
    { pickup: true, startTick: 1920, endTick: 3840, chords: [] },
    { pickup: false, startTick: 3840, endTick: 5760, chords: ['Ebmaj7'] }
  ], 'A pickup near a later first downbeat should still get its own chart bar.');
  const multiBarPickup = await page.evaluate(() => {
    const chart = window.KeyerStandardsDebug.buildMidiChart({
      title: 'Two-bar pickup',
      ppq: 120,
      durationTicks: 1440,
      markers: [
        { type: 'marker', text: 'Cmaj7', tick: 960 }
      ],
      tempos: [],
      timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }]
    }, [
      { midi: 60, tick: 240, endTick: 360 },
      { midi: 62, tick: 720, endTick: 840 }
    ]);
    return chart.bars.slice(0, 3).map(bar => ({
      pickup: bar.pickup,
      pickupNotes: bar.pickupNotes.map(note => note.midi),
      startTick: bar.startTick,
      endTick: bar.endTick,
      chords: bar.chords.map(chord => chord.raw)
    }));
  });
  assert.deepEqual(multiBarPickup, [
    { pickup: true, pickupNotes: [60], startTick: 0, endTick: 480, chords: [] },
    { pickup: true, pickupNotes: [62], startTick: 480, endTick: 960, chords: [] },
    { pickup: false, pickupNotes: [], startTick: 960, endTick: 1440, chords: ['Cmaj7'] }
  ], 'Every bar containing a multi-bar lead-in needs its own zero/pickup event.');
  await page.locator('#keyboardRangeMode').selectOption('split');
  const splitIsolation = await page.evaluate(() => ({
    chordMelody: document.querySelectorAll('#piano .melody-tone').length,
    melodyChordTones: document.querySelectorAll('#melodyPiano .root-tone, #melodyPiano .chord-tone, #melodyPiano .scale-tone').length,
    melodyNotes: document.querySelectorAll('#melodyPiano .melody-tone').length
  }));
  assert.deepEqual(splitIsolation, { chordMelody: 0, melodyChordTones: 0, melodyNotes: 1 }, 'Split keyboards must keep chord and melody colors independent.');
  await page.locator('#keyboardRangeMode').selectOption('compact');
  const register = await page.evaluate(() => {
    const event = window.KeyerStandardsDebug.state.events[window.KeyerStandardsDebug.state.activeIndex];
    const melody = window.KeyerStandardsDebug.melodyNotesForEvent(event);
    return {
      topChord: Math.max(...window.KeyerStandardsDebug.state.displayVoicing.map(note => note.midi)),
      lowestMelody: Math.min(...melody.map(note => note.midi))
    };
  });
  assert.ok(register.topChord <= register.lowestMelody - 2, `Chord register (${register.topChord}) should sit under melody (${register.lowestMelody})`);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - window.innerWidth,
      chart: chartScroll.scrollWidth - chartScroll.clientWidth
    }));
    assert.ok(overflow.document <= 1, `${width}px melody controls overflow the page by ${overflow.document}px`);
    assert.ok(overflow.chart <= 1, `${width}px MIDI chart overflows by ${overflow.chart}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });

  // Full register is literal: it should include the actual MIDI range for
  // the whole current chart rather than folding C6 back into the card.
  await page.locator('#keyboardRangeMode').selectOption('full');
  const fullRegister = await page.evaluate(() => {
    const piano = document.querySelector('#piano');
    const stage = document.querySelector('.instrument-stage');
    const keys = [...document.querySelectorAll('.piano-key')].map(key => Number(key.dataset.midi));
    const melody = document.querySelector('.piano-key.melody-tone');
    return {
      rangeMode: piano.dataset.rangeMode,
      low: Number(piano.dataset.lowMidi),
      high: Number(piano.dataset.highMidi),
      keys,
      shownVoicing: window.KeyerStandardsDebug.state.displayVoicing.map(note => note.midi),
      melodyMidi: melody?.dataset.melodyMidi,
      melodyKeyMidi: melody?.dataset.midi,
      melodyOctaveBadge: melody?.querySelector('.melody-octave')?.textContent || '',
      melodyColor: melody ? getComputedStyle(melody).backgroundColor : '',
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      stageOverflow: stage.scrollWidth - stage.clientWidth
    };
  });
  assert.equal(fullRegister.rangeMode, 'full');
  assert.ok(fullRegister.keys.length > 25, 'Full register should show more than the compact two octaves');
  assert.ok(fullRegister.low <= 84 && fullRegister.high >= 84, 'Full register must include the actual C6 melody');
  assert.equal(fullRegister.melodyMidi, '84');
  assert.equal(fullRegister.melodyKeyMidi, '84', 'Full register must not fold the melody to another octave');
  assert.equal(fullRegister.melodyOctaveBadge, '', 'An in-range full-register melody needs no folded octave badge');
  assert.equal(fullRegister.melodyColor, 'rgb(165, 102, 255)', 'The entire active melody key should be purple');
  assert.ok(fullRegister.shownVoicing.every(midi => fullRegister.keys.includes(midi)), 'Full register must show the exact sounding chord voicing');
  assert.ok(fullRegister.documentOverflow <= 1, 'A full keyboard must not widen the mobile document');
  assert.ok(fullRegister.stageOverflow > 1, 'A long keyboard should scroll only inside its own stage');

  // The guitar view shows the pickup as melody only: it must not invent a
  // first-chord grip underneath the lead-in.
  await page.locator('#instrumentView').selectOption('fretboard');
  const fretboard = await page.evaluate(() => {
    const board = document.querySelector('#fretboard');
    const stage = document.querySelector('.instrument-stage');
    const rows = [...board.querySelectorAll('.fretboard-string')];
    const openMidis = rows.map(row => Number(row.querySelector('.fretboard-cell[data-fret="0"]')?.dataset.midi));
    const octaveMidis = rows.map(row => Number(row.querySelector('.fretboard-cell[data-fret="12"]')?.dataset.midi));
    const lastFret = Number(board.dataset.lastFret);
    const highMidis = rows.map(row => Number(row.querySelector(`.fretboard-cell[data-fret="${lastFret}"]`)?.dataset.midi));
    const melody = board.querySelector('.fretboard-cell.melody-tone');
    const melodyNote = melody?.querySelector('.fretboard-note');
    const voicing = [...board.querySelectorAll('.fretboard-cell.voicing')];
    const frettedVoicing = voicing.map(cell => Number(cell.dataset.fret)).filter(fret => fret > 0);
    const voices = voicing.map(cell => ({
      string: Number(cell.dataset.string),
      fret: Number(cell.dataset.fret),
      midi: Number(cell.dataset.midi),
      melody: cell.classList.contains('melody-tone'),
      bass: cell.classList.contains('bass')
    }));
    return {
      hidden: board.hidden,
      pianoHidden: document.querySelector('#piano').hidden,
      arrangement: board.dataset.arrangement,
      rowCount: rows.length,
      cellCount: board.querySelectorAll('.fretboard-cell').length,
      lastFret,
      colCount: Number(board.getAttribute('aria-colcount')),
      openMidis,
      octaveMidis,
      highMidis,
      melodyMidi: melody?.dataset.melodyMidi,
      melodyBadge: melody?.querySelector('.melody-octave')?.textContent || '',
      melodyColor: melodyNote ? getComputedStyle(melodyNote).backgroundColor : '',
      melodyString: Number(melody?.dataset.string),
      melodyPhysicalMidi: Number(melody?.dataset.midi),
      voices,
      voicingStrings: voicing.map(cell => Number(cell.dataset.string)),
      fretSpan: frettedVoicing.length ? Math.max(...frettedVoicing) - Math.min(...frettedVoicing) : 0,
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      stageOverflow: stage.scrollWidth - stage.clientWidth,
      stageScrollLeft: stage.scrollLeft
    };
  });
  assert.equal(fretboard.hidden, false);
  assert.equal(fretboard.pianoHidden, true);
  assert.equal(fretboard.arrangement, 'melody-pickup');
  assert.equal(fretboard.rowCount, 6);
  assert.equal(fretboard.lastFret, 20, 'C6 should extend high E from fret 12 through its real fret 20.');
  assert.equal(fretboard.colCount, 21, 'Open through fret 20 needs 21 accessible fret columns.');
  assert.equal(fretboard.cellCount, 126, 'Six strings with open through fret 20 should give 126 cells');
  assert.deepEqual(fretboard.openMidis, [64, 59, 55, 50, 45, 40]);
  assert.deepEqual(fretboard.octaveMidis, [76, 71, 67, 62, 57, 52]);
  assert.deepEqual(fretboard.highMidis, [84, 79, 75, 70, 65, 60]);
  assert.equal(fretboard.melodyMidi, '84');
  assert.equal(fretboard.melodyBadge, '', 'An extended neck should show the C6 melody in its real guitar octave, not as a folded badge.');
  assert.equal(fretboard.melodyColor, 'rgb(165, 102, 255)', 'The fretboard melody marker should be purple');
  assert.ok(fretboard.melodyString <= 2, `The melody should prefer one of the top three guitar strings, got string ${fretboard.melodyString}`);
  assert.equal(fretboard.melodyPhysicalMidi, 84, 'C6 should occupy its literal physical fretboard MIDI.');
  assert.equal(fretboard.voices.length, 0, 'A pickup must not borrow or render the first chord voicing.');
  assert.equal(await page.locator('#fretboard .root-tone, #fretboard .chord-tone, #fretboard .scale-tone').count(), 0, 'Pickup view should show only the purple melody note.');
  assert.ok(fretboard.documentOverflow <= 1, 'An extended fretboard must not widen the mobile document');
  assert.ok(fretboard.stageOverflow > 1, 'An extended neck should scroll inside the instrument stage instead of shrinking its frets.');
  assert.ok(fretboard.stageScrollLeft > 0, 'The current high purple melody should be brought into the extended-neck viewport.');
  const extendedFretPan = await page.evaluate(() => {
    const board = document.querySelector('#fretboard');
    const highFret = board.querySelector('.fretboard-cell[data-string="0"][data-fret="20"]');
    const down = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 901, clientX: 270, clientY: 180 });
    highFret.dispatchEvent(down);
    const result = {
      prevented: down.defaultPrevented,
      captured: board.hasPointerCapture?.(901) || false
    };
    highFret.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, cancelable: true, pointerId: 901, clientX: 220, clientY: 180 }));
    return result;
  });
  assert.deepEqual(extendedFretPan, {
    prevented: false,
    captured: false
  }, 'An extended guitar neck must defer a drag to the horizontal stage instead of capturing it as a held fret.');

  // A chord-melody grip is chosen for the chord occurrence, not revoiced for
  // every note the learner scrubs through. The purple marker is free to move
  // through that held harmony, but the fretted chord should stay put until a
  // new chart chord is selected.
  async function guitarChordMelodySnapshot() {
    return page.evaluate(() => {
      const board = document.querySelector('#fretboard');
      const heldGrip = [...board.querySelectorAll('.fretboard-cell.chord-melody-tone')]
        .map(cell => ({
          string: Number(cell.dataset.string),
          fret: Number(cell.dataset.fret),
          midi: Number(cell.dataset.midi),
          role: cell.querySelector('.fretboard-role')?.textContent || ''
        }))
        .sort((left, right) => left.string - right.string || left.fret - right.fret);
      const melody = [...board.querySelectorAll('.fretboard-cell.melody-tone')].map(cell => ({
        string: Number(cell.dataset.string),
        fret: Number(cell.dataset.fret),
        midi: Number(cell.dataset.midi),
        sourceMidi: Number(cell.dataset.melodyMidi)
      }));
      return {
        activeIndex: window.KeyerStandardsDebug.state.activeIndex,
        chord: document.querySelector('#selectedChord').textContent,
        slider: Number(document.querySelector('#melodySlider').value),
        heldGrip,
        melody
      };
    });
  }

  // Chord-melody work starts only at the first actual marker/downbeat.
  await page.evaluate(() => window.KeyerStandardsDebug.selectEvent(1, false));
  const firstMelodyGrip = await guitarChordMelodySnapshot();
  await page.locator('#melodySlider').evaluate(element => {
    element.value = '2';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const laterMelodyGrip = await guitarChordMelodySnapshot();
  assert.equal(firstMelodyGrip.slider, 1, 'The song-wide melody wheel should start on Am7’s first note after the pickup.');
  assert.equal(laterMelodyGrip.slider, 2, 'The song-wide melody wheel should advance to Am7’s second note.');
  assert.equal(laterMelodyGrip.activeIndex, firstMelodyGrip.activeIndex, 'Melody scrubbing must stay on the same chart chord');
  assert.equal(laterMelodyGrip.chord, firstMelodyGrip.chord, 'Melody scrubbing must not replace the current chord');
  assert.equal(firstMelodyGrip.melody.length, 1, 'A chord-melody grip should have one purple melody marker');
  assert.deepEqual(firstMelodyGrip.melody[0], {
    string: 0,
    fret: 17,
    midi: 81,
    sourceMidi: 81
  }, 'The extended-neck chord-melody solver must retain A5 at its literal fret 17.');
  assert.equal(laterMelodyGrip.melody.length, 1, 'Only one purple melody marker should move at a time');
  assert.notDeepEqual(laterMelodyGrip.melody[0], firstMelodyGrip.melody[0], 'The purple melody marker should follow the newly selected melody note');
  assert.deepEqual(
    laterMelodyGrip.heldGrip,
    firstMelodyGrip.heldGrip,
    'Advancing melody notes inside one chord must keep the chosen guitar chord grip fixed'
  );

  await page.evaluate(() => window.KeyerStandardsDebug.selectEvent(2, false));
  const nextChordGrip = await guitarChordMelodySnapshot();
  assert.notEqual(nextChordGrip.activeIndex, laterMelodyGrip.activeIndex, 'Selecting the next harmony should leave the prior chord occurrence');
  assert.notEqual(nextChordGrip.chord, laterMelodyGrip.chord, 'The next chart event should be a different chord');
  assert.notDeepEqual(nextChordGrip.heldGrip, firstMelodyGrip.heldGrip, 'A new chord should receive its own playable chord-melody grip');
  await page.evaluate(() => window.KeyerStandardsDebug.selectEvent(1, false));

  // Return the rest of the MIDI interaction regressions to their default
  // compact piano surface.
  await page.locator('#instrumentView').selectOption('piano');
  await page.locator('#keyboardRangeMode').selectOption('compact');

  await page.locator('#melodySlider').evaluate(element => {
    element.value = '2';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.locator('.piano-key.melody-tone[data-melody-midi="83"]').count(), 1, 'Slider should move the actual melody note');
  assert.ok(await page.locator('.piano-key.playing').count() >= 1, 'Scrubbing a melody note should audition it');

  // The melody wheel is song-wide. Moving from its pickup note into index 1
  // must select the first marker chord, rather than putting both notes under
  // that chord’s local slider.
  await page.locator('#melodySlider').evaluate(element => {
    element.value = '0';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.deepEqual(await page.evaluate(() => ({
    activeIndex: window.KeyerStandardsDebug.state.activeIndex,
    chord: document.querySelector('#selectedChord').textContent,
    melody: window.KeyerStandardsDebug.state.activeMelodyNote?.midi,
    slider: Number(document.querySelector('#melodySlider').value)
  })), { activeIndex: 0, chord: 'Pickup', melody: 84, slider: 0 }, 'Wheel index zero must select and audition the separate pickup.');
  await page.locator('#melodySlider').evaluate(element => {
    element.value = '1';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.deepEqual(await page.evaluate(() => ({
    activeIndex: window.KeyerStandardsDebug.state.activeIndex,
    chord: document.querySelector('#selectedChord').textContent,
    melody: window.KeyerStandardsDebug.state.activeMelodyNote?.midi,
    slider: Number(document.querySelector('#melodySlider').value)
  })), { activeIndex: 1, chord: 'Am7', melody: 81, slider: 1 }, 'Wheel index one must enter the first chord on its own first melody onset.');
  await page.locator('#melodySlider').focus();
  await page.keyboard.press('ArrowRight');
  const sliderKeyboardResult = await page.evaluate(() => ({
    activeIndex: window.KeyerStandardsDebug.state.activeIndex,
    value: Number(document.querySelector('#melodySlider').value),
    max: Number(document.querySelector('#melodySlider').max),
    melodyMidi: document.querySelector('#piano').dataset.melodyMidi
  }));
  assert.equal(sliderKeyboardResult.value, 2, 'Native keyboard range input should advance one note through the global melody wheel.');
  assert.equal(sliderKeyboardResult.melodyMidi, '83', 'Native keyboard range input should show the later melody note');
  assert.equal(sliderKeyboardResult.activeIndex, 1, 'The second Am7 melody note should stay in the first chord.');

  const touchWheelAxisAndMotion = await page.evaluate(() => {
    const wheel = document.querySelector('#melodyWheel');
    const surface = wheel.querySelector('.melody-wheel-surface');
    const slider = document.querySelector('#melodySlider');
    const makePointer = (type, pointerId, clientX, clientY) => new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: 'touch',
      clientX,
      clientY,
      button: 0
    });
    const before = wheel.style.getPropertyValue('--melody-wheel-roll');
    const beforeValue = Number(slider.value);
    surface.dispatchEvent(makePointer('pointerdown', 81, 100, 100));
    const fractionalMove = makePointer('pointermove', 81, 109, 100);
    surface.dispatchEvent(fractionalMove);
    const during = wheel.style.getPropertyValue('--melody-wheel-roll');
    const duringValue = Number(slider.value);
    surface.dispatchEvent(makePointer('pointerup', 81, 109, 100));

    surface.dispatchEvent(makePointer('pointerdown', 82, 100, 100));
    const verticalMove = makePointer('pointermove', 82, 102, 132);
    surface.dispatchEvent(verticalMove);
    const verticalPrevented = verticalMove.defaultPrevented;
    const afterVerticalValue = Number(slider.value);
    surface.dispatchEvent(makePointer('pointerup', 82, 102, 132));
    const verticalWheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });
    surface.dispatchEvent(verticalWheel);
    return {
      before,
      during,
      beforeValue,
      duringValue,
      fractionalPrevented: fractionalMove.defaultPrevented,
      verticalPrevented,
      afterVerticalValue,
      verticalWheelPrevented: verticalWheel.defaultPrevented
    };
  });
  assert.notEqual(touchWheelAxisAndMotion.during, touchWheelAxisAndMotion.before, 'A fractional horizontal touch drag should visibly roll the tread before the next note detent.');
  assert.equal(touchWheelAxisAndMotion.duringValue, touchWheelAxisAndMotion.beforeValue, 'A fractional drag must not advance the note until it crosses a detent.');
  assert.equal(touchWheelAxisAndMotion.fractionalPrevented, true, 'Horizontal touch drags should be claimed by the melody encoder.');
  assert.equal(touchWheelAxisAndMotion.verticalPrevented, false, 'Vertical touch drags over the melody wheel must remain available for page scrolling.');
  assert.equal(touchWheelAxisAndMotion.afterVerticalValue, touchWheelAxisAndMotion.beforeValue, 'A vertical scroll gesture must not change the selected melody note.');
  assert.equal(touchWheelAxisAndMotion.verticalWheelPrevented, false, 'An ordinary vertical mouse wheel should scroll the page instead of changing the melody.');

  // The wheel surface itself is an encoder. A real rightward drag must cross
  // the barline to D7, rather than bubbling into the study-card swipe handler
  // and accidentally going backward to the pickup.
  await page.locator('#melodySlider').scrollIntoViewIfNeeded();
  const wheelBox = await page.locator('#melodySlider').boundingBox();
  assert.ok(wheelBox, 'Melody wheel should have a visible pointer target.');
  await page.mouse.move(wheelBox.x + wheelBox.width / 2, wheelBox.y + wheelBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(wheelBox.x + wheelBox.width - 6, wheelBox.y + wheelBox.height / 2, { steps: 5 });
  await page.mouse.up();
  assert.deepEqual(await page.evaluate(() => ({
    activeIndex: window.KeyerStandardsDebug.state.activeIndex,
    slider: Number(document.querySelector('#melodySlider').value),
    melody: document.querySelector('#piano').dataset.melodyMidi,
    chord: document.querySelector('#selectedChord').textContent
  })), {
    activeIndex: 2,
    slider: 3,
    melody: '79',
    chord: 'D7'
  }, 'A rightward encoder drag should advance into the next chord, never back into the pickup.');

  // With MIDI markers selected, the chord arrows become a phrase navigator:
  // pickup notes first, then one note at a time inside each chord.
  await page.evaluate(() => window.KeyerStandardsDebug.selectEvent(0, false));
  assert.equal(await page.locator('#nextChord').getAttribute('aria-label'), 'Play pickup melody');
  await page.locator('#nextChord').click();
  const firstMidiArrow = await page.evaluate(() => ({
    activeIndex: window.KeyerStandardsDebug.state.activeIndex,
    melodyMidi: window.KeyerStandardsDebug.state.activeMelodyNote?.midi,
    cursor: window.KeyerStandardsDebug.state.melodyCursor
  }));
  assert.deepEqual(firstMidiArrow, { activeIndex: 0, melodyMidi: 84, cursor: 0 }, 'First MIDI arrow should play the pickup without a chord.');
  assert.equal(await page.locator('#nextChord').getAttribute('aria-label'), 'Next chord and first melody note');
  await page.locator('#nextChord').click();
  const secondMidiArrow = await page.evaluate(() => ({
    activeIndex: window.KeyerStandardsDebug.state.activeIndex,
    melodyMidi: window.KeyerStandardsDebug.state.activeMelodyNote?.midi,
    cursor: window.KeyerStandardsDebug.state.melodyCursor
  }));
  assert.deepEqual(secondMidiArrow, { activeIndex: 1, melodyMidi: 81, cursor: 0 }, 'Second MIDI arrow should enter the first chord at its own downbeat.');
  assert.equal(await page.locator('#nextChord').getAttribute('aria-label'), 'Next melody note');
  await page.locator('#nextChord').click();
  const nextChordMidiArrow = await page.evaluate(() => ({
    activeIndex: window.KeyerStandardsDebug.state.activeIndex,
    melodyMidi: window.KeyerStandardsDebug.state.activeMelodyNote?.midi,
    cursor: window.KeyerStandardsDebug.state.melodyCursor
  }));
  assert.deepEqual(nextChordMidiArrow, { activeIndex: 1, melodyMidi: 83, cursor: 1 }, 'Second note should remain inside the first chord.');
  assert.equal(await page.locator('#nextChord').getAttribute('aria-label'), 'Next chord and first melody note');
  await page.locator('#nextChord').click();
  const followingChordMidiArrow = await page.evaluate(() => ({
    activeIndex: window.KeyerStandardsDebug.state.activeIndex,
    melodyMidi: window.KeyerStandardsDebug.state.activeMelodyNote?.midi,
    cursor: window.KeyerStandardsDebug.state.melodyCursor
  }));
  assert.deepEqual(followingChordMidiArrow, { activeIndex: 2, melodyMidi: 79, cursor: 0 }, 'Only after the final first-chord note should MIDI navigation enter the next harmony.');
  await page.locator('#previousChord').click();
  const reverseMidiArrow = await page.evaluate(() => ({
    activeIndex: window.KeyerStandardsDebug.state.activeIndex,
    melodyMidi: window.KeyerStandardsDebug.state.activeMelodyNote?.midi,
    cursor: window.KeyerStandardsDebug.state.melodyCursor
  }));
  assert.deepEqual(reverseMidiArrow, { activeIndex: 1, melodyMidi: 83, cursor: 1 }, 'Previous MIDI arrow should return to the prior chord’s last melody note');
  await page.locator('#previousChord').click();
  assert.deepEqual(await page.evaluate(() => ({
    activeIndex: window.KeyerStandardsDebug.state.activeIndex,
    melodyMidi: window.KeyerStandardsDebug.state.activeMelodyNote?.midi,
    cursor: window.KeyerStandardsDebug.state.melodyCursor
  })), { activeIndex: 1, melodyMidi: 81, cursor: 0 }, 'Previous MIDI arrow should continue note-by-note inside a chord');
  await page.locator('#previousChord').click();
  assert.deepEqual(await page.evaluate(() => ({
    activeIndex: window.KeyerStandardsDebug.state.activeIndex,
    melodyMidi: window.KeyerStandardsDebug.state.activeMelodyNote?.midi,
    cursor: window.KeyerStandardsDebug.state.melodyCursor
  })), { activeIndex: 0, melodyMidi: 84, cursor: 0 }, 'Previous MIDI arrow should return from the first chord to the separate pickup.');
  await page.evaluate(() => window.KeyerStandardsDebug.selectEvent(3, false));
  assert.equal(await page.locator('#nextChord').getAttribute('aria-label'), 'Play this chord');
  await page.locator('#nextChord').click();
  assert.equal(
    await page.evaluate(() => window.KeyerStandardsDebug.state.activeIndex),
    3,
    'The first MIDI arrow on a chord under a melody rest should sound that chord instead of skipping it'
  );
  assert.equal(await page.locator('#nextChord').getAttribute('aria-label'), 'Next chord');
  await page.evaluate(() => window.KeyerStandardsDebug.selectEvent(0, false));

  await page.locator('#playChart').click();
  assert.equal(await page.locator('#playChart').textContent(), 'Stop chart');
  assert.equal(await page.evaluate(() => window.KeyerStandardsDebug.state.transport.playing), true);
  assert.equal(await page.locator('.piano-key.melody-tone').count(), 0, 'Transport must wait for the real melody onset instead of previewing a future note');
  await page.waitForFunction(() => (
    window.KeyerStandardsDebug.state.activeIndex === 1
    && window.KeyerStandardsDebug.state.activeMelodyNote?.midi === 84
  ), undefined, { timeout: 2200 });
  const pickupTransition = await page.evaluate(() => ({
    chord: document.querySelector('#selectedChord').textContent,
    voicingCount: window.KeyerStandardsDebug.state.voicing.length,
    sliderMelody: document.querySelector('#melodyReadout').textContent,
    visibleMelody: document.querySelector('#piano').dataset.melodyMidi
  }));
  assert.equal(pickupTransition.chord, 'Am7');
  assert.ok(pickupTransition.voicingCount > 0, 'The first marker should start its chord accompaniment.');
  assert.match(pickupTransition.sliderMelody, /^C6 · pickup · 1 \/ 4$/);
  assert.equal(pickupTransition.visibleMelody, '84', 'The held pickup should remain visible through the first chord marker.');
  await page.locator('#playChart').click();
  assert.equal(await page.evaluate(() => window.KeyerStandardsDebug.state.transport.playing), false);
  await page.locator('#useChartTempo').click();
  await page.locator('#tempoRange').evaluate(element => {
    element.value = '86';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.locator('#tempoValue').textContent(), '86 BPM');

  const markerlessFallback = await page.evaluate(() => {
    const debug = window.KeyerStandardsDebug;
    const markerlessMidi = { ...debug.state.midi, markers: [] };
    debug.installMidiSource(markerlessMidi, { name: 'melody-only.mid', title: 'Melody only' });
    return {
      source: debug.state.chartSource,
      midiChart: Boolean(debug.state.midiChart),
      melodyVisible: debug.state.showMelody,
      panelHidden: document.querySelector('#melodyPanel').hidden,
      playMelodyDisabled: document.querySelector('#playMelody').disabled
    };
  });
  assert.deepEqual(markerlessFallback, {
    source: 'ireal',
    midiChart: false,
    melodyVisible: true,
    panelHidden: false,
    playMelodyDisabled: false
  }, 'A melody-only MIDI should remain usable over the current iReal form');

  const lowMelodyRegister = await page.evaluate(() => {
    const debug = window.KeyerStandardsDebug;
    debug.installMidiSource({
      title: 'Low melody register',
      ppq: 120,
      durationTicks: 480,
      markers: [{ type: 'marker', text: 'Ab', tick: 0 }],
      tempos: [{ bpm: 100 }],
      timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
      tracks: [{
        index: 0,
        name: 'Melody',
        notes: [{ midi: 45, tick: 0, endTick: 480, durationTicks: 480, channel: 0, trackIndex: 0 }]
      }]
    }, { name: 'low-register.mid', title: 'Low melody register' });
    const { state } = debug;
    return {
      source: state.chartSource,
      range: state.displayRange,
      voicing: state.displayVoicing.map(note => note.midi),
      melody: state.melodyNotes[0].midi,
      pianoKeys: document.querySelectorAll('.piano-key').length
    };
  });
  assert.equal(lowMelodyRegister.source, 'midi');
  assert.equal(lowMelodyRegister.pianoKeys, 25, 'The shifted register remains a two-octave 15/10-key card');
  assert.ok(Math.max(...lowMelodyRegister.voicing) < lowMelodyRegister.melody, 'Low melody notes shift the audible root-bass voicing underneath the melody');
  assert.ok(lowMelodyRegister.voicing.every(midi => midi >= lowMelodyRegister.range.low && midi <= lowMelodyRegister.range.high), 'The shifted card shows the exact audible voicing');

  // A melody already inside the 0–12-fret board should retain its actual
  // sounding octave; only out-of-board notes receive an octave-equivalent
  // display with a badge.
  await page.locator('#instrumentView').selectOption('fretboard');
  const lowMelodyFretboard = await page.evaluate(() => {
    const board = document.querySelector('#fretboard');
    const melody = board.querySelector('.fretboard-cell.melody-tone');
    return {
      midi: melody?.dataset.melodyMidi,
      string: Number(melody?.dataset.string),
      physicalMidi: Number(melody?.dataset.midi),
      badge: melody?.querySelector('.melody-octave')?.textContent || '',
      lastFret: Number(board.dataset.lastFret),
      cellCount: board.querySelectorAll('.fretboard-cell').length,
      extended: board.dataset.extended
    };
  });
  assert.equal(lowMelodyFretboard.midi, '45');
  assert.ok(lowMelodyFretboard.string >= 3, 'A2 should remain on a physically appropriate lower guitar string.');
  assert.equal(lowMelodyFretboard.physicalMidi, 45, 'An in-board melody note must stay in its written/sounding octave.');
  assert.equal(lowMelodyFretboard.badge, '', 'A literal in-board melody needs no displaced-octave badge.');
  assert.equal(lowMelodyFretboard.lastFret, 12, 'A song without a high melody should retain the compact first-position neck.');
  assert.equal(lowMelodyFretboard.cellCount, 78, 'The normal neck remains six strings by open-through-12 frets.');
  assert.equal(lowMelodyFretboard.extended, 'false');

  if (process.env.KEYER_SCREENSHOT) await page.screenshot({ path: process.env.KEYER_SCREENSHOT, fullPage: true });
  await browser.close();
  server.close();
  console.log('Jazz standards mobile UI test passed.');
})().catch(error => {
  server.close();
  console.error(error);
  process.exitCode = 1;
});
