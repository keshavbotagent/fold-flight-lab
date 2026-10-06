import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS } from '../src/lib/designs.ts';
import { DEFAULT_SETTINGS, simulateFlight } from '../src/lib/physics.ts';
import { compareDesigns, optimizeDesigns } from '../src/lib/experiments.ts';
import type { RankedFlight } from '../src/lib/types.ts';

function verifyRanking(ranking: RankedFlight[]) {
  assert.equal(ranking.length, DESIGNS.length);
  assert.equal(new Set(ranking.map(entry => entry.design.id)).size, DESIGNS.length);
  for (let i = 0; i < ranking.length; i++) {
    const current = ranking[i];
    assert.equal(current.rank, i + 1);
    assert.equal(current.flight.designId, current.design.id);
    if (i > 0) {
      const previous = ranking[i - 1];
      if (previous.flight.landed === current.flight.landed) {
        assert.ok(previous.flight.duration >= current.flight.duration, 'ranking descends by airtime');
        if (previous.flight.duration === current.flight.duration) assert.ok(previous.flight.distance >= current.flight.distance, 'equal airtime uses distance tie-break');
      } else {
        assert.ok(previous.flight.landed, 'a completed flight outranks a time-limited flight');
      }
    }
  }
}

test('comparison is repeatable, complete, ranked by airtime, and uses identical launch conditions', () => {
  const settings = { speed: 7, angle: 10, height: 1.5, turbulence: 0.12, seed: 392, windSpeed: 0.5, windDirection: 90 };
  const snapshot = structuredClone(settings);
  const first = compareDesigns(settings);
  verifyRanking(first);
  assert.deepEqual(compareDesigns(settings), first, 'seeded comparison repeats exactly');
  assert.deepEqual(settings, snapshot, 'comparison does not mutate caller settings');
  for (const entry of first) assert.deepEqual(entry.flight.settings, { ...DEFAULT_SETTINGS, ...settings }, 'all designs have the same experiment settings');
});

test('optimizer gives every design the same exhaustive budget and is reproducible', async () => {
  const settings = { speed: 7, angle: 10, trim: 0, height: 1.5, windSpeed: 0, turbulence: 0, seed: 25, maxTime: 60 };
  const progress: { done: number; total: number }[] = [];
  const first = await optimizeDesigns(settings, (done, total) => progress.push({ done, total }));
  const second = await optimizeDesigns(settings);
  verifyRanking(first.ranking);
  assert.deepEqual(second, first, 'the same seed and budget produce the same optimum');
  const trialsPerDesign = first.ranges.angles.length * first.ranges.speeds.length * first.ranges.trims.length;
  assert.ok(trialsPerDesign >= 25, 'optimizer explores a meaningful combination set');
  assert.equal(first.trials, trialsPerDesign * DESIGNS.length, 'all geometries receive the full grid budget');
  assert.equal(progress[0].done, 0);
  assert.equal(progress.at(-1)!.done, first.trials);
  for (let i = 0; i < progress.length; i++) {
    assert.equal(progress[i].total, first.trials);
    assert.ok(progress[i].done >= 0 && progress[i].done <= first.trials);
    if (i > 0) assert.ok(progress[i].done >= progress[i - 1].done, 'progress does not go backward');
  }
  const baseline = compareDesigns(settings);
  for (const entry of first.ranking) {
    const launch = entry.flight.settings;
    assert.ok(first.ranges.angles.includes(launch.angle));
    assert.ok(first.ranges.speeds.includes(launch.speed));
    assert.ok(first.ranges.trims.includes(launch.trim));
    for (const key of ['height', 'windSpeed', 'windDirection', 'turbulence', 'seed', 'paperWeight', 'maxTime', 'dt', 'airTemperature', 'fieldElevation'] as const) {
      assert.equal(launch[key], { ...DEFAULT_SETTINGS, ...settings }[key], `${key} is held constant across optimizer candidates`);
    }
    const sameDesignBaseline = baseline.find(b => b.design.id === entry.design.id)!;
    if (sameDesignBaseline.flight.landed) assert.ok(entry.flight.duration >= sameDesignBaseline.flight.duration, `${entry.design.name}: exhaustive search retains or improves an admissible baseline`);
  }
  // Independently enumerate one complete airframe grid. A reported trial count
  // alone would not catch repeated candidates or a missed optimal combination.
  const design = DESIGNS[2];
  const candidates = first.ranges.angles.flatMap(angle => first.ranges.speeds.flatMap(speed => first.ranges.trims.map(trim =>
    simulateFlight(design, { ...settings, angle, speed, trim }),
  ))).filter(flight => flight.landed && !flight.truncated);
  assert.ok(candidates.length > 0);
  candidates.sort((a, b) => b.duration - a.duration || b.distance - a.distance);
  assert.deepEqual(first.ranking.find(entry => entry.design.id === design.id)!.flight, candidates[0], 'reported optimum matches an independent exhaustive search');

  const refined = first.ranking.map(entry => ({
    ...entry,
    flight: simulateFlight(entry.design, { ...entry.flight.settings, dt: 1 / 480 }),
  }));
  for (const entry of refined) {
    const original = first.ranking.find(item => item.design.id === entry.design.id)!.flight;
    assert.ok(Math.abs(original.duration - entry.flight.duration) <= Math.max(0.04, entry.flight.duration * 0.015), `${entry.design.name}: optimized airtime is stable at a fourfold finer integration step`);
  }
  refined.sort((a, b) => b.flight.duration - a.flight.duration || b.flight.distance - a.flight.distance);
  assert.equal(refined[0].design.id, first.ranking[0].design.id, 'the selected-launch winner survives finer integration without assuming a particular design');
});

test('optimizer rejects an already-aborted run without reporting progress', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(optimizeDesigns({}, () => { calls++; }, controller.signal), (error: unknown) => error instanceof Error && error.name === 'AbortError');
  assert.equal(calls, 0);
});

test('an in-progress optimization can be cancelled at a progress checkpoint', async () => {
  const controller = new AbortController();
  const checkpoints: { done: number; total: number }[] = [];
  await assert.rejects(optimizeDesigns({}, (done, total) => {
    checkpoints.push({ done, total });
    if (done > 0) controller.abort();
  }, controller.signal), (error: unknown) => error instanceof Error && error.name === 'AbortError');
  assert.equal(checkpoints[0].done, 0);
  assert.ok(checkpoints.some(({ done }) => done > 0), 'some work completed before cancellation');
  assert.ok(checkpoints.at(-1)!.done < checkpoints.at(-1)!.total, 'cancelled before the full grid finished');
});

test('comparison exposes time-limited flights as truncated rather than completed records', () => {
  const ranking = compareDesigns({ maxTime: 0.2, height: 20, speed: 6 });
  verifyRanking(ranking);
  for (const entry of ranking) {
    assert.equal(entry.flight.landed, false);
    assert.equal(entry.flight.truncated, true);
    assert.ok(entry.flight.samples.at(-1)!.y > 0);
  }
});

test('optimizer preserves censored outcomes when no candidate reaches the ground', async () => {
  const optimized = await optimizeDesigns({ maxTime: 0.2, height: 20, windSpeed: 0, turbulence: 0 });
  verifyRanking(optimized.ranking);
  for (const entry of optimized.ranking) {
    assert.equal(entry.flight.landed, false);
    assert.equal(entry.flight.truncated, true);
    assert.ok(entry.flight.samples.at(-1)!.y > 0);
  }
});
