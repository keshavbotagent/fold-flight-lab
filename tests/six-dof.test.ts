import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS } from '../src/lib/designs.ts';
import { DEFAULT_SETTINGS, PHYSICS_VERSION, evaluateAerodynamics, getAtmosphere, getMassProperties, simulateFlight } from '../src/lib/physics.ts';
import { EARTH_RADIUS } from '../src/lib/atmosphere.ts';
import type { FlightSample, LaunchSettings, PlaneDesign } from '../src/lib/types.ts';

const radians = (degrees: number) => degrees * Math.PI / 180;
const near = (actual: number, expected: number, tolerance: number, description: string) => {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${description}: ${actual} versus ${expected} (±${tolerance})`);
};
const pitchQuaternion = (angle: number) => ({ x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) });
const quaternion = (s: FlightSample) => {
  const q = [s.qx, s.qy, s.qz, s.qw] as number[];
  assert.ok(q.every(Number.isFinite), 'samples expose all four quaternion components');
  return q;
};
function equivalentRotation(actual: number[], expected: number[], tolerance: number, label: string) {
  const difference = Math.sqrt(actual.reduce((sum, value, i) => sum + (value - expected[i]) ** 2, 0));
  const antipodalDifference = Math.sqrt(actual.reduce((sum, value, i) => sum + (value + expected[i]) ** 2, 0));
  assert.ok(Math.min(difference, antipodalDifference) <= tolerance, `${label}: equivalent quaternion rotation within ${tolerance}`);
}
function aerodynamicState(pitch: number, speed = 7, omegaZ = 0, lateralSpeed = 0) {
  return {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: speed, y: 0, z: lateralSpeed },
    orientation: pitchQuaternion(pitch),
    angularVelocity: { x: 0, y: 0, z: omegaZ },
  };
}

test('atmosphere matches sea-level reference air and responds to temperature and elevation', () => {
  const conditions = { airTemperature: 15, fieldElevation: 0 };
  const seaLevel = getAtmosphere(conditions);
  near(seaLevel.pressure, 101325, 0.1, 'standard pressure in Pa');
  near(seaLevel.temperatureKelvin, 288.15, 1e-10, 'Celsius to Kelvin');
  near(seaLevel.density, 1.225, 0.00003, 'standard dry-air density in kg/m³');
  near(seaLevel.dynamicViscosity, 1.7894e-5, 2e-9, 'Sutherland viscosity at 15°C in Pa·s');
  near(seaLevel.gravity, 9.80665, 1e-8, 'sea-level standard gravity');
  near(seaLevel.density, seaLevel.pressure / (287.05287 * seaLevel.temperatureKelvin), 1e-10, 'ideal-gas density');

  const hot = getAtmosphere({ ...conditions, airTemperature: 35 });
  const cold = getAtmosphere({ ...conditions, airTemperature: -5 });
  assert.ok(cold.density > seaLevel.density && seaLevel.density > hot.density, 'warmer air is less dense at equal pressure');
  assert.ok(cold.dynamicViscosity < seaLevel.dynamicViscosity && seaLevel.dynamicViscosity < hot.dynamicViscosity, 'air viscosity rises with temperature');
  const high = getAtmosphere({ ...conditions, fieldElevation: 2000 });
  assert.ok(high.pressure < seaLevel.pressure && high.density < seaLevel.density, 'higher launch fields have lower air pressure and density');
  assert.ok(high.gravity < seaLevel.gravity, 'gravity follows altitude');
  const inFlight = getAtmosphere(conditions, 100);
  assert.ok(inFlight.pressure < seaLevel.pressure && inFlight.gravity < seaLevel.gravity, 'flight altitude also affects the atmosphere');
});

test('mass and positive body inertias scale with the amount of paper', () => {
  for (const design of DESIGNS) {
    const light = getMassProperties(design, { ...DEFAULT_SETTINGS, paperWeight: 80 });
    const heavy = getMassProperties(design, { ...DEFAULT_SETTINGS, paperWeight: 160 });
    near(light.mass, design.mass, 1e-12, `${design.name}: one baseline sheet`);
    near(heavy.mass, 2 * light.mass, 1e-12, `${design.name}: double paper mass`);
    for (const axis of ['x', 'y', 'z'] as const) {
      assert.ok(light.inertia[axis] > 0 && Number.isFinite(light.inertia[axis]), `${design.name}: finite positive ${axis} inertia`);
      near(heavy.inertia[axis], 2 * light.inertia[axis], 1e-12, `${design.name}: inertia proportional to paper mass`);
    }
    assert.ok(light.meanChord > 0 && light.aspectRatio > 0);
  }
});

test('isolated vacuum flight matches the analytical constant-gravity ballistic trajectory', () => {
  const constantGravity = 9.80665;
  const flight = simulateFlight(DESIGNS[0], {
    speed: 8, angle: 17, height: 20, windSpeed: 0, turbulence: 0, maxTime: 1.217, dt: 1 / 240,
  }, { densityScale: 0, gravityOverride: constantGravity });
  assert.equal(flight.modelVersion, PHYSICS_VERSION);
  assert.ok(flight.truncated && !flight.landed);
  const initial = flight.samples[0];
  for (const sample of flight.samples) {
    near(sample.x, initial.vx * sample.t, 1e-8, 'ballistic downrange position');
    // 30Hz recorded samples align with this integration step; the final horizon
    // is integrated separately, so none of these oracle checks relies on interpolation.
    near(sample.y, initial.y + initial.vy * sample.t - constantGravity * sample.t ** 2 / 2, 2e-8, 'ballistic vertical position');
    near(sample.vx, initial.vx, 1e-10, 'vacuum horizontal velocity stays constant');
    near(sample.vy, initial.vy - constantGravity * sample.t, 1e-9, 'gravity accelerates vertically');
    near(sample.z, 0, 1e-10, 'no vacuum lateral force');
    near(sample.drag!, 0, 1e-12, 'no drag in a vacuum');
    near(sample.lift!, 0, 1e-12, 'no lift in a vacuum');
    equivalentRotation(quaternion(sample), quaternion(initial), 1e-10, 'a torque-free body at rest does not follow its changing velocity');
    near(sample.omegaX!, 0, 1e-10, 'zero torque-free roll rate');
    near(sample.omegaY!, 0, 1e-10, 'zero torque-free yaw rate');
    near(sample.omegaZ!, 0, 1e-10, 'zero torque-free pitch rate');
  }
});

test('vacuum ground contact matches the analytical ballistic root', () => {
  const g = 9.80665;
  const settings = { speed: 5, angle: 13, height: 1.2, windSpeed: 0, turbulence: 0, dt: 1 / 960 };
  const flight = simulateFlight(DESIGNS[0], settings, { densityScale: 0, gravityOverride: g });
  const first = flight.samples[0];
  const expectedTime = (first.vy + Math.sqrt(first.vy ** 2 + 2 * g * first.y)) / g;
  assert.ok(flight.landed && !flight.truncated);
  near(flight.duration, expectedTime, 2e-6, 'ballistic landing time');
  near(flight.distance, first.vx * expectedTime, 1e-5, 'ballistic landing range');
  assert.equal(flight.samples.at(-1)!.y, 0);
});

test('torque-free principal-axis spin follows quaternion rigid-body kinematics', () => {
  const angularSpeed = 2;
  const flight = simulateFlight(DESIGNS[0], { speed: 4, angle: 11, height: 10, maxTime: 0.8, dt: 1 / 240 }, {
    densityScale: 0, gravityScale: 0, initialAngularVelocity: { x: angularSpeed, y: 0, z: 0 },
  });
  const q0 = quaternion(flight.samples[0]);
  for (const sample of flight.samples) {
    const c = Math.cos(angularSpeed * sample.t / 2), s = Math.sin(angularSpeed * sample.t / 2);
    const expected = [q0[0] * c + q0[3] * s, q0[1] * c + q0[2] * s, q0[2] * c - q0[1] * s, q0[3] * c - q0[0] * s];
    equivalentRotation(quaternion(sample), expected, 2e-7, 'body-axis constant-rate quaternion motion');
    near(sample.omegaX!, angularSpeed, 1e-9, 'free principal-axis angular rate');
    near(sample.omegaY!, 0, 1e-9, 'free yaw angular rate');
    near(sample.omegaZ!, 0, 1e-9, 'free pitch angular rate');
    near(Math.hypot(...quaternion(sample)), 1, 1e-10, 'unit quaternion');
  }
});

test('torque-free nonprincipal spin preserves rotational energy and world angular momentum', () => {
  const design = DESIGNS[0];
  const initialRate = { x: 0.9, y: 0.7, z: 1.1 };
  const flight = simulateFlight(design, { speed: 3, angle: 11, height: 10, maxTime: 2, dt: 1 / 480 }, {
    densityScale: 0, gravityScale: 0, initialAngularVelocity: initialRate,
  });
  const { inertia } = getMassProperties(design, flight.settings);
  const rotateToWorld = ([x, y, z, w]: number[], vector: number[]) => [
    (1 - 2 * (y * y + z * z)) * vector[0] + 2 * (x * y - z * w) * vector[1] + 2 * (x * z + y * w) * vector[2],
    2 * (x * y + z * w) * vector[0] + (1 - 2 * (x * x + z * z)) * vector[1] + 2 * (y * z - x * w) * vector[2],
    2 * (x * z - y * w) * vector[0] + 2 * (y * z + x * w) * vector[1] + (1 - 2 * (x * x + y * y)) * vector[2],
  ];
  const energy = (s: FlightSample) => (inertia.x * s.omegaX! ** 2 + inertia.y * s.omegaY! ** 2 + inertia.z * s.omegaZ! ** 2) / 2;
  const momentum = (s: FlightSample) => rotateToWorld(quaternion(s), [inertia.x * s.omegaX!, inertia.y * s.omegaY!, inertia.z * s.omegaZ!]);
  const first = flight.samples[0];
  const initialEnergy = energy(first);
  const initialMomentum = momentum(first);
  const momentumTolerance = Math.hypot(...initialMomentum) * 5e-6 + 1e-12;
  for (const sample of flight.samples) {
    near(energy(sample), initialEnergy, initialEnergy * 5e-6 + 1e-12, 'free rigid-body rotational energy');
    momentum(sample).forEach((component, axis) => near(component, initialMomentum[axis], momentumTolerance, `constant world angular momentum axis ${axis}`));
    near(Math.hypot(...quaternion(sample)), 1, 1e-10, 'normalized gyroscopic attitude');
  }
  const last = flight.samples.at(-1)!;
  assert.ok(Math.hypot(last.omegaX! - initialRate.x, last.omegaY! - initialRate.y, last.omegaZ! - initialRate.z) > 1e-4, 'Euler gyroscopic coupling changes body rates for a nonprincipal spin');
});

test('aerodynamic forces obey the drag law and cannot propel still-air motion', () => {
  const settings = { ...DEFAULT_SETTINGS, windSpeed: 0, turbulence: 0, height: 0 };
  for (const design of DESIGNS) {
    for (const angle of [-10, 0, 5, 15, 35, 75, 120, 170]) {
      const state = aerodynamicState(radians(angle), 7, 0, 1);
      const aero = evaluateAerodynamics(design, settings, state);
      const dynamicPressure = 0.5 * aero.density * aero.airspeed ** 2;
      near(aero.drag, dynamicPressure * design.wingArea * aero.cd, 1e-10, 'D=½ρV²SCd in newtons');
      assert.ok(aero.cd > 0 && aero.drag >= 0);
      const power = aero.force.x * state.velocity.x + aero.force.y * state.velocity.y + aero.force.z * state.velocity.z;
      assert.ok(power <= 1e-9, `${design.name} at ${angle}°: still-air aerodynamic forces dissipate translational energy (${power}W)`);
      near(power, -aero.drag * aero.airspeed, 1e-9, 'total effective drag accounts for all dissipative force projections');
      assert.ok(aero.reynolds > 0 && Number.isFinite(aero.reynolds));
    }
  }
});

test('still-air force and moment power remains passive at the worst angular rate', () => {
  const settings = { ...DEFAULT_SETTINGS, windSpeed: 0, turbulence: 0, height: 0 };
  const axes = ['x', 'y', 'z'] as const;
  for (const design of DESIGNS) {
    for (const speed of [0.5, 2, 7, 12]) {
      for (const angle of [-30, -10, 0, 5, 15, 30, 60, 120]) {
        for (const side of [-0.5, 0, 0.5]) {
          const state = aerodynamicState(radians(angle), speed, 0, side * speed);
          const staticAero = evaluateAerodynamics(design, settings, state);
          const rate = { x: 0, y: 0, z: 0 };
          // A static moment plus linear damping has its largest mechanical power
          // at omega=Mstatic/(2*damping). This probes the passivity envelope,
          // rather than only observing trajectories that happen to lose energy.
          for (const axis of axes) {
            const response = evaluateAerodynamics(design, settings, { ...state, angularVelocity: { ...state.angularVelocity, [axis]: 1 } });
            const damping = staticAero.moment[axis] - response.moment[axis];
            assert.ok(damping > 0, `${design.name}: positive ${axis} rotational damping`);
            rate[axis] = staticAero.moment[axis] / (2 * damping);
          }
          const maximum = evaluateAerodynamics(design, settings, { ...state, angularVelocity: rate });
          const forcePower = maximum.force.x * state.velocity.x + maximum.force.y * state.velocity.y + maximum.force.z * state.velocity.z;
          const momentPower = axes.reduce((sum, axis) => sum + maximum.moment[axis] * rate[axis], 0);
          assert.ok(forcePower + momentPower <= 1e-10, `${design.name}, V=${speed}, alpha=${angle}°, lateral=${side}: net aerodynamic power ${forcePower + momentPower}W`);
        }
      }
    }
  }
});

test('zero-angle pure drag decelerates without creating lift, lateral motion or attitude', () => {
  const design: PlaneDesign = { ...DESIGNS[0], trimAngle: 0 };
  const settings: LaunchSettings = { ...DEFAULT_SETTINGS, height: 0, angle: 0, trim: 0, speed: 6, windSpeed: 0, turbulence: 0 };
  const aero = evaluateAerodynamics(design, settings, aerodynamicState(0, settings.speed));
  near(aero.lift, 0, 1e-12, 'zero angle of attack produces no lift');
  near(aero.moment.z, 0, 1e-12, 'zero trim has no static pitch moment');
  // No gravity and no lift leaves an independent, straight-flight control case;
  // do not assume constant Cd because the model includes Reynolds corrections.
  const flight = simulateFlight(design, { ...settings, height: 0.01, maxTime: 0.2, dt: 1 / 960 }, { gravityScale: 0 });
  const last = flight.samples.at(-1)!;
  assert.ok(last.vx > 0 && last.vx < settings.speed, 'unpowered drag reduces the forward speed');
  near(last.vy, 0, 1e-9, 'pure drag stays horizontal');
  near(last.vz, 0, 1e-9, 'pure drag has no sideways force');
  equivalentRotation(quaternion(last), quaternion(flight.samples[0]), 1e-9, 'zero trim creates no pitching motion');
});

test('stable airframes generate restoring pitch moments and angular damping', () => {
  const settings = { ...DEFAULT_SETTINGS, windSpeed: 0, turbulence: 0, height: 0, trim: 0 };
  for (const design of DESIGNS) {
    const neutral = radians(design.trimAngle);
    for (const error of [-2, 2]) {
      const response = evaluateAerodynamics(design, settings, aerodynamicState(neutral + radians(error)));
      assert.ok(response.moment.z * error < 0, `${design.name}: aerodynamic torque restores a ${error}° trim error`);
    }
    for (const rate of [-0.5, 0.5]) {
      const response = evaluateAerodynamics(design, settings, aerodynamicState(neutral, 7, rate));
      assert.ok(response.moment.z * rate < 0, `${design.name}: pitch damping opposes rotation`);
    }
  }
});

test('sideslip produces restoring yaw and dihedral roll with mirrored signs', () => {
  const settings = { ...DEFAULT_SETTINGS, windSpeed: 0, turbulence: 0, height: 0 };
  for (const design of DESIGNS) {
    const positive = evaluateAerodynamics(design, settings, aerodynamicState(radians(design.trimAngle), 7, 0, 0.7));
    const negative = evaluateAerodynamics(design, settings, aerodynamicState(radians(design.trimAngle), 7, 0, -0.7));
    assert.ok(positive.beta > 0 && negative.beta < 0, 'sideslip follows lateral airflow velocity');
    assert.ok(positive.moment.y * positive.beta < 0 && negative.moment.y * negative.beta < 0, `${design.name}: yaw torque aligns the nose with the air-relative velocity`);
    assert.ok(positive.moment.x * positive.beta < 0 && negative.moment.x * negative.beta < 0, `${design.name}: dihedral raises the into-wind wing`);
    near(positive.moment.y, -negative.moment.y, 1e-10, 'mirrored yaw moment');
    near(positive.moment.x, -negative.moment.x, 1e-10, 'mirrored dihedral roll moment');
  }
});

test('six-DoF flights conserve unit attitude and dissipate total mechanical energy in still air', () => {
  for (const design of DESIGNS) {
    const flight = simulateFlight(design, { windSpeed: 0, turbulence: 0, speed: 7, angle: 12, height: 1.5, maxTime: 60, dt: 1 / 480 });
    const { mass, inertia } = getMassProperties(design, flight.settings);
    const groundRadius = EARTH_RADIUS + flight.settings.fieldElevation;
    const g = getAtmosphere(flight.settings).gravity;
    const energy = (s: FlightSample) => mass * (g * groundRadius * s.y / (groundRadius + s.y) + (s.vx ** 2 + s.vy ** 2 + s.vz ** 2) / 2)
      + (inertia.x * s.omegaX! ** 2 + inertia.y * s.omegaY! ** 2 + inertia.z * s.omegaZ! ** 2) / 2;
    const initial = energy(flight.samples[0]);
    let previousEnergy = initial;
    assert.ok(flight.landed && !flight.truncated, `${design.name}: completed passive flight`);
    for (const sample of flight.samples) {
      near(Math.hypot(...quaternion(sample)), 1, 1e-10, `${design.name}: normalized recorded quaternion`);
      const currentEnergy = energy(sample);
      assert.ok(currentEnergy <= previousEnergy + initial * 1e-6 + 1e-10, `${design.name}: total kinetic, rotational and potential energy cannot increase between samples (${currentEnergy - previousEnergy}J)`);
      previousEnergy = currentEnergy;
      const aero = evaluateAerodynamics(design, flight.settings, {
        position: { x: sample.x, y: sample.y, z: sample.z },
        velocity: { x: sample.vx, y: sample.vy, z: sample.vz },
        orientation: { x: sample.qx!, y: sample.qy!, z: sample.qz!, w: sample.qw! },
        angularVelocity: { x: sample.omegaX!, y: sample.omegaY!, z: sample.omegaZ! },
      }, sample.t);
      const workRate = aero.force.x * sample.vx + aero.force.y * sample.vy + aero.force.z * sample.vz
        + aero.moment.x * sample.omegaX! + aero.moment.y * sample.omegaY! + aero.moment.z * sample.omegaZ!;
      assert.ok(workRate <= 1e-10, `${design.name}: instantaneous still-air aerodynamic work cannot inject mechanical energy`);
      assert.ok(sample.density! > 0 && sample.reynolds! >= 0);
    }
    assert.ok(energy(flight.samples.at(-1)!) < initial, `${design.name}: passive drag and damping dissipate energy`);
  }
});

test('selected six-DoF flights converge at 120, 240, 480 and 960Hz', () => {
  for (const design of [DESIGNS[0], DESIGNS[2], DESIGNS[4], DESIGNS.at(-1)!]) {
    const settings = { speed: 7, angle: 12, height: 1.8, windSpeed: 0, turbulence: 0, trim: 0, maxTime: 60 };
    const flights = [120, 240, 480, 960].map(frequency => simulateFlight(design, { ...settings, dt: 1 / frequency }));
    assert.ok(flights.every(flight => flight.landed), `${design.name}: all integration refinements reach ground contact`);
    const finest = flights.at(-1)!;
    for (let i = 0; i < flights.length - 1; i++) {
      near(flights[i].duration, finest.duration, Math.max(0.015, finest.duration * 0.005), `${design.name}: ${[120, 240, 480][i]}Hz converged airtime`);
      near(flights[i].distance, finest.distance, Math.max(0.03, finest.distance * 0.005), `${design.name}: ${[120, 240, 480][i]}Hz converged range`);
    }
  }
});
