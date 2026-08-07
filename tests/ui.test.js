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
const music = 'T44*A{A-7 B7 C^7 D7|G^7|C^7|F#h7}';
const fixture = `[url=irealb://Autumn%20Leaves=Kosma%20Joseph==Medium%20Swing=G-=1r34LbKcu7${encodeURIComponent(music)}===Jazz%20Fixture]Jazz Fixture[/url]`;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

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

  await assertMobileLayout(390, 4);
  await assertMobileLayout(320, 4);

  if (process.env.KEYER_SCREENSHOT) await page.screenshot({ path: process.env.KEYER_SCREENSHOT, fullPage: true });
  await browser.close();
  server.close();
  console.log('Jazz standards mobile UI test passed.');
})().catch(error => {
  server.close();
  console.error(error);
  process.exitCode = 1;
});
