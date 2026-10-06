/** Geometry for instructional fold diagrams; every frame uses a 240 × 240 viewBox. */
export interface FoldShape {
  points: string;
  tone?: 'paper' | 'underside' | 'accent';
}
export interface FoldLine {
  points: string;
  kind: 'crease' | 'fold' | 'mountain' | 'edge' | 'hidden';
}
export interface FoldArrow {
  path: string;
  kind?: 'fold' | 'open' | 'turn';
}
export interface FoldLabel { x: number; y: number; text: string; }
export interface FoldFrame {
  view?: 'top' | 'side' | 'front';
  shapes: FoldShape[];
  lines?: FoldLine[];
  arrows?: FoldArrow[];
  labels?: FoldLabel[];
}
export interface FoldStep {
  title: string;
  instruction: string;
  detail?: string;
  before: FoldFrame;
  after: FoldFrame;
}
export interface FoldGuide {
  id: string;
  orientation: 'portrait' | 'landscape';
  steps: FoldStep[];
  tip: string;
}
