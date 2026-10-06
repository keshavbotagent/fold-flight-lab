import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESIGNS } from '../src/lib/designs';
import { AIR_GAS_CONSTANT, EARTH_RADIUS, STANDARD_GRAVITY } from '../src/lib/atmosphere';
import { compareDesigns, optimizeDesigns } from '../src/lib/experiments';
import { DEFAULT_SETTINGS, getAtmosphere, PHYSICS_VERSION, simulateFlight } from '../src/lib/physics';
import { INDOOR_ENVIRONMENT, NEW_DELHI_ENVIRONMENT } from '../src/lib/environment';
import type { FlightResult, FlightSample, LaunchSettings, RankedFlight } from '../src/lib/types';

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
const DURATION_TOLERANCE_PERCENT = 1;

function sampledRange(flight: FlightResult, key: keyof FlightSample) {
  const values = flight.samples.map((entry) => entry[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return values.length ? { min: Math.min(...values), max: Math.max(...values) } : undefined;
}

function summary(flight: FlightResult) {
  const { samples: _samples, ...metrics } = flight;
  return {
    ...metrics,
    sampledAerodynamics: {
      airspeedMetersPerSecond: sampledRange(flight, 'airspeed'),
      densityKgPerCubicMeter: sampledRange(flight, 'density'),
      reynoldsNumber: sampledRange(flight, 'reynolds'),
      angleOfAttackRadians: sampledRange(flight, 'alpha'),
      liftNewtons: sampledRange(flight, 'lift'),
      dragNewtons: sampledRange(flight, 'drag'),
    },
  };
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

async function profiledSearch(launch: Partial<LaunchSettings>, reportProgress = false) {
  const started = performance.now();
  const cpuStarted = process.cpuUsage();
  let previousCheckpoint = started;
  let previousDone = 0;
  let maxProgressIntervalMs = 0;
  let maxTrialsBetweenCheckpoints = 0;
  let lastReportedQuarter = -1;
  const result = await optimizeDesigns(launch, (done, total) => {
    const now = performance.now();
    if (done > previousDone) {
      maxProgressIntervalMs = Math.max(maxProgressIntervalMs, now - previousCheckpoint);
      maxTrialsBetweenCheckpoints = Math.max(maxTrialsBetweenCheckpoints, done - previousDone);
    }
    previousCheckpoint = now;
    previousDone = done;
    const quarter = Math.floor((done / total) * 4);
    if (reportProgress && quarter !== lastReportedQuarter) {
      lastReportedQuarter = quarter;
      console.log(`Optimization: ${done}/${total} equally allocated trials.`);
    }
  });
  const cpu = process.cpuUsage(cpuStarted);
  return {
    result,
    performance: {
      elapsedMs: performance.now() - started,
      cpuMs: (cpu.user + cpu.system) / 1000,
      maxProgressIntervalMs,
      maxTrialsBetweenCheckpoints,
      note: 'Execution-machine measurements; browser timing depends on hardware and scheduling. Progress intervals include event-loop yields.',
    },
  };
}

function replayAtStep(dt: number, ranking: RankedFlight[]) {
  const flights = ranking.map(({ design, flight }) => ({
    design,
    flight: simulateFlight(design, { ...flight.settings, dt }),
  }));
  flights.sort((a, b) => {
    const aCompleted = a.flight.landed && !a.flight.truncated;
    const bCompleted = b.flight.landed && !b.flight.truncated;
    if (aCompleted !== bCompleted) return aCompleted ? -1 : 1;
    return b.flight.duration - a.flight.duration || b.flight.distance - a.flight.distance;
  });
  return {
    requestedDt: dt,
    dt: flights[0]?.flight.settings.dt ?? dt,
    ranking: flights.map((entry, index) => ({ ...entry, rank: index + 1 })),
  };
}

type StepResult = { dt: number; ranking: RankedFlight[] };
function numericalCheck(replays: StepResult[], grids: StepResult[]) {
  // Sanitization may clamp a requested refinement. Duplicate actual steps do
  // not count as additional convergence evidence.
  const distinct = (steps: StepResult[]) => steps.filter((step, index) =>
    index === 0 || Math.abs(step.dt - steps[index - 1].dt) > 1e-12);
  const replaySteps = distinct(replays);
  const gridSteps = distinct(grids);
  const first = replaySteps[0];
  const previous = replaySteps.at(-2);
  const finest = replaySteps.at(-1);
  const previousGrid = gridSteps.at(-2);
  const finestGrid = gridSteps.at(-1);
  const changePercent = (a: number, b: number) => b > 0 ? Math.abs(a - b) / b * 100 : a === b ? 0 : 100;
  const perDesign = DESIGNS.map((design) => {
    const a = previous?.ranking.find((entry) => entry.design.id === design.id);
    const b = finest?.ranking.find((entry) => entry.design.id === design.id);
    const initial = first?.ranking.find((entry) => entry.design.id === design.id);
    const gridA = previousGrid?.ranking.find((entry) => entry.design.id === design.id);
    const gridB = finestGrid?.ranking.find((entry) => entry.design.id === design.id);
    return {
      designId: design.id,
      name: design.name,
      replayDurationChangePercent: a && b ? changePercent(a.flight.duration, b.flight.duration) : undefined,
      defaultToFinestReplayDurationChangePercent: initial && b ? changePercent(initial.flight.duration, b.flight.duration) : undefined,
      gridDurationChangePercent: gridA && gridB ? changePercent(gridA.flight.duration, gridB.flight.duration) : undefined,
      completionConsistent: Boolean(a && b && gridA && gridB)
        && a!.flight.landed === b!.flight.landed && a!.flight.truncated === b!.flight.truncated
        && gridA!.flight.landed === gridB!.flight.landed && gridA!.flight.truncated === gridB!.flight.truncated,
    };
  });
  const maxChange = (key: 'replayDurationChangePercent' | 'gridDurationChangePercent' | 'defaultToFinestReplayDurationChangePercent') =>
    Math.max(0, ...perDesign.map((entry) => entry[key] ?? Infinity));
  const initialWinner = first?.ranking.find(completed);
  const selectedLaunchWinnerStable = Boolean(initialWinner) && replaySteps.every((step) =>
    step.ranking.find(completed)?.design.id === initialWinner!.design.id);
  const fullGridWinnerStable = Boolean(initialWinner) && gridSteps.every((step) =>
    step.ranking.find(completed)?.design.id === initialWinner!.design.id);
  const maxReplayDurationChangePercent = maxChange('replayDurationChangePercent');
  const maxGridDurationChangePercent = maxChange('gridDurationChangePercent');
  const completionConsistent = perDesign.every((entry) => entry.completionConsistent);
  return {
    tolerancePercent: DURATION_TOLERANCE_PERCENT,
    comparedStepsSeconds: [previous?.dt, finest?.dt],
    distinctSteps: replaySteps.length,
    selectedLaunchWinnerStable,
    fullGridWinnerStable,
    completionConsistent,
    maxReplayDurationChangePercent,
    maxGridDurationChangePercent,
    maxDefaultToFinestReplayDurationChangePercent: maxChange('defaultToFinestReplayDurationChangePercent'),
    passed: replaySteps.length >= 3 && gridSteps.length >= 3 && selectedLaunchWinnerStable
      && fullGridWinnerStable && completionConsistent
      && maxReplayDurationChangePercent <= DURATION_TOLERANCE_PERCENT
      && maxGridDurationChangePercent <= DURATION_TOLERANCE_PERCENT,
    perDesign,
    interpretation: 'Numerical step-sensitivity check using a declared 1% duration tolerance; not validation of physical flight accuracy.',
  };
}

console.log(`Comparing ${DESIGNS.length} paper-plane designs with shared seed ${seed}.`);
const baseline = compareDesigns(settings);
if (baseline.some((entry) => entry.flight.modelVersion !== PHYSICS_VERSION)) {
  throw new Error('Flight model versions do not match the benchmark engine; no reports were written.');
}
const primarySearch = await profiledSearch(settings, true);
const optimized = primarySearch.result;
const distanceSearch = await optimizeDesigns(settings, undefined, undefined, 'distance');
const distanceRefined = distanceSearch.ranking.map(row => ({ ...row, flight: simulateFlight(row.design, { ...row.flight.settings, dt: settings.dt / 4 }) }));
const distanceNumericalCheck = distanceRefined.every(row => {
  const original = distanceSearch.ranking.find(item => item.design.id === row.design.id)!.flight;
  return row.flight.landed === original.landed && Math.abs(row.flight.distance - original.distance) <= Math.max(0.001, original.distance * 0.01);
});
if (!distanceNumericalCheck) throw new Error('Distance launch replays exceed 1% numerical tolerance.');
console.log(`Primary search: ${rounded(primarySearch.performance.elapsedMs / 1000)} s wall; ${rounded(primarySearch.performance.cpuMs / 1000)} s CPU; max progress interval ${rounded(primarySearch.performance.maxProgressIntervalMs)} ms.`);

// Compare the same selected launch settings at smaller integration steps.
// This checks numerical sensitivity without giving any airframe extra tuning.
const convergence = [1, 0.5, 0.25].map((factor) => replayAtStep(settings.dt * factor, optimized.ranking));

// Also repeat the complete, equal-budget grid at each smaller step. This checks
// whether refining integration changes the best launch, not merely its replay.
const gridConvergence: { requestedDt: number; dt: number; trials: number; ranking: RankedFlight[]; performance: typeof primarySearch.performance }[] = [];
for (const factor of [1, 0.5, 0.25]) {
  const requestedDt = settings.dt * factor;
  if (factor !== 1) console.log(`Repeating the full equal-budget grid at dt=${requestedDt} s.`);
  const profiled = factor === 1 ? primarySearch : await profiledSearch({ ...settings, dt: requestedDt });
  const search = profiled.result;
  gridConvergence.push({
    requestedDt,
    dt: search.ranking[0]?.flight.settings.dt ?? requestedDt,
    trials: search.trials,
    ranking: search.ranking,
    performance: profiled.performance,
  });
}
let stepCheck = numericalCheck(convergence, gridConvergence);
if (!stepCheck.passed) {
  const requestedDt = settings.dt / 8;
  console.log(`Numerical check needs more evidence; repeating all designs at requested dt=${requestedDt} s.`);
  convergence.push(replayAtStep(requestedDt, optimized.ranking));
  const refined = await profiledSearch({ ...settings, dt: requestedDt });
  gridConvergence.push({
    requestedDt,
    dt: refined.result.ranking[0]?.flight.settings.dt ?? requestedDt,
    trials: refined.result.trials,
    ranking: refined.result.ranking,
    performance: refined.performance,
  });
  stepCheck = numericalCheck(convergence, gridConvergence);
}

const packageMetadata = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const winner = optimized.ranking.find(completed);
const baselineWinner = baseline.find(completed);
const selectedLaunchWinnerStable = stepCheck.selectedLaunchWinnerStable;
const fullGridWinnerStable = stepCheck.fullGridWinnerStable;
const stableWinner = stepCheck.passed;
const finestWinner = convergence.at(-1)?.ranking.find(completed);
const finestGridWinner = gridConvergence.at(-1)?.ranking.find(completed);
const trialsPerDesign = optimized.trials / DESIGNS.length;
const baselineSettings = baseline[0]?.flight.settings ?? settings;
const groundAtmosphere = getAtmosphere(baselineSettings, 0);
const launchAtmosphere = getAtmosphere(baselineSettings, baselineSettings.height);
const modelDocumentation = await readFile(path.join(projectRoot, 'docs', 'model.md'), 'utf8');
const sourceReferences = [...new Set([
  NEW_DELHI_ENVIRONMENT.sources.elevation,
  NEW_DELHI_ENVIRONMENT.sources.climate,
  'https://cires1.colorado.edu/~voemel/vp.html',
  'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/',
  'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/induced-drag-coefficient/',
  'https://www.grc.nasa.gov/www/k-12/airplane/viscosity.html',
  'https://www.grc.nasa.gov/www/k-12/airplane/atmosmet.html',
  'https://ocw.mit.edu/courses/16-333-aircraft-stability-and-control-fall-2004/pages/lecture-notes/',
  ...Array.from(modelDocumentation.matchAll(/https:\/\/[^\s)>\]]+/g), (match) => match[0]),
  ...DESIGNS.flatMap(design => design.achievement ? [design.achievement.sourceUrl, design.achievement.designSourceUrl] : []),
])];
type PriorReport = {
  modelVersion?: string;
  generatedAt: string;
  baselineSettings: Partial<LaunchSettings>;
  optimization: {
    trials: number;
    ranges: typeof optimized.ranges;
    ranking: { rank: number; designId: string; name: string; flight: { duration: number } }[];
  };
};
const priorText = await readFile(path.join(projectRoot, 'artifacts', 'v1-benchmark.json'), 'utf8').catch(() => undefined);
const priorReport: PriorReport | undefined = priorText ? JSON.parse(priorText) : undefined;
const commonSettingKeys = ['speed', 'angle', 'height', 'windSpeed', 'windDirection', 'turbulence', 'paperWeight', 'trim', 'seed', 'maxTime', 'dt'] as const;
const modelChangeComparison = priorReport ? {
  previousModelVersion: priorReport.modelVersion ?? '1.0-aerodynamic-relaxation',
  currentModelVersion: PHYSICS_VERSION,
  previousGeneratedAt: priorReport.generatedAt,
  source: 'artifacts/v1-benchmark.json',
  commonConditionsEqual: commonSettingKeys.every((key) => priorReport.baselineSettings[key] === baselineSettings[key]),
  sameGridAndBudget: priorReport.optimization.trials === optimized.trials
    && JSON.stringify(priorReport.optimization.ranges) === JSON.stringify(optimized.ranges),
  previousTopThree: priorReport.optimization.ranking.slice(0, 3).map((entry) => ({
    rank: entry.rank, designId: entry.designId, name: entry.name, duration: entry.flight.duration,
  })),
  currentTopThree: optimized.ranking.slice(0, 3).map(({ rank, design, flight }) => ({
    rank, designId: design.id, name: design.name, duration: flight.duration,
  })),
  interpretation: 'Before/after model predictions. The rigid-body equations, atmosphere, and estimated coefficients changed; differences are not evidence of improved physical accuracy.',
} : undefined;
const reportData = {
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  modelVersion: PHYSICS_VERSION,
  environmentPreset: INDOOR_ENVIRONMENT,
  interpretation: 'Model predictions from a six-degree-of-freedom rigid-body paper-plane simulator with estimated coefficients; not measured physical flight results.',
  objective: 'Longest airtime among completed landings; distance breaks airtime ties. Time-capped trajectories cannot win optimization.',
  software: { name: packageMetadata.name, version: packageMetadata.version, three: packageMetadata.dependencies.three },
  physics: {
    modelVersion: PHYSICS_VERSION,
    degreesOfFreedom: 6,
    attitudeRepresentation: 'unit quaternion',
    motion: 'aerodynamic force and torque with mass and body inertia',
    physicalCalibrationPerformed: false,
    estimatedParameters: ['projected geometry', 'lift slope', 'maximum lift coefficient', 'profile drag coefficient', 'center of gravity', 'aerodynamic center', 'stability and damping derivatives', 'span efficiency', 'inertia distribution factors'],
    sourceDocumentation: 'docs/model.md in the source bundle',
    sourceReferences,
  },
  atmosphere: {
    conditions: { airTemperatureCelsius: baselineSettings.airTemperature, fieldElevationMeters: baselineSettings.fieldElevation,
      relativeHumidityPercent: baselineSettings.relativeHumidity, seaLevelPressureHpa: baselineSettings.seaLevelPressure },
    units: { altitudeMSL: 'm', gravity: 'm/s²', density: 'kg/m³', dynamicViscosity: 'Pa·s', pressure: 'Pa', temperatureKelvin: 'K', relativeHumidity: '%', vaporPressure: 'Pa' },
    ground: groundAtmosphere,
    launch: launchAtmosphere,
    constants: {
      standardGravityMetersPerSecondSquared: STANDARD_GRAVITY,
      earthRadiusMeters: EARTH_RADIUS,
      airGasConstantJoulesPerKgKelvin: AIR_GAS_CONSTANT,
    },
    notes: 'Gravity varies with absolute altitude. ISA altitude reduction uses the selected sea-level pressure; local temperature and water-vapor partial pressure determine moist-air density. Relative humidity is held constant over the local flight. Sutherland viscosity remains a dry-air approximation. The New Delhi preset is representative climate data, not live weather.',
  },
  baselineSettings,
  modelChangeComparison,
  designs: DESIGNS,
  baseline: summarizeRanking(baseline),
  distanceOptimization: { objective: distanceSearch.objective, trials: distanceSearch.trials, ranges: distanceSearch.ranges, ranking: summarizeRanking(distanceSearch.ranking), numericalCheck: { passed: distanceNumericalCheck, distanceTolerancePercent: 1, refinedReplayStep: settings.dt / 4, ranking: summarizeRanking(distanceRefined) } },
  optimization: {
    objective: optimized.objective,
    ranges: optimized.ranges,
    trials: optimized.trials,
    trialsPerDesign,
    changedVariables: ['angle', 'speed', 'trim'],
    sharedVariables: ['height', 'windSpeed', 'windDirection', 'turbulence', 'paperWeight', 'seed', 'maxTime', 'dt', 'airTemperature', 'fieldElevation', 'relativeHumidity', 'seaLevelPressure'],
    ranking: summarizeRanking(optimized.ranking),
    performance: primarySearch.performance,
  },
  convergence: {
    selectedLaunchWinnerStable,
    fullGridWinnerStable,
    numericalCheck: stepCheck,
    additionalGridTrials: gridConvergence.slice(1).reduce((sum, search) => sum + search.trials, 0),
    fullGridSearchTrials: gridConvergence.reduce((sum, search) => sum + search.trials, 0),
    note: 'Selected launches are replayed and the full equal-budget grid is independently repeated at finer steps. Numerical sensitivity is not physical validation.',
    steps: convergence.map(({ requestedDt, dt, ranking }) => ({ requestedDt, dt, ranking: summarizeRanking(ranking) })),
    gridSearchSteps: gridConvergence.map(({ requestedDt, dt, trials, ranking, performance: timing }) => ({ requestedDt, dt, trials, ranking: summarizeRanking(ranking), performance: timing })),
  },
};

const columns = [
  'experiment', 'rank', 'design_id', 'design', 'airtime_s', 'distance_m', 'peak_height_m',
  'final_speed_m_s', 'landed', 'truncated', 'stall_events', 'launch_speed_m_s',
  'launch_angle_deg', 'trim_deg', 'release_height_m', 'paper_gsm', 'wind_speed_m_s',
  'wind_direction_deg', 'turbulence', 'seed', 'dt_s', 'max_time_s',
  'air_temperature_c', 'field_elevation_m', 'relative_humidity_percent', 'sea_level_pressure_hpa',
  'release_altitude_msl_m', 'peak_altitude_msl_m', 'model_version', 'mass_kg',
  'launch_gravity_m_s2', 'launch_density_kg_m3', 'launch_viscosity_pa_s', 'launch_pressure_pa',
  'sampled_reynolds_min', 'sampled_reynolds_max',
];
const csvRows = [columns.join(',')];
const csvExperiments: [string, RankedFlight[]][] = [
  ['baseline', baseline],
  ['optimized', optimized.ranking],
  ['optimized_distance', distanceSearch.ranking],
  ...gridConvergence.slice(1).map(({ dt, ranking }): [string, RankedFlight[]] => [`optimized_dt_${dt}`, ranking]),
];
for (const [experiment, ranking] of csvExperiments) {
  for (const { rank, design, flight } of ranking) {
    const atmosphere = getAtmosphere(flight.settings, flight.settings.height);
    const reynolds = sampledRange(flight, 'reynolds');
    csvRows.push([
      experiment, rank, design.id, design.name, flight.duration, flight.distance,
      flight.maxHeight, flight.finalSpeed, flight.landed, flight.truncated, flight.stallEvents,
      flight.settings.speed, flight.settings.angle, flight.settings.trim, flight.settings.height,
      flight.settings.paperWeight, flight.settings.windSpeed, flight.settings.windDirection,
      flight.settings.turbulence, flight.settings.seed, flight.settings.dt, flight.settings.maxTime,
      flight.settings.airTemperature, flight.settings.fieldElevation,
      flight.settings.relativeHumidity, flight.settings.seaLevelPressure,
      flight.settings.fieldElevation + flight.settings.height, flight.settings.fieldElevation + flight.maxHeight,
      flight.modelVersion ?? PHYSICS_VERSION,
      flight.mass ?? design.mass * flight.settings.paperWeight / 80,
      atmosphere.gravity, atmosphere.density, atmosphere.dynamicViscosity, atmosphere.pressure,
      reynolds?.min ?? '', reynolds?.max ?? '',
    ].map(csvCell).join(','));
  }
}

const modelFinding = winner
  ? `**${winner.design.name} has the longest completed flight in this search: ${rounded(winner.flight.duration)} s**, covering ${rounded(winner.flight.distance)} m at ${winner.flight.settings.speed} m/s, a ${winner.flight.settings.angle}° launch angle, and ${winner.flight.settings.trim}° trim. This is a simulation prediction, not a physical endurance record.`
  : '**No airframe completed a landing within the time cap. The search cannot identify a longest completed flight.**';
const sensitivityFinding = winner && !(selectedLaunchWinnerStable && fullGridWinnerStable)
  ? `**The leading design changes when the integration step is refined.** At the finest tested step, ${finestGridWinner?.design.name ?? 'no airframe'} leads the complete grid${finestGridWinner ? ` at ${rounded(finestGridWinner.flight.duration)} s` : ''}, while ${finestWinner?.design.name ?? 'no airframe'} leads the selected-launch replay. A numerically stable winner has not been established.`
  : winner && !stableWinner
    ? `**The leader remains ${winner.design.name}, but the numerical step check remains unresolved.** Maximum finest-step airtime change is ${rounded(stepCheck.maxReplayDurationChangePercent, 6)}% in selected-launch replay and ${rounded(stepCheck.maxGridDurationChangePercent, 6)}% in the complete search, against the declared ${DURATION_TOLERANCE_PERCENT}% tolerance. Completion status and distinct-step counts also enter this check.`
  : winner
    ? `The leader remains ${winner.design.name} at all ${stepCheck.distinctSteps} distinct tested integration steps, including independent complete equal-budget searches. Maximum airtime change between the finest two steps is ${rounded(stepCheck.maxReplayDurationChangePercent, 6)}% for selected-launch replay and ${rounded(stepCheck.maxGridDurationChangePercent, 6)}% for grid optima; both satisfy the declared ${DURATION_TOLERANCE_PERCENT}% numerical tolerance.`
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
const modelChangeRows = modelChangeComparison?.previousTopThree.map((entry, index) => {
  const current = modelChangeComparison.currentTopThree[index];
  return `| ${index + 1} | ${entry.name} | ${rounded(entry.duration)} | ${current?.name ?? '—'} | ${current ? rounded(current.duration) : '—'} |`;
}) ?? [];
const numericalRows = stepCheck.perDesign.map((entry) =>
  `| ${entry.name} | ${entry.replayDurationChangePercent === undefined ? '—' : rounded(entry.replayDurationChangePercent, 6)} | ${entry.gridDurationChangePercent === undefined ? '—' : rounded(entry.gridDurationChangePercent, 6)} | ${entry.defaultToFinestReplayDurationChangePercent === undefined ? '—' : rounded(entry.defaultToFinestReplayDurationChangePercent, 6)} | ${entry.completionConsistent ? 'Consistent' : 'Changed or unavailable'} |`);
const markdown = [
  '# Paper-plane flight experiment',
  '',
  modelFinding,
  '',
  '## Documented competition designs',
  '',
  'The catalogue includes three designs with documented international achievements and public folding methods. These are selected historical champions, not a current universal top-three ranking. Every simulated variant uses the same A4 paper and estimated geometry, inertia and coefficients; historical results are provenance only and never enter the flight equations or optimizer.',
  '',
  '| Design | Documented achievement | Historical result | Source |',
  '| --- | --- | --- | --- |',
  ...DESIGNS.filter(design => design.achievement).map(design => {
    const achievement = design.achievement!;
    return `| ${design.name} | ${achievement.title} | ${achievement.value} ${achievement.unit} · ${achievement.date} | [Official result](${achievement.sourceUrl}) · [Folding method](${achievement.designSourceUrl}) |`;
  }),
  '',
  sensitivityFinding,
  '',
  ...(modelChangeComparison ? [
    '## Model revision comparison',
    '',
    `The previous ${modelChangeComparison.previousModelVersion} predictions are included alongside the current predictions in \`benchmark.json\`. This run uses **${PHYSICS_VERSION}**, with rigid-body force/torque, quaternion attitude, atmospheric conditions, and revised estimated coefficients. ${modelChangeComparison.commonConditionsEqual && modelChangeComparison.sameGridAndBudget ? 'The common launch/weather/paper settings and 105-trial-per-design grid remain identical.' : 'The shared conditions or grid also differ; changes cannot be attributed solely to the model revision.'} These are before/after model predictions, not a physical accuracy comparison.`,
    '',
    '| Rank | Prior model design | Prior airtime (s) | Current model design | Current airtime (s) |',
    '| ---: | --- | ---: | --- | ---: |',
    ...modelChangeRows,
    '',
  ] : []),
  baselineFinding,
  '',
  '## Fair comparison settings',
  '',
  `Default environment: **${INDOOR_ENVIRONMENT.name}**: wind and gusts are exactly zero. Temperature and humidity retain representative ${NEW_DELHI_ENVIRONMENT.climatePeriod} Delhi climate values; the 215 m ground elevation comes from Safdarjung metadata. Sea-level pressure is estimated. These are editable defaults, not indoor observations. Walls, ceilings, ventilation and thermals are not modeled.`,
  '',
  `Relative humidity is ${baselineSettings.relativeHumidity}%; sea-level-reduced pressure is ${baselineSettings.seaLevelPressure} hPa. These remain identical for every trial. Local pressure and moist-air density are recomputed at the plane's altitude.`,
  '',
  `All ${DESIGNS.length} airframes use ${baselineSettings.paperWeight} gsm paper, a ${baselineSettings.height} m release height, ${baselineSettings.windSpeed} m/s wind at ${baselineSettings.windDirection}°, turbulence ${baselineSettings.turbulence}, gust seed ${baselineSettings.seed}, maximum integration step ${baselineSettings.dt} s, and a ${baselineSettings.maxTime} s time cap. Air temperature is ${baselineSettings.airTemperature} °C at field elevation ${baselineSettings.fieldElevation} m. A4 paper area and stock determine mass consistently across all designs.`,
  '',
  `At release, gravity is ${rounded(launchAtmosphere.gravity, 8)} m/s², density ${rounded(launchAtmosphere.density, 8)} kg/m³, dynamic viscosity ${launchAtmosphere.dynamicViscosity.toExponential(8)} Pa·s, pressure ${rounded(launchAtmosphere.pressure, 3)} Pa, and temperature ${rounded(launchAtmosphere.temperatureKelvin, 3)} K. Ground reference values and SI unit definitions are recorded in JSON.`,
  '',
  `The baseline release uses ${baselineSettings.speed} m/s speed, ${baselineSettings.angle}° elevation, and ${baselineSettings.trim}° additional trim. Rankings compare airtime first, then distance.`,
  'Distance is final horizontal displacement from launch.',
  '',
  table(baseline, false),
  '',
  '## Equal-budget launch and trim search',
  '',
  `Each design receives exactly ${trialsPerDesign} trials (${optimized.trials} total): angles [${optimized.ranges.angles.join(', ')}]°, speeds [${optimized.ranges.speeds.join(', ')}] m/s, and additional trim [${optimized.ranges.trims.join(', ')}]°. Only these three variables vary. Environment, paper, release height, seed, air temperature, and field elevation remain fixed. Each reported flight preserves its actual simulated settings.`,
  '',
  'Completed landings are eligible to win. Time-capped trajectories are censored observations: their duration is a lower bound and they are excluded from winner selection. If every trial of an airframe is capped, its marked fallback appears after completed flights.',
  '',
  table(optimized.ranking, true),
  '',
  '## Distance objective',
  '',
  'The same grid is independently searched for greatest horizontal displacement among completed landings; airtime breaks distance ties. This is the appropriate metric for Suzanne and Krstić’s documented distance events. Launch speeds are candidate inputs, not measurements of record throws. Fourfold finer-step replays satisfy a 1% distance tolerance; that checks numerical sensitivity, not physical accuracy.',
  '',
  table(distanceSearch.ranking, true),
  '',
  '## Why champion predictions differ from records',
  '',
  'The former domain stopped at 10 m/s and 30° and scored only airtime. A still-air audit found that extending angles alone did not improve Suzanne or Sky King’s best airtime under the old speed cap; faster releases were responsible for their modeled gains. The new grid includes vertical releases and higher speeds equally for all designs. Standardized paper stock, upright zero-spin releases and estimated aerodynamic coefficients differ from the historical flights. See [the primary-source audit](competition-context.md).',
  '',
  '## Integration-step sensitivity',
  '',
  `The best launch settings selected above are replayed at ${convergence.length} requested integration steps without retuning. Agreement checks numerical sensitivity of this model; it does not validate real-world aerodynamics. Repeated actual steps caused by sanitization count only once.`,
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
  `Numerical check: **${stepCheck.passed ? 'passes' : 'unresolved'}** at a declared ${DURATION_TOLERANCE_PERCENT}% airtime tolerance between the finest two distinct steps. The leader must remain the same in both replay and complete-grid searches, and landing/cap status must stay consistent.`,
  '',
  '| Design | Replay change (%) | Grid optimum change (%) | Default-to-finest replay change (%) | Landing/cap status |',
  '| --- | ---: | ---: | ---: | --- |',
  ...numericalRows,
  '',
  '## Execution performance',
  '',
  `The primary ${optimized.trials}-trial search took ${rounded(primarySearch.performance.elapsedMs / 1000)} s wall time and ${rounded(primarySearch.performance.cpuMs / 1000)} s process CPU time on this execution machine. Maximum observed progress interval was ${rounded(primarySearch.performance.maxProgressIntervalMs)} ms, with at most ${primarySearch.performance.maxTrialsBetweenCheckpoints} trials between checkpoints. Browser optimization yields after 12 trials or 16 ms elapsed, whichever occurs first; a single flight simulation remains synchronous. Browser timing depends on hardware and scheduling.`,
  '',
  '## Interpretation and reproduction',
  '',
  'This model integrates translational and rotational motion with aerodynamic forces/torques and a quaternion attitude. Gravity, moist-air density, pressure, viscosity, and Reynolds effects are calculated from atmospheric assumptions. Humidity changes air density; its effects on paper mass, stiffness and deformation are not modeled. Airframe geometry, aerodynamic coefficients, center-of-mass/aerodynamic-center positions, damping derivatives, efficiency, and inertia distribution remain estimates. Flexible-paper deformation, detailed fold CFD, and measured calibration are outside this model. Its numerical checks do not establish physical accuracy. The winner is the longest predicted completed flight within the finite launch/trim grid and these assumptions.',
  '',
  'Source notes and coefficient assumptions are described in `docs/model.md` in the source bundle. Sources support the equations and atmospheric constants; they do not validate the estimated paper-plane coefficients.',
  '',
  ...sourceReferences.map((url) => `- ${url}`),
  '',
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
// Refresh the app's default snapshot only for the default reproducible run.
// Keep source imports separate from the public downloadable reports.
if (seed === DEFAULT_SETTINGS.seed && !option('--output-dir')) {
  const reportsDir = path.join(projectRoot, 'public', 'reports');
  const dataDir = path.join(projectRoot, 'src', 'data');
  await mkdir(reportsDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  for (const name of ['benchmark.json', 'benchmark.csv', 'benchmark.md']) {
    await copyFile(path.join(outputDir, name), path.join(reportsDir, name));
  }
  await writeFile(path.join(dataDir, 'tested-results.json'), `${JSON.stringify({
    modelVersion: reportData.modelVersion,
    generatedAt: reportData.generatedAt,
    baselineSettings: reportData.baselineSettings,
    atmosphere: reportData.atmosphere,
    numericalCheck: reportData.convergence.numericalCheck,
    optimization: reportData.optimization,
    distanceOptimization: reportData.distanceOptimization,
  }, null, 2)}\n`);
}
console.log(winner
  ? `Longest completed flight: ${winner.design.name}, ${rounded(winner.flight.duration)} s.`
  : 'No completed flight; no winner selected.');
console.log(`Reports written to ${outputDir}`);
