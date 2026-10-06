import { DESIGNS } from './designs';
import { DEFAULT_SETTINGS, simulateFlight } from './physics';
import type {
  FlightResult,
  LaunchSettings,
  OptimizationResult,
  OptimizationObjective,
  RankedFlight,
} from './types';

// Every design receives this entire grid. Weather, paper, release height,
// atmospheric temperature/elevation, integration step, and gust seed remain
// identical for every trial.
export const OPTIMIZATION_RANGES = Object.freeze({
  angles: Object.freeze([0, 5, 10, 15, 20, 25, 30, 45, 60, 75, 90]),
  speeds: Object.freeze([4, 5.5, 7, 8.5, 10, 15, 17.5, 20, 25]),
  trims: Object.freeze([-2, 0, 2]),
});

const TRIALS_PER_YIELD = 12;
const YIELD_BUDGET_MS = 16;

/** Positive means a has the better simulated result. */
function flightScore(a: FlightResult, b: FlightResult, objective: OptimizationObjective): number {
  return objective === 'distance'
    ? a.distance - b.distance || a.duration - b.duration
    : a.duration - b.duration || a.distance - b.distance;
}

/** A time-capped trajectory is a censored observation, not a winning flight. */
function isCompleted(flight: FlightResult): boolean {
  return flight.landed && !flight.truncated;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('The flight experiment was cancelled.', 'AbortError');
  }
}

function rank(flights: Omit<RankedFlight, 'rank'>[], objective: OptimizationObjective): RankedFlight[] {
  return flights
    .sort((a, b) => {
      if (isCompleted(a.flight) !== isCompleted(b.flight)) {
        return isCompleted(a.flight) ? -1 : 1;
      }
      return -flightScore(a.flight, b.flight, objective);
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/** Compare all designs at one identical release, paper stock, and weather. */
export function compareDesigns(settings: Partial<LaunchSettings> = {}, objective: OptimizationObjective = 'airtime'): RankedFlight[] {
  const sharedSettings = { ...DEFAULT_SETTINGS, ...settings };
  return rank(
    DESIGNS.map((design) => ({
      design,
      flight: simulateFlight(design, { ...sharedSettings }),
    })), objective,
  );
}

/**
 * Maximize the chosen metric among landed flights. Each airframe
 * receives the same finite grid: no design-specific budget or gust-seed search.
 * Only each design's best trajectory is retained. Capped flights are preserved
 * as a clearly marked fallback if an airframe never lands within the time cap.
 */
export async function optimizeDesigns(
  settings: Partial<LaunchSettings> = {},
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
  objective: OptimizationObjective = 'airtime',
): Promise<OptimizationResult> {
  throwIfAborted(signal);
  const sharedSettings = { ...DEFAULT_SETTINGS, ...settings };
  // Snapshot the grid so callers cannot change an in-progress experiment.
  const ranges = {
    angles: [...OPTIMIZATION_RANGES.angles],
    speeds: [...OPTIMIZATION_RANGES.speeds],
    trims: [...OPTIMIZATION_RANGES.trims],
  };
  const total = DESIGNS.length * ranges.angles.length * ranges.speeds.length * ranges.trims.length;
  const bestFlights: Omit<RankedFlight, 'rank'>[] = [];
  let done = 0;
  let trialsSinceYield = 0;
  let lastReported = 0;
  let yieldDeadline = performance.now() + YIELD_BUDGET_MS;
  onProgress?.(0, total);

  for (const design of DESIGNS) {
    let bestCompleted: FlightResult | undefined;
    let bestCapped: FlightResult | undefined;
    for (const angle of ranges.angles) {
      for (const speed of ranges.speeds) {
        for (const trim of ranges.trims) {
          throwIfAborted(signal);
          const flight = simulateFlight(design, { ...sharedSettings, angle, speed, trim });
          if (isCompleted(flight)) {
            if (!bestCompleted || flightScore(flight, bestCompleted, objective) > 0) bestCompleted = flight;
          } else if (!bestCapped || flightScore(flight, bestCapped, objective) > 0) {
            bestCapped = flight;
          }
          done += 1;
          trialsSinceYield += 1;

          if (trialsSinceYield >= TRIALS_PER_YIELD || performance.now() >= yieldDeadline) {
            onProgress?.(done, total);
            lastReported = done;
            // A macrotask yield lets the browser paint, process cancellation,
            // and keep camera interaction live while the grid is evaluated.
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
            throwIfAborted(signal);
            trialsSinceYield = 0;
            yieldDeadline = performance.now() + YIELD_BUDGET_MS;
          }
        }
      }
    }
    const flight = bestCompleted ?? bestCapped;
    if (flight) bestFlights.push({ design, flight });
  }

  throwIfAborted(signal);
  if (lastReported !== done) onProgress?.(done, total);
  return { objective, ranking: rank(bestFlights, objective), trials: done, ranges };
}
