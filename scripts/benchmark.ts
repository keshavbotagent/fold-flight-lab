import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESIGNS } from '../src/lib/designs';
import { compareDesigns, optimizeDesigns } from '../src/lib/experiments';
import { DEFAULT_SETTINGS, simulateFlight } from '../src/lib/physics';
import type { FlightResult, LaunchSettings, RankedFlight } from '../src/lib/types';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function option(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return args[index + 1];
}

const seedOption = option('--seed');
const seed = seedOption === undefined ? DEFAULT_SETTINGS.seed : Number(seedOption);
if (!Number.isFinite(seed) || !Number.isInteger(seed)) throw new Error('--seed must be an integer.');
const outputDir = path.resolve(projectRoot, option('--output-dir') ?? 'artifacts');
const settings: LaunchSettings = { ...DEFAULT_SETTINGS, seed };

function summary(flight: FlightResult) {
  const { samples: _samples, ...metrics } = flight;
  return metrics;
}

function summarizeRanking(ranking: RankedFlight[]) {
  return ranking.map(({ rank, design, flight }) => ({
    rank,
    designId: design.id,
    name: design.name,
    flight: summary(flight),
  }));
}

function completed(entry: RankedFlight): boolean {
  return entry.flight.landed && !entry.flight.truncated;
}

function rounded(value: number, digits = 3): string {
  return value.toFixed(digits);
}

function csvCell(value: string | number | boolean): string {
  const cell = String(value);
  return /[",\n\r]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

function table(ranking: RankedFlight[], optimized: boolean): string {
  const header = optimized
    ? '| Rank | Design | Airtime (s) | Distance (m) | Speed (m/s) | Angle (°) | Trim (°) | Status |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |'
    : '| Rank | Design | Airtime (s) | Distance (m) | Peak height (m) | Status |\n| --- | --- | ---: | ---: | ---: | --- |';
  const rows = ranking.map(({ rank, design, flight }) => {
    const metrics = optimized
      ? `${rounded(flight.duration)} | ${rounded(flight.distance)} | ${flight.settings.speed} | ${flight.settings.angle} | ${flight.settings.trim}`
      : `${rounded(flight.duration)} | ${rounded(flight.distance)} | ${rounded(flight.maxHeight)}`;
    return `| ${rank} | ${design.name} | ${metrics} | ${flight.landed && !flight.truncated ? 'Landed' : 'Time-capped; not a completed flight'} |`;
  });
  return [header, ...rows].join('\n');
}

console.log(`Comparing ${DESIGNS.length} paper-plane designs with shared seed ${seed}.`);
const baseline = compareDesigns(settings);
let lastReportedQuarter = -1;
const optimized = await optimizeDesigns(settings, (done, total) => {
  const quarter = Math.floor((done / total) * 4);
  if (quarter !== lastReportedQuarter) {
    lastReportedQuarter = quarter;
    console.log(`Optimization: ${done}/${total} equally allocated trials.`);
  }
});

// Compare the same selected launch settings at smaller integration steps.
// This checks numerical sensitivity without giving any airframe extra tuning.
const convergence = [1, 0.5, 0.25].map((factor) => {
  const flights = optimized.ranking.map(({ design, flight }) => ({
    design,
    flight: simulateFlight(design, { ...flight.settings, dt: settings.dt * factor }),
  }));
  flights.sort((a, b) => {
    const aCompleted = a.flight.landed && !a.flight.truncated;
    const bCompleted = b.flight.landed && !b.flight.truncated;
    if (aCompleted !== bCompleted) return aCompleted ? -1 : 1;
    return b.flight.duration - a.flight.duration || b.flight.distance - a.flight.distance;
  });
  return {
    dt: flights[0]?.flight.settings.dt ?? settings.dt * factor,
    ranking: flights.map((entry, index) => ({ ...entry, rank: index + 1 })),
  };
});

// Also repeat the complete, equal-budget grid at each smaller step. This checks
// whether refining integration changes the best launch, not merely its replay.
const gridConvergence: { dt: number; trials: number; ranking: RankedFlight[] }[] = [];
for (const factor of [1, 0.5, 0.25]) {
  const requestedDt = settings.dt * factor;
  if (factor !== 1) console.log(`Repeating the full equal-budget grid at dt=${requestedDt} s.`);
  const search = factor === 1 ? optimized : await optimizeDesigns({ ...settings, dt: requestedDt });
  gridConvergence.push({
    dt: search.ranking[0]?.flight.settings.dt ?? requestedDt,
    trials: search.trials,
    ranking: search.ranking,
  });
}

const packageMetadata = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const winner = optimized.ranking.find(completed);
const baselineWinner = baseline.find(completed);
const convergenceWinners = convergence.map(({ ranking }) => ranking.find(completed));
const selectedLaunchWinnerStable = Boolean(winner) && convergenceWinners.every((entry) => entry?.design.id === winner?.design.id);
const gridWinners = gridConvergence.map(({ ranking }) => ranking.find(completed));
const fullGridWinnerStable = Boolean(winner) && gridWinners.every((entry) => entry?.design.id === winner?.design.id);
const stableWinner = selectedLaunchWinnerStable && fullGridWinnerStable;
const finestWinner = convergenceWinners.at(-1);
const finestGridWinner = gridWinners.at(-1);
const trialsPerDesign = optimized.trials / DESIGNS.length;
const reportData = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  interpretation: 'Model predictions from a simplified paper-plane aerodynamic simulator; not measured physical flight results.',
  objective: 'Longest airtime among completed landings; distance breaks airtime ties. Time-capped trajectories cannot win optimization.',
  software: { name: packageMetadata.name, version: packageMetadata.version, three: packageMetadata.dependencies.three },
  baselineSettings: baseline[0]?.flight.settings ?? settings,
  designs: DESIGNS,
  baseline: summarizeRanking(baseline),
  optimization: {
    ranges: optimized.ranges,
    trials: optimized.trials,
    trialsPerDesign,
    changedVariables: ['angle', 'speed', 'trim'],
    sharedVariables: ['height', 'windSpeed', 'windDirection', 'turbulence', 'paperWeight', 'seed', 'maxTime', 'dt'],
    ranking: summarizeRanking(optimized.ranking),
  },
  convergence: {
    selectedLaunchWinnerStable,
    fullGridWinnerStable,
    additionalGridTrials: gridConvergence.slice(1).reduce((sum, search) => sum + search.trials, 0),
    fullGridSearchTrials: gridConvergence.reduce((sum, search) => sum + search.trials, 0),
    note: 'Selected launches are replayed and the full equal-budget grid is independently repeated at finer steps. Numerical sensitivity is not physical validation.',
    steps: convergence.map(({ dt, ranking }) => ({ dt, ranking: summarizeRanking(ranking) })),
    gridSearchSteps: gridConvergence.map(({ dt, trials, ranking }) => ({ dt, trials, ranking: summarizeRanking(ranking) })),
  },
};

const columns = [
  'experiment', 'rank', 'design_id', 'design', 'airtime_s', 'distance_m', 'peak_height_m',
  'final_speed_m_s', 'landed', 'truncated', 'stall_events', 'launch_speed_m_s',
  'launch_angle_deg', 'trim_deg', 'release_height_m', 'paper_gsm', 'wind_speed_m_s',
  'wind_direction_deg', 'turbulence', 'seed', 'dt_s', 'max_time_s',
];
const csvRows = [columns.join(',')];
const csvExperiments: [string, RankedFlight[]][] = [
  ['baseline', baseline],
  ['optimized', optimized.ranking],
  ...gridConvergence.slice(1).map(({ dt, ranking }): [string, RankedFlight[]] => [`optimized_dt_${dt}`, ranking]),
];
for (const [experiment, ranking] of csvExperiments) {
  for (const { rank, design, flight } of ranking) {
    csvRows.push([
      experiment, rank, design.id, design.name, flight.duration, flight.distance,
      flight.maxHeight, flight.finalSpeed, flight.landed, flight.truncated, flight.stallEvents,
      flight.settings.speed, flight.settings.angle, flight.settings.trim, flight.settings.height,
      flight.settings.paperWeight, flight.settings.windSpeed, flight.settings.windDirection,
      flight.settings.turbulence, flight.settings.seed, flight.settings.dt, flight.settings.maxTime,
    ].map(csvCell).join(','));
  }
}

const modelFinding = winner
  ? `**${winner.design.name} has the longest completed flight in this search: ${rounded(winner.flight.duration)} s**, covering ${rounded(winner.flight.distance)} m at ${winner.flight.settings.speed} m/s, a ${winner.flight.settings.angle}° launch angle, and ${winner.flight.settings.trim}° trim. This is a simulation prediction, not a physical endurance record.`
  : '**No airframe completed a landing within the time cap. The search cannot identify a longest completed flight.**';
const sensitivityFinding = winner && !stableWinner
  ? `**The leading design changes when the integration step is refined.** At the finest tested step, ${finestGridWinner?.design.name ?? 'no airframe'} leads the complete grid${finestGridWinner ? ` at ${rounded(finestGridWinner.flight.duration)} s` : ''}, while ${finestWinner?.design.name ?? 'no airframe'} leads the selected-launch replay. A numerically stable winner has not been established; the top candidates need a converged rerun before a firm model ranking.`
  : winner
    ? `The leader remains ${winner.design.name} at all three tested integration steps, including independent repeats of the complete equal-budget search.`
    : 'No completed winner was available at the baseline integration step.';
const baselineFinding = baselineWinner
  ? `With one identical release for every airframe, ${baselineWinner.design.name} leads at ${rounded(baselineWinner.flight.duration)} s.`
  : 'No baseline flight landed within the time cap.';
const convergenceRows = convergence.map(({ dt, ranking }) => {
  const leading = ranking.find(completed);
  const selected = winner && ranking.find((entry) => entry.design.id === winner.design.id);
  return `| ${rounded(dt, 5)} | ${leading?.design.name ?? 'No completed landing'} | ${leading ? rounded(leading.flight.duration, 5) : '—'} | ${selected ? rounded(selected.flight.duration, 5) : '—'} |`;
});
const gridRows = gridConvergence.map(({ dt, trials, ranking }) => {
  const leading = ranking.find(completed);
  return `| ${rounded(dt, 5)} | ${trials} | ${leading?.design.name ?? 'No completed landing'} | ${leading ? rounded(leading.flight.duration, 5) : '—'} | ${leading?.flight.settings.speed ?? '—'} | ${leading?.flight.settings.angle ?? '—'} | ${leading?.flight.settings.trim ?? '—'} |`;
});
const baselineSettings = baseline[0]?.flight.settings ?? settings;
const markdown = [
  '# Paper-plane flight experiment',
  '',
  modelFinding,
  '',
  sensitivityFinding,
  '',
  baselineFinding,
  '',
  '## Fair comparison settings',
  '',
  `All ${DESIGNS.length} airframes use ${baselineSettings.paperWeight} gsm paper, a ${baselineSettings.height} m release height, ${baselineSettings.windSpeed} m/s wind at ${baselineSettings.windDirection}°, turbulence ${baselineSettings.turbulence}, gust seed ${baselineSettings.seed}, integration step ${baselineSettings.dt} s, and a ${baselineSettings.maxTime} s time cap. A4 paper area and stock determine mass consistently across all designs.`,
  '',
  `The baseline release uses ${baselineSettings.speed} m/s speed, ${baselineSettings.angle}° elevation, and ${baselineSettings.trim}° additional trim. Rankings compare airtime first, then distance.`,
  'Distance is final horizontal displacement from launch.',
  '',
  table(baseline, false),
  '',
  '## Equal-budget launch and trim search',
  '',
  `Each design receives exactly ${trialsPerDesign} trials (${optimized.trials} total): angles [${optimized.ranges.angles.join(', ')}]°, speeds [${optimized.ranges.speeds.join(', ')}] m/s, and additional trim [${optimized.ranges.trims.join(', ')}]°. Only these three variables vary. Environment, paper, release height, and seed remain fixed. Each reported flight preserves its actual simulated settings.`,
  '',
  'Completed landings are eligible to win. Time-capped trajectories are censored observations: their duration is a lower bound and they are excluded from winner selection. If every trial of an airframe is capped, its marked fallback appears after completed flights.',
  '',
  table(optimized.ranking, true),
  '',
  '## Integration-step sensitivity',
  '',
  'The best launch settings selected above are replayed at three integration steps without retuning. Agreement checks numerical stability of this model; it does not validate real-world aerodynamics.',
  '',
  '| Step (s) | Leading design | Leading airtime (s) | Original winner airtime (s) |',
  '| ---: | --- | ---: | ---: |',
  ...convergenceRows,
  '',
  `The complete ${optimized.trials}-trial grid is also repeated independently at each finer step, giving ${reportData.convergence.fullGridSearchTrials} grid-search trials in total. Every design receives the same search budget at each step.`,
  '',
  '| Step (s) | Trials | Grid winner | Airtime (s) | Speed (m/s) | Angle (°) | Trim (°) |',
  '| ---: | ---: | --- | ---: | ---: | ---: | ---: |',
  ...gridRows,
  '',
  '## Interpretation and reproduction',
  '',
  'The simulator uses heuristic aerodynamic coefficients and simplified stability. It cannot reproduce detailed fold geometry, deformation, center-of-mass errors, room drafts, or human release variability. The winner is the longest predicted flight within this finite launch/trim grid and these assumptions; other grid bounds or physical calibration may change the ranking.',
  '',
  `Run \`npm run benchmark -- --seed ${seed}\` from the project directory to reproduce the metrics. \`--output-dir <path>\` changes the destination. All reported rows are generated from the shared physics engine used by the interactive simulator.`,
  '',
  '- `benchmark.json`: settings, airframe coefficients, full-precision metrics, search ranges, and step-sensitivity results.',
  '- `benchmark.csv`: full-precision baseline, optimized, and independently refined-grid results for spreadsheets.',
  '',
  `Software: ${packageMetadata.name} ${packageMetadata.version}; Three.js ${packageMetadata.dependencies.three}.`,
  '',
].join('\n');

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'benchmark.json'), `${JSON.stringify(reportData, null, 2)}\n`);
await writeFile(path.join(outputDir, 'benchmark.csv'), `${csvRows.join('\n')}\n`);
await writeFile(path.join(outputDir, 'benchmark.md'), markdown);
console.log(winner
  ? `Longest completed flight: ${winner.design.name}, ${rounded(winner.flight.duration)} s.`
  : 'No completed flight; no winner selected.');
console.log(`Reports written to ${outputDir}`);
