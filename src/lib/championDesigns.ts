import type { PlaneDesign } from './types';
import { SUZANNE_GUIDE } from './folds/suzanne';
import { SKY_KING_GUIDE } from './folds/sky-king';
import { KRSTIC_DART_GUIDE } from './folds/krstic-dart';

// Record provenance never determines these uncalibrated model parameters.
// All variants use the same uncut A4 sheet; historical materials/launches differ.
const MASS = 0.0049896; // 0.210 × 0.297 × 80 / 1000 kg.

export const CHAMPION_DESIGNS: PlaneDesign[] = [
  {
    id: 'suzanne', name: 'Suzanne', category: 'Distance glider',
    subtitle: 'John Collins’s record-setting glider',
    description: 'Broad swept wings and a layered nose distinguish this historical distance champion. The simulated one-sheet variant uses estimated geometry and balance.',
    color: '#eac27e', shape: 'suzanne', mass: MASS,
    wingArea: 0.0176, span: 0.142, length: 0.206,
    cd0: 0.040, liftSlope: 2.5, maxCl: 0.98, trimAngle: 4.8, stability: 0.87, dihedral: 10,
    dynamics: {
      centerOfGravity: 0.165, aerodynamicCenter: 0.25,
      pitchDamping: -3.3, rollDamping: -0.39, yawDamping: -0.20,
      yawStability: 0.065, sideForceSlope: 0.45, spanEfficiency: 0.77,
      rollInertiaFactor: 0.045, pitchInertiaFactor: 0.060, yawInertiaFactor: 0.049,
    },
    achievement: {
      organization: 'Guinness World Records', title: 'Former distance world record',
      status: 'former-world-record', metric: 'distance', value: 69.14, unit: 'm',
      date: '2012-02-26', location: 'McClellan, California, USA',
      credit: 'Designed by John M. Collins; thrown by Joe Ayoob.',
      sourceUrl: 'https://www.guinnessworldrecords.com/news/2026/5/evolution-of-the-paper-plane-flight-and-how-far-its-actually-possible-to-throw-one',
      designSourceUrl: 'https://makezine.com/projects/worlds-best-paper-airplane/',
      designSourceLabel: 'John Collins’s folding tutorial',
    },
    modelNotes: 'These original schematic instructions adapt Collins’s published method without tape. His record aircraft used 100 gsm A4 and adhesive tape; this comparison defaults to 80 gsm A4.',
    foldSteps: SUZANNE_GUIDE.steps.map(step => step.instruction),
  },
  {
    id: 'sky-king', name: 'Sky King', category: 'Airtime glider',
    subtitle: 'Takuo Toda’s historical airtime champion',
    description: 'A blunt folded nose, broad wings, dorsal keel and downturned tips form this compact airtime design. Its flight coefficients remain estimates.',
    color: '#93cfbc', shape: 'sky-king', mass: MASS,
    wingArea: 0.01725, span: 0.1485, length: 0.1395,
    cd0: 0.047, liftSlope: 2.8, maxCl: 1.0, trimAngle: 5.8, stability: 0.84, dihedral: -3,
    dynamics: {
      centerOfGravity: 0.165, aerodynamicCenter: 0.25,
      pitchDamping: -3.4, rollDamping: -0.43, yawDamping: -0.24,
      yawStability: 0.080, sideForceSlope: 0.58, spanEfficiency: 0.76,
      rollInertiaFactor: 0.055, pitchInertiaFactor: 0.065, yawInertiaFactor: 0.049,
    },
    achievement: {
      organization: 'Guinness World Records', title: 'Former airtime world record',
      status: 'former-world-record', metric: 'duration', value: 27.9, unit: 's',
      date: '2009-04',
      credit: 'Designed and thrown by Takuo Toda.',
      sourceUrl: 'https://www.guinnessworldrecords.jp/news/2015/12/paperaircraft',
      designSourceUrl: 'https://www.honda.co.jp/kids/jiyuu-kenkyu/challenge/c-13/skyking/',
      designSourceLabel: 'Toda-supervised photographed guide',
    },
    modelNotes: 'Original simplified diagrams adapt a Toda-supervised Sky King guide; the nose pocket is schematic. Use the linked photographs for the exact construction. Toda’s later 29.2 s flight is a separate record; the model’s search uses shared forward-launch conditions.',
    foldSteps: SKY_KING_GUIDE.steps.map(step => step.instruction),
  },
  {
    id: 'krstic-dart', name: 'Krstić Dart', category: 'Championship dart',
    subtitle: '2022 Red Bull Paper Wings distance winner',
    description: 'Repeated edge rolls create a dense, narrow paper beam with a wrapped nose lock. Its very small lifting area favors a strong distance launch over slow gliding.',
    color: '#d5a9d6', shape: 'krstic', mass: MASS,
    wingArea: 0.00364, span: 0.035, length: 0.195,
    cd0: 0.027, liftSlope: 1.05, maxCl: 0.50, trimAngle: 2.7, stability: 0.90, dihedral: 2,
    dynamics: {
      centerOfGravity: 0.180, aerodynamicCenter: 0.25,
      pitchDamping: -3.6, rollDamping: -0.20, yawDamping: -0.20,
      yawStability: 0.065, sideForceSlope: 0.62, spanEfficiency: 0.55,
      rollInertiaFactor: 0.024, pitchInertiaFactor: 0.065, yawInertiaFactor: 0.0633,
    },
    achievement: {
      organization: 'Red Bull Paper Wings', title: '2022 world-final distance winner',
      status: 'world-final-winner', metric: 'distance', value: 61.11, unit: 'm',
      date: '2022-05-14', location: 'Hangar-7, Salzburg, Austria',
      credit: 'Designed and thrown by Lazar Krstić (Serbia). “Krstić Dart” is this simulator’s descriptive name.',
      sourceUrl: 'https://www.guinnessworldrecords.com/world-records/729614-farthest-throw-at-the-red-bull-paper-plane-championship',
      designSourceUrl: 'https://www.mensjournal.com/entertainment/how-to-make-best-paper-airplane',
      designSourceLabel: 'Krstić’s published championship method',
    },
    modelNotes: 'Original schematic diagrams group the publicly demonstrated construction. The published method recommends 100 gsm paper and an inverted throw; this comparison uses the same 80 gsm stock and launch attitude as every other plane. Remove any temporary folding clip before flying.',
    foldSteps: KRSTIC_DART_GUIDE.steps.map(step => step.instruction),
  },
];
