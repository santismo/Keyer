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
    // A second Am7 note keeps the within-chord arrow/grip regression
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
  const libraryActionLayout = await page.evaluate(() => {
    const random = document.querySelector('#randomSong').getBoundingClientRect();
    const play = document.querySelector('#playChart').getBoundingClientRect();
    return {
      sameLeft: Math.abs(random.left - play.left) < 1,
      sameWidth: Math.abs(random.width - play.width) < 1,
      belowRandom: play.top >= random.bottom + 6
    };
  });
  assert.deepEqual(libraryActionLayout, { sameLeft: true, sameWidth: true, belowRandom: true }, 'Play chart should sit directly under Random in the library controls.');
  assert.equal(await page.locator('#songSearch').inputValue(), '', 'The selected standard must not occupy the search field.');
  await page.locator('#songSearch').click();
  await page.waitForSelector('#searchResults:not([hidden])');
  assert.deepEqual(await page.evaluate(() => ({
    open: !document.querySelector('#searchResults').hidden,
    focused: document.activeElement === document.querySelector('#songSearch')
  })), { open: true, focused: false }, 'The first tap should browse standards without opening the mobile keyboard.');
  await page.locator('#songSearch').click();
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'songSearch', 'A second tap should enter normal typing mode.');
  await page.locator('#songSearch').fill('autumn');
  assert.ok(await page.locator('#searchResults .result-button').count() >= 1, 'Typing after the second tap should filter the open song list.');
  await page.locator('#searchResults .result-button').first().click();
  assert.equal(await page.locator('#songSearch').inputValue(), '', 'Choosing a standard must clear the search text instead of replacing it with the song title.');
  assert.equal(await page.locator('#favoriteSong').getAttribute('aria-pressed'), 'false');
  await page.locator('#favoriteSong').click();
  assert.deepEqual(await page.evaluate(() => ({
    pressed: document.querySelector('#favoriteSong').getAttribute('aria-pressed'),
    glyph: document.querySelector('#favoriteSong').textContent,
    favorites: JSON.parse(localStorage.getItem('keyer-jazz-standard-favorites') || '[]')
  })), { pressed: 'true', glyph: '★', favorites: ['autumn leaves::kosma joseph::g-'] }, 'Starring a standard should persist a stable favorite identity.');
  await page.locator('#songAvailabilityFilter').selectOption('favorites');
  await page.waitForSelector('#searchResults:not([hidden])');
  assert.equal(await page.locator('#searchResults .result-button').count(), 1, 'Favorites should be available as their own library bank.');
  await page.locator('#songAvailabilityFilter').selectOption('all');
  await page.keyboard.press('Escape');
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

  const pianoStyles = ['root-shell', 'shell', 'rootless', 'closed', 'spread', 'upper-structure', 'modern', 'cluster', 'avant-garde'];
  for (const style of pianoStyles) {
    await page.locator('#pianoVoicingStyle').selectOption(style);
    const grip = await page.evaluate(() => {
      const { state } = window.KeyerStandardsDebug;
      const midis = state.voicing.map(note => note.midi);
      const upper = state.voicing.filter(note => !note.bass).map(note => note.midi);
      return {
        style: state.pianoVoicingStyle,
        count: midis.length,
        span: Math.max(...midis) - Math.min(...midis),
        upperSpan: upper.length > 1 ? Math.max(...upper) - Math.min(...upper) : 0,
        root: state.events[state.activeIndex]?.chord?.root,
        pcs: state.voicing.map(note => note.pc),
        storage: localStorage.getItem('keyer-jazz-piano-voicing-style')
      };
    });
    assert.equal(grip.style, style);
    assert.equal(grip.storage, style, `${style} should persist`);
    assert.ok(grip.count >= 3 && grip.count <= 5, `${style} should use a practical number of fingers`);
    assert.ok(grip.upperSpan <= (style === 'cluster' ? 7 : 12), `${style} upper chord hand should stay playable`);
    if (!['spread', 'upper-structure', 'avant-garde'].includes(style)) {
      assert.ok(grip.span <= (style === 'cluster' ? 7 : 12), `${style} should fit one simultaneous hand`);
    }
    if (['shell', 'rootless', 'modern', 'cluster'].includes(style)) {
      assert.equal(grip.pcs.includes(grip.root), false, `${style} should not quietly add the harmonic root`);
    }
  }
  await page.locator('#pianoVoicingStyle').selectOption('root-shell');

  const originalHarmony = await page.evaluate(() => ({
    labels: [...document.querySelectorAll('.chart-chord')].map(button => button.textContent),
    activeCell: window.KeyerStandardsDebug.state.events[window.KeyerStandardsDebug.state.activeIndex].cellId,
    timing: window.KeyerStandardsDebug.state.timeline.map(entry => [entry.type, entry.cellId || '', entry.startBeat, entry.endBeat])
  }));
  await page.locator('#reharmLevel').selectOption('5');
  const advancedHarmony = await page.evaluate(() => ({
    labels: [...document.querySelectorAll('.chart-chord')].map(button => button.textContent),
    activeCell: window.KeyerStandardsDebug.state.events[window.KeyerStandardsDebug.state.activeIndex].cellId,
    timing: window.KeyerStandardsDebug.state.timeline.map(entry => [entry.type, entry.cellId || '', entry.startBeat, entry.endBeat]),
    changed: document.querySelectorAll('.chart-chord.reharmonized').length,
    storage: localStorage.getItem('keyer-jazz-reharm-level')
  }));
  assert.ok(advancedHarmony.changed > 0, 'Advanced reharm should visibly alter eligible chart cells');
  assert.notDeepEqual(advancedHarmony.labels, originalHarmony.labels);
  assert.equal(advancedHarmony.activeCell, originalHarmony.activeCell, 'Changing reharm amount should preserve the selected occurrence');
  assert.deepEqual(advancedHarmony.timing, originalHarmony.timing, 'Reharm must not move beats, bars, or pickup timing');
  assert.equal(advancedHarmony.storage, '5');
  await page.locator('#reharmLevel').selectOption('0');
  assert.deepEqual(
    await page.evaluate(() => [...document.querySelectorAll('.chart-chord')].map(button => button.textContent)),
    originalHarmony.labels,
    'Level zero must restore the exact source harmony'
  );
  await page.locator('#reharmLevel').selectOption('5');
  assert.deepEqual(
    await page.evaluate(() => [...document.querySelectorAll('.chart-chord')].map(button => button.textContent)),
    advancedHarmony.labels,
    'Selecting the same reharm level again must be deterministic'
  );
  await page.locator('#reharmLevel').selectOption('0');

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

  // Random must ignore the text currently being searched for while honoring
  // the selected library bank. A search miss should never make Random inert
  // or force it to load the typed title.
  await page.evaluate(() => {
    const debug = window.KeyerStandardsDebug;
    const original = debug.state.songs[0];
    window.__keyerRandomTest = { original, random: Math.random };
    debug.state.songs = [original, { ...original, title: 'Chart Only Random', composer: 'Keyer test' }];
    Math.random = () => .99;
  });
  await page.locator('#songAvailabilityFilter').selectOption('favorites');
  await page.locator('#songSearch').fill('not this favorite');
  await page.locator('#randomSong').click();
  assert.equal(await page.locator('#songTitle').textContent(), 'Autumn Leaves', 'Favorites Random should draw from remembered favorites, never the search text.');
  await page.locator('#songAvailabilityFilter').selectOption('all');
  await page.locator('#songSearch').fill('this search has no matching song');
  await page.locator('#randomSong').click();
  assert.equal(await page.locator('#songTitle').textContent(), 'Chart Only Random', 'All-bank Random must ignore a non-matching search query.');

  await page.locator('#songAvailabilityFilter').selectOption('melody');
  await page.locator('#songSearch').fill('still not a matching title');
  await page.locator('#randomSong').click();
  assert.equal(await page.locator('#songTitle').textContent(), 'Autumn Leaves', 'MIDI-bank Random should choose from MIDI-available songs, not the search text.');

  await page.locator('#songAvailabilityFilter').selectOption('chords');
  await page.locator('#songSearch').fill('another search miss');
  await page.locator('#randomSong').click();
  assert.equal(await page.locator('#songTitle').textContent(), 'Chart Only Random', 'Chord-chart Random should honor its bank even with text in Search.');
  await page.evaluate(() => {
    const debug = window.KeyerStandardsDebug;
    const saved = window.__keyerRandomTest;
    Math.random = saved.random;
    debug.state.songs = [saved.original];
    debug.loadSong(saved.original);
  });
  await page.locator('#songAvailabilityFilter').selectOption('all');
  assert.equal(await page.locator('#songTitle').textContent(), 'Autumn Leaves');

  await page.locator('#toggleMelody').click();
  await page.waitForFunction(() => (
    window.KeyerStandardsDebug.state.chartSource === 'midi'
    && window.KeyerStandardsDebug.state.melodyNotes.length > 0
  ));
  assert.equal(await page.locator('#chartSource').inputValue(), 'midi');
  assert.equal(await page.locator('#playMelody').isDisabled(), false);
  assert.equal(await page.locator('#tempoValue').textContent(), '100 BPM');
  assert.equal(await page.evaluate(() => localStorage.getItem('keyer-jazz-show-melody')), 'on', 'Showing melody should be remembered as a learner preference.');
  await page.locator('#randomSong').click();
  assert.equal(await page.evaluate(() => window.KeyerStandardsDebug.state.showMelody), true, 'Changing standards must not reset Show melody.');
  await page.waitForFunction(() => (
    window.KeyerStandardsDebug.state.showMelody
    && window.KeyerStandardsDebug.state.chartSource === 'midi'
    && window.KeyerStandardsDebug.state.melodyNotes.length > 0
  ));
  const midiBeforeReharm = await page.evaluate(() => ({
    source: window.KeyerStandardsDebug.state.chartSource,
    melody: window.KeyerStandardsDebug.state.melodyNotes.map(note => [note.id, note.midi, note.startBeat, note.endBeat]),
    timeline: window.KeyerStandardsDebug.state.timeline.map(entry => [entry.type, entry.cellId || '', entry.startBeat, entry.endBeat])
  }));
  await page.locator('#reharmLevel').selectOption('3');
  const midiAfterReharm = await page.evaluate(() => ({
    source: window.KeyerStandardsDebug.state.chartSource,
    melody: window.KeyerStandardsDebug.state.melodyNotes.map(note => [note.id, note.midi, note.startBeat, note.endBeat]),
    timeline: window.KeyerStandardsDebug.state.timeline.map(entry => [entry.type, entry.cellId || '', entry.startBeat, entry.endBeat]),
    changed: document.querySelectorAll('.chart-chord.reharmonized').length,
    pickup: window.KeyerStandardsDebug.state.events[0]?.kind
  }));
  assert.equal(midiAfterReharm.source, 'midi', 'Reharm should retain the MIDI-marker chart source');
  assert.ok(midiAfterReharm.changed > 0, 'MIDI marker harmony should support reharmonization');
  assert.deepEqual(midiAfterReharm.melody, midiBeforeReharm.melody, 'Reharm must preserve the literal MIDI melody');
  assert.deepEqual(midiAfterReharm.timeline, midiBeforeReharm.timeline, 'Reharm must preserve MIDI marker and pickup timing');
  assert.equal(midiAfterReharm.pickup, 'pickup');
  assert.deepEqual(await page.evaluate(() => {
    const debug = window.KeyerStandardsDebug;
    const Theory = window.KeyerJazzTheory;
    return debug.state.events.flatMap((event, index) => {
      if (!event?.item?.reharm || !event.chord) return [];
      const start = Number(event.sourceStartBeat);
      const end = Number(event.sourceEndBeat);
      const overlap = debug.state.melodyNotes.filter(note => note.startBeat < end - .0001 && note.endBeat > start + .0001);
      if (!overlap.length) return [];
      const scale = Theory.suggestScale(event.chord, { nextChord: debug.state.events[index + 1]?.chord });
      const allowed = new Set([...(scale?.pcs || []), ...Theory.chordPitchClasses(event.chord)].map(pc => Theory.mod(pc)));
      return overlap.filter(note => !allowed.has(Theory.mod(note.midi))).map(note => ({
        cellId: event.cellId,
        chord: event.chord.display,
        melodyMidi: note.midi
      }));
    });
  }), [], 'Reharm must protect melody notes that sustain across a chord marker, not only new onsets.');
  await page.locator('#reharmLevel').selectOption('0');
  assert.equal(
    await page.locator('#melodyWheel, #melodySlider, #melodyReadout, .melody-wheel, .melody-panel').count(),
    0,
    'The reel and its hidden range/readout should be removed in favor of the two chord arrows.'
  );
  const chordArrowChrome = await page.evaluate(() => [...document.querySelectorAll('#previousChord, #nextChord')].map(button => {
    const rect = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    return {
      width: rect.width,
      height: rect.height,
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      borderWidth: Number.parseFloat(style.borderTopWidth),
      borderRadius: Number.parseFloat(style.borderTopLeftRadius)
    };
  }));
  assert.equal(chordArrowChrome.length, 2);
  chordArrowChrome.forEach((button, index) => {
    assert.ok(button.width >= 44 && button.height >= 44, `Chord arrow ${index + 1} must be at least 44px square: ${JSON.stringify(button)}`);
    assert.ok(button.borderWidth >= 1 && button.borderRadius > 0, `Chord arrow ${index + 1} needs a defined bordered button shape.`);
    assert.ok(button.backgroundImage !== 'none' || button.backgroundColor !== 'rgba(0, 0, 0, 0)', `Chord arrow ${index + 1} needs a visible fill.`);
  });
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
  await page.evaluate(() => window.KeyerStandardsDebug.selectEvent(1, false));
  const guitarStyles = ['chord-melody', 'shell', 'rootless', 'triads', 'drop-2', 'spread'];
  for (const style of guitarStyles) {
    await page.locator('#guitarVoicingStyle').selectOption(style);
    const grip = await page.evaluate(() => {
      const { state } = window.KeyerStandardsDebug;
      return {
        style: state.guitarVoicingStyle,
        storage: localStorage.getItem('keyer-jazz-guitar-voicing-style'),
        count: state.fretboardVoicing.length,
        hasBass: state.fretboardVoicing.some(note => note.bass),
        roles: state.fretboardVoicing.map(note => note.role)
      };
    });
    assert.equal(grip.style, style);
    assert.equal(grip.storage, style, `${style} should persist for guitar study.`);
    assert.ok(grip.count >= 2 && grip.count <= 4, `${style} should retain a playable guitar shell.`);
    if (style === 'shell') assert.ok(grip.count <= 3, 'Shell should not become a dense guitar grip.');
    if (style === 'rootless') assert.equal(grip.hasBass, false, 'Rootless guitar voicings must omit the bass/root.');
  }
  await page.locator('#guitarVoicingStyle').selectOption('chord-melody');
  await page.evaluate(() => window.KeyerStandardsDebug.selectEvent(0, false));
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

  const fretPositionRail = await page.evaluate(() => {
    const board = document.querySelector('#fretboard');
    const buttons = [...board.querySelectorAll('.fret-position-button')];
    return {
      lastFret: Number(board.dataset.lastFret),
      labels: buttons.map(button => button.textContent),
      pressed: buttons.filter(button => button.getAttribute('aria-pressed') === 'true').length,
      toolbarRole: board.querySelector('.fret-position-selector')?.getAttribute('role'),
      toolbarLabel: board.querySelector('.fret-position-selector')?.getAttribute('aria-label')
    };
  });
  assert.deepEqual(
    fretPositionRail.labels,
    Array.from({ length: fretPositionRail.lastFret + 1 }, (_, fret) => String(fret)),
    'Every available fret from open string 0 through the dynamic neck end needs a numbered button.'
  );
  assert.equal(fretPositionRail.pressed, 0, 'Automatic guitar positioning starts with no fret locked.');
  assert.equal(fretPositionRail.toolbarRole, 'toolbar');
  assert.match(fretPositionRail.toolbarLabel, /lowest fret/i);

  // The highest currently visible number is clickable. Selecting it extends
  // the neck by a playable hand span, but that extra width remains confined to
  // the instrument scroller rather than widening the phone page.
  await page.locator(`.fret-position-button[data-fret="${fretPositionRail.lastFret}"]`).click();
  await page.waitForTimeout(32);
  const extendedPositionRail = await page.evaluate(() => {
    const board = document.querySelector('#fretboard');
    const stage = board.closest('.instrument-stage');
    const selected = board.querySelector('.fret-position-button[aria-pressed="true"]');
    const selectedRect = selected.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    return {
      anchor: window.KeyerStandardsDebug.state.fretboardPositionAnchor,
      boardAnchor: board.dataset.positionAnchor,
      lastFret: Number(board.dataset.lastFret),
      selectedFret: Number(selected?.dataset.fret),
      selectedVisible: selectedRect.left >= stageRect.left - 1 && selectedRect.right <= stageRect.right + 1,
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      stageOverflow: stage.scrollWidth - stage.clientWidth
    };
  });
  assert.equal(extendedPositionRail.anchor, fretPositionRail.lastFret);
  assert.equal(extendedPositionRail.boardAnchor, String(fretPositionRail.lastFret));
  assert.equal(extendedPositionRail.selectedFret, fretPositionRail.lastFret);
  assert.ok(extendedPositionRail.lastFret >= fretPositionRail.lastFret + 4, 'A high anchor needs a full five-position hand window for a chord shape.');
  assert.equal(extendedPositionRail.selectedVisible, true, 'The newly locked fret should remain visible after the neck rerenders.');
  assert.ok(extendedPositionRail.documentOverflow <= 1, 'A high fret lock must not widen the mobile document.');
  assert.ok(extendedPositionRail.stageOverflow > 1, 'A high fret lock should keep the expanded neck horizontally scrollable.');

  const dynamicLastFret = extendedPositionRail.lastFret;
  await page.evaluate(() => {
    const stage = document.querySelector('#fretboard').closest('.instrument-stage');
    stage.scrollLeft = stage.scrollWidth;
  });
  const dynamicLastButton = page.locator(`.fret-position-button[data-fret="${dynamicLastFret}"]`);
  assert.equal(await dynamicLastButton.isEnabled(), true, 'The dynamically appended final fret should remain a real clickable button.');
  await dynamicLastButton.click();
  assert.equal(
    await page.evaluate(() => window.KeyerStandardsDebug.state.fretboardPositionAnchor),
    dynamicLastFret,
    'Clicking a dynamically appended fret should replace the prior lock.'
  );
  await page.locator(`.fret-position-button[data-fret="${dynamicLastFret}"]`).click();
  assert.equal(await page.evaluate(() => window.KeyerStandardsDebug.state.fretboardPositionAnchor), null, 'Pressing the selected fret again restores automatic positioning.');

  // A chord-melody grip is chosen for the chord occurrence, not revoiced for
  // every note the learner steps through. The purple marker is free to move
  // through that held harmony, but the fretted chord stays put until the next
  // harmony. A selected fret floors and biases only the chord accompaniment.
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
      const accompaniment = heldGrip.filter(note => note.role !== 'M');
      const melody = [...board.querySelectorAll('.fretboard-cell.melody-tone')].map(cell => ({
        string: Number(cell.dataset.string),
        fret: Number(cell.dataset.fret),
        midi: Number(cell.dataset.midi),
        sourceMidi: Number(cell.dataset.melodyMidi)
      }));
      return {
        activeIndex: window.KeyerStandardsDebug.state.activeIndex,
        chord: document.querySelector('#selectedChord').textContent,
        cursor: window.KeyerStandardsDebug.state.melodyCursor,
        anchor: window.KeyerStandardsDebug.state.fretboardPositionAnchor,
        boardAnchor: board.dataset.positionAnchor,
        pressedFrets: [...board.querySelectorAll('.fret-position-button[aria-pressed="true"]')].map(button => Number(button.dataset.fret)),
        heldGrip,
        accompaniment,
        melody
      };
    });
  }

  // Chord-melody work starts only at the first actual marker/downbeat.
  await page.evaluate(() => window.KeyerStandardsDebug.selectEvent(1, false));
  await page.locator('#nextChord').click();
  const firstMelodyGrip = await guitarChordMelodySnapshot();
  await page.locator('#nextChord').click();
  const laterMelodyGrip = await guitarChordMelodySnapshot();
  assert.equal(firstMelodyGrip.cursor, 0, 'The first forward-arrow press starts Am7 on its first melody note.');
  assert.equal(laterMelodyGrip.cursor, 1, 'The next forward-arrow press advances to Am7’s second melody note.');
  assert.equal(laterMelodyGrip.activeIndex, firstMelodyGrip.activeIndex, 'Melody stepping must stay on the same chart chord');
  assert.equal(laterMelodyGrip.chord, firstMelodyGrip.chord, 'Melody stepping must not replace the current chord');
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

  await page.locator('.fret-position-button[data-fret="10"]').click();
  const anchoredLaterGrip = await guitarChordMelodySnapshot();
  assert.deepEqual(anchoredLaterGrip.pressedFrets, [10], 'The selected fret should be the only visibly locked fret.');
  assert.equal(anchoredLaterGrip.anchor, 10);
  assert.equal(anchoredLaterGrip.boardAnchor, '10');
  assert.ok(anchoredLaterGrip.accompaniment.length > 0, 'A fret lock must still yield an accompaniment grip.');
  assert.ok(anchoredLaterGrip.accompaniment.every(note => note.fret >= 10), 'No chord voice may fall below the selected fret.');
  assert.ok(Math.min(...anchoredLaterGrip.accompaniment.map(note => note.fret)) <= 15, 'The chord floor should remain near the selected fret.');

  await page.locator('#previousChord').click();
  const anchoredFirstGrip = await guitarChordMelodySnapshot();
  assert.equal(anchoredFirstGrip.cursor, 0);
  assert.equal(anchoredFirstGrip.anchor, 10, 'The fret lock should persist while stepping backward through melody notes.');
  assert.deepEqual(anchoredFirstGrip.heldGrip, anchoredLaterGrip.heldGrip, 'Melody movement must not revoice an anchored chord grip.');
  await page.locator('#nextChord').click();
  await page.locator('#nextChord').click();
  const nextChordGrip = await guitarChordMelodySnapshot();
  assert.notEqual(nextChordGrip.activeIndex, laterMelodyGrip.activeIndex, 'Selecting the next harmony should leave the prior chord occurrence');
  assert.notEqual(nextChordGrip.chord, laterMelodyGrip.chord, 'The next chart event should be a different chord');
  assert.equal(nextChordGrip.anchor, 10, 'The fret lock should persist into the next chord.');
  assert.deepEqual(nextChordGrip.pressedFrets, [10]);
  assert.ok(nextChordGrip.accompaniment.length > 0 && nextChordGrip.accompaniment.every(note => note.fret >= 10), 'Every new chord should honor the selected fret floor.');
  assert.notDeepEqual(nextChordGrip.heldGrip, anchoredFirstGrip.heldGrip, 'A new chord should receive its own playable chord-melody grip');

  await page.locator('.fret-position-button[data-fret="10"]').click();
  assert.equal(await page.evaluate(() => window.KeyerStandardsDebug.state.fretboardPositionAnchor), null);
  await page.evaluate(() => window.KeyerStandardsDebug.selectEvent(1, false));
  await page.locator('#nextChord').click();
  const restoredAutomaticGrip = await guitarChordMelodySnapshot();
  assert.deepEqual(restoredAutomaticGrip.pressedFrets, []);
  assert.deepEqual(restoredAutomaticGrip.heldGrip, firstMelodyGrip.heldGrip, 'Deselecting a fret should restore the deterministic automatic voicing.');

  await page.locator('.fret-position-button[data-fret="0"]').click();
  const openPositionGrip = await guitarChordMelodySnapshot();
  assert.equal(openPositionGrip.anchor, 0, 'Fret 0 must be selectable rather than treated as an empty value.');
  assert.equal(openPositionGrip.boardAnchor, '0');
  assert.deepEqual(openPositionGrip.pressedFrets, [0]);
  assert.ok(openPositionGrip.accompaniment.length > 0);
  assert.ok(Math.min(...openPositionGrip.accompaniment.map(note => note.fret)) <= 5, 'Fret 0 should bias the chord toward open/first position.');
  await page.locator('.fret-position-button[data-fret="0"]').click();
  assert.equal(await page.evaluate(() => window.KeyerStandardsDebug.state.fretboardPositionAnchor), null);

  // Return the rest of the MIDI interaction regressions to their default
  // compact piano surface.
  await page.locator('#instrumentView').selectOption('piano');
  await page.locator('#keyboardRangeMode').selectOption('compact');
  assert.equal(await page.locator('.piano-key.melody-tone[data-melody-midi="81"]').count(), 1, 'The compact card should retain the current arrow-selected melody note.');

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

  const leadingRestSelection = await page.evaluate(() => {
    const debug = window.KeyerStandardsDebug;
    const state = debug.state;
    const saved = {
      activeIndex: state.activeIndex,
      timeline: state.timeline,
      timelineByEventIndex: state.timelineByEventIndex
    };
    const selectedChord = { id: 'selected-first-chord', type: 'chord', eventIndex: 0, startBeat: 2, endBeat: 6 };
    state.activeIndex = 0;
    state.timeline = [
      { id: 'leading-silence', type: 'rest', startBeat: 0, endBeat: 2 },
      selectedChord
    ];
    state.timelineByEventIndex = new Map([[0, selectedChord]]);
    const resolved = debug.timelineIndexForSelection();
    state.activeIndex = saved.activeIndex;
    state.timeline = saved.timeline;
    state.timelineByEventIndex = saved.timelineByEventIndex;
    return resolved;
  });
  assert.equal(leadingRestSelection, 1, 'Selecting the first chord must skip unrelated leading silence when Play starts.');

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
    activeMelodyMidi: window.KeyerStandardsDebug.state.activeMelodyNote?.midi,
    visibleMelody: document.querySelector('#piano').dataset.melodyMidi
  }));
  assert.equal(pickupTransition.chord, 'Am7');
  assert.ok(pickupTransition.voicingCount > 0, 'The first marker should start its chord accompaniment.');
  assert.equal(pickupTransition.activeMelodyMidi, 84, 'Transport should preserve the held pickup without relying on a reel readout.');
  assert.equal(pickupTransition.visibleMelody, '84', 'The held pickup should remain visible through the first chord marker.');
  await page.locator('#playChart').click();
  assert.equal(await page.evaluate(() => window.KeyerStandardsDebug.state.transport.playing), false);

  await page.evaluate(() => window.KeyerStandardsDebug.selectEvent(1, false));
  await page.locator('#playChart').click();
  await page.waitForFunction(() => (
    window.KeyerStandardsDebug.state.transport.playing
    && window.KeyerStandardsDebug.state.activeIndex === 1
  ), undefined, { timeout: 1200 });
  assert.deepEqual(await page.evaluate(() => ({
    activeIndex: window.KeyerStandardsDebug.state.activeIndex,
    chord: document.querySelector('#selectedChord').textContent,
    voicingCount: window.KeyerStandardsDebug.state.voicing.length
  })), { activeIndex: 1, chord: 'Am7', voicingCount: 4 }, 'Play should start directly from the selected first chord.');
  await page.locator('#playChart').click();

  await page.evaluate(() => window.KeyerStandardsDebug.selectEvent(3, false));
  await page.locator('#playChart').click();
  await page.waitForFunction(() => (
    window.KeyerStandardsDebug.state.transport.playing
    && window.KeyerStandardsDebug.state.activeIndex === 3
  ), undefined, { timeout: 1200 });
  assert.deepEqual(await page.evaluate(() => ({
    activeIndex: window.KeyerStandardsDebug.state.activeIndex,
    chord: document.querySelector('#selectedChord').textContent
  })), { activeIndex: 3, chord: 'Gmaj7' }, 'Play should also start from later selected MIDI markers without jumping away.');
  await page.locator('#playChart').click();

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
      playMelodyDisabled: document.querySelector('#playMelody').disabled
    };
  });
  assert.deepEqual(markerlessFallback, {
    source: 'ireal',
    midiChart: false,
    melodyVisible: true,
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

  await page.locator('.fret-position-button[data-fret="10"]').click();
  const anchoredLowMelody = await page.evaluate(() => {
    const board = document.querySelector('#fretboard');
    const melody = board.querySelector('.fretboard-cell.melody-tone');
    const accompaniment = [...board.querySelectorAll('.fretboard-cell.chord-melody-tone')]
      .filter(cell => cell.querySelector('.fretboard-role')?.textContent !== 'M')
      .map(cell => Number(cell.dataset.fret));
    const exactCandidateFrets = [...board.querySelectorAll('.fretboard-string')]
      .map(row => 45 - Number(row.dataset.openMidi))
      .filter(fret => fret >= 0 && fret <= Number(board.dataset.lastFret));
    return {
      anchor: window.KeyerStandardsDebug.state.fretboardPositionAnchor,
      boardAnchor: board.dataset.positionAnchor,
      melodyMidi: Number(melody?.dataset.melodyMidi),
      physicalMidi: Number(melody?.dataset.midi),
      melodyFret: Number(melody?.dataset.fret),
      exactCandidateFrets,
      accompaniment,
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      stageOverflow: board.closest('.instrument-stage').scrollWidth - board.closest('.instrument-stage').clientWidth
    };
  });
  assert.equal(anchoredLowMelody.anchor, 10);
  assert.equal(anchoredLowMelody.boardAnchor, '10');
  assert.equal(anchoredLowMelody.melodyMidi, 45);
  assert.equal(anchoredLowMelody.physicalMidi, 45, 'A fret lock must never octave-fold the literal melody register.');
  assert.ok(anchoredLowMelody.melodyFret < 10, 'The purple melody may sit below the selected chord-position floor.');
  assert.deepEqual(anchoredLowMelody.exactCandidateFrets, [0, 5], 'A2 has no exact physical position at or above fret 10.');
  assert.equal(anchoredLowMelody.exactCandidateFrets.some(fret => fret >= 10), false, 'A melody may fall below the anchor only when no exact anchored position exists.');
  assert.ok(anchoredLowMelody.accompaniment.every(fret => fret >= 10), 'Only chord accompaniment is constrained by the selected fret.');
  assert.ok(anchoredLowMelody.documentOverflow <= 1, 'An anchored extended neck must stay inside the phone document.');
  assert.ok(anchoredLowMelody.stageOverflow > 1, 'An anchored extended neck remains horizontally scrollable.');
  await page.locator('.fret-position-button[data-fret="10"]').click();
  assert.deepEqual(await page.evaluate(() => ({
    anchor: window.KeyerStandardsDebug.state.fretboardPositionAnchor,
    lastFret: Number(document.querySelector('#fretboard').dataset.lastFret),
    pressed: document.querySelectorAll('.fret-position-button[aria-pressed="true"]').length
  })), { anchor: null, lastFret: 12, pressed: 0 }, 'Deselecting the fret lock should return the compact neck to automatic logic.');

  // A fret lock is a soft preference for melody placement. When the same
  // literal pitch exists both below and at/above the chosen position, move the
  // purple note to the nearby alternate string without changing its MIDI.
  // Only the chord accompaniment remains a hard fret floor.
  await page.evaluate(() => {
    const debug = window.KeyerStandardsDebug;
    debug.installMidiSource({
      title: 'Melody anchor preference',
      ppq: 120,
      durationTicks: 480,
      markers: [{ type: 'marker', text: 'Cmaj7', tick: 0 }],
      tempos: [{ bpm: 100 }],
      timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
      tracks: [{
        index: 0,
        name: 'Melody',
        notes: [
          { midi: 62, tick: 0, endTick: 120, durationTicks: 120, channel: 0, trackIndex: 0 },
          { midi: 60, tick: 120, endTick: 240, durationTicks: 120, channel: 0, trackIndex: 0 }
        ]
      }]
    }, { name: 'melody-anchor-preference.mid', title: 'Melody anchor preference' });
  });
  await page.locator('.fret-position-button[data-fret="5"]').click();

  async function melodyAnchorPreferenceSnapshot() {
    return page.evaluate(() => {
      const board = document.querySelector('#fretboard');
      const melody = board.querySelector('.fretboard-cell.melody-tone');
      const sourceMidi = Number(melody?.dataset.melodyMidi);
      const exactCandidates = [...board.querySelectorAll('.fretboard-string')]
        .map((row, string) => ({ string, fret: sourceMidi - Number(row.dataset.openMidi) }))
        .filter(position => position.fret >= 0 && position.fret <= Number(board.dataset.lastFret));
      const heldGrip = [...board.querySelectorAll('.fretboard-cell.chord-melody-tone')]
        .map(cell => ({
          string: Number(cell.dataset.string),
          fret: Number(cell.dataset.fret),
          midi: Number(cell.dataset.midi),
          role: cell.querySelector('.fretboard-role')?.textContent || ''
        }))
        .sort((left, right) => left.string - right.string || left.fret - right.fret);
      return {
        activeIndex: window.KeyerStandardsDebug.state.activeIndex,
        chord: document.querySelector('#selectedChord')?.textContent || '',
        anchor: window.KeyerStandardsDebug.state.fretboardPositionAnchor,
        cursor: window.KeyerStandardsDebug.state.melodyCursor,
        sourceMidi,
        physicalMidi: Number(melody?.dataset.midi),
        string: Number(melody?.dataset.string),
        fret: Number(melody?.dataset.fret),
        octaveBadge: melody?.querySelector('.melody-octave')?.textContent || '',
        releasedVoicingKeys: (board.dataset.releasedVoicingKeys || '').split(',').filter(Boolean),
        ghostedVoicingKeys: [...board.querySelectorAll('.fretboard-cell.released-for-melody')]
          .map(cell => `${cell.dataset.string}:${cell.dataset.fret}`),
        playingChordKeys: [...board.querySelectorAll('.fretboard-cell.chord-melody-tone.playing')]
          .map(cell => `${cell.dataset.string}:${cell.dataset.fret}`),
        activeFretSpan: Number(board.dataset.activeFretSpan),
        audibleChordMidis: window.KeyerStandardsDebug.state.fretboardVoicing.map(note => note.midi),
        exactCandidates,
        heldGrip,
        accompaniment: heldGrip.filter(note => note.role !== 'M')
      };
    });
  }

  // The first press auditions the already-displayed first note; the second
  // moves to the next onset inside the same chord.
  await page.locator('#nextChord').click();
  const firstSoftAnchoredMelody = await melodyAnchorPreferenceSnapshot();
  assert.equal(firstSoftAnchoredMelody.anchor, 5);
  assert.equal(firstSoftAnchoredMelody.sourceMidi, 62);
  assert.equal(firstSoftAnchoredMelody.physicalMidi, 62, 'D4 must stay at its exact sounding/physical MIDI.');
  assert.equal(firstSoftAnchoredMelody.octaveBadge, '');
  assert.ok(firstSoftAnchoredMelody.exactCandidates.some(position => position.fret < 5), 'D4 should have a tempting below-anchor upper-string position for this regression.');
  assert.ok(firstSoftAnchoredMelody.exactCandidates.some(position => position.fret >= 5), 'D4 should also have a reasonable exact position near the anchor.');
  assert.ok(
    firstSoftAnchoredMelody.fret >= 5,
    `The exact D4 should move to an alternate string at or above the soft anchor: ${JSON.stringify(firstSoftAnchoredMelody)}`
  );
  assert.ok(firstSoftAnchoredMelody.accompaniment.length > 0 && firstSoftAnchoredMelody.accompaniment.every(note => note.fret >= 5), 'Chord accompaniment keeps the hard fret floor.');

  await page.locator('#nextChord').click();
  const secondSoftAnchoredMelody = await melodyAnchorPreferenceSnapshot();
  assert.equal(secondSoftAnchoredMelody.cursor, 1);
  assert.equal(secondSoftAnchoredMelody.sourceMidi, 60);
  assert.equal(secondSoftAnchoredMelody.physicalMidi, 60, 'C4 must stay at its exact sounding/physical MIDI.');
  assert.equal(secondSoftAnchoredMelody.octaveBadge, '');
  assert.ok(secondSoftAnchoredMelody.exactCandidates.some(position => position.fret < 5));
  assert.ok(secondSoftAnchoredMelody.exactCandidates.some(position => position.fret >= 5));
  assert.ok(
    secondSoftAnchoredMelody.fret >= 5,
    `The moving purple C4 should prefer the exact anchored-string position: ${JSON.stringify(secondSoftAnchoredMelody)}`
  );
  assert.ok(secondSoftAnchoredMelody.accompaniment.length > 0 && secondSoftAnchoredMelody.accompaniment.every(note => note.fret >= 5), 'The accompaniment floor must remain hard on later melody notes.');
  assert.deepEqual(secondSoftAnchoredMelody.heldGrip, firstSoftAnchoredMelody.heldGrip, 'Soft melody repositioning must not revoice the held chord grip.');
  await page.locator('.fret-position-button[data-fret="5"]').click();

  // Do not satisfy a high fret preference by dropping a later melody onto an
  // arbitrary bass string. Ab3 has an exact anchored position at A-string
  // fret 11, but it neither sits above nor shares a cell with the held
  // accompaniment. Its conventional G/D-string position is preferable.
  await page.evaluate(() => {
    window.KeyerStandardsDebug.installMidiSource({
      title: 'Melody anchor bass-string fallback',
      ppq: 120,
      durationTicks: 480,
      markers: [{ type: 'marker', text: 'Dm7', tick: 0 }],
      tempos: [{ bpm: 100 }],
      timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
      tracks: [{
        index: 0,
        name: 'Melody',
        notes: [
          { midi: 65, tick: 0, endTick: 120, durationTicks: 120, channel: 0, trackIndex: 0 },
          { midi: 56, tick: 120, endTick: 240, durationTicks: 120, channel: 0, trackIndex: 0 }
        ]
      }]
    }, { name: 'melody-anchor-bass-fallback.mid', title: 'Melody anchor bass-string fallback' });
  });
  await page.locator('.fret-position-button[data-fret="10"]').click();
  await page.locator('#nextChord').click();
  const highAnchorHeldMelody = await melodyAnchorPreferenceSnapshot();
  assert.equal(highAnchorHeldMelody.anchor, 10);
  assert.equal(highAnchorHeldMelody.sourceMidi, 65);
  assert.equal(highAnchorHeldMelody.physicalMidi, 65);
  assert.ok(highAnchorHeldMelody.fret >= 10, `The onset note should establish an anchored held grip: ${JSON.stringify(highAnchorHeldMelody)}`);
  assert.ok(highAnchorHeldMelody.accompaniment.length > 0 && highAnchorHeldMelody.accompaniment.every(note => note.fret >= 10));

  await page.locator('#nextChord').click();
  const naturalLowMelody = await melodyAnchorPreferenceSnapshot();
  const topAccompanimentString = Math.min(...naturalLowMelody.accompaniment.map(note => note.string));
  const accompanimentCells = new Set(naturalLowMelody.accompaniment.map(note => `${note.string}:${note.fret}`));
  const anchoredExactCandidates = naturalLowMelody.exactCandidates.filter(position => position.fret >= 10);
  const reasonableAnchoredCandidates = anchoredExactCandidates.filter(position => (
    position.string < topAccompanimentString
    || accompanimentCells.has(`${position.string}:${position.fret}`)
  ));
  assert.equal(naturalLowMelody.cursor, 1);
  assert.equal(naturalLowMelody.sourceMidi, 56);
  assert.equal(naturalLowMelody.physicalMidi, 56, 'The fallback must preserve the literal Ab3 register.');
  assert.equal(naturalLowMelody.octaveBadge, '');
  assert.ok(anchoredExactCandidates.some(position => position.string === 4 && position.fret === 11), 'The test needs the tempting exact A-string fret-11 candidate.');
  assert.deepEqual(reasonableAnchoredCandidates, [], `No exact anchored Ab3 belongs above or on the held accompaniment: ${JSON.stringify(naturalLowMelody)}`);
  assert.ok(
    naturalLowMelody.fret < 10 && naturalLowMelody.string <= 3,
    `Prefer a conventional upper-string Ab3 below the anchor over an arbitrary anchored bass string: ${JSON.stringify(naturalLowMelody)}`
  );
  assert.deepEqual(naturalLowMelody.heldGrip, highAnchorHeldMelody.heldGrip, 'The low moving melody must not revoice the held chord grip.');
  await page.locator('.fret-position-button[data-fret="10"]').click();

  // A normal chord-melody hand should never need more than five numbered
  // fret positions (a delta of four) or more than four distinct fretted
  // finger locations. The first melody onset owns each chord's canonical
  // grip; later melody notes may release one held finger to remain nearby.
  await page.evaluate(() => {
    window.KeyerStandardsDebug.installMidiSource({
      title: 'Playable chord melody grip',
      ppq: 120,
      durationTicks: 960,
      markers: [
        { type: 'marker', text: 'Cmaj7', tick: 0 },
        { type: 'marker', text: 'Fmaj7', tick: 480 }
      ],
      tempos: [{ bpm: 100 }],
      timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
      tracks: [{
        index: 0,
        name: 'Melody',
        notes: [
          { midi: 67, tick: 0, endTick: 120, durationTicks: 120, channel: 0, trackIndex: 0 },
          { midi: 60, tick: 120, endTick: 240, durationTicks: 120, channel: 0, trackIndex: 0 },
          { midi: 76, tick: 240, endTick: 360, durationTicks: 120, channel: 0, trackIndex: 0 },
          { midi: 65, tick: 480, endTick: 600, durationTicks: 120, channel: 0, trackIndex: 0 }
        ]
      }]
    }, { name: 'playable-chord-melody-grip.mid', title: 'Playable chord melody grip' });
  });

  function guitarGripMetrics(grip) {
    const fretted = grip.map(note => note.fret).filter(fret => fret > 0);
    return {
      span: fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0,
      distinctFrets: new Set(fretted).size,
      center: fretted.length ? fretted.reduce((sum, fret) => sum + fret, 0) / fretted.length : 0
    };
  }

  function assertPlayableGuitarGrip(snapshot, label) {
    const metrics = guitarGripMetrics(snapshot.heldGrip);
    assert.ok(snapshot.heldGrip.length > 0, `${label} must not accept an impossible/empty candidate.`);
    assert.ok(metrics.span <= 4, `${label} spans ${metrics.span} frets: ${JSON.stringify(snapshot)}`);
    assert.ok(metrics.distinctFrets <= 4, `${label} needs ${metrics.distinctFrets} fretted finger positions: ${JSON.stringify(snapshot)}`);
    return metrics;
  }

  await page.locator('#nextChord').click();
  const playableCGrip = await melodyAnchorPreferenceSnapshot();
  const playableCMetrics = assertPlayableGuitarGrip(playableCGrip, 'Cmaj7 downbeat grip');
  assert.equal(playableCGrip.activeIndex, 0);
  assert.equal(playableCGrip.chord, 'Cmaj7');
  assert.equal(playableCGrip.cursor, 0);
  assert.equal(playableCGrip.sourceMidi, 67, 'The Cmaj7 grip must follow its first-onset G4.');
  assert.ok(
    playableCGrip.heldGrip.some(note => note.role === 'M' && note.string === playableCGrip.string && note.fret === playableCGrip.fret),
    `The first G4 onset should be part of the canonical Cmaj7 grip: ${JSON.stringify(playableCGrip)}`
  );
  assert.ok(playableCGrip.accompaniment.length >= 2, 'A feasible automatic chord-melody grip must retain a real accompaniment shell.');

  await page.locator('#nextChord').click();
  const nearbyC4 = await melodyAnchorPreferenceSnapshot();
  assert.equal(nearbyC4.activeIndex, playableCGrip.activeIndex);
  assert.equal(nearbyC4.cursor, 1);
  assert.equal(nearbyC4.sourceMidi, 60);
  assert.equal(nearbyC4.physicalMidi, 60, 'The later C4 must stay at its exact guitar pitch.');
  assert.ok(
    nearbyC4.exactCandidates.some(position => position.string === 3 && position.fret === 10),
    'The regression needs the technically free but distant D-string fret-10 C4 candidate.'
  );
  assert.notDeepEqual(
    { string: nearbyC4.string, fret: nearbyC4.fret },
    { string: 3, fret: 10 },
    `C4 should release a nearby held finger instead of jumping to D-string fret 10: ${JSON.stringify(nearbyC4)}`
  );
  assert.ok(
    Math.abs(nearbyC4.fret - playableCGrip.fret) <= 4,
    `The G4-to-C4 melody fingering should remain inside one hand position: ${JSON.stringify({ playableCGrip, nearbyC4 })}`
  );
  assert.ok(nearbyC4.releasedVoicingKeys.length > 0, 'A nearby occupied string should be temporarily released for C4.');
  const releasedAccompaniment = playableCGrip.accompaniment.filter(note => nearbyC4.releasedVoicingKeys.includes(`${note.string}:${note.fret}`));
  assert.ok(releasedAccompaniment.length > 0, `At least one nearby accompaniment finger must be released for C4: ${JSON.stringify(nearbyC4)}`);
  assert.ok(
    nearbyC4.releasedVoicingKeys.includes(`${playableCGrip.string}:${playableCGrip.fret}`),
    'After the melody moves, its original G4 onset cell should no longer appear held.'
  );
  assert.ok(
    releasedAccompaniment.every(note => !nearbyC4.audibleChordMidis.includes(note.midi)),
    'Every released chord finger must also be omitted from the audible fretboard grip.'
  );
  assert.ok(
    releasedAccompaniment.every(note => !nearbyC4.playingChordKeys.includes(`${note.string}:${note.fret}`)),
    'A chord tone released for the moving melody must stop ringing instead of only disappearing from the next replay.'
  );
  assert.ok(nearbyC4.activeFretSpan <= 4, `The temporary C4 fingering must stay within a five-position hand window: ${JSON.stringify(nearbyC4)}`);
  assert.deepEqual(nearbyC4.heldGrip, playableCGrip.heldGrip, 'Moving G4 to C4 must not regenerate the canonical Cmaj7 grip.');

  await page.locator('#nextChord').click();
  const highExactE5 = await melodyAnchorPreferenceSnapshot();
  assert.equal(highExactE5.activeIndex, playableCGrip.activeIndex, 'The high leap remains inside Cmaj7.');
  assert.equal(highExactE5.cursor, 2);
  assert.equal(highExactE5.sourceMidi, 76);
  assert.equal(highExactE5.physicalMidi, 76, 'A later high E5 must remain at its exact guitar MIDI/register.');
  assert.equal(highExactE5.octaveBadge, '', 'An exact E5 on fret 12 needs no folded-octave badge.');
  assert.deepEqual(
    { string: highExactE5.string, fret: highExactE5.fret },
    { string: 0, fret: 12 },
    `E5 should occupy its literal high-E-string fret: ${JSON.stringify(highExactE5)}`
  );
  assert.deepEqual(highExactE5.heldGrip, playableCGrip.heldGrip, 'A forced high melody leap must not regenerate the canonical Cmaj7 grip.');
  const highMelodyOutOfWindow = playableCGrip.accompaniment.filter(note => Math.abs(note.fret - highExactE5.fret) > 4);
  assert.ok(highMelodyOutOfWindow.length > 0, 'The fixture needs chord fingers outside the high melody hand window.');
  assert.ok(
    highMelodyOutOfWindow.every(note => highExactE5.releasedVoicingKeys.includes(`${note.string}:${note.fret}`)),
    `Every out-of-window chord finger must be released for the high E5: ${JSON.stringify(highExactE5)}`
  );
  assert.ok(
    highMelodyOutOfWindow.every(note => highExactE5.ghostedVoicingKeys.includes(`${note.string}:${note.fret}`)),
    'Released out-of-window chord fingers should remain visible only as ghosted learning references.'
  );
  assert.ok(
    highMelodyOutOfWindow.every(note => !highExactE5.audibleChordMidis.includes(note.midi)),
    'Out-of-window chord voices must be removed from the audible fretboard voicing.'
  );
  assert.ok(
    highMelodyOutOfWindow.every(note => !highExactE5.playingChordKeys.includes(`${note.string}:${note.fret}`)),
    'Out-of-window chord voices already ringing from the downbeat must stop on the high leap.'
  );
  assert.ok(highExactE5.activeFretSpan <= 4, `The high E5 display must still fit a five-position active hand window: ${JSON.stringify(highExactE5)}`);

  await page.locator('#nextChord').click();
  const playableFGrip = await melodyAnchorPreferenceSnapshot();
  const playableFMetrics = assertPlayableGuitarGrip(playableFGrip, 'Fmaj7 downbeat grip');
  assert.equal(playableFGrip.activeIndex, 1);
  assert.equal(playableFGrip.chord, 'Fmaj7');
  assert.equal(playableFGrip.cursor, 0);
  assert.equal(playableFGrip.sourceMidi, 65, 'The next chord must use its own first-onset F4 as the new melody anchor.');
  assert.ok(
    playableFGrip.heldGrip.some(note => note.role === 'M' && note.string === playableFGrip.string && note.fret === playableFGrip.fret),
    `F4 should be part of the canonical Fmaj7 grip: ${JSON.stringify(playableFGrip)}`
  );
  assert.ok(playableFGrip.accompaniment.length >= 2, 'The next automatic grip must remain a chord rather than melody alone.');
  assert.ok(
    Math.abs(playableFGrip.fret - nearbyC4.fret) <= 4,
    `The melody should take the nearby exact F4 position when entering Fmaj7: ${JSON.stringify({ nearbyC4, playableFGrip })}`
  );
  assert.ok(
    Math.abs(playableFMetrics.center - playableCMetrics.center) <= 4,
    `Avoidable chord-to-chord hand motion should stay within one position: ${JSON.stringify({ playableCMetrics, playableFMetrics })}`
  );

  if (process.env.KEYER_SCREENSHOT) await page.screenshot({ path: process.env.KEYER_SCREENSHOT, fullPage: true });
  await browser.close();
  server.close();
  console.log('Jazz standards mobile UI test passed.');
})().catch(error => {
  server.close();
  console.error(error);
  process.exitCode = 1;
});
