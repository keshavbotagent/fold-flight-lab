import type { FlightResult, FlightSample, LaunchSettings, PlaneDesign } from './types';

/** SI units; UI angles are degrees and trajectory attitude angles are radians. */
export const DEFAULT_SETTINGS: LaunchSettings = Object.freeze({
  speed: 7,
  angle: 12,
  height: 1.8,
  windSpeed: 0,
  windDirection: 0,
  turbulence: 0,
  paperWeight: 80,
  trim: 0,
  seed: 42,
  maxTime: 60,
  dt: 1 / 120,
});

const GRAVITY = 9.81;
const AIR_DENSITY = 1.225;
const DEG = Math.PI / 180;
const SAMPLE_INTERVAL = 1 / 30;
const TWO_PI = Math.PI * 2;

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function wrapAngle(value: number): number {
  return ((value + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
}

function sanitizeSettings(overrides: Partial<LaunchSettings>): LaunchSettings {
  const value = (key: keyof LaunchSettings) => Number.isFinite(overrides[key])
    ? overrides[key] as number
    : DEFAULT_SETTINGS[key];
  return {
    speed: clamp(value('speed'), 0, 30),
    angle: clamp(value('angle'), -45, 80),
    height: clamp(value('height'), 0, 100),
    windSpeed: clamp(value('windSpeed'), 0, 20),
    windDirection: ((value('windDirection') % 360) + 360) % 360,
    turbulence: clamp(value('turbulence'), 0, 2),
    paperWeight: clamp(value('paperWeight'), 40, 240),
    trim: clamp(value('trim'), -12, 12),
    seed: Math.trunc(value('seed')) >>> 0,
    maxTime: clamp(value('maxTime'), 0.01, 180),
    dt: clamp(value('dt'), 1 / 480, 1 / 30),
  };
}

function validateDesign(design: PlaneDesign): void {
  for (const key of ['mass', 'wingArea', 'span', 'length', 'cd0', 'liftSlope', 'maxCl'] as const) {
    if (!Number.isFinite(design[key]) || design[key] <= 0) {
      throw new RangeError(`Plane design ${key} must be finite and greater than zero.`);
    }
  }
  for (const key of ['trimAngle', 'stability', 'dihedral'] as const) {
    if (!Number.isFinite(design[key])) {
      throw new RangeError(`Plane design ${key} must be finite.`);
    }
  }
}

interface State {
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  pitch: number;
  pitchRate: number;
  heading: number;
  roll: number;
}

function sample(state: State): FlightSample {
  return {
    t: state.t,
    x: state.x,
    y: state.y,
    z: state.z,
    vx: state.vx,
    vy: state.vy,
    vz: state.vz,
    pitch: state.pitch,
    roll: state.roll,
  };
}

function interpolate(a: State, b: State, fraction: number): State {
  const linear = (key: keyof State) => a[key] + (b[key] - a[key]) * fraction;
  return {
    t: linear('t'), x: linear('x'), y: linear('y'), z: linear('z'),
    vx: linear('vx'), vy: linear('vy'), vz: linear('vz'),
    pitch: a.pitch + wrapAngle(b.pitch - a.pitch) * fraction,
    pitchRate: linear('pitchRate'),
    heading: a.heading + wrapAngle(b.heading - a.heading) * fraction,
    roll: linear('roll'),
  };
}

/** Exact critically damped pitch relaxation for a constant aerodynamic target. */
function relaxPitch(pitch: number, rate: number, target: number, frequency: number, dt: number) {
  const error = wrapAngle(pitch - target);
  const combined = rate + frequency * error;
  const decay = Math.exp(-frequency * dt);
  return {
    pitch: target + (error + combined * dt) * decay,
    rate: (rate - frequency * combined * dt) * decay,
  };
}

/** Repeatable smooth gusts; changing integration dt never changes the random sequence. */
function gustPhases(seed: number): number[] {
  let state = seed || 0x9e3779b9;
  return Array.from({ length: 6 }, () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000 * TWO_PI;
  });
}

function aerodynamicCoefficients(alpha: number, design: PlaneDesign, stallAngle: number, inducedFactor: number) {
  const absAlpha = Math.abs(alpha);
  const attachedCl = Math.min(design.maxCl, design.liftSlope * Math.min(absAlpha, stallAngle));
  const postStall = Math.max(0, absAlpha - stallAngle);
  const cl = Math.sign(alpha) * attachedCl * Math.pow(Math.cos(postStall), 2);
  return {
    cl,
    cd: design.cd0 + inducedFactor * cl * cl + 1.1 * Math.pow(Math.sin(postStall), 2),
  };
}

/**
 * A passive, estimated aerodynamic model, not CFD or a calibrated flight predictor.
 * +X is downrange, +Y is up, +Z is sideways. See docs/model.md for assumptions.
 */
export function simulateFlight(design: PlaneDesign, overrides: Partial<LaunchSettings> = {}): FlightResult {
  validateDesign(design);
  const settings = sanitizeSettings(overrides);
  const launchAngle = settings.angle * DEG;
  const trimAngle = clamp(design.trimAngle + settings.trim, -20, 25) * DEG;
  const mass = design.mass * settings.paperWeight / 80;
  const aspectRatio = design.span * design.span / design.wingArea;
  const stability = clamp(design.stability, 0.05, 1);
  const efficiency = clamp(0.58 + stability * 0.17, 0.55, 0.8);
  const inducedFactor = 1 / (Math.PI * efficiency * aspectRatio);
  const forceFactor = 0.5 * AIR_DENSITY * design.wingArea / mass;
  const stallAngle = clamp(design.maxCl / design.liftSlope, 8 * DEG, 32 * DEG);
  const phases = gustPhases(settings.seed);
  const direction = settings.windDirection * DEG;
  const baseWindX = settings.windSpeed * Math.cos(direction);
  const baseWindZ = settings.windSpeed * Math.sin(direction);
  const gustAmplitude = settings.turbulence * (0.35 + 0.06 * settings.windSpeed);

  let state: State = {
    t: 0, x: 0, y: settings.height, z: 0,
    vx: settings.speed * Math.cos(launchAngle),
    vy: settings.speed * Math.sin(launchAngle), vz: 0,
    pitch: launchAngle + trimAngle, pitchRate: 0, heading: 0, roll: 0,
  };
  const samples: FlightSample[] = [sample(state)];
  let nextSample = SAMPLE_INTERVAL;
  let maxHeight = state.y;
  let stallEvents = 0;
  let stalled = false;
  let landed = state.y <= 0;

  while (!landed && state.t < settings.maxTime - 1e-10) {
    const previous = state;
    // Limit angular travel per step for small, light wings and extreme launch speeds.
    const conservativeAirSpeed = Math.hypot(state.vx - baseWindX, state.vy, state.vz - baseWindZ)
      + gustAmplitude * 2;
    const angularStepLimit = 0.12 / Math.max(0.01, forceFactor * design.maxCl * conservativeAirSpeed);
    const dt = Math.min(settings.dt, angularStepLimit, settings.maxTime - state.t);
    const midTime = state.t + dt / 2;
    const wx = baseWindX + gustAmplitude * (
      0.62 * Math.sin(midTime * 1.7 + phases[0]) + 0.38 * Math.sin(midTime * 4.8 + phases[1]));
    const wy = gustAmplitude * 0.35 * (
      0.76 * Math.sin(midTime * 2.3 + phases[2]) + 0.24 * Math.sin(midTime * 7.2 + phases[3]));
    const wz = baseWindZ + gustAmplitude * (
      0.65 * Math.sin(midTime * 1.3 + phases[4]) + 0.35 * Math.sin(midTime * 5.3 + phases[5]));

    // Gravity half-step, followed by an air-relative aerodynamic update.
    const avx = state.vx - wx;
    const avy = state.vy - GRAVITY * dt / 2 - wy;
    const avz = state.vz - wz;
    const airSpeed = Math.hypot(avx, avy, avz);
    const horizontalSpeed = Math.hypot(avx, avz);
    const flightAngle = Math.atan2(avy, horizontalSpeed);
    const airHeading = horizontalSpeed > 1e-8 ? Math.atan2(avz, avx) : state.heading;
    const pitchFrequency = clamp((0.18 + 0.24 * stability) * airSpeed / design.length, 1.1, 12);
    const initialFlightAngle = Math.atan2(state.vy - wy, horizontalSpeed);
    const pitchPredictor = relaxPitch(state.pitch, state.pitchRate, flightAngle + trimAngle, pitchFrequency, dt / 2);
    const alphaPredictor = clamp(wrapAngle(pitchPredictor.pitch - flightAngle), -Math.PI / 2, Math.PI / 2);
    const predictedCoefficients = aerodynamicCoefficients(alphaPredictor, design, stallAngle, inducedFactor);
    const beta = wrapAngle(airHeading - state.heading);
    const dihedral = clamp(design.dihedral, 0, 25) * DEG;
    const rollFrequency = 1.5 + stability * 3;
    let rollTarget = clamp(-beta * dihedral * 1.8, -25 * DEG, 25 * DEG);
    let rollMid = rollTarget + (state.roll - rollTarget) * Math.exp(-rollFrequency * dt / 2);
    let midpointFlightAngle = flightAngle;
    let midpointHeading = airHeading;

    let vx = state.vx;
    let vy = state.vy - GRAVITY * dt;
    let vz = state.vz;
    if (airSpeed > 1e-10) {
      const ux = avx / airSpeed;
      const uy = avy / airSpeed;
      const uz = avz / airSpeed;
      const horizontalUnit = horizontalSpeed / airSpeed;
      // Unit lift vector: projection of world-up perpendicular to relative velocity.
      let nx: number;
      let ny: number;
      let nz: number;
      if (horizontalUnit > 1e-8) {
        nx = -ux * uy / horizontalUnit;
        ny = horizontalUnit;
        nz = -uz * uy / horizontalUnit;
      } else {
        nx = Math.cos(state.heading);
        ny = 0;
        nz = Math.sin(state.heading);
      }
      const sx = uy * nz - uz * ny;
      const sy = uz * nx - ux * nz;
      const sz = ux * ny - uy * nx;
      // Predict the actual midpoint flow. Evaluating CL before the wing turns the
      // air velocity creates first-order timestep bias, especially near stalls.
      const predictorDrag = forceFactor * predictedCoefficients.cd * airSpeed * dt / 2;
      const predictorTurn = predictedCoefficients.cl / predictedCoefficients.cd * Math.log1p(predictorDrag);
      const cosPredictor = Math.cos(predictorTurn);
      const sinPredictor = Math.sin(predictorTurn);
      const cosRollPredictor = Math.cos(rollMid);
      const sinRollPredictor = Math.sin(rollMid);
      const px = ux * cosPredictor + (nx * cosRollPredictor + sx * sinRollPredictor) * sinPredictor;
      const py = uy * cosPredictor + (ny * cosRollPredictor + sy * sinRollPredictor) * sinPredictor;
      const pz = uz * cosPredictor + (nz * cosRollPredictor + sz * sinRollPredictor) * sinPredictor;
      midpointFlightAngle = Math.atan2(py, Math.hypot(px, pz));
      midpointHeading = Math.atan2(pz, px);
      const pitchTargetMid = initialFlightAngle + wrapAngle(midpointFlightAngle - initialFlightAngle) / 2 + trimAngle;
      const pitchMid = relaxPitch(state.pitch, state.pitchRate, pitchTargetMid, pitchFrequency, dt / 2);
      const alpha = clamp(wrapAngle(pitchMid.pitch - midpointFlightAngle), -Math.PI / 2, Math.PI / 2);
      const { cl, cd } = aerodynamicCoefficients(alpha, design, stallAngle, inducedFactor);
      const absAlpha = Math.abs(alpha);
      if (!stalled && absAlpha > stallAngle) {
        stalled = true;
        stallEvents++;
      } else if (stalled && absAlpha < stallAngle * 0.85) {
        stalled = false;
      }

      const headingMid = state.heading + beta * (1 - Math.exp(-(0.7 + stability * 2) * dt / 2));
      rollTarget = clamp(-wrapAngle(midpointHeading - headingMid) * dihedral * 1.8, -25 * DEG, 25 * DEG);
      rollMid = rollTarget + (state.roll - rollTarget) * Math.exp(-rollFrequency * dt / 2);
      const cosRoll = Math.cos(rollMid);
      const sinRoll = Math.sin(rollMid);
      const lx = nx * cosRoll + sx * sinRoll;
      const ly = ny * cosRoll + sy * sinRoll;
      const lz = nz * cosRoll + sz * sinRoll;

      // Integrate quadratic drag exactly. Lift rotates air velocity, preserving speed.
      const dragAmount = forceFactor * cd * airSpeed * dt;
      const newAirSpeed = airSpeed / (1 + dragAmount);
      const turnAngle = cl / cd * Math.log1p(dragAmount);
      const cosTurn = Math.cos(turnAngle);
      const sinTurn = Math.sin(turnAngle);
      vx = newAirSpeed * (ux * cosTurn + lx * sinTurn) + wx;
      vy = newAirSpeed * (uy * cosTurn + ly * sinTurn) + wy - GRAVITY * dt / 2;
      vz = newAirSpeed * (uz * cosTurn + lz * sinTurn) + wz;
    }

    const newFlightAngle = Math.atan2(vy - wy, Math.hypot(vx - wx, vz - wz));
    const meanFlightAngle = initialFlightAngle + wrapAngle(newFlightAngle - initialFlightAngle) / 2;
    const pitchNext = relaxPitch(state.pitch, state.pitchRate, meanFlightAngle + trimAngle, pitchFrequency, dt);
    state = {
      t: previous.t + dt,
      x: previous.x + (previous.vx + vx) * dt / 2,
      y: previous.y + (previous.vy + vy) * dt / 2,
      z: previous.z + (previous.vz + vz) * dt / 2,
      vx, vy, vz, pitch: pitchNext.pitch, pitchRate: pitchNext.rate,
      heading: previous.heading + wrapAngle(midpointHeading - previous.heading) * (1 - Math.exp(-(0.7 + stability * 2) * dt)),
      roll: rollTarget + (previous.roll - rollTarget) * Math.exp(-rollFrequency * dt),
    };

    // Solve the ground crossing on the last segment; time is not rounded to dt.
    if (state.y <= 0) {
      state = interpolate(previous, state, previous.y / (previous.y - state.y));
      state.y = 0;
      landed = true;
    }
    maxHeight = Math.max(maxHeight, state.y);
    while (nextSample <= state.t + 1e-10) {
      const fraction = clamp((nextSample - previous.t) / (state.t - previous.t), 0, 1);
      const sampled = interpolate(previous, state, fraction);
      sampled.t = Math.min(nextSample, state.t);
      samples.push(sample(sampled));
      nextSample += SAMPLE_INTERVAL;
    }
  }

  if (state.t > samples[samples.length - 1].t + 1e-10) {
    samples.push(sample(state));
  } else {
    samples[samples.length - 1] = sample(state);
  }
  return {
    designId: design.id,
    settings,
    samples,
    duration: state.t,
    distance: Math.hypot(state.x, state.z),
    maxHeight,
    finalSpeed: Math.hypot(state.vx, state.vy, state.vz),
    landed,
    truncated: !landed,
    stallEvents,
  };
}
