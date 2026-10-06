import type { AirframeDynamics, Atmosphere, FlightResult, FlightSample, LaunchSettings, PlaneDesign } from './types';
import { getAtmosphere } from './atmosphere';
import { NEW_DELHI_ENVIRONMENT } from './environment';
export { getAtmosphere } from './atmosphere';

export const PHYSICS_VERSION = '2.1.0-moist-air';
export const DEFAULT_SETTINGS: LaunchSettings = Object.freeze({
  speed: 7, angle: 12, height: 1.8,
  paperWeight: 80, trim: 0, seed: 42, maxTime: 60, dt: 1 / 120,
  ...NEW_DELHI_ENVIRONMENT.settings,
});

export interface Vector3 { x: number; y: number; z: number; }
export interface Quaternion { x: number; y: number; z: number; w: number; }
export interface RigidBodyState {
  position: Vector3;
  velocity: Vector3;
  orientation: Quaternion;
  angularVelocity: Vector3;
}
/** Scientific isolation controls. Normal user flight uses the defaults. */
export interface FlightPhysicsOptions {
  densityScale?: number;
  gravityScale?: number;
  gravityOverride?: number;
  initialAngularVelocity?: Vector3;
}
export interface MassProperties { mass: number; inertia: Vector3; meanChord: number; aspectRatio: number; }
export interface AerodynamicEvaluation {
  force: Vector3;
  moment: Vector3;
  lift: number;
  drag: number;
  airspeed: number;
  alpha: number;
  beta: number;
  density: number;
  reynolds: number;
  cl: number;
  cd: number;
  atmosphere: Atmosphere;
}

const DEG = Math.PI / 180;
const TAU = 2 * Math.PI;
const SAMPLE_INTERVAL = 1 / 30;
const REFERENCE_REYNOLDS = 50_000;
const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));
const smoothstep = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };

function sanitizeSettings(overrides: Partial<LaunchSettings>): LaunchSettings {
  const value = (key: keyof LaunchSettings) => Number.isFinite(overrides[key])
    ? overrides[key] as number : DEFAULT_SETTINGS[key];
  return {
    speed: clamp(value('speed'), 0, 30), angle: clamp(value('angle'), -45, 80),
    height: clamp(value('height'), 0, 100), windSpeed: clamp(value('windSpeed'), 0, 20),
    windDirection: ((value('windDirection') % 360) + 360) % 360,
    turbulence: clamp(value('turbulence'), 0, 2), paperWeight: clamp(value('paperWeight'), 40, 240),
    trim: clamp(value('trim'), -12, 12), seed: Math.trunc(value('seed')) >>> 0,
    maxTime: clamp(value('maxTime'), 0.01, 180), dt: clamp(value('dt'), 1 / 3840, 1 / 30),
    airTemperature: clamp(value('airTemperature'), -60, 60),
    fieldElevation: clamp(value('fieldElevation'), -500, 10_000),
    relativeHumidity: clamp(value('relativeHumidity'), 0, 100),
    seaLevelPressure: clamp(value('seaLevelPressure'), 850, 1100),
  };
}

function validateDesign(design: PlaneDesign): void {
  for (const key of ['mass', 'wingArea', 'span', 'length', 'cd0', 'liftSlope', 'maxCl'] as const) {
    if (!Number.isFinite(design[key]) || design[key] <= 0) {
      throw new RangeError(`Plane design ${key} must be finite and greater than zero.`);
    }
  }
  for (const key of ['trimAngle', 'stability', 'dihedral'] as const) {
    if (!Number.isFinite(design[key])) throw new RangeError(`Plane design ${key} must be finite.`);
  }
  if (design.dynamics) {
    for (const [key, value] of Object.entries(design.dynamics)) {
      if (!Number.isFinite(value)) throw new RangeError(`Airframe dynamics ${key} must be finite.`);
    }
    for (const key of ['rollInertiaFactor', 'pitchInertiaFactor', 'yawInertiaFactor', 'spanEfficiency'] as const) {
      if (design.dynamics[key] <= 0) throw new RangeError(`Airframe dynamics ${key} must be positive.`);
    }
    for (const key of ['rollDamping', 'pitchDamping', 'yawDamping'] as const) {
      if (design.dynamics[key] > 0) throw new RangeError(`Airframe dynamics ${key} must not add rotational energy.`);
    }
  }
}

export function getAirframeDynamics(design: PlaneDesign): AirframeDynamics {
  const s = clamp(design.stability, 0.05, 1);
  return design.dynamics ?? {
    centerOfGravity: 0.25 - (0.04 + 0.05 * s), aerodynamicCenter: 0.25,
    pitchDamping: -1.4, rollDamping: -0.5, yawDamping: -0.25,
    yawStability: 0.1, sideForceSlope: 0.6, spanEfficiency: 0.6 + 0.17 * s,
    rollInertiaFactor: 0.05, pitchInertiaFactor: 0.04, yawInertiaFactor: 0.04,
  };
}

export function getMassProperties(design: PlaneDesign, settings: Pick<LaunchSettings, 'paperWeight'>): MassProperties {
  validateDesign(design);
  const d = getAirframeDynamics(design);
  const weight = Number.isFinite(settings.paperWeight) ? clamp(settings.paperWeight, 40, 240) : 80;
  const mass = design.mass * weight / 80;
  return {
    mass,
    inertia: {
      x: mass * design.span ** 2 * d.rollInertiaFactor,
      y: mass * (design.span ** 2 + design.length ** 2) * d.yawInertiaFactor,
      z: mass * design.length ** 2 * d.pitchInertiaFactor,
    },
    meanChord: design.wingArea / design.span,
    aspectRatio: design.span ** 2 / design.wingArea,
  };
}

/** Flat-plate friction only; CD0 already contains the reference value. */
export function skinFrictionCoefficient(reynolds: number): number {
  const re = Math.max(1000, reynolds);
  const laminar = 1.328 / Math.sqrt(re);
  const turbulent = Math.max(0, 0.074 / Math.pow(re, 0.2) - 1742 / re);
  const transition = smoothstep((re - 300_000) / 500_000);
  return laminar * (1 - transition) + turbulent * transition;
}

function gustPhases(seed: number): number[] {
  let n = seed || 0x9e3779b9;
  return Array.from({ length: 6 }, () => {
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    return (n >>> 0) / 0x100000000 * TAU;
  });
}

interface Context {
  design: PlaneDesign;
  settings: LaunchSettings;
  dynamics: AirframeDynamics;
  properties: MassProperties;
  phases: number[];
  windX: number;
  windZ: number;
  gustAmplitude: number;
  densityScale: number;
  gravityScale: number;
  gravityOverride?: number;
  trim: number;
  stallAngle: number;
}

function context(design: PlaneDesign, settings: LaunchSettings, options: FlightPhysicsOptions): Context {
  const scale = (v: number | undefined) => Number.isFinite(v) ? clamp(v as number, 0, 10) : 1;
  return {
    design, settings, dynamics: getAirframeDynamics(design), properties: getMassProperties(design, settings),
    phases: gustPhases(settings.seed), windX: settings.windSpeed * Math.cos(settings.windDirection * DEG),
    windZ: settings.windSpeed * Math.sin(settings.windDirection * DEG),
    gustAmplitude: settings.turbulence * (0.35 + 0.06 * settings.windSpeed),
    densityScale: scale(options.densityScale), gravityScale: scale(options.gravityScale),
    gravityOverride: Number.isFinite(options.gravityOverride) ? clamp(options.gravityOverride as number, 0, 30) : undefined,
    trim: clamp(design.trimAngle + settings.trim, -20, 25) * DEG,
    stallAngle: clamp(design.maxCl / design.liftSlope, 8 * DEG, 32 * DEG),
  };
}

function wind(ctx: Context, t: number): Vector3 {
  const p = ctx.phases, a = ctx.gustAmplitude;
  return {
    x: ctx.windX + a * (0.62 * Math.sin(t * 1.7 + p[0]) + 0.38 * Math.sin(t * 4.8 + p[1])),
    y: a * 0.35 * (0.76 * Math.sin(t * 2.3 + p[2]) + 0.24 * Math.sin(t * 7.2 + p[3])),
    z: ctx.windZ + a * (0.65 * Math.sin(t * 1.3 + p[4]) + 0.35 * Math.sin(t * 5.3 + p[5])),
  };
}

// World position xyz, world velocity xyz, quaternion xyzw, body angular velocity xyz.
type State = number[];
function normalizeQuaternion(s: State): void {
  const norm = Math.hypot(s[6], s[7], s[8], s[9]);
  if (norm < 1e-15) throw new RangeError('Rigid-body orientation must have a nonzero quaternion.');
  for (let i = 6; i < 10; i++) s[i] /= norm;
}

function aerodynamicState(ctx: Context, state: State, t: number): AerodynamicEvaluation {
  const atmosphere = getAtmosphere(ctx.settings, state[1]);
  const density = atmosphere.density * ctx.densityScale;
  const air = wind(ctx, t);
  const ax = state[3] - air.x, ay = state[4] - air.y, az = state[5] - air.z;
  const airspeed = Math.hypot(ax, ay, az);
  const qnorm = Math.hypot(state[6], state[7], state[8], state[9]);
  const x = state[6] / qnorm, y = state[7] / qnorm, z = state[8] / qnorm, w = state[9] / qnorm;
  // Matrix columns: body's forward, up and right axes in world coordinates.
  const r00 = 1 - 2 * (y * y + z * z), r01 = 2 * (x * y - z * w), r02 = 2 * (x * z + y * w);
  const r10 = 2 * (x * y + z * w), r11 = 1 - 2 * (x * x + z * z), r12 = 2 * (y * z - x * w);
  const r20 = 2 * (x * z - y * w), r21 = 2 * (y * z + x * w), r22 = 1 - 2 * (x * x + y * y);
  const bx = r00 * ax + r10 * ay + r20 * az;
  const by = r01 * ax + r11 * ay + r21 * az;
  const bz = r02 * ax + r12 * ay + r22 * az;
  const alpha = airspeed > 1e-9 ? Math.atan2(-by, bx) : 0;
  const beta = airspeed > 1e-9 ? Math.atan2(bz, Math.hypot(bx, by)) : 0;
  const d = ctx.design, dyn = ctx.dynamics, props = ctx.properties;
  const reynolds = density * airspeed * props.meanChord / atmosphere.dynamicViscosity;
  const dynamicArea = 0.5 * density * airspeed * airspeed * d.wingArea;
  const separated = smoothstep((Math.abs(alpha) - 0.8 * ctx.stallAngle) / (0.8 * ctx.stallAngle));
  const attachedCl = clamp(d.liftSlope * alpha, -d.maxCl, d.maxCl);
  const flatPlateCl = 0.9 * d.maxCl * Math.sin(2 * alpha);
  const cl = (1 - separated) * attachedCl + separated * flatPlateCl;
  const profileCd = Math.max(0.005, d.cd0 + 2 * (
    skinFrictionCoefficient(reynolds) - skinFrictionCoefficient(REFERENCE_REYNOLDS)));
  const cd = profileCd + cl * cl / (Math.PI * dyn.spanEfficiency * props.aspectRatio)
    + separated * 1.5 * Math.sin(alpha) ** 2;
  let lift = dynamicArea * cl;
  const profileDrag = dynamicArea * cd;
  const sideForce = -dynamicArea * dyn.sideForceSlope * Math.sin(beta);
  const invSpeed = airspeed > 1e-9 ? 1 / airspeed : 0;
  const ux = ax * invSpeed, uy = ay * invSpeed, uz = az * invSpeed;
  const upProjection = r01 * ux + r11 * uy + r21 * uz;
  let lx = r01 - upProjection * ux, ly = r11 - upProjection * uy, lz = r21 - upProjection * uz;
  const liftNorm = Math.hypot(lx, ly, lz);
  if (liftNorm > 1e-9) { lx /= liftNorm; ly /= liftNorm; lz /= liftNorm; }
  else { lx = 0; ly = 0; lz = 0; lift = 0; }
  const force = {
    x: lift * lx - profileDrag * ux + sideForce * r02,
    y: lift * ly - profileDrag * uy + sideForce * r12,
    z: lift * lz - profileDrag * uz + sideForce * r22,
  };
  // q*S*l*C_rate*(omega*l/(2V)), written without the low-speed 1/V singularity.
  const dampingArea = 0.25 * density * airspeed * d.wingArea;
  const staticMargin = dyn.aerodynamicCenter - dyn.centerOfGravity;
  const moment = {
    x: dynamicArea * d.span * (-0.5 * d.dihedral * DEG * d.liftSlope * Math.sin(beta) * Math.cos(alpha))
      + dampingArea * d.span ** 2 * dyn.rollDamping * state[10],
    y: -dynamicArea * d.span * dyn.yawStability * Math.sin(beta)
      + dampingArea * d.span ** 2 * dyn.yawDamping * state[11],
    z: -dynamicArea * props.meanChord * staticMargin * d.liftSlope * Math.sin(alpha - ctx.trim)
      + dampingArea * props.meanChord ** 2 * dyn.pitchDamping * state[12],
  };
  const drag = profileDrag - sideForce * Math.sin(beta);
  const effectiveCd = cd + dyn.sideForceSlope * Math.sin(beta) ** 2;
  return { force, moment, lift, drag, airspeed, alpha, beta, density, reynolds, cl, cd: effectiveCd, atmosphere };
}

/** Force in world axes excluding gravity, torque in body axes; all SI. */
export function evaluateAerodynamics(
  design: PlaneDesign, settings: LaunchSettings, state: RigidBodyState, t = 0,
  options: FlightPhysicsOptions = {},
): AerodynamicEvaluation {
  const values = [state.position.x, state.position.y, state.position.z,
    state.velocity.x, state.velocity.y, state.velocity.z,
    state.orientation.x, state.orientation.y, state.orientation.z, state.orientation.w,
    state.angularVelocity.x, state.angularVelocity.y, state.angularVelocity.z];
  if (!values.every(Number.isFinite)) throw new RangeError('Rigid-body state must contain finite values.');
  normalizeQuaternion(values);
  return aerodynamicState(context(design, sanitizeSettings(settings), options), values, t);
}

function derivative(ctx: Context, s: State, t: number): State {
  const aero = aerodynamicState(ctx, s, t);
  const { mass, inertia } = ctx.properties;
  const gravity = (ctx.gravityOverride ?? aero.atmosphere.gravity) * ctx.gravityScale;
  const p = s[10], q = s[11], r = s[12], x = s[6], y = s[7], z = s[8], w = s[9];
  return [
    s[3], s[4], s[5], aero.force.x / mass, aero.force.y / mass - gravity, aero.force.z / mass,
    0.5 * (w * p + y * r - z * q), 0.5 * (w * q + z * p - x * r),
    0.5 * (w * r + x * q - y * p), -0.5 * (x * p + y * q + z * r),
    (aero.moment.x + (inertia.y - inertia.z) * q * r) / inertia.x,
    (aero.moment.y + (inertia.z - inertia.x) * r * p) / inertia.y,
    (aero.moment.z + (inertia.x - inertia.y) * p * q) / inertia.z,
  ];
}

function add(s: State, k: State, factor: number): State {
  return s.map((value, i) => value + k[i] * factor);
}

function rk4(ctx: Context, s: State, t: number, dt: number): State {
  const a = derivative(ctx, s, t);
  const b = derivative(ctx, add(s, a, dt / 2), t + dt / 2);
  const c = derivative(ctx, add(s, b, dt / 2), t + dt / 2);
  const d = derivative(ctx, add(s, c, dt), t + dt);
  const next = s.map((value, i) => value + dt * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6);
  normalizeQuaternion(next);
  return next;
}

function safeStep(ctx: Context, s: State, t: number): number {
  const a = aerodynamicState(ctx, s, t);
  const d = ctx.design, dyn = ctx.dynamics, props = ctx.properties;
  const dampingArea = 0.25 * a.density * a.airspeed * d.wingArea;
  const dampingRate = Math.max(
    Math.abs(dampingArea * d.span ** 2 * dyn.rollDamping / props.inertia.x),
    Math.abs(dampingArea * d.span ** 2 * dyn.yawDamping / props.inertia.y),
    Math.abs(dampingArea * props.meanChord ** 2 * dyn.pitchDamping / props.inertia.z),
  );
  const staticPitchRate = Math.sqrt(Math.abs(0.5 * a.density * a.airspeed ** 2 * d.wingArea
    * props.meanChord * (dyn.aerodynamicCenter - dyn.centerOfGravity) * d.liftSlope / props.inertia.z));
  const aeroTurningRate = 0.5 * a.density * a.airspeed * d.wingArea * Math.max(d.maxCl, a.cd) / props.mass;
  const angularRate = Math.hypot(s[10], s[11], s[12]);
  return Math.min(ctx.settings.dt, 0.45 / Math.max(0.001, dampingRate),
    0.15 / Math.max(0.001, staticPitchRate, aeroTurningRate, angularRate));
}

function interpolate(a: State, b: State, fraction: number): State {
  const result = a.map((value, i) => value + (b[i] - value) * fraction);
  const sign = a[6] * b[6] + a[7] * b[7] + a[8] * b[8] + a[9] * b[9] < 0 ? -1 : 1;
  for (let i = 6; i < 10; i++) result[i] = a[i] + (sign * b[i] - a[i]) * fraction;
  normalizeQuaternion(result);
  return result;
}

function sample(ctx: Context, s: State, t: number): FlightSample {
  const a = aerodynamicState(ctx, s, t);
  const x = s[6], y = s[7], z = s[8], w = s[9];
  const forwardY = 2 * (x * y + z * w);
  const forwardX = 1 - 2 * (y * y + z * z), forwardZ = 2 * (x * z - y * w);
  const pitch = Math.atan2(forwardY, Math.hypot(forwardX, forwardZ));
  const yaw = Math.atan2(-forwardZ, forwardX);
  const upX = 2 * (x * y - z * w), upY = 1 - 2 * (x * x + z * z), upZ = 2 * (y * z + x * w);
  const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw), cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
  const roll = Math.atan2(upX * sinYaw + upZ * cosYaw,
    -upX * cosYaw * sinPitch + upY * cosPitch + upZ * sinYaw * sinPitch);
  return {
    t, x: s[0], y: s[1], z: s[2], vx: s[3], vy: s[4], vz: s[5],
    pitch, yaw, roll,
    qx: x, qy: y, qz: z, qw: w, omegaX: s[10], omegaY: s[11], omegaZ: s[12],
    airspeed: a.airspeed, alpha: a.alpha, lift: a.lift, drag: a.drag,
    density: a.density, reynolds: a.reynolds,
  };
}

/** Unpowered quaternion six-degree-of-freedom rigid-body flight; no attitude controller. */
export function simulateFlight(
  design: PlaneDesign, overrides: Partial<LaunchSettings> = {}, options: FlightPhysicsOptions = {},
): FlightResult {
  validateDesign(design);
  const settings = sanitizeSettings(overrides), ctx = context(design, settings, options);
  const launch = settings.angle * DEG, initialPitch = launch + ctx.trim;
  const rates = options.initialAngularVelocity ?? { x: 0, y: 0, z: 0 };
  if (![rates.x, rates.y, rates.z].every(Number.isFinite)) throw new RangeError('Initial angular velocity must be finite.');
  let state: State = [0, settings.height, 0,
    settings.speed * Math.cos(launch), settings.speed * Math.sin(launch), 0,
    0, 0, Math.sin(initialPitch / 2), Math.cos(initialPitch / 2), rates.x, rates.y, rates.z];
  let time = 0, nextSample = SAMPLE_INTERVAL, maxHeight = state[1], stallEvents = 0;
  let stalled = false, landed = state[1] <= 0;
  const samples = [sample(ctx, state, time)];
  while (!landed && time < settings.maxTime - 1e-10) {
    const previous = state, previousTime = time;
    let dt = Math.min(safeStep(ctx, state, time), settings.maxTime - time);
    if (nextSample > time + 1e-10) dt = Math.min(dt, nextSample - time);
    state = rk4(ctx, state, time, dt);
    time += dt;
    if (!state.every(Number.isFinite)) throw new RangeError('Flight state became nonfinite; airframe values are outside the model range.');
    if (state[1] <= 0) {
      // Cubic Hermite height locates ground contact inside the last RK4 segment.
      const y0 = previous[1], y1 = state[1], dy0 = previous[4] * dt, dy1 = state[4] * dt;
      let low = 0, high = 1;
      for (let i = 0; i < 30; i++) {
        const f = (low + high) / 2, f2 = f * f, f3 = f2 * f;
        const height = (2 * f3 - 3 * f2 + 1) * y0 + (f3 - 2 * f2 + f) * dy0
          + (-2 * f3 + 3 * f2) * y1 + (f3 - f2) * dy1;
        if (height > 0) low = f; else high = f;
      }
      const fraction = (low + high) / 2;
      state = rk4(ctx, previous, previousTime, dt * fraction);
      state[1] = 0;
      time = previousTime + dt * fraction;
      landed = true;
    }
    maxHeight = Math.max(maxHeight, state[1]);
    const alpha = Math.abs(aerodynamicState(ctx, state, time).alpha);
    if (!stalled && alpha > ctx.stallAngle) { stalled = true; stallEvents++; }
    else if (stalled && alpha < ctx.stallAngle * 0.85) stalled = false;
    if (nextSample <= time + 1e-10) {
      const atSample = Math.abs(time - nextSample) < 1e-9 ? state
        : interpolate(previous, state, clamp((nextSample - previousTime) / (time - previousTime), 0, 1));
      samples.push(sample(ctx, atSample, Math.min(time, nextSample)));
      nextSample += SAMPLE_INTERVAL;
    }
  }
  if (time > samples[samples.length - 1].t + 1e-10) samples.push(sample(ctx, state, time));
  else samples[samples.length - 1] = sample(ctx, state, time);
  return {
    designId: design.id, settings, samples, duration: time, distance: Math.hypot(state[0], state[2]),
    maxHeight, finalSpeed: Math.hypot(state[3], state[4], state[5]), landed, truncated: !landed,
    stallEvents, modelVersion: PHYSICS_VERSION, mass: ctx.properties.mass,
  };
}
