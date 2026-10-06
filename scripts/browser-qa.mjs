import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5173';
const artifactPath = resolve('artifacts');
await mkdir(artifactPath, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const browserErrors = [];
const checks = [];
const record = (name, details) => { checks.push({ name, details }); console.log(`PASS ${name}${details ? ` — ${details}` : ''}`); };
function watch(page) {
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`); });
}
async function screenshot(page, name) {
  await page.screenshot({ path: resolve(artifactPath, name), fullPage: true, animations: 'disabled' });
}
async function setSlider(page, label, target) {
  const slider = page.getByRole('slider', { name: label, exact: true });
  const range = await slider.evaluate(input => ({ min: Number(input.min), step: Number(input.step || 1) }));
  await slider.press('Home');
  for (let i = 0; i < Math.round((target - range.min) / range.step); i++) await slider.press('ArrowRight');
  assert.equal(Number(await slider.inputValue()), target, `${label} responds to keyboard input`);
  return slider;
}
async function verifyRenderer(page) {
  const canvas = page.locator('.scene-host canvas');
  await canvas.waitFor({ state: 'visible' });
  const context = await canvas.evaluate(element => {
    const gl = element.getContext('webgl2');
    return {
      width: element.width, height: element.height,
      clientWidth: element.clientWidth, clientHeight: element.clientHeight,
      valid: Boolean(gl && !gl.isContextLost()),
      version: gl?.getParameter(gl.VERSION),
    };
  });
  assert.ok(context.valid, 'WebGL2 context exists and is live');
  assert.ok(context.width > 100 && context.height > 100, 'scene has a real render buffer');
  assert.ok(context.clientWidth > 100 && context.clientHeight > 100, 'canvas has a visible size');
  assert.equal(await page.locator('.error-state').count(), 0, 'no 3D renderer fallback');
  return context;
}
async function verifyCSV(page, filename) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith('.csv'));
  await download.saveAs(resolve(artifactPath, filename));
  const csv = await readFile(resolve(artifactPath, filename), 'utf8');
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 9, 'CSV contains a header and all eight designs');
  const header = lines[0].split(',');
  assert.ok(header.includes('seed') && header.includes('time_capped') && header.includes('trim_deg'));
  const rows = lines.slice(1).map(line => line.split(','));
  for (let i = 0; i < rows.length; i++) {
    assert.equal(Number(rows[i][0]), i + 1);
    assert.equal(rows[i].length, header.length);
    if (i > 0) assert.ok(Number(rows[i - 1][2]) >= Number(rows[i][2]), 'exported airtime ranking is descending');
  }
  return lines.length - 1;
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });
  // This checks the optional registration contract, not native browser support.
  await context.addInitScript(() => {
    window.__qaFlightTools = [];
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTool(tool, { signal }) {
        window.__qaFlightTools.push(tool);
        signal.addEventListener('abort', () => {
          window.__qaFlightTools = window.__qaFlightTools.filter(item => item !== tool);
        }, { once: true });
      } },
    });
  });
  const page = await context.newPage();
  watch(page);
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('.design-option').count(), 8);
  assert.equal(await page.locator('.leaderboard tbody tr').count(), 8);
  const renderer = await verifyRenderer(page);
  await screenshot(page, 'desktop-initial.png');
  const layoutBoxes = await page.evaluate(() => Object.fromEntries(
    ['.control-panel', '.launch-button', '.flight-panel', '.scene-shell'].map(selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return [selector, { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom }];
    }),
  ));
  assert.ok(layoutBoxes['.launch-button'].bottom <= 900, 'the desktop launch button fits in the initial 900px viewport');
  await writeFile(resolve(artifactPath, 'desktop-layout.json'), JSON.stringify(layoutBoxes, null, 2));
  record('desktop renders eight designs, leaderboard and WebGL2', renderer.version);

  await page.locator('.design-option').filter({ hasText: 'Wide Glider' }).click();
  assert.equal(await page.locator('.design-option.selected .design-option-name').innerText(), 'Wide Glider');
  await setSlider(page, 'Launch speed', 8);
  await setSlider(page, 'Launch angle', 10);
  await setSlider(page, 'Release height', 2);
  await page.getByRole('button', { name: 'Paper, wind & trim', exact: true }).click();
  await setSlider(page, 'Paper weight', 85);
  await setSlider(page, 'Wind speed', 1);
  await page.getByLabel('Wind direction', { exact: true }).selectOption('90');
  await setSlider(page, 'Gust intensity', 0.1);
  await page.getByRole('button', { name: 'Reset conditions', exact: true }).click();
  assert.equal(await page.getByRole('slider', { name: 'Launch speed', exact: true }).inputValue(), '7');
  await page.getByRole('button', { name: 'Paper, wind & trim', exact: true }).click();
  record('airframe selection, sliders and weather reset respond');

  await page.getByRole('button', { name: 'Launch plane', exact: false }).click();
  await page.waitForFunction(() => Number(document.querySelector('[aria-label="Flight timeline"]').value) > 0.3);
  await page.getByRole('button', { name: 'Pause flight', exact: true }).click();
  const timeline = page.getByRole('slider', { name: 'Flight timeline', exact: true });
  const pausedTime = Number(await timeline.inputValue());
  await page.waitForTimeout(200);
  assert.equal(Number(await timeline.inputValue()), pausedTime, 'paused flight clock remains still');
  await page.getByRole('button', { name: 'Play flight', exact: true }).click();
  await page.waitForFunction(previous => Number(document.querySelector('[aria-label="Flight timeline"]').value) > previous + 0.1, pausedTime);
  await page.getByRole('button', { name: 'Pause flight', exact: true }).click();
  const beforeReplay = Number(await timeline.inputValue());
  await page.getByRole('button', { name: 'Replay flight', exact: true }).click();
  assert.ok(Number(await timeline.inputValue()) < beforeReplay, 'replay restarts the flight clock');
  await page.getByRole('button', { name: 'Pause flight', exact: true }).click();
  await timeline.press('End');
  assert.ok(Math.abs(Number(await timeline.inputValue()) - Number(await timeline.getAttribute('max'))) < 0.02, 'timeline can scrub to landing');
  await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('2');
  for (const name of ['Top camera', 'Orbit camera', 'Follow camera']) {
    await page.getByRole('button', { name, exact: true }).click();
    assert.equal(await page.getByRole('button', { name, exact: true }).getAttribute('aria-pressed'), 'true');
  }
  record('launch, pause, play, replay, timeline, playback rate and all cameras work');

  await page.getByRole('button', { name: 'Compare all designs', exact: true }).click();
  assert.equal(await page.locator('.leaderboard tbody tr').count(), 8);
  await page.getByRole('button', { name: 'Pause flight', exact: true }).click();
  await page.getByRole('button', { name: 'Top camera', exact: true }).click();
  await screenshot(page, 'desktop-comparison.png');
  assert.equal(await verifyCSV(page, 'matched-ui.csv'), 8);
  record('matched comparison and complete CSV download work');

  await page.getByRole('button', { name: 'Find best launches', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.results-description')?.textContent?.includes('840 launches'), null, { timeout: 30_000 });
  assert.equal(await page.getByRole('tab', { name: /Best launch search/ }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('.leaderboard tbody tr').count(), 8);
  if (await page.getByRole('button', { name: 'Pause flight', exact: true }).count()) await page.getByRole('button', { name: 'Pause flight', exact: true }).click();
  await screenshot(page, 'desktop-optimized.png');
  await verifyCSV(page, 'optimized-ui.csv');
  record('equal-budget 840-launch search completes and exports eight results');

  await page.getByRole('button', { name: 'Replay Wide Glider', exact: true }).click();
  assert.equal(await page.locator('.design-option.selected .design-option-name').innerText(), 'Wide Glider');
  await page.getByRole('button', { name: 'Pause flight', exact: true }).click();
  await page.getByRole('button', { name: 'Fold guide', exact: true }).click();
  assert.equal(await page.getByRole('dialog').getByRole('heading', { level: 2 }).innerText(), 'Fold a Wide Glider');
  assert.ok(await page.getByRole('dialog').locator('.fold-list li').count() >= 4);
  await screenshot(page, 'desktop-fold-guide.png');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('button', { name: 'Model & assumptions', exact: true }).click();
  assert.ok((await page.getByRole('dialog').innerText()).includes('coefficients are estimates'));
  await screenshot(page, 'desktop-model.png');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  record('row replay and accessible model/fold dialogs work');
  await page.waitForFunction(() => window.__qaFlightTools?.length === 2);
  const toolContract = await page.evaluate(() => {
    const tools = window.__qaFlightTools;
    const read = tools.find(tool => tool.name === 'read_flight_lab');
    const compare = tools.find(tool => tool.name === 'compare_current_airframes');
    const before = read.execute({});
    const rejected = tools.map(tool => {
      try { tool.execute({ speed: 99 }); return false; }
      catch (error) { return error instanceof TypeError; }
    });
    const comparison = compare.execute({});
    const after = read.execute({});
    return {
      tools: tools.map(({ name, inputSchema, annotations }) => ({ name, inputSchema, annotations })),
      before, rejected, comparison, after,
    };
  });
  assert.equal(toolContract.before.selectedId, 'wide-glider');
  assert.equal(toolContract.before.designs.length, 8);
  assert.ok(toolContract.rejected.every(Boolean), 'additional tool arguments are rejected');
  for (const tool of toolContract.tools) {
    assert.equal(tool.inputSchema.type, 'object');
    assert.deepEqual(tool.inputSchema.properties, {});
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.equal(tool.annotations.readOnlyHint, tool.name === 'read_flight_lab');
  }
  assert.equal(toolContract.comparison.results.length, 8);
  assert.equal(toolContract.after.comparisonMethod, 'matched');
  assert.deepEqual(toolContract.after.results, toolContract.comparison.results, 'tool result and immediately refreshed UI state agree');
  assert.equal(toolContract.after.playing, true);
  record('WebMCP registry contract via mock: schemas, annotations, invalid input and compare/readback');
  // Avoid running two software WebGL render loops while capturing mobile.
  await context.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobile = await mobileContext.newPage();
  watch(mobile);
  await mobile.goto(baseURL, { waitUntil: 'networkidle' });
  await verifyRenderer(mobile);
  const sizing = await mobile.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(sizing.viewport <= 391 && sizing.document <= 391 && sizing.body <= 391, `no horizontal page overflow at configured 390px: ${JSON.stringify(sizing)}`);
  record('mobile WebGL and 390px layout render', JSON.stringify(sizing));
  await screenshot(mobile, 'mobile-initial.png');
  await mobile.getByRole('button', { name: 'Launch plane', exact: false }).click();
  await mobile.getByRole('button', { name: 'Pause flight', exact: true }).click();
  await mobile.getByRole('button', { name: 'Fold guide', exact: true }).click();
  assert.ok(await mobile.getByRole('dialog').isVisible());
  await screenshot(mobile, 'mobile-fold-guide.png');
  await mobile.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await mobile.getByRole('button', { name: 'How it works', exact: true }).click();
  assert.ok(await mobile.getByRole('dialog').isVisible());
  await screenshot(mobile, 'mobile-model.png');
  await mobile.getByRole('button', { name: 'Close dialog', exact: true }).click();
  record('390px mobile has live WebGL, usable dialogs and no page overflow', JSON.stringify(sizing));
  assert.deepEqual(browserErrors, [], 'no uncaught JavaScript or browser console errors');
  record('desktop and mobile have no JavaScript/console errors');
  await writeFile(resolve(artifactPath, 'browser-qa.json'), JSON.stringify({ ok: true, checks, desktopLayout: layoutBoxes, mobileLayout: sizing, browserErrors, optionalWebMCP: 'Registry contract tested with a document.modelContext stub; native browser tool invocation was not available.' }, null, 2));
  console.log(JSON.stringify({ ok: true, checks: checks.length, artifacts: artifactPath }));
} finally {
  await browser.close();
}
