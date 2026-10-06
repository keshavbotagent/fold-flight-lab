import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5173';
const DESIGN_COUNT = 11;
const CHAMPIONS = ['Suzanne', 'Sky King', 'Krstić Dart'];
const MOBILE_ONLY = process.argv.includes('--mobile-only');
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
  const increments = Math.round((target - range.min) / range.step);
  if (increments > 20) {
    await slider.evaluate((input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, target - range.step);
    await slider.press('ArrowRight');
  } else {
    for (let i = 0; i < increments; i++) await slider.press('ArrowRight');
  }
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
  assert.equal(lines.length, DESIGN_COUNT + 1, 'CSV contains a header and every design');
  const header = lines[0].split(',');
  assert.ok(header.includes('seed') && header.includes('time_capped') && header.includes('trim_deg'));
  assert.ok(header.includes('air_temperature_c') && header.includes('field_elevation_m') && header.includes('model_version'), 'exports identify the atmosphere and physics model');
  assert.ok(header.includes('release_altitude_msl_m') && header.includes('peak_altitude_msl_m'), 'exports distinguish absolute altitude from height above ground');
  assert.ok(header.includes('relative_humidity_percent') && header.includes('sea_level_pressure_hpa'), 'exports preserve moist-air conditions');
  const rows = lines.slice(1).map(line => line.split(','));
  for (const name of CHAMPIONS) assert.ok(rows.some(row => row[1] === name), `${name} is exported`);
  for (let i = 0; i < rows.length; i++) {
    assert.equal(Number(rows[i][0]), i + 1);
    assert.equal(rows[i].length, header.length);
    const value = name => Number(rows[i][header.indexOf(name)]);
    assert.equal(value('release_altitude_msl_m'), value('field_elevation_m') + value('height_m'));
    assert.equal(value('peak_altitude_msl_m'), value('field_elevation_m') + value('max_height_m'));
    if (i > 0) assert.ok(Number(rows[i - 1][2]) >= Number(rows[i][2]), 'exported airtime ranking is descending');
  }
  return lines.length - 1;
}
async function diagnosticValue(page, label) {
  const row = page.locator('.force-diagnostic').filter({ has: page.locator('.force-label').filter({ hasText: new RegExp(`^${label}$`) }) });
  assert.equal(await row.count(), 1, `one ${label} diagnostic`);
  const value = Number.parseFloat(await row.locator('.force-value').innerText());
  assert.ok(Number.isFinite(value), `${label} has a finite displayed value`);
  return value;
}
async function verifyQuaternionRendering(page) {
  const result = await page.evaluate(async () => {
    const { FlightScene } = await import('/src/lib/scene.ts');
    const { DESIGNS } = await import('/src/lib/designs.ts');
    const host = document.createElement('div');
    Object.assign(host.style, { position: 'fixed', width: '300px', height: '200px', top: '0', left: '0', opacity: '0', pointerEvents: 'none' });
    document.body.append(host);
    const errors = [];
    const scene = new FlightScene(host, message => errors.push(message));
    const rootHalf = Math.sqrt(0.5);
    const base = { x: 0, y: 2, z: 0, vx: 0, vy: 0, vz: 7, pitch: 1.2, roll: -0.8, qx: 0, qy: 0, omegaX: 0, omegaY: 0, omegaZ: 0 };
    try {
      scene.setFlight({
        designId: DESIGNS[0].id,
        settings: {}, samples: [
          { ...base, t: 0, qz: 0, qw: 2 },
          { ...base, t: 1, qz: -2 * rootHalf, qw: -2 * rootHalf },
        ], duration: 1, distance: 0, maxHeight: 2, finalSpeed: 7, landed: false, truncated: true, stallEvents: 0,
      });
      scene.setTime(0);
      const first = scene.primary.plane.quaternion.toArray();
      scene.setTime(0.5);
      const middle = scene.primary.plane.quaternion.toArray();
      scene.setTime(1);
      const final = scene.primary.plane.quaternion.toArray();
      return { first, middle, final, errors };
    } finally { scene.destroy(); host.remove(); }
  });
  const sameRotation = (actual, expected) => Math.abs(actual.reduce((sum, value, i) => sum + value * expected[i], 0)) > 1 - 1e-8;
  assert.ok(sameRotation(result.first, [0, 0, 0, 1]), 'supplied quaternion overrides conflicting pitch and ground velocity');
  assert.ok(sameRotation(result.middle, [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)]), 'antipodal endpoint follows shortest-arc quaternion interpolation');
  assert.ok(sameRotation(result.final, [0, 0, Math.sqrt(0.5), Math.sqrt(0.5)]), 'final attitude matches the provided quaternion rotation');
  for (const q of [result.first, result.middle, result.final]) assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-8, 'renderer normalizes attitude');
  assert.deepEqual(result.errors, []);
}

async function verifyFoldGuide(page, name, exhaustive = true) {
  const dialog = page.getByRole('dialog');
  assert.equal(await dialog.getByRole('heading', { level: 2 }).innerText(), `Fold a ${name}`);
  const chooser = dialog.getByRole('list', { name: 'Folding steps', exact: true });
  const total = await chooser.getByRole('button').count();
  assert.ok(total >= 6 && total <= 40, `${name} has a complete folding sequence`);
  if (CHAMPIONS.includes(name)) {
    assert.equal(await dialog.locator('.competition-details').count(), 1);
    assert.ok(await dialog.getByRole('link', { name: 'Official result', exact: true }).getAttribute('href'));
    assert.equal(await dialog.getByRole('link', { name: 'Published folding method', exact: true }).count(), 1);
    assert.match(await dialog.locator('.competition-model-note').innerText(), /schematic.*estimated aerodynamics/i);
  }
  assert.equal(await dialog.getByRole('button', { name: 'Previous step', exact: true }).isDisabled(), true);
  assert.match(await dialog.locator('.fold-step-count').innerText(), new RegExp(`^Step 1 of ${total}`));
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await dialog.locator('.fold-overview > summary').evaluate(element => element === document.activeElement), true, 'focus wraps to the last visible control');
  await page.keyboard.press('Tab');
  assert.equal(await dialog.getByRole('button', { name: 'Close dialog', exact: true }).evaluate(element => element === document.activeElement), true, 'focus stays inside the modal and skips disabled/hidden controls');
  if (name === 'Suzanne') {
    await chooser.getByRole('button').nth(12).click();
    await dialog.getByRole('button', { name: 'Skip optional preparation', exact: true }).click();
    assert.match(await dialog.locator('.fold-step-count').innerText(), /^Step 22 of 22/);
    await chooser.getByRole('button').first().click();
  }
  const signatures = new Set();
  for (let index = 0; index < (exhaustive ? total : 2); index++) {
    if (index > 0) await dialog.getByRole('button', { name: 'Next step', exact: true }).click();
    assert.match(await dialog.locator('.fold-step-count').innerText(), new RegExp(`^Step ${index + 1} of ${total}`));
    assert.equal(await chooser.getByRole('button').nth(index).getAttribute('aria-current'), 'step');
    const diagrams = dialog.locator('svg.fold-diagram');
    assert.equal(await diagrams.count(), 2, 'every step has action and result illustrations');
    const diagramData = await diagrams.evaluateAll(elements => elements.map(svg => {
      const box = svg.getBBox();
      return {
        role: svg.getAttribute('role'),
        title: svg.querySelector('title')?.textContent,
        description: svg.querySelector('desc')?.textContent,
        labelled: svg.getAttribute('aria-labelledby')?.split(' ').every(id => document.getElementById(id)),
        polygons: svg.querySelectorAll('polygon').length,
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        signature: [...svg.querySelectorAll('polygon, polyline, path:not(defs path)')].map(node => `${node.tagName}:${node.getAttribute('points') ?? node.getAttribute('d')}:${node.getAttribute('class')}`).join('|'),
      };
    }));
    for (const image of diagramData) {
      assert.equal(image.role, 'img');
      assert.ok(image.title?.includes(name) && image.description?.length > 15 && image.labelled, 'diagrams have unique linked titles and meaningful descriptions');
      assert.ok(image.polygons > 0 && image.box.width > 20 && image.box.height > 10, `${name} step ${index + 1} contains visible paper geometry: ${JSON.stringify(image.box)}`);
      assert.ok([image.box.x, image.box.y, image.box.width, image.box.height].every(Number.isFinite), 'diagram geometry is finite');
      assert.ok(image.box.x >= -2 && image.box.y >= -2 && image.box.x + image.box.width <= 242 && image.box.y + image.box.height <= 242, `${name} step ${index + 1} fits its viewBox: ${JSON.stringify(image.box)}`);
    }
    const signature = diagramData.map(image => image.signature).join('\n');
    assert.ok(!signatures.has(signature), `${name} step ${index + 1} has its own folding geometry`);
    signatures.add(signature);
  }
  if (!exhaustive) await chooser.getByRole('button').last().click();
  assert.equal(await dialog.getByRole('button', { name: 'Next step', exact: true }).count(), 0);
  assert.equal(await dialog.getByRole('button', { name: 'Start again', exact: true }).isEnabled(), true);
  assert.match(await dialog.locator('.fold-step-count').innerText(), /Ready to fly/);
  await dialog.getByRole('button', { name: 'Previous step', exact: true }).click();
  assert.match(await dialog.locator('.fold-step-count').innerText(), new RegExp(`^Step ${total - 1} of ${total}`));
  await chooser.getByRole('button').last().click();
  await dialog.getByRole('button', { name: 'Start again', exact: true }).click();
  assert.match(await dialog.locator('.fold-step-count').innerText(), new RegExp(`^Step 1 of ${total}`));
  await dialog.getByText('All steps at a glance', { exact: true }).click();
  assert.equal(await dialog.locator('.fold-list li').count(), total);
  await dialog.locator('.fold-overview-link').nth(2).click();
  assert.match(await dialog.locator('.fold-step-count').innerText(), new RegExp(`^Step 3 of ${total}`));
  await dialog.getByText('All steps at a glance', { exact: true }).click();
  await chooser.getByRole('button').first().click();
  const ids = await dialog.locator('[id]').evaluateAll(elements => elements.map(element => element.id));
  assert.equal(new Set(ids).size, ids.length, 'SVG accessibility and marker IDs are unique');
  return total;
}

let layoutBoxes = null;
try {
  if (!MOBILE_ONLY) {
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
  assert.equal(await page.locator('.design-option').count(), DESIGN_COUNT);
  assert.equal(await page.locator('.leaderboard tbody tr').count(), DESIGN_COUNT);
  assert.deepEqual(await page.locator('.design-option-name').allTextContents().then(names => names.slice(0, 3)), CHAMPIONS);
  assert.match(await page.getByLabel('Environment details', { exact: true }).innerText(), /New Delhi, India/);
  assert.match(await page.getByLabel('Environment details', { exact: true }).innerText(), /26°C.*46% humidity.*215 m above sea level/);
  const renderer = await verifyRenderer(page);
  await screenshot(page, 'desktop-initial.png');
  layoutBoxes = await page.evaluate(() => Object.fromEntries(
    ['.control-panel', '.launch-button', '.flight-panel', '.scene-shell'].map(selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return [selector, { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom }];
    }),
  ));
  assert.ok(layoutBoxes['.launch-button'].bottom <= 900, 'the desktop launch button fits in the initial 900px viewport');
  await writeFile(resolve(artifactPath, 'desktop-layout.json'), JSON.stringify(layoutBoxes, null, 2));
  record('desktop renders eleven designs, sourced champions, leaderboard and WebGL2', renderer.version);
  for (const name of CHAMPIONS) {
    await page.locator('.design-option').filter({ hasText: name }).click();
    assert.match(await page.locator('.design-record').innerText(), /former record|world-final win/);
    const launch = await page.locator('.launch-section > .launch-button').boundingBox();
    assert.ok(launch.y + launch.height <= 900, `${name} keeps the launch control visible`);
  }
  await verifyQuaternionRendering(page);
  record('rendered attitude uses normalized shortest-arc quaternion interpolation');

  await page.locator('.design-option').filter({ hasText: 'Wide Glider' }).click();
  assert.equal(await page.locator('.design-option.selected .design-option-name').innerText(), 'Wide Glider');
  await setSlider(page, 'Launch speed', 8);
  await setSlider(page, 'Launch angle', 10);
  await setSlider(page, 'Release height', 2);
  await page.getByRole('button', { name: 'Paper, wind & altitude', exact: true }).click();
  await setSlider(page, 'Paper weight', 85);
  await setSlider(page, 'Wind speed', 2);
  await page.getByLabel('Wind direction', { exact: true }).selectOption('0');
  await setSlider(page, 'Gust intensity', 0);
  await setSlider(page, 'Air temperature', 25);
  await setSlider(page, 'Relative humidity', 0);
  const dryDensity = await diagnosticValue(page, 'Air density');
  await setSlider(page, 'Relative humidity', 100);
  assert.ok(await diagnosticValue(page, 'Air density') < dryDensity, 'humidity lowers the live air density');
  assert.equal(await diagnosticValue(page, 'Humidity'), 100);
  await setSlider(page, 'Sea-level pressure', 1000);
  const lowerPressureDensity = await diagnosticValue(page, 'Air density');
  await setSlider(page, 'Sea-level pressure', 1020);
  assert.ok(await diagnosticValue(page, 'Air density') > lowerPressureDensity, 'pressure increases live air density');
  await setSlider(page, 'Sea-level pressure', 1008.3);
  await setSlider(page, 'Relative humidity', 46);
  assert.match(await page.getByLabel('Environment details', { exact: true }).innerText(), /Custom environment/);
  await setSlider(page, 'Ground elevation', 1500);
  assert.match(await page.getByLabel('Altitude above sea level', { exact: true }).innerText(), /^1502\.0 m above sea level$/);
  await setSlider(page, 'Ground elevation', -400);
  assert.match(await page.getByLabel('Altitude above sea level', { exact: true }).innerText(), /^-398\.0 m above sea level$/);
  await setSlider(page, 'Ground elevation', 1500);
  await page.getByRole('button', { name: 'Paper, wind & altitude', exact: true }).click();
  await page.getByRole('button', { name: 'Launch plane', exact: false }).click();
  await page.getByRole('button', { name: 'Pause flight', exact: true }).click();
  await page.getByRole('slider', { name: 'Flight timeline', exact: true }).press('Home');
  const airspeed = await diagnosticValue(page, 'Airspeed');
  const groundSpeed = Number.parseFloat(await page.locator('.metric').filter({ hasText: 'GROUND SPEED' }).locator('.metric-value').innerText());
  const expectedAirspeed = Math.hypot(8 * Math.cos(10 * Math.PI / 180) - 2, 8 * Math.sin(10 * Math.PI / 180));
  assert.ok(Math.abs(airspeed - expectedAirspeed) <= 0.12, `airspeed ${airspeed} matches air-relative launch velocity ${expectedAirspeed}`);
  assert.ok(Math.abs(groundSpeed - 8) <= 0.12 && groundSpeed - airspeed > 1, 'wind distinguishes airspeed from ground speed');
  assert.ok(await diagnosticValue(page, 'Air density') < 1.15, 'warm high-elevation launch reduces the displayed density');
  assert.ok(await diagnosticValue(page, 'Gravity') < 9.807, 'local gravity reflects the launch elevation');
  assert.ok(await diagnosticValue(page, 'Drag') > 0);
  assert.match(await page.getByLabel('Altitude above sea level', { exact: true }).innerText(), /^1502\.0 m above sea level$/);
  const flightHeight = Number.parseFloat(await page.locator('.metric').filter({ hasText: 'ABOVE GROUND' }).locator('.metric-value').innerText());
  assert.equal(flightHeight, 2, 'sea-level elevation does not add to height above ground');
  await page.getByRole('slider', { name: 'Flight timeline', exact: true }).press('End');
  assert.match(await page.getByLabel('Altitude above sea level', { exact: true }).innerText(), /^1500\.0 m above sea level$/);
  record('temperature, elevation and wind change diagnostics; airspeed differs from ground speed');
  await page.getByRole('button', { name: 'Paper, wind & altitude', exact: true }).click();
  await page.getByRole('button', { name: 'Reset conditions', exact: true }).click();
  assert.equal(await page.getByRole('slider', { name: 'Launch speed', exact: true }).inputValue(), '7');
  assert.equal(await page.getByRole('slider', { name: 'Air temperature', exact: true }).inputValue(), '26');
  assert.equal(await page.getByRole('slider', { name: 'Ground elevation', exact: true }).inputValue(), '215');
  assert.equal(await page.getByRole('slider', { name: 'Relative humidity', exact: true }).inputValue(), '46');
  assert.equal(await page.getByRole('slider', { name: 'Sea-level pressure', exact: true }).inputValue(), '1008.3');
  assert.equal(await page.getByRole('slider', { name: 'Wind speed', exact: true }).inputValue(), '2');
  assert.equal(await page.getByLabel('Wind direction', { exact: true }).inputValue(), '180');
  assert.match(await page.getByLabel('Altitude above sea level', { exact: true }).innerText(), /^216\.8 m above sea level$/);
  assert.match(await page.getByLabel('Environment details', { exact: true }).innerText(), /New Delhi, India/);
  await page.getByRole('button', { name: 'Paper, wind & altitude', exact: true }).click();
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
  assert.equal(await page.locator('.leaderboard tbody tr').count(), DESIGN_COUNT);
  await page.getByRole('button', { name: 'Pause flight', exact: true }).click();
  await page.getByRole('button', { name: 'Top camera', exact: true }).click();
  await screenshot(page, 'desktop-comparison.png');
  assert.equal(await verifyCSV(page, 'matched-ui.csv'), DESIGN_COUNT);
  record('matched comparison and complete CSV download work');

  await page.getByRole('button', { name: 'Find best launches', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.results-description')?.textContent?.replaceAll(',', '').includes('1155 launches') && !document.querySelector('.progress-status'), null, { timeout: 60_000 });
  assert.equal(await page.getByRole('tab', { name: /Best launch search/ }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('.leaderboard tbody tr').count(), DESIGN_COUNT);
  if (await page.getByRole('button', { name: 'Pause flight', exact: true }).count()) await page.getByRole('button', { name: 'Pause flight', exact: true }).click();
  await screenshot(page, 'desktop-optimized.png');
  await verifyCSV(page, 'optimized-ui.csv');
  record('equal-budget 1155-launch search completes and exports eleven results');

  await page.getByRole('button', { name: 'Replay Wide Glider', exact: true }).click();
  assert.equal(await page.locator('.design-option.selected .design-option-name').innerText(), 'Wide Glider');
  await page.getByRole('button', { name: 'Pause flight', exact: true }).click();
  await page.getByRole('button', { name: 'Fold guide', exact: true }).click();
  await verifyFoldGuide(page, 'Wide Glider');
  await screenshot(page, 'desktop-fold-guide.png');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Fold guide', exact: true }).evaluate(element => element === document.activeElement), true, 'closing restores focus to the guide button');
  const designNames = await page.locator('.design-option-name').allTextContents();
  for (const name of designNames.filter(name => name !== 'Wide Glider')) {
    await page.locator('.design-option').filter({ hasText: name }).click();
    await page.getByRole('button', { name: 'Fold guide', exact: true }).click();
    await verifyFoldGuide(page, name);
    if (name === 'Krstić Dart') {
      await page.getByRole('dialog').getByRole('list', { name: 'Folding steps', exact: true }).getByRole('button').nth(24).click();
      await screenshot(page, 'desktop-champion-detail.png');
    }
    await page.keyboard.press('Escape');
  }
  await page.locator('.design-option').filter({ hasText: 'Wide Glider' }).click();
  await page.getByRole('button', { name: 'Fold guide', exact: true }).click();
  assert.match(await page.getByRole('dialog').locator('.fold-step-count').innerText(), /^Step 1 of/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Model & assumptions', exact: true }).click();
  const modelText = await page.getByRole('dialog').innerText();
  assert.ok(/six.?degree|6.?dof/i.test(modelText), 'model describes six degrees of freedom');
  assert.ok(/quaternion/i.test(modelText) && /RK4|Runge.?Kutta/i.test(modelText), 'model identifies attitude and integration methods');
  assert.ok(/estimat|uncalibrat/i.test(modelText), 'model distinguishes numerical validation from calibration');
  await screenshot(page, 'desktop-model.png');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  record('row replay, sourced illustrated folding steps for all eleven planes, and accessible dialogs work');
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
  assert.equal(toolContract.before.designs.length, DESIGN_COUNT);
  assert.equal(toolContract.before.designs.filter(design => design.documentedAchievement).length, 3);
  assert.ok(toolContract.rejected.every(Boolean), 'additional tool arguments are rejected');
  for (const tool of toolContract.tools) {
    assert.equal(tool.inputSchema.type, 'object');
    assert.deepEqual(tool.inputSchema.properties, {});
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.equal(tool.annotations.readOnlyHint, tool.name === 'read_flight_lab');
  }
  assert.equal(toolContract.comparison.results.length, DESIGN_COUNT);
  assert.equal(toolContract.after.comparisonMethod, 'matched');
  assert.deepEqual(toolContract.after.results, toolContract.comparison.results, 'tool result and immediately refreshed UI state agree');
  assert.equal(toolContract.after.playing, true);
  record('WebMCP registry contract via mock: schemas, annotations, invalid input and compare/readback');
  // Avoid running two software WebGL render loops while capturing mobile.
  await context.close();
  }

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
  const mobileDesign = await mobile.locator('.design-option.selected .design-option-name').innerText();
  await verifyFoldGuide(mobile, mobileDesign, false);
  const foldSizing = await mobile.getByRole('dialog').evaluate(element => ({ width: element.clientWidth, content: element.scrollWidth }));
  assert.ok(foldSizing.content <= foldSizing.width + 1, `fold guide has no horizontal overflow: ${JSON.stringify(foldSizing)}`);
  await screenshot(mobile, 'mobile-fold-guide.png');
  await mobile.getByRole('button', { name: 'Close dialog', exact: true }).click();
  for (const name of CHAMPIONS) {
    await mobile.locator('.design-option').filter({ has: mobile.locator('.design-option-name').filter({ hasText: new RegExp(`^${name}$`) }) }).click();
    await mobile.getByRole('button', { name: 'Fold guide', exact: true }).click();
    assert.ok(await mobile.locator('.fold-step-nav').evaluate(element => element.clientHeight <= 56), `${name} uses one compact row of mobile steps`);
    await verifyFoldGuide(mobile, name, false);
    const championSizing = await mobile.getByRole('dialog').evaluate(element => ({ width: element.clientWidth, content: element.scrollWidth }));
    assert.ok(championSizing.content <= championSizing.width + 1, `${name} guide fits the mobile viewport: ${JSON.stringify(championSizing)}`);
    if (name === 'Krstić Dart') {
      await mobile.getByRole('dialog').getByRole('list', { name: 'Folding steps', exact: true }).getByRole('button').nth(24).click();
      const activeInView = await mobile.locator('.fold-step-nav').evaluate(element => {
        const list = element.getBoundingClientRect(), active = element.querySelector('[aria-current="step"]').getBoundingClientRect();
        return active.left >= list.left - 1 && active.right <= list.right + 1;
      });
      assert.ok(activeInView, 'the selected mobile step stays visible while scrolling the numbered list');
      await mobile.getByRole('dialog').locator('.fold-panel').first().scrollIntoViewIfNeeded();
      await screenshot(mobile, 'mobile-champion-guide.png');
    }
    await mobile.getByRole('button', { name: 'Close dialog', exact: true }).click();
  }
  await mobile.getByRole('button', { name: 'How it works', exact: true }).click();
  assert.ok(await mobile.getByRole('dialog').isVisible());
  await screenshot(mobile, 'mobile-model.png');
  await mobile.getByRole('button', { name: 'Close dialog', exact: true }).click();
  record('390px mobile has live WebGL, usable dialogs and no page overflow', JSON.stringify(sizing));
  assert.deepEqual(browserErrors, [], 'no uncaught JavaScript or browser console errors');
  record(MOBILE_ONLY ? 'mobile has no JavaScript/console errors' : 'desktop and mobile have no JavaScript/console errors');
  await writeFile(resolve(artifactPath, MOBILE_ONLY ? 'browser-qa-mobile.json' : 'browser-qa.json'), JSON.stringify({ ok: true, checks, desktopLayout: layoutBoxes, mobileLayout: sizing, browserErrors, optionalWebMCP: MOBILE_ONLY ? 'Not repeated by the targeted mobile run.' : 'Registry contract tested with a document.modelContext stub; native browser tool invocation was not available.' }, null, 2));
  console.log(JSON.stringify({ ok: true, checks: checks.length, artifacts: artifactPath }));
} finally {
  await browser.close();
}
