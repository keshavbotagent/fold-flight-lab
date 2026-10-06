import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS } from '../src/lib/designs.ts';
import { DEFAULT_SETTINGS, getAtmosphere, simulateFlight } from '../src/lib/physics.ts';
import { EARTH_RADIUS } from '../src/lib/atmosphere.ts';
import type { FlightSample, LaunchSettings } from '../src/lib/types.ts';

const specificEnergy = (s: FlightSample, settings: LaunchSettings) => {
  const groundRadius = EARTH_RADIUS + settings.fieldElevation;
  const groundGravity = getAtmosphere(settings).gravity;
  const potential = groundGravity * groundRadius * s.y / (groundRadius + s.y);
  return potential + (s.vx ** 2 + s.vy ** 2 + s.vz ** 2) / 2;
};
const almost = (actual: number, expected: number, tolerance: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} versus ${expected}, tolerance ${tolerance}`);

// Each paper sheet has the same mass; geometry and fold-induced aerodynamics vary.
test('the catalog has distinct, physically valid designs with equal paper mass', () => {
  assert.ok(DESIGNS.length >= 6, 'at least six geometries are compared');
  assert.equal(new Set(DESIGNS.map(d => d.id)).size, DESIGNS.length);
  for (const design of DESIGNS) {
    assert.ok(design.mass > 0 && design.mass < 0.02, `${design.name}: paper sheet mass in kg`);
    almost(design.mass, DESIGNS[0].mass, 1e-12, `${design.name} equal mass`);
    for (const [label, value] of Object.entries({ wingArea: design.wingArea, span: design.span, length: design.length, cd0: design.cd0, maxCl: design.maxCl })) {
      assert.ok(Number.isFinite(value) && value > 0, `${design.name}: positive ${label}`);
    }
  }
});

test('all designs dissipate mechanical energy in still air and return finite flights', () => {
  for (const design of DESIGNS) {
    const flight = simulateFlight(design, { windSpeed: 0, turbulence: 0, speed: 7, angle: 12, height: 1.5, trim: 0, maxTime: 60, dt: 1 / 240 });
    assert.ok(flight.landed, `${design.name}: should reach the ground within a minute`);
    assert.equal(flight.truncated, false);
    assert.ok(flight.duration > 0 && flight.distance > 0);
    const initialEnergy = specificEnergy(flight.samples[0], flight.settings);
    let previousEnergy = initialEnergy;
    let previousTime = -1;
    for (const sample of flight.samples) {
      for (const [key, value] of Object.entries(sample)) assert.ok(Number.isFinite(value), `${design.name}: finite ${key}`);
      assert.ok(sample.t > previousTime, `${design.name}: sample times increase`);
      assert.ok(sample.y >= 0, `${design.name}: no sample below ground`);
      const energy = specificEnergy(sample, flight.settings);
      assert.ok(energy <= previousEnergy + initialEnergy * 1e-7 + 1e-8, `${design.name}: still-air energy cannot increase between recorded samples (${energy - previousEnergy}J/kg)`);
      previousEnergy = energy;
      previousTime = sample.t;
    }
    assert.ok(specificEnergy(flight.samples.at(-1)!, flight.settings) < initialEnergy, `${design.name}: drag dissipates energy`);
  }
});

test('landing occurs at y=0 with consistent interpolated time and distance', () => {
  const flight = simulateFlight(DESIGNS[0], { height: 0.15, speed: 4, angle: -10, windSpeed: 0, turbulence: 0, maxTime: 10, dt: 1 / 120 });
  const last = flight.samples.at(-1)!;
  assert.ok(flight.landed);
  assert.equal(flight.truncated, false);
  assert.equal(last.y, 0);
  almost(last.t, flight.duration, 1e-10, 'final sample time equals reported duration');
  almost(Math.hypot(last.x, last.z), flight.distance, 1e-8, 'distance matches ground displacement');
  assert.ok(flight.samples.slice(0, -1).every(s => s.y > 0), 'flight stops at its first ground contact');
});

test('time-limited trajectories end at the requested horizon and are marked truncated', () => {
  const horizon = 0.217;
  const flight = simulateFlight(DESIGNS[0], { height: 20, speed: 6, windSpeed: 0, turbulence: 0, maxTime: horizon, dt: 1 / 120 });
  assert.equal(flight.landed, false);
  assert.equal(flight.truncated, true);
  assert.ok(flight.samples.at(-1)!.y > 0);
  almost(flight.duration, horizon, 1e-10, 'exact horizon');
  almost(flight.samples.at(-1)!.t, horizon, 1e-10, 'final horizon sample');
});

test('seeded turbulence is repeatable and different seeds alter the trajectory', () => {
  const settings = { windSpeed: 1, windDirection: 65, turbulence: 0.35, seed: 1047, maxTime: 30 };
  const first = simulateFlight(DESIGNS[1], settings);
  const repeat = simulateFlight(DESIGNS[1], settings);
  const differentSeed = simulateFlight(DESIGNS[1], { ...settings, seed: 1048 });
  assert.deepEqual(repeat, first);
  assert.notDeepEqual(differentSeed.samples, first.samples);
  assert.deepEqual(
    simulateFlight(DESIGNS[1], { turbulence: 0, seed: 12 }).samples,
    simulateFlight(DESIGNS[1], { turbulence: 0, seed: 13 }).samples,
    'gust seed has no effect when turbulence is disabled',
  );
});

test('halving integration dt produces convergent calm-air duration and distance', () => {
  for (const design of DESIGNS) {
    const settings = { speed: 7, angle: 12, height: 1.5, windSpeed: 0, turbulence: 0, trim: 0, maxTime: 60 };
    const coarse = simulateFlight(design, { ...settings, dt: 1 / 120 });
    const fine = simulateFlight(design, { ...settings, dt: 1 / 240 });
    assert.ok(coarse.landed && fine.landed, `${design.name}: both integrations land`);
    almost(coarse.duration, fine.duration, Math.max(0.05, fine.duration * 0.025), `${design.name} duration convergence`);
    almost(coarse.distance, fine.distance, Math.max(0.15, fine.distance * 0.025), `${design.name} distance convergence`);
  }
});

test('wind directions use tailwind +X and crosswind +Z convention', () => {
  const design = DESIGNS[0];
  const settings = { speed: 7, angle: 5, height: 10, turbulence: 0, maxTime: 0.3, dt: 1 / 240 };
  const calm = simulateFlight(design, { ...settings, windSpeed: 0 }).samples.at(-1)!;
  const tail = simulateFlight(design, { ...settings, windSpeed: 2, windDirection: 0 }).samples.at(-1)!;
  const head = simulateFlight(design, { ...settings, windSpeed: 2, windDirection: 180 }).samples.at(-1)!;
  const positiveCrosswind = simulateFlight(design, { ...settings, windSpeed: 2, windDirection: 90 }).samples.at(-1)!;
  const negativeCrosswind = simulateFlight(design, { ...settings, windSpeed: 2, windDirection: 270 }).samples.at(-1)!;
  assert.ok(tail.vx > calm.vx && calm.vx > head.vx, 'headwind produces stronger initial deceleration than tailwind');
  assert.ok(positiveCrosswind.z > 0 && negativeCrosswind.z < 0, 'crosswind displacement follows signed wind');
  almost(positiveCrosswind.z, -negativeCrosswind.z, 1e-6, 'symmetric crosswind drift');
  assert.equal(DEFAULT_SETTINGS.windSpeed, 0, 'default comparison uses calm air');
});
