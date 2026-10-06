import type { FoldGuide, FoldFrame, FoldLine, FoldArrow, FoldLabel } from './schema';

// Original geometric schematics, not copies of the publisher's illustrations.
// Procedure: John Collins, https://makezine.com/projects/worlds-best-paper-airplane/
// The sheet is A4 in a 240 x 240 viewBox; nose up until the explicit quarter turn.
// Flat folds below reflect moving facets in their actual hinges. Paper thickness
// and the creator's small layer clearances are omitted, as disclosed in the guide.
type Point = readonly [number, number];
type Tone = 'paper' | 'underside' | 'accent';
interface Layer { vertices: Point[]; tone: Tone }
interface State { layers: Layer[]; lines: { vertices: Point[]; kind: FoldLine['kind'] }[] }
const encode = (p: readonly Point[]) => p.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(' ');
const poly = (vertices: readonly Point[], tone: Tone = 'paper') => ({ points: encode(vertices), tone });
const ln = (vertices: readonly Point[], kind: FoldLine['kind']): FoldLine => ({ points: encode(vertices), kind });
const arrow = (path: string, kind: FoldArrow['kind'] = 'fold'): FoldArrow => ({ path, kind });
const label = (x: number, y: number, text: string): FoldLabel => ({ x, y, text });
// Historical tape preparation can be skipped for the simulated tape-free sheet.
const optional = <T extends FoldGuide['steps'][number]>(step: T): T & { optional: true } => ({ ...step, optional: true });
const cross = (p: Point, a: Point, b: Point) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const area = (p: readonly Point[]) => Math.abs(p.reduce((sum, v, i) => {
  const w = p[(i + 1) % p.length];
  return sum + v[0] * w[1] - w[0] * v[1];
}, 0)) / 2;
function reflect(p: Point, a: Point, b: Point): Point {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const f = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  return [2 * (a[0] + f * dx) - p[0], 2 * (a[1] + f * dy) - p[1]];
}
function clip(polygon: readonly Point[], a: Point, b: Point, sign: number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const vp = sign * cross(p, a, b), vq = sign * cross(q, a, b);
    if (vp >= -1e-8) result.push(p);
    if ((vp > 1e-8 && vq < -1e-8) || (vp < -1e-8 && vq > 1e-8)) {
      const f = vp / (vp - vq);
      result.push([p[0] + f * (q[0] - p[0]), p[1] + f * (q[1] - p[1])]);
    }
  }
  return result.filter((p, i) => !i || Math.hypot(p[0] - result[i - 1][0], p[1] - result[i - 1][1]) > 1e-7);
}
function splitSegment(p: Point, q: Point, a: Point, b: Point, sign: number): { fixed?: Point[]; moving?: Point[] } {
  const vp = sign * cross(p, a, b), vq = sign * cross(q, a, b);
  if (vp >= -1e-8 && vq >= -1e-8) return { moving: [p, q] };
  if (vp <= 1e-8 && vq <= 1e-8) return { fixed: [p, q] };
  const f = vp / (vp - vq), i: Point = [p[0] + f * (q[0] - p[0]), p[1] + f * (q[1] - p[1])];
  return vp > 0 ? { moving: [p, i], fixed: [i, q] } : { fixed: [p, i], moving: [i, q] };
}
function fold(state: State, a: Point, b: Point, movingPoint: Point, behind = false): State {
  const sign = Math.sign(cross(movingPoint, a, b));
  const fixed: Layer[] = [], moved: Layer[] = [];
  for (const layer of state.layers) {
    const stay = clip(layer.vertices, a, b, -sign), go = clip(layer.vertices, a, b, sign);
    if (area(stay) > 1e-5) fixed.push({ ...layer, vertices: stay });
    if (area(go) > 1e-5) moved.push({ vertices: go.map(p => reflect(p, a, b)), tone: layer.tone === 'paper' ? 'underside' : 'paper' });
  }
  moved.reverse();
  const lines: State['lines'] = [];
  for (const line of state.lines) {
    for (let i = 0; i < line.vertices.length - 1; i++) {
      const parts = splitSegment(line.vertices[i], line.vertices[i + 1], a, b, sign);
      if (parts.fixed) lines.push({ vertices: parts.fixed, kind: line.kind });
      if (parts.moving) lines.push({ vertices: parts.moving.map(p => reflect(p, a, b)), kind: 'hidden' });
    }
  }
  lines.push({ vertices: [a, b], kind: 'crease' });
  return { layers: behind ? [...moved, ...fixed] : [...fixed, ...moved], lines };
}
function frame(state: State, view: FoldFrame['view'] = 'top', labels: FoldLabel[] = []): FoldFrame {
  return { view, shapes: state.layers.map(l => poly(l.vertices, l.tone)), lines: state.lines.map(l => ln(l.vertices, l.kind)), labels };
}
const action = (f: FoldFrame, lines: FoldLine[] = [], arrows: FoldArrow[] = [], labels: FoldLabel[] = []): FoldFrame => ({
  ...f, lines: [...(f.lines ?? []), ...lines], arrows, labels,
});
function transform(state: State, fn: (p: Point) => Point): State {
  return { layers: state.layers.map(l => ({ ...l, vertices: l.vertices.map(fn) })), lines: state.lines.map(l => ({ ...l, vertices: l.vertices.map(fn) })) };
}
function half(state: State, a: Point, b: Point, keepPoint: Point): State {
  const sign = Math.sign(cross(keepPoint, a, b));
  const layers = state.layers.map(l => ({ ...l, vertices: clip(l.vertices, a, b, sign) })).filter(l => area(l.vertices) > 1e-5);
  const lines: State['lines'] = [];
  for (const l of state.lines) for (let i = 0; i < l.vertices.length - 1; i++) {
    const part = splitSegment(l.vertices[i], l.vertices[i + 1], a, b, sign).moving;
    if (part) lines.push({ vertices: part, kind: l.kind });
  }
  return { layers, lines };
}
const combine = (a: State, b: State): State => ({ layers: [...a.layers, ...b.layers], lines: [...a.lines, ...b.lines] });

const A: Point = [48, 18], B: Point = [192, 18], BL: Point = [48, 222], BR: Point = [192, 222];
const L: Point = [48, 162], R: Point = [192, 162], C: Point = [120, 90], bottom: Point = [120, 222];
const t = Math.tan(Math.PI / 8);
const TL: Point = [48 + 144 * t, 18], TR: Point = [192 - 144 * t, 18];
const HL: Point = [48 + 72 * t, 90], HR: Point = [192 - 72 * t, 90];
const plain: State = { layers: [{ vertices: [A, B, BR, BL], tone: 'paper' }], lines: [] };
const diagonalOne: State = { ...plain, lines: [{ vertices: [A, R], kind: 'crease' }] };
const diagonals: State = { ...plain, lines: [...diagonalOne.lines, { vertices: [B, L], kind: 'crease' }] };
const leftNose = fold(diagonals, TL, L, A);
const bothNose = fold(leftNose, TR, R, B);
const lowered = fold(bothNose, HL, HR, TL);
const leftCorner = fold(lowered, C, L, HL);
const corners = fold(leftCorner, C, R, HR);
const foldedBody = fold(corners, C, bottom, L, true);
// Keep the two half-wing stacks separate: the first wing operation must not
// silently fold the other wing. Outside layers stay outside the mountain fold.
const nearHalf = half(corners, C, bottom, R);
const farHalfOriginal = half(corners, C, bottom, L);
const farHalfMirrored: State = {
  layers: farHalfOriginal.layers.slice().reverse().map(l => ({ vertices: l.vertices.map(p => reflect(p, C, bottom)), tone: l.tone === 'paper' ? 'underside' : 'paper' })),
  lines: farHalfOriginal.lines.map(l => ({ vertices: l.vertices.map(p => reflect(p, C, bottom)), kind: 'hidden' })),
};
const quarterTurn = ([x, y]: Point): Point => [y - 36, 276 - x];
const nearSide = transform(nearHalf, quarterTurn), farSide = transform(farHalfMirrored, quarterTurn);
const sideBody = combine(farSide, nearSide);
const N: Point = quarterTurn(C), shoulder: Point = quarterTurn(R), tailOuter: Point = quarterTurn(BR), tailSpine: Point = quarterTurn(bottom);
const trialHinge: Point = [186, 156 - 132 * t];
// At the tentative fold the leading edge reaches the spine, but a small white
// triangle remains visible. Lowering it until that gap disappears sets the
// final hinge. With zero-thickness A4 geometry, reflected tailSpine touches
// the original outer wing edge y=84 when sin(2*phi) = -72/132.
const phi = -0.5 * Math.asin(72 / 132);
const finalHinge: Point = [186, 156 + 132 * Math.tan(phi)];
const trialNear = fold(nearSide, N, trialHinge, shoulder);
const trialWing = combine(farSide, trialNear);
const finalNear = fold(nearSide, N, finalHinge, shoulder);
const oneWing = combine(farSide, finalNear);
const finalFar = fold(farSide, N, finalHinge, shoulder);
const bothWings = combine(finalFar, finalNear);

// For the opened top view, wing distances are measured perpendicular to the
// actual slanted hinge; a simple x-mirror of the closed silhouette would give
// an incorrect span and trailing edge. This is a zero-thickness 90-degree
// opening about each wing hinge, projected from above.
const u: Point = [Math.cos(phi), Math.sin(phi)], v: Point = [-Math.sin(phi), Math.cos(phi)];
function toTop(p: Point, sign: number): Point {
  const dx = p[0] - N[0], dy = p[1] - N[1];
  const longitudinal = (u[0] * dx + u[1] * dy) * u[0];
  const width = v[0] * dx + v[1] * dy;
  return [120 + sign * width, 90 + longitudinal];
}
const unfoldedFacet: Point[] = [N, shoulder, tailOuter, finalHinge];
const closedFacet = unfoldedFacet.map(p => reflect(p, N, finalHinge));
const leftWingTop = closedFacet.map(p => toTop(p, -1)), rightWingTop = closedFacet.map(p => toTop(p, 1));
function undersideWingLayers(sourceBeforeWingFold: State, sign: number): Layer[] {
  // Select the original MOVING facets before folding. The reflected wing and
  // the retained keel lie on the same side of the hinge in a closed side view,
  // so clipping finalNear/finalFar there would falsely open the keel as a wing.
  const side = Math.sign(cross(shoulder, N, finalHinge));
  return sourceBeforeWingFold.layers.map(l => ({ ...l, vertices: clip(l.vertices, N, finalHinge, side) }))
    .filter(l => area(l.vertices) > 1e-5)
    .map(l => ({ ...l, vertices: l.vertices.map(p => toTop(reflect(p, N, finalHinge), sign)) }));
}
const leftUndersideSource = transform(farHalfOriginal, p => quarterTurn([240 - p[0], p[1]]));
const openTop: FoldFrame = {
  view: 'top',
  // The upper faces are the continuous outer sheet. The nose packet and its
  // sloping free-layer seams are underneath, as in the creator's final photos.
  shapes: [poly(leftWingTop), poly(rightWingTop)],
  lines: [ln([[120, 90], [120, 222]], 'edge'), ln(leftWingTop, 'edge'), ln(rightWingTop, 'edge')],
  labels: [label(120, 66, 'Nose')],
};
const undersideTop: FoldFrame = {
  view: 'top',
  shapes: [...undersideWingLayers(leftUndersideSource, -1), ...undersideWingLayers(nearSide, 1)].map(l => poly(l.vertices, l.tone)),
  lines: [ln([[120, 90], [120, 222]], 'edge')],
  labels: [label(120, 66, 'Underside')],
};
const preparedSide = frame(bothWings, 'side');
const onSide = (s: FoldFrame): FoldFrame => ({ ...s, view: 'side' });

// Tape is an optional historical preparation, not part of the equal-stock
// tape-free numerical airframe. These original diagrams identify the order
// and regions of the source procedure; spacing is schematic, not measured.
// Width is deliberately exaggerated so a mobile reader can see a strip.
const strip = (center: Point, length: number, width: number, angle = 0) => {
  const c = Math.cos(angle), s = Math.sin(angle);
  return poly([[-length / 2, -width / 2], [length / 2, -width / 2], [length / 2, width / 2], [-length / 2, width / 2]].map(([x, y]) => [center[0] + c * x - s * y, center[1] + s * x + c * y] as Point), 'accent');
};
const withTape = (f: FoldFrame, strips: ReturnType<typeof strip>[], labels: FoldLabel[] = []): FoldFrame => ({ ...f, shapes: [...f.shapes, ...strips], labels });
const sideTape12 = [strip([136, 138], 16, 2.6, Math.PI / 2), strip([151, 137], 16, 2.6, Math.PI / 2)];
const sideTape345 = [strip([58, 154], 8, 3.4, -0.15), strip([67, 156], 7, 3.4), strip([76, 156], 7, 3.4)];
const tapedTab = withTape(preparedSide, sideTape12);
const tapedNose = withTape(preparedSide, [...sideTape12, ...sideTape345]);
const sideCornerTip = quarterTurn([120, 90 + 72 * t]);
const seamMovingSide = Math.sign(cross(shoulder, N, finalHinge));
const seamMoving = splitSegment(sideCornerTip, shoulder, N, finalHinge, seamMovingSide).moving!;
const seamRoot = toTop(reflect(seamMoving[0], N, finalHinge), -1);
function seamTape(x: number, length: number) {
  const sign = x < 120 ? -1 : 1;
  const end = sign < 0 ? leftWingTop[1] : rightWingTop[1];
  const slope = (end[1] - seamRoot[1]) / (end[0] - 120);
  return strip([x, seamRoot[1] + (x - 120) * slope], length, 2.3, Math.atan(slope));
}
function trailingWrap(x: number) {
  const sign = x < 120 ? -1 : 1;
  const wing = sign < 0 ? leftWingTop : rightWingTop;
  const outer = wing[2], root = wing[3];
  const edgeY = root[1] + (x - root[0]) * (outer[1] - root[1]) / (outer[0] - root[0]);
  const tape: Point[] = [[x - 1.15, edgeY - 5.5], [x + 1.15, edgeY - 5.5], [x + 1.15, edgeY + 5.5], [x - 1.15, edgeY + 5.5]];
  // Only the near-face half of a wrapped strip is visible. Its lower edge
  // lands on the actual sloping paper edge rather than hanging beyond it.
  return poly(clip(tape, root, outer, Math.sign(cross([120, 90], root, outer))), 'accent');
}
const topTape67 = [seamTape(92, 30 * 144 / 210), seamTape(148, 30 * 144 / 210)];
const topTape89 = [trailingWrap(91), trailingWrap(149)];
const topTape101112 = [strip([120, 219], 8, 2.3, Math.PI / 2), seamTape(76, 8), seamTape(164, 8)];
const topTape1314 = [seamTape(111, 30 * 144 / 210), seamTape(129, 30 * 144 / 210)];
const topTape1516 = [strip([120, 107], 21, 3.1), strip([120, 117], 21, 3.1)];
const tapeTopBase = withTape(undersideTop, [strip([120, 93], 7, 3.4), strip([120, 100], 7, 3.4)], [label(120, 66, 'Underside')]);
const tapeTop67 = withTape(tapeTopBase, topTape67);
const tapeTop89 = withTape(tapeTop67, topTape89);
const tapeTop101112 = withTape(tapeTop89, topTape101112);
const tapeTop1314 = withTape(tapeTop101112, topTape1314);
// A turn to the upper side hides the underside seams and their tape. The
// center-rear wrap remains visible, then the two final cross bands are added.
const tapeTop1516 = withTape(openTop, [strip([120, 93], 7, 3.4), ...topTape89, topTape101112[0], ...topTape1516]);
const prepStrips = Array.from({ length: 10 }, (_, i) => strip([32 + (i % 5) * 42, 33 + Math.floor(i / 5) * 20], 30, i < 3 ? 3.8 : 2.4));

function frontGauge(included: number, y: number): FoldFrame['shapes'] {
  const rise = 75 * Math.tan((180 - included) * Math.PI / 360);
  return [poly([[45, y - rise], [120, y], [195, y - rise], [195, y - rise + 2], [120, y + 2], [45, y - rise + 2]]), poly([[118.5, y + 1], [121.5, y + 1], [121.5, y + 22], [118.5, y + 22]], 'underside')];
}
const frontFlat: FoldFrame = {
  view: 'front', shapes: [...frontGauge(180, 95), ...frontGauge(180, 177)],
  lines: [ln([[120, 96], [120, 116]], 'edge'), ln([[120, 178], [120, 199]], 'edge')],
  labels: [label(120, 61, 'Nose station'), label(120, 142, 'Mid-wing station')],
};
const frontShaped: FoldFrame = {
  view: 'front', shapes: [...frontGauge(165, 95), ...frontGauge(155, 177)],
  lines: [ln([[45, 95], [195, 95]], 'hidden'), ln([[45, 177], [195, 177]], 'hidden')],
  labels: [label(120, 57, '165° at nose'), label(120, 138, '155° at mid-wing')],
};

export const SUZANNE_GUIDE: FoldGuide = {
  id: 'suzanne', orientation: 'portrait',
  steps: [
    {
      title: 'Make the first diagonal reference',
      instruction: 'Start with uncut A4, short edge at the top. Bring the top edge onto the left long edge, crease, then open the sheet again.',
      detail: 'The upper-left corner stays fixed. This diagonal is a reference crease, not a folded-down wing. Keep the lower part of the A4 sheet intact.',
      before: action(frame(plain), [ln([A, R], 'fold')], [arrow('M 179 32 Q 147 100 61 151'), arrow('M 70 131 Q 142 94 179 51', 'open')], [label(120, 210, 'A4 · 210 × 297 mm')]),
      after: frame(diagonalOne),
    },
    {
      title: 'Make the opposite diagonal',
      instruction: 'Bring the top edge onto the right long edge, crease, and reopen. The two diagonals now cross.',
      detail: 'Work symmetrically. The crossing point will locate the next horizontal fold; there is no extra center crease yet.',
      before: action(frame(diagonalOne), [ln([B, L], 'fold')], [arrow('M 61 32 Q 92 98 179 151'), arrow('M 170 131 Q 96 94 61 51', 'open')]),
      after: frame(diagonals, 'top', [label(120, 112, 'Crossing point')]),
    },
    {
      title: 'Bring in the upper-left edge',
      instruction: 'Fold the upper part of the left long edge onto the diagonal that runs upward to the top-right corner.',
      detail: 'Use the crease as an alignment line. Only the upper-left triangle moves; the lower left side remains full width.',
      before: action(frame(diagonals), [ln([TL, L], 'fold')], [arrow('M 59 31 Q 79 8 147 60')]),
      after: frame(leftNose),
    },
    {
      title: 'Bring in the upper-right edge',
      instruction: 'Fold the matching upper-right edge onto the other diagonal. Align the two sides carefully.',
      detail: 'The reflected corner ends at the same height as the first one. A narrow top and two layered shoulders remain.',
      before: action(frame(leftNose), [ln([TR, R], 'fold')], [arrow('M 181 31 Q 159 8 93 60')]),
      after: frame(bothNose),
    },
    {
      title: 'Lower the layered top',
      instruction: 'Fold the whole upper section down on a horizontal line through the original diagonal crossing.',
      detail: 'The two reference diagonals locate the hinge. Reflect the entire layered top downward; do not cut off or hide its lower trapezoid.',
      before: action(frame(bothNose), [ln([HL, HR], 'fold')], [arrow('M 120 29 Q 161 86 120 157')]),
      after: frame(lowered),
    },
    {
      title: 'Fold the new left corner inward',
      instruction: 'Bring the new upper-left corner down to the center, using the existing diagonal as its hinge.',
      detail: 'The layered corner rotates around the diagonal from the nose to the left shoulder. Leave the lower center tab in place.',
      before: action(frame(lowered), [ln([C, L], 'fold')], [arrow('M 81 92 Q 80 137 119 132')]),
      after: frame(leftCorner),
    },
    {
      title: 'Match the right corner',
      instruction: 'Fold the upper-right corner down to meet the first corner on the centerline.',
      detail: 'Both corner tips meet. The remaining lower tab is part of the layered nose; it is not an independent flap to remove.',
      before: action(frame(leftCorner), [ln([C, R], 'fold')], [arrow('M 159 92 Q 161 137 121 132')]),
      after: frame(corners),
    },
    {
      title: 'Close the body with layers outside',
      instruction: 'Fold the airplane in half along its centerline, taking the left half away from you behind the right half.',
      detail: 'This is a mountain fold. The folded nose layers stay outside the body. A valley fold in the opposite direction would trap the layers incorrectly.',
      before: action(frame(corners), [ln([C, bottom], 'mountain')], [arrow('M 68 190 Q 120 234 173 190')]),
      after: frame(foldedBody),
    },
    {
      title: 'Turn nose left, spine down',
      instruction: 'Turn the closed model a quarter turn on the table so its nose points left and its long center fold is along the bottom.',
      detail: 'The result is a side view of the same closed body. No new crease is made in this step.',
      before: action(frame(foldedBody), [], [arrow('M 177 74 Q 226 110 190 161', 'turn')]),
      after: frame(sideBody, 'side', [label(61, 179, 'Nose'), label(160, 179, 'Spine')]),
    },
    {
      title: 'Position the first wing without creasing',
      instruction: 'Lower the near wing until its folded leading edge reaches the spine. Hold it loosely and leave the hinge uncreased.',
      detail: 'A small white triangular gap still shows at the rear. This is only the initial alignment position; do not press a permanent wing fold yet.',
      before: action(frame(sideBody, 'side'), [ln([N, trialHinge], 'fold')], [arrow('M 132 88 Q 172 119 155 154')]),
      after: action(frame(trialWing, 'side'), [ln([[155.82, 156], [186, 156], [186, 125.82]], 'edge')], [], [label(177, 188, 'White gap')]),
    },
    {
      title: 'Close the white gap, then crease',
      instruction: 'Lower the same wing a little farther until the white triangle disappears. Only then press the wing hinge.',
      detail: 'The free wing edge now covers the rear spine corner. The source uses this alignment test rather than a fixed millimeter offset. The hinge drawn here follows ideal zero-thickness geometry.',
      before: action(frame(trialWing, 'side'), [ln([N, finalHinge], 'fold')], [arrow('M 171 126 Q 193 140 188 158')], [label(173, 187, 'Lower slightly')]),
      after: frame(oneWing, 'side', [label(154, 199, 'Gap closed')]),
    },
    {
      title: 'Fold the second wing to match',
      instruction: 'Turn the model over, fold the other wing to match the first, and return to the same side for checking.',
      detail: 'Match both leading edges and both wing hinges. The before and after views use the same side orientation; the turn is shown by the curved arrow.',
      before: action(frame(oneWing, 'side'), [ln([N, finalHinge], 'mountain')], [arrow('M 203 91 Q 226 132 203 177', 'turn'), arrow('M 132 86 Q 166 117 159 168')]),
      after: frame(bothWings, 'side'),
    },
    {
      title: 'Open the wings for a symmetry check',
      instruction: 'Spread the two wings away from the keel. Turn the nose upward again and inspect the model from above.',
      detail: 'The view changes from side to top. Both wings open around their actual slanted hinges; the keel stays below the centerline. Keep the nose layers aligned. Tape-free simulator construction can proceed directly to the final shaping step.',
      before: action(frame(bothWings, 'side'), [ln([N, finalHinge], 'crease')], [arrow('M 139 163 Q 135 119 165 85', 'open'), arrow('M 172 153 Q 206 123 208 90', 'open')]),
      after: openTop,
    },
    optional({
      title: 'Optional record preparation: prepare tape',
      instruction: 'For the creator’s taped physical preparation, make three 30 × 2.25 mm strips and seven 30 × 1.5 mm strips. Keep all paper uncut.',
      detail: 'Tape is optional and absent from the simulator. Collins used Scotch Magic tape with 100 g/m² A4; this fair model uses the selected paper stock. Subdivide strips for positions 3–5 and 10–12 as shown in the linked original tutorial. The strip widths in these diagrams are enlarged for legibility.',
      before: action(openTop, [], [arrow('M 24 46 Q 45 11 72 28')], [label(120, 48, 'Tape only')]),
      after: withTape(openTop, prepStrips, [label(120, 77, '30 mm lengths')]),
    }),
    optional({
      title: 'Optional tape: secure the center tab',
      instruction: 'Return to the side view and put the first two narrow pieces at the two exposed ends of the layered center tab.',
      detail: 'These are source positions 1 and 2. Press down the layered tab without changing its creases. The preparation strips above are separate supplies, not attached paper parts. Placement regions here are schematic; use the linked creator guide for exact positioning.',
      before: action(preparedSide, [], [arrow('M 129 113 Q 130 124 136 137'), arrow('M 163 113 Q 157 121 151 137')], [label(143, 72, 'Pieces 1–2')]),
      after: tapedTab,
    }),
    optional({
      title: 'Optional tape: reinforce the nose',
      instruction: 'Apply the three short wider pieces around the nose and the adjacent front spine, in the creator’s numbered order.',
      detail: 'These are positions 3, 4 and 5, cut from one wider strip. Wrap them across the nearby layers rather than stretching or reshaping the nose. Tape has no modeled mass or aerodynamic effect because it is not part of the simulated airframe.',
      before: action(tapedTab, [], [arrow('M 51 125 Q 41 146 59 153'), arrow('M 85 183 Q 63 179 67 157')], [label(113, 72, 'Pieces 3–5')]),
      after: tapedNose,
    }),
    optional({
      title: 'Optional tape: secure paired leading seams',
      instruction: 'Open the wings and view the underside. Attach the next two narrow strips to the matching sloping layer seams.',
      detail: 'These are positions 6 and 7. The drawing changes from side view to underside plan view; the nose remains at the top. Source positions 1–5 remain on the center tab and spine, largely hidden in this view.',
      before: action(onSide(tapedNose), [], [arrow('M 196 96 Q 226 122 206 158', 'turn')], [label(132, 63, 'Turn to underside')]),
      after: withTape(tapeTop67, [], [label(79, 161, '7'), label(161, 161, '6')]),
    }),
    optional({
      title: 'Optional tape: wrap the trailing edges',
      instruction: 'Use the next two narrow pieces at the matching rear wing edges, wrapping across the paper edge.',
      detail: 'These are positions 8 and 9. Keep the two sides equal and avoid pulling an unintended twist into the wings. The colored rectangles indicate tape, not new folds or winglets.',
      before: action(tapeTop67, [], [arrow('M 55 216 Q 66 237 90 230'), arrow('M 185 216 Q 174 237 150 230')]),
      after: withTape(tapeTop89, [], [label(74, 215, '8'), label(166, 215, '9')]),
    }),
    optional({
      title: 'Optional tape: use the divided narrow strip',
      instruction: 'Place the three short pieces at the center rear edge and the two outer ends of the sloping layer seams.',
      detail: 'These are positions 10, 11 and 12, subdivided from one narrow strip. Their order and approximate regions follow the creator’s tutorial; the illustrations do not supply measured placement offsets.',
      before: action(tapeTop89, [], [arrow('M 50 156 Q 58 175 77 180'), arrow('M 190 156 Q 182 175 163 180'), arrow('M 134 207 Q 125 199 120 217')]),
      after: withTape(tapeTop101112, [], [label(61, 190, '12'), label(178, 190, '11'), label(142, 218, '10')]),
    }),
    optional({
      title: 'Optional tape: finish the inner seams',
      instruction: 'Add the next two narrow pieces to the corresponding inner sloping layer seams near the wing roots.',
      detail: 'These are positions 13 and 14. Secure the existing layer edges while keeping the left and right wings symmetric. Do not add a new root crease.',
      before: action(tapeTop101112, [], [arrow('M 88 143 Q 100 135 111 152'), arrow('M 152 143 Q 140 135 129 152')]),
      after: withTape(tapeTop1314, [], [label(92, 151, '14'), label(147, 151, '13')]),
    }),
    optional({
      title: 'Optional tape: add the final cross bands',
      instruction: 'Turn to the upper side and apply the two remaining full wider strips across the layered front body, last.',
      detail: 'These are source positions 15 and 16: each 30 × 2.25 mm. The two transverse bands are intentionally installed after the other tape. All tape placements remain an optional physical preparation outside the tape-free simulation.',
      before: action(tapeTop1314, [], [arrow('M 171 95 Q 158 106 131 107'), arrow('M 70 118 Q 85 112 109 117'), arrow('M 185 144 Q 205 158 187 178', 'turn')]),
      after: withTape(tapeTop1516, [], [label(166, 105, '15'), label(166, 124, '16'), label(120, 65, 'Upper side')]),
    }),
    {
      title: 'Shape the variable upward V',
      instruction: 'Hold the keel and raise both wings evenly. Check an included angle of about 165° at the nose and 155° farther back at mid-wing.',
      detail: 'The before and after diagrams are two front-view cross sections of one airplane, not two airplanes. The creator uses angle gauges; 165° means about 7.5° rise per wing, while 155° means about 12.5°. The tapering wing angle is physical shaping, not an extra sharp crease. The simulator uses a representative single dihedral and cannot reproduce all this flexibility.',
      before: action(frontFlat, [], [arrow('M 51 94 Q 59 73 81 87', 'open'), arrow('M 189 94 Q 181 73 159 87', 'open'), arrow('M 51 176 Q 58 149 81 163', 'open'), arrow('M 189 176 Q 182 149 159 163', 'open')]),
      after: frontShaped,
    },
  ],
  tip: 'Suzanne is John Collins’s design thrown by Joe Ayoob for the former 69.14 m distance record in 2012. This original schematic follows Collins’s public fold sequence; layer clearances and tape placements are approximate. Steps 14–21 describe optional historical tape preparation and may be skipped for the tape-free model. The record preparation used 100 g/m² A4 and tape; simulated comparisons use equal selected paper stock and estimated, uncalibrated aerodynamics. Read the linked creator tutorial for exact preparation and trim before a physical throw.',
};
