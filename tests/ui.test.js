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
const fixture = '[url=irealb://Autumn%20Leaves=Kosma%20Joseph==Medium%20Swing=G-=1r34LbKcu7T44*A%7BA-7%7CD7%7CG%5E7%7CC%5E7%7D===Jazz%20Fixture]Jazz Fixture[/url]';
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
  assert.ok(await page.locator('.piano-key.scale').count() > 0);
  assert.ok(await page.locator('.piano-key.voicing').count() >= 4);
  assert.ok(await page.locator('.piano-key .key-name').count() > 0);
  await page.locator('#toggleNoteNames').click();
  assert.equal(await page.locator('.piano-key .key-name').count(), 0);
  assert.equal(await page.locator('#toggleNoteNames').getAttribute('aria-pressed'), 'false');
  await page.locator('#toggleNoteNames').click();

  const before = await page.locator('#chordProgress').textContent();
  await page.locator('#nextChord').click();
  const after = await page.locator('#chordProgress').textContent();
  assert.notEqual(after, before);

  const target = await page.locator('.chart-chord').nth(2).boundingBox();
  assert.ok(target && target.height >= 44, 'Chart chord targets should be at least 44px tall');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `Page has ${overflow}px of horizontal overflow`);

  if (process.env.KEYER_SCREENSHOT) await page.screenshot({ path: process.env.KEYER_SCREENSHOT, fullPage: true });
  await browser.close();
  server.close();
  console.log('Jazz standards mobile UI test passed.');
})().catch(error => {
  server.close();
  console.error(error);
  process.exitCode = 1;
});
