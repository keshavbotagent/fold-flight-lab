export type PlaneShape = 'dart' | 'glider' | 'delta' | 'nakamura' | 'stunt' | 'canard' | 'wide' | 'needle';
/** Estimated, dimensionless stability derivatives and mass-distribution factors. */
export interface AirframeDynamics {
  centerOfGravity: number;
  aerodynamicCenter: number;
  pitchDamping: number;
  rollDamping: number;
  yawDamping: number;
  yawStability: number;
  sideForceSlope: number;
  spanEfficiency: number;
  rollInertiaFactor: number;
  pitchInertiaFactor: number;
  yawInertiaFactor: number;
}
export interface Atmosphere {
  gravity: number;
  density: number;
  dynamicViscosity: number;
  pressure: number;
  temperatureKelvin: number;
}
export interface PlaneDesign {
  id: string;
  name: string;
  category: string;
  subtitle: string;
  description: string;
  color: string;
  shape: PlaneShape;
  mass: number;
  wingArea: number;
  span: number;
  length: number;
  cd0: number;
  liftSlope: number;
  maxCl: number;
  trimAngle: number;
  stability: number;
  dihedral: number;
  dynamics?: AirframeDynamics;
  foldSteps: string[];
}
export interface LaunchSettings {
  speed: number;
  angle: number;
  height: number;
  windSpeed: number;
  windDirection: number;
  turbulence: number;
  paperWeight: number;
  trim: number;
  seed: number;
  maxTime: number;
  dt: number;
  airTemperature: number;
  fieldElevation: number;
}
export interface FlightSample {
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  pitch: number;
  roll: number;
  yaw?: number;
  qx?: number;
  qy?: number;
  qz?: number;
  qw?: number;
  omegaX?: number;
  omegaY?: number;
  omegaZ?: number;
  airspeed?: number;
  alpha?: number;
  lift?: number;
  drag?: number;
  density?: number;
  reynolds?: number;
}
export interface FlightResult {
  designId: string;
  settings: LaunchSettings;
  samples: FlightSample[];
  duration: number;
  distance: number;
  maxHeight: number;
  finalSpeed: number;
  landed: boolean;
  truncated: boolean;
  stallEvents: number;
  modelVersion?: string;
  mass?: number;
}
export interface RankedFlight { design: PlaneDesign; flight: FlightResult; rank: number; }
export interface OptimizationResult { ranking: RankedFlight[]; trials: number; ranges: { angles: number[]; speeds: number[]; trims: number[] }; }
