export type PlaneShape = 'dart' | 'glider' | 'delta' | 'nakamura' | 'stunt' | 'canard' | 'wide' | 'needle';
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
}
export interface RankedFlight { design: PlaneDesign; flight: FlightResult; rank: number; }
export interface OptimizationResult { ranking: RankedFlight[]; trials: number; ranges: { angles: number[]; speeds: number[]; trims: number[] }; }
