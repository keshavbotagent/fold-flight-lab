import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DESIGNS } from '../src/lib/designs.ts';
import { OPTIMIZATION_RANGES } from '../src/lib/experiments.ts';
import { DEFAULT_SETTINGS, PHYSICS_VERSION, simulateFlight } from '../src/lib/physics.ts';
import type { FlightResult } from '../src/lib/types.ts';

type StoredRow = { rank: number; designId: string; name: string; flight: Omit<FlightResult, 'samples'> };

test('the shipped leaderboard fixture is current, reproducible and sorted by completed airtime', () => {
  const fixture = JSON.parse(readFileSync(new URL('../src/data/tested-results.json', import.meta.url), 'utf8')) as {
    baselineSettings: typeof DEFAULT_SETTINGS;
    distanceOptimization: { ranking: StoredRow[]; trials: number; ranges: typeof OPTIMIZATION_RANGES };
    optimization: { ranking: StoredRow[]; trials: number; sharedVariables: string[]; ranges: { angles: number[]; speeds: number[]; trims: number[] } };
  };
  const { optimization } = fixture;
  assert.deepEqual(fixture.baselineSettings, DEFAULT_SETTINGS, 'shipped baseline uses current defaults');
  assert.deepEqual(optimization.ranges, OPTIMIZATION_RANGES, 'shipped search uses the current domain');
  assert.deepEqual(fixture.distanceOptimization.ranges, OPTIMIZATION_RANGES);
  assert.equal(fixture.distanceOptimization.trials, optimization.trials);
  for (const [index, row] of fixture.distanceOptimization.ranking.entries()) {
    for (const key of optimization.sharedVariables as (keyof typeof DEFAULT_SETTINGS)[]) {
      assert.equal(row.flight.settings[key], DEFAULT_SETTINGS[key], `${row.name}: ${key} matches current held defaults`);
    }
    const design = DESIGNS.find(candidate => candidate.id === row.designId)!;
    const flight = simulateFlight(design, row.flight.settings);
    assert.ok(flight.landed && !flight.truncated);
    assert.ok(Math.abs(flight.distance - row.flight.distance) <= 1e-9);
    if (index) assert.ok(fixture.distanceOptimization.ranking[index - 1].flight.distance >= flight.distance);
  }
  assert.equal(optimization.ranking.length, DESIGNS.length);
  assert.equal(new Set(optimization.ranking.map(row => row.designId)).size, DESIGNS.length);
  assert.ok(optimization.sharedVariables.includes('airTemperature') && optimization.sharedVariables.includes('fieldElevation'), 'benchmark records the held atmosphere conditions');
  assert.ok(optimization.sharedVariables.includes('relativeHumidity') && optimization.sharedVariables.includes('seaLevelPressure'), 'benchmark holds humidity and sea-level pressure fixed');
  assert.equal(optimization.trials, DESIGNS.length * optimization.ranges.angles.length * optimization.ranges.speeds.length * optimization.ranges.trims.length);
  let previous: FlightResult | undefined;
  for (let i = 0; i < optimization.ranking.length; i++) {
    const row = optimization.ranking[i];
    assert.equal(row.rank, i + 1);
    assert.equal(row.flight.modelVersion, PHYSICS_VERSION, `${row.name}: stored model version must match the current solver`);
    for (const key of optimization.sharedVariables as (keyof typeof DEFAULT_SETTINGS)[]) {
      assert.equal(row.flight.settings[key], DEFAULT_SETTINGS[key], `${row.name}: ${key} matches current held defaults`);
    }
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      assert.ok(Object.hasOwn(row.flight.settings, key), `${row.name}: stored launch includes ${key}`);
      assert.ok(Number.isFinite(row.flight.settings[key as keyof typeof DEFAULT_SETTINGS]), `${row.name}: finite stored ${key}`);
    }
    const design = DESIGNS.find(candidate => candidate.id === row.designId);
    assert.ok(design, `${row.name}: current catalog contains the stored airframe`);
    const rerun = simulateFlight(design, row.flight.settings);
    assert.deepEqual(rerun.settings, row.flight.settings);
    for (const metric of ['duration', 'distance', 'maxHeight', 'finalSpeed'] as const) {
      assert.ok(Math.abs(rerun[metric] - row.flight[metric]) <= 1e-9, `${row.name}: stored ${metric} ${row.flight[metric]} differs from current ${rerun[metric]}`);
    }
    assert.equal(rerun.landed, row.flight.landed);
    assert.equal(rerun.truncated, row.flight.truncated);
    if (previous) {
      if (previous.landed !== rerun.landed) assert.ok(previous.landed, 'completed flights precede time-limited observations');
      else {
        assert.ok(previous.duration >= rerun.duration, 'current reruns remain in descending airtime order');
        if (previous.duration === rerun.duration) assert.ok(previous.distance >= rerun.distance, 'current ties use distance');
      }
    }
    previous = rerun;
  }
});
