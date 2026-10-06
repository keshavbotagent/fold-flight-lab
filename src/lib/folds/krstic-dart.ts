import type { FoldGuide, FoldFrame, FoldLine, FoldArrow, FoldLabel } from './schema';

/**
 * Original schematic drawings of the publicly demonstrated Krstić method.
 * The source links and the limits of the reconstruction are documented in
 * docs/airframes.md. This is a companion to the creator demonstration,
 * not a claim that a particular hand-folded plane will reproduce 61.11 m.
 *
 * Working coordinates below are millimetres. The repeated rolls are drawn as
 * a fan around one nose, rather than as an unrelated conventional centre dart.
 * View cameras fit those coordinates into a 240 × 240 SVG; they do not change
 * the paper. Polygons are clipped and reflected at their drawn fold creases.
 */
type Point = readonly [number, number];
type Piece = { vertices: Point[]; layer: 'body' | 'wrapper'; underside: boolean };
type Paper = Piece[];
type Seam = [Point, Point][];
type Camera = { scale: number; x: number; y: number };
const ROOT_TWO = Math.sqrt(2);
const NOSE: Point = [0, 0];
const EPSILON = 1e-7;
const mm = (value: number) => Number(value.toFixed(2));
const pointString = (vertices: Point[]) => vertices.map(([x, y]) => `${mm(x)},${mm(y)}`).join(' ');
const project = ([x, y]: Point, camera: Camera): Point => [camera.x + x * camera.scale, camera.y + y * camera.scale];
function clipSegment(start: Point, end: Point, box: readonly [number, number, number, number] = [12, 12, 228, 228]): Point[] {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  let low = 0, high = 1;
  for (const [p, q] of [[-dx, start[0] - box[0]], [dx, box[2] - start[0]], [-dy, start[1] - box[1]], [dy, box[3] - start[1]]]) {
    if (Math.abs(p) < EPSILON) { if (q < 0) return []; continue; }
    const ratio = q / p;
    if (p < 0) low = Math.max(low, ratio); else high = Math.min(high, ratio);
    if (low > high) return [];
  }
  return [[start[0] + low * dx, start[1] + low * dy], [start[0] + high * dx, start[1] + high * dy]];
}
const polyline = (vertices: Point[], kind: FoldLine['kind'], camera: Camera): FoldLine => {
  const projected = vertices.map(p => project(p, camera));
  const clipped: Point[] = [];
  for (let i = 0; i < projected.length - 1; i += 1) {
    const segment = clipSegment(projected[i], projected[i + 1]);
    if (segment.length) clipped.push(...segment);
  }
  return { points: pointString(clipped), kind };
};
const side = (p: Point, a: Point, b: Point) =>
  (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

function reflect(p: Point, a: Point, b: Point): Point {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  return [2 * (a[0] + t * dx) - p[0], 2 * (a[1] + t * dy) - p[1]];
}

function clip(vertices: Point[], a: Point, b: Point, sign: number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < vertices.length; i += 1) {
    const current = vertices[i], next = vertices[(i + 1) % vertices.length];
    const currentSide = sign * side(current, a, b), nextSide = sign * side(next, a, b);
    if (currentSide >= -EPSILON) result.push(current);
    if ((currentSide > EPSILON && nextSide < -EPSILON) || (currentSide < -EPSILON && nextSide > EPSILON)) {
      const t = currentSide / (currentSide - nextSide);
      result.push([current[0] + t * (next[0] - current[0]), current[1] + t * (next[1] - current[1])]);
    }
  }
  return result.filter((p, i) => !i || Math.hypot(p[0] - result[i - 1][0], p[1] - result[i - 1][1]) > EPSILON);
}

function usable(vertices: Point[]): boolean {
  const twiceArea = vertices.reduce((sum, p, i) => {
    const next = vertices[(i + 1) % vertices.length];
    return sum + p[0] * next[1] - next[0] * p[1];
  }, 0);
  return vertices.length >= 3 && Math.abs(twiceArea) > EPSILON;
}

function fold(paper: Paper, a: Point, b: Point, movingSign: number, selected: Piece['layer'] | 'all' = 'all'): Paper {
  const fixed: Paper = [], moving: Paper = [];
  for (const piece of paper) {
    if (selected !== 'all' && selected !== piece.layer) {
      fixed.push(piece);
      continue;
    }
    const still = clip(piece.vertices, a, b, -movingSign);
    const flap = clip(piece.vertices, a, b, movingSign);
    if (usable(still)) fixed.push({ ...piece, vertices: still });
    if (usable(flap)) moving.push({ ...piece, vertices: flap.map(p => reflect(p, a, b)), underside: !piece.underside });
  }
  return [...fixed, ...moving];
}

// The original diagonal is a material attachment, not merely two coincident
// drawn edges. Carry both adjoining packets whenever a fold moves that seam.
function foldSeam(seam: Seam, a: Point, b: Point, sign: number): Seam {
  const result: Seam = [];
  for (const [start, end] of seam) {
    const startSide = sign * side(start, a, b), endSide = sign * side(end, a, b);
    if (startSide <= EPSILON && endSide <= EPSILON) result.push([start, end]);
    else if (startSide >= -EPSILON && endSide >= -EPSILON) result.push([reflect(start, a, b), reflect(end, a, b)]);
    else {
      const t = startSide / (startSide - endSide);
      const hinge: Point = [start[0] + t * (end[0] - start[0]), start[1] + t * (end[1] - start[1])];
      result.push(startSide > 0 ? [reflect(start, a, b), hinge] : [start, hinge]);
      result.push(endSide > 0 ? [hinge, reflect(end, a, b)] : [hinge, end]);
    }
  }
  return result.filter(([a, b]) => Math.hypot(a[0] - b[0], a[1] - b[1]) > EPSILON);
}

function cameraFor(...papers: Paper[]): Camera {
  const vertices = papers.flatMap(paper => paper.flatMap(piece => piece.vertices));
  const minX = Math.min(...vertices.map(p => p[0])), maxX = Math.max(...vertices.map(p => p[0]));
  const minY = Math.min(...vertices.map(p => p[1])), maxY = Math.max(...vertices.map(p => p[1]));
  const scale = Math.min(176 / Math.max(1, maxX - minX), 190 / Math.max(1, maxY - minY));
  return { scale, x: 120 - (minX + maxX) * scale / 2, y: 24 - minY * scale };
}

function envelope(vertices: Point[]): Point[] {
  const ordered = vertices.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .filter((p, i, all) => !i || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) > EPSILON);
  const half = (sequence: Point[]) => {
    const hull: Point[] = [];
    for (const p of sequence) {
      while (hull.length > 1 && side(p, hull[hull.length - 2], hull[hull.length - 1]) <= EPSILON) hull.pop();
      hull.push(p);
    }
    return hull.slice(0, -1);
  };
  return [...half(ordered), ...half(ordered.slice().reverse())];
}

function frame(paper: Paper, camera: Camera, creases: { vertices: Point[]; kind: FoldLine['kind'] }[] = []): FoldFrame {
  // The hundreds of overlapping internal packet facets would obscure the
  // instruction. Show each packet's projected envelope and its upper layers;
  // the complete clipped/reflected paper remains in the working model above.
  const visible: Paper = [];
  for (const layer of ['body', 'wrapper'] as const) {
    const packet = paper.filter(piece => piece.layer === layer);
    if (!packet.length) continue;
    visible.push({ vertices: envelope(packet.flatMap(piece => piece.vertices)), layer, underside: packet[0].underside });
    visible.push(...packet.slice(-4));
  }
  const unique = visible.filter((piece, i) => !visible.slice(0, i).some(old => pointString(old.vertices) === pointString(piece.vertices)));
  return {
    view: 'top',
    shapes: unique.map(piece => ({ points: pointString(piece.vertices.map(p => project(p, camera))), tone: piece.underside ? 'underside' : 'paper' })),
    lines: [
      ...creases.map(crease => polyline(crease.vertices, crease.kind, camera)),
      ...unique.slice(-5).map(piece => polyline([...piece.vertices, piece.vertices[0]], 'edge', camera)),
    ],
  };
}

const detailBox = [-9, 170, 9, 195] as const;
const detailCamera: Camera = { scale: 4, x: 180, y: 108 - 170 * 4 };
function tailDetail(source: FoldFrame, camera: Camera): FoldFrame {
  // Magnify the same visible polygons; this inset does not substitute a wider
  // plane or change its working geometry. The complete plane remains at left.
  const unproject = ([x, y]: Point): Point => [(x - camera.x) / camera.scale, (y - camera.y) / camera.scale];
  const decode = (points: string): Point[] => points.split(' ').filter(Boolean).map(pair => {
    const [x, y] = pair.split(',').map(Number); return unproject([x, y]);
  });
  const crops = source.shapes.flatMap(shape => {
    let vertices = decode(shape.points);
    for (const [a, b] of [
      [[-9, 170], [9, 170]], [[9, 170], [9, 195]],
      [[9, 195], [-9, 195]], [[-9, 195], [-9, 170]],
    ] as [Point, Point][]) vertices = clip(vertices, a, b, 1);
    return usable(vertices) ? [{ ...shape, points: pointString(vertices.map(p => project(p, detailCamera))) }] : [];
  });
  const insetLines: FoldLine[] = [];
  for (const line of source.lines ?? []) {
    const vertices = decode(line.points);
    for (let i = 0; i < vertices.length - 1; i += 1) {
      const section = clipSegment(vertices[i], vertices[i + 1], detailBox);
      if (section.length) insetLines.push({ ...line, points: pointString(section.map(p => project(p, detailCamera))) });
    }
  }
  return {
    ...source,
    shapes: [...source.shapes, ...crops],
    lines: [...(source.lines ?? []), ...insetLines,
      { points: '142,106 218,106 218,210 142,210 142,106', kind: 'hidden' },
      { points: pointString([project([0, 182], camera), [142, 176]]), kind: 'hidden' }],
    labels: [...(source.labels ?? []), { x: 180, y: 94, text: 'Tail close-up' }],
  };
}

function foldArrow(paper: Paper, a: Point, b: Point, movingSign: number, selected: Piece['layer'] | 'all', camera: Camera): FoldArrow[] {
  const candidates = paper.filter(piece => selected === 'all' || piece.layer === selected)
    .flatMap(piece => piece.vertices).filter(p => movingSign * side(p, a, b) > EPSILON);
  if (!candidates.length) return [];
  const source = candidates.reduce((best, p) => Math.abs(side(p, a, b)) > Math.abs(side(best, a, b)) ? p : best);
  const start = project(source, camera), end = project(reflect(source, a, b), camera);
  const dx = end[0] - start[0], dy = end[1] - start[1], length = Math.hypot(dx, dy);
  const bend = Math.min(22, Math.max(8, length * 0.2));
  const control: Point = [
    Math.max(12, Math.min(228, (start[0] + end[0]) / 2 - dy / Math.max(1, length) * bend)),
    Math.max(12, Math.min(222, (start[1] + end[1]) / 2 + dx / Math.max(1, length) * bend)),
  ];
  return [{ path: `M ${mm(start[0])} ${mm(start[1])} Q ${mm(control[0])} ${mm(control[1])} ${mm(end[0])} ${mm(end[1])}`, kind: 'fold' }];
}

const steps: FoldGuide['steps'] = [];
let paper: Paper = [{ vertices: [[0, 0], [210, 0], [210, 297], [0, 297]], layer: 'body', underside: false }];
const firstCamera: Camera = { scale: 144 / 210, x: 48, y: 18 };
const diagonalEnd: Point = [210, 210];
const cornerAfter: Paper = [
  { vertices: [NOSE, diagonalEnd, [210, 297], [0, 297]], layer: 'body', underside: false },
  { vertices: [NOSE, diagonalEnd, [0, 210]], layer: 'wrapper', underside: true },
];
steps.push({
  title: 'Make the diagonal corner base',
  instruction: 'Use an uncut A4 sheet. Bring the top short edge onto the left long edge and press the diagonal corner fold.',
  detail: 'The creator recommends 100 g/m² paper. The simulator compares every design with 80 g/m² paper. This illustrated sequence is a schematic companion to the linked championship demonstration.',
  before: {
    ...frame(paper, firstCamera, [{ vertices: [NOSE, diagonalEnd], kind: 'fold' }]),
    arrows: foldArrow(paper, NOSE, diagonalEnd, -1, 'all', firstCamera),
    labels: [{ x: 120, y: 14, text: 'A4 · 210×297 mm' }],
  },
  after: frame(cornerAfter, firstCamera, [{ vertices: [NOSE, diagonalEnd], kind: 'edge' }]),
});
paper = cornerAfter;

// A change of working orientation puts the corner nose at the top of every
// subsequent drawing. This rotation is explicitly presented to the folder.
const turned: Paper = paper.map(piece => ({ ...piece, vertices: piece.vertices.map(([x, y]): Point => [(x - y) / ROOT_TWO, (x + y) / ROOT_TWO]) }));
steps.push({
  title: 'Turn the diagonal point upward',
  instruction: 'Turn the sheet 45° so the new diagonal edge runs vertically and its pointed end is at the top.',
  detail: 'Keep track of the triangular top layer: it will become the wrapper around the dense spine. The unmarked face and the turned-over face use different shades.',
  before: { ...frame(paper, firstCamera), arrows: [{ path: 'M 168 74 Q 222 70 204 120', kind: 'turn' }], labels: [{ x: 173, y: 154, text: 'Turn 45°' }] },
  after: frame(turned, cameraFor(turned)),
});
paper = turned;
let attachedSeam: Seam = [[NOSE, [0, 210 * ROOT_TWO]]];
let measuredTail = false;
const tailA: Point = [-260, 195], tailB: Point = [100, 195];

function addFold(title: string, instruction: string, detail: string, a: Point, b: Point, sign: number,
  selected: Piece['layer'] | 'all', labels: FoldLabel[] = [], extra: { vertices: Point[]; kind: FoldLine['kind'] }[] = [], magnifyTail = false): void {
  const carriesAttachment = selected !== 'all' && attachedSeam.some(segment => segment.some(p => sign * side(p, a, b) > EPSILON));
  const movingLayers = carriesAttachment ? 'all' : selected;
  const primary = fold(paper, a, b, sign, movingLayers);
  if (movingLayers === 'all') attachedSeam = foldSeam(attachedSeam, a, b, sign);
  const tuckTail = measuredTail && primary.some(piece => piece.vertices.some(p => p[1] > 195 + EPSILON));
  const after = tuckTail ? fold(primary, tailA, tailB, 1, 'all') : primary;
  if (tuckTail) attachedSeam = foldSeam(attachedSeam, tailA, tailB, 1);
  const camera = cameraFor(paper, primary, after);
  const before = frame(paper, camera, [...extra, { vertices: [a, b], kind: 'fold' },
    ...(tuckTail ? [{ vertices: [tailA, tailB], kind: 'fold' as const }] : [])]);
  // A coloured outline shows only the intermediate overhang, so the second
  // arrow starts on actual paper after the first roll. Reflection at 195 mm
  // tucks that paper back into the packet; no vertices are cropped or clamped.
  if (tuckTail) {
    for (const layer of ['body', 'wrapper'] as const) {
      const overhang = primary.filter(piece => piece.layer === layer)
        .flatMap(piece => clip(piece.vertices, tailA, tailB, 1));
      if (usable(envelope(overhang))) before.shapes.push({
        points: pointString(envelope(overhang).map(p => project(p, camera))), tone: 'accent',
      });
    }
  }
  const action: FoldFrame = {
    ...before,
    arrows: [...foldArrow(paper, a, b, sign, movingLayers, camera),
      ...(tuckTail ? foldArrow(primary, tailA, tailB, 1, 'all', camera) : [])],
    labels: [...labels, ...(tuckTail ? [{ x: 63, y: 222, text: '1. Fold' }, { x: 178, y: 222, text: '2. Tail tuck' }] : [])],
  };
  const result = frame(after, camera, [{ vertices: [a, b], kind: 'crease' },
    ...(tuckTail ? [{ vertices: [tailA, tailB], kind: 'crease' as const }] : [])]);
  steps.push({
    title,
    instruction: instruction + (tuckTail ? ' Then tuck the highlighted tail overhang back at the same 195 mm edge.' : ''),
    detail: detail + (carriesAttachment ? ' Carry the attached triangle with the moving face, keeping its free flap accessible.' : '')
      + (tuckTail ? ' Follow arrow 1 for the main fold, then arrow 2 for the tail tuck; the coloured outline is the intermediate projection.' : ''),
    before: magnifyTail ? tailDetail(action, camera) : action,
    after: magnifyTail ? tailDetail(result, camera) : result,
  });
  paper = after;
}

// Roll locations are an idealised fan drawing, not published manufacturing
// angles. The written guide asks the folder to use the creator's crease order
// and the two published ruler checks; it does not prescribe these SVG angles.
const ray = (degrees: number): Point => [Math.tan(degrees * Math.PI / 180) * 400, 400];
function roll(title: string, degrees: number, instruction: string, detail: string): void {
  const end = ray(degrees);
  addFold(title, instruction, detail, NOSE, end, 1, 'body', [], [
    { vertices: [[-110, 195], [18, 195]], kind: 'hidden' },
  ]);
}

roll('Start the first narrow edge roll', -40.5,
  'Lift the narrow outside edge of the lower sheet inward. Keep every roll pointing to the same nose.',
  'Work with the lower sheet, leaving the triangular top layer free. The drawing shows the moving edge and its reflected landing position; take precise crease placements from the creator video.');

// The exposed upper triangle is folded independently of the growing spine.
// Its maximum transverse width is drawn as85mm to preserve the source check.
const wrapperAngle = -Math.atan(85 / (210 * ROOT_TWO - 85)) * 180 / Math.PI;
addFold('Open the top layer and fold its triangle inward',
  'Lift the loose top triangle, fold its inner corner toward the spine, then lay that layer back down.',
  'Keep the lower edge roll intact. This layer remains broader than the spine and will be wrapped and pocket-locked later.',
  NOSE, ray(wrapperAngle), 1, 'wrapper');

roll('Roll the lower edge again', -36,
  'Bring the lower folded edge over itself once, starting at the nose and pressing toward the tail.',
  'Preserve the separate wrapper triangle. Tight, straight layers make the distance dart rigid.');
roll('Make the second repeated edge roll', -31.5,
  'Repeat that lower-edge roll once more. Flatten the stack without twisting the point.',
  'These two rolls follow the initial edge fold; they are successive layers of one spine.');

measuredTail = true;
addFold('Set the spine length to 195 mm',
  'Measure 195 mm from the nose along the spine. Fold the excess tail back at that mark.',
  'Use a ruler on the actual paper. The 195 mm check is from the published championship method, rather than an estimated SVG measurement.',
  [-260, 195], [100, 195], 1, 'all', [{ x: 171, y: 215, text: '195 mm' }]);

// A small reverse fold at the already squared back edge represents the source
// tail-flap flattening operation. All material stays in the model.
addFold('Flatten the two tail corners',
  'Tuck the small upper and lower tail projections into the stack so the back edge is square.',
  'Do not cut the tail. Match its two faces and flatten them with a smooth ruler edge. The diagram shows the exposed flap of this paired operation.',
  [-120, 191], [24, 195], 1, 'body');

roll('Align the upper paper with the tail and roll', -27,
  'Align the protruding upper paper with the squared tail, tuck its corner inward, then turn the lower edge over once.',
  'Keep the back edge flush. Follow the creator demonstration for the small tail tucks between rolls.');
roll('Repeat the aligned tail tuck and roll', -22.5,
  'Align the next protruding corner with the same tail edge and make the next edge roll.',
  'The dark line is a layer edge; the dashed line is the next fold. The paper is packed into the spine, with the loose triangle kept clear.');
roll('Make the final aligned tail tuck and roll', -18,
  'Repeat the tail alignment and fold the edge over once more before the final rolling sequence.',
  'Check both tail faces for protruding corners. The folded sheet should feel compact along its entire spine.');

for (const [index, degrees] of [-13.5, -9, -4.5, -2.25].entries()) {
  roll(`Final spine roll ${index + 1} of 4`, degrees,
    'Roll the packed edge inward one more turn, keeping the point straight and the broad loose triangle outside.',
    'The published method uses four final turns. A smooth pen or ruler can press the fold without tearing the paper.');
}

const measuredCamera = cameraFor(paper);
const wrapperVertices = paper.filter(piece => piece.layer === 'wrapper').flatMap(piece => piece.vertices);
const widestWrapper = wrapperVertices.reduce((best, p) => p[0] < best[0] ? p : best);
const measurementLine: Point[] = [widestWrapper, [0, widestWrapper[1]]];
const measuredFrame: FoldFrame = {
  ...frame(paper, measuredCamera, [{ vertices: measurementLine, kind: 'hidden' }]),
  labels: [{ x: 93, y: 221, text: 'Triangle: 85 mm' }],
};
const inspectAngle = -12 * Math.PI / 180;
const inspectionPoint = ([x, y]: Point): Point => [
  Math.cos(inspectAngle) * x - Math.sin(inspectAngle) * y,
  Math.sin(inspectAngle) * x + Math.cos(inspectAngle) * y,
];
const inspectionPaper: Paper = paper.map(piece => ({ ...piece, vertices: piece.vertices.map(inspectionPoint) }));
const inspectionCamera = cameraFor(inspectionPaper);
steps.push({
  title: 'Check the exposed triangle: 85 mm',
  instruction: 'Turn the paper for the ruler check and compare the remaining triangle with the creator’s 85 mm reference.',
  detail: 'Compare the ruler placement with the original demonstration. Keep the triangle available for wrapping. Return the point upward before the next step. These drawings enlarge thin layers and cannot represent paper thickness.',
  before: { ...measuredFrame, arrows: [{ path: 'M 207 57 Q 229 83 207 108', kind: 'turn' }] },
  after: {
    ...frame(inspectionPaper, inspectionCamera, [{ vertices: measurementLine.map(inspectionPoint), kind: 'hidden' }]),
    labels: [{ x: 93, y: 221, text: 'Keep this flap' }],
  },
});
steps.push({
  title: 'Return the nose to the top',
  instruction: 'Turn the checked packet back so its pointed end faces upward. Keep the loose triangle outside the spine.',
  detail: 'This changes the viewing orientation only. The measured tail, rolled layers and exposed triangle stay folded.',
  before: {
    ...frame(inspectionPaper, inspectionCamera),
    arrows: [{ path: 'M 207 108 Q 229 83 207 57', kind: 'turn' }],
    labels: [{ x: 120, y: 222, text: 'Turn back' }],
  },
  after: { ...frame(paper, measuredCamera), labels: [{ x: 120, y: 222, text: 'Nose upward' }] },
});

const bodyVertices = paper.filter(piece => piece.layer === 'body').flatMap(piece => piece.vertices);
const tailLeft = Math.min(...bodyVertices.filter(p => p[1] > 190).map(p => p[0]));
const centreEnd: Point = [tailLeft / 2, 195];
addFold('Close the body along its measured midpoint',
  'Find the midpoint of the packed body with a ruler and fold it lengthwise. Keep the loose triangle accessible.',
  'Do not use the original centre of the unrolled A4 sheet: this is the centre of the compact, rolled body.',
  NOSE, centreEnd, -1, 'all');

// A very narrow wing fold is shown on the accessible body face; repeat it on
// the opposite face as described. Its attached loose wrapper travels with that
// face, retaining the shared edge and remaining available for the nose lock.
const wingRootA: Point = NOSE;
const wingRootB: Point = [tailLeft * 0.75, 195];
addFold('Fold matching narrow wings',
  'Fold the first wing away from the keel, then repeat on the other face so both wing roots and tail edges match.',
  'The exposed triangle is a wrapper, not a third wing. A temporary clip may hold the packed body during the next operation; it must come off before flight.',
  wingRootA, wingRootB, 1, 'body');

// Repeated turns of the same loose triangle around the spine. Fixed portions
// and moving portions are clipped/reflected each time, retaining every layer.
let turns = 0;
while (turns < 12) {
  const vertices = paper.filter(piece => piece.layer === 'wrapper').flatMap(piece => piece.vertices);
  const minX = Math.min(...vertices.map(p => p[0])), maxX = Math.max(...vertices.map(p => p[0]));
  if (minX >= -7.01 && maxX <= 7.01) break;
  const rightSide = maxX > 7.01 && (maxX - 7 >= -7 - minX);
  const edgeX = rightSide ? 7 : -7;
  const movingSign = rightSide ? -1 : 1;
  turns += 1;
  addFold(turns === 1 ? 'Wrap the loose triangle over the spine' : `Continue the wrapper: turn ${turns}`,
    'Pass the free triangular paper around the next side of the spine and press it flat. Keep the narrow wings clear.',
    'Continue around the same spine, one fold at a time, until only a small terminal tab remains. The number of turns varies with paper thickness; the drawings show successive turns of the same flap.',
    [edgeX, 0], [edgeX, 205], movingSign, 'wrapper', [], [], turns >= 3);
}

// Fold a genuinely free part of the wrapper toward the stacked side pocket.
// Keep the entire attached seam on the fixed side of this final tab crease.
const seamXs = attachedSeam.flatMap(segment => segment.map(p => p[0]));
const freeWrapperXs = paper.filter(piece => piece.layer === 'wrapper').flatMap(piece => piece.vertices.map(p => p[0]));
const seamMin = Math.min(...seamXs), seamMax = Math.max(...seamXs);
const wrapperMin = Math.min(...freeWrapperXs), wrapperMax = Math.max(...freeWrapperXs);
const tabOnRight = wrapperMax - seamMax >= seamMin - wrapperMin;
const tabCreaseX = tabOnRight ? (seamMax + wrapperMax) / 2 : (seamMin + wrapperMin) / 2;
addFold('Fold the remaining tab toward the pocket',
  'Flatten the last loose flap across the body and fold its outer corner inward so it fits the side pocket.',
  'Use a smooth tool to separate the pocket layers gently. This is an opening between folds, not a slit or a cut.',
  [tabCreaseX, 0], [tabCreaseX, 195], tabOnRight ? -1 : 1, 'wrapper', [], [], true);

const pocketCamera = cameraFor(paper);
const pocketBefore = frame(paper, pocketCamera, [
  { vertices: [[-4, 174], [4, 174], [4, 195]], kind: 'hidden' },
]);
const tuckedIndex = paper.map(piece => piece.layer).lastIndexOf('wrapper');
const tuckedVertices = paper[tuckedIndex].vertices;
const tabPoint: Point = [
  tuckedVertices.reduce((sum, p) => sum + p[0], 0) / tuckedVertices.length,
  tuckedVertices.reduce((sum, p) => sum + p[1], 0) / tuckedVertices.length,
];
const pocketPoint: Point = [seamMin * 0.65, tabPoint[1] - 1.5];
const pocketSource = project(tabPoint, pocketCamera), pocketEnd = project(pocketPoint, pocketCamera);
const insetSource = project(tabPoint, detailCamera), insetEnd = project(pocketPoint, detailCamera);
const lockedPaper = paper.filter((_, i) => i !== tuckedIndex);
const lockedFrame = frame(lockedPaper, pocketCamera);
const insertionFrame = tailDetail({
  ...pocketBefore,
  arrows: [{ path: `M ${mm(pocketSource[0])} ${mm(pocketSource[1])} Q ${mm(pocketSource[0] + 15)} ${mm(pocketSource[1] - 15)} ${mm(pocketEnd[0])} ${mm(pocketEnd[1])}`, kind: 'fold' }],
  labels: [{ x: 120, y: 222, text: 'Tuck into pocket' }],
}, pocketCamera);
insertionFrame.arrows?.push({ path: `M ${mm(insetSource[0])} ${mm(insetSource[1])} Q ${mm(insetSource[0] + 15)} ${mm(insetSource[1] - 20)} ${mm(insetEnd[0])} ${mm(insetEnd[1])}`, kind: 'fold' });
steps.push({
  title: 'Tuck the tab into the side pocket',
  instruction: 'Fold the terminal tab once more and slide it between the side-pocket layers. Press the lock flat and remove any temporary clip.',
  detail: 'The tucked layer is shown with a hidden edge after insertion. Leave the flight model as one uncut, unballasted sheet; no clip remains attached.',
  before: insertionFrame,
  // The inserted tab is concealed by the pocket face, not removed from the
  // physical paper. Its location is drawn as a hidden edge.
  after: tailDetail({ ...lockedFrame, lines: [...(lockedFrame.lines ?? []), polyline([tabPoint, pocketPoint], 'hidden', pocketCamera)], labels: [{ x: 120, y: 222, text: 'Clip removed' }] }, pocketCamera),
});

const shape = (vertices: Point[], tone: 'paper' | 'underside' | 'accent' = 'paper') => ({ points: pointString(vertices), tone });
const frontClosed: FoldFrame = {
  view: 'front',
  shapes: [
    shape([[114, 117], [126, 117], [128, 168], [112, 168]], 'underside'),
    shape([[114, 117], [105, 70], [109, 70], [120, 119]]),
    shape([[120, 119], [131, 70], [135, 70], [126, 117]]),
  ],
  lines: [
    { points: '114,117 120,120 126,117', kind: 'crease' },
    { points: '116,124 118,161', kind: 'edge' },
    { points: '124,124 122,161', kind: 'edge' },
  ],
  arrows: [
    { path: 'M 107 82 Q 73 96 74 128', kind: 'open' },
    { path: 'M 133 82 Q 167 96 166 128', kind: 'open' },
  ],
  labels: [{ x: 120, y: 202, text: 'Look into nose' }],
};
const frontOpen: FoldFrame = {
  view: 'front',
  shapes: [
    shape([[114, 131], [120, 135], [126, 131], [127, 164], [120, 170], [113, 164]], 'underside'),
    shape([[71, 127], [114, 131], [120, 135], [75, 131]]),
    shape([[120, 135], [126, 131], [169, 127], [165, 131]]),
  ],
  lines: [
    { points: '76,130 115,133', kind: 'edge' },
    { points: '125,133 164,130', kind: 'edge' },
    { points: '118,142 122,142 123,160 117,160 118,142', kind: 'hidden' },
  ],
  labels: [{ x: 120, y: 91, text: 'Matched wings' }, { x: 120, y: 202, text: 'No clip aboard' }],
};
steps.push({
  title: 'Open the wings and check the locked spine',
  instruction: 'Look into the nose and open both narrow wings equally. Check the pocket lock, straight spine and matched tail.',
  detail: 'This front view is enlarged to make the small wings visible. Krstić’s distance demonstration launches inverted with a fingertip at the tail. Begin with gentle throws; the championship distance also depended on the pilot.',
  before: frontClosed,
  after: frontOpen,
});

export const KRSTIC_DART_GUIDE: FoldGuide = {
  id: 'krstic-dart',
  orientation: 'portrait',
  steps,
  tip: 'Krstić Championship Dart is a descriptive simulator name. This original schematic guide follows the published rolled-spine and pocket-lock method; use the linked creator demonstration for precise crease placement. The 61.11 m result was the 2022 Red Bull distance championship, and the model uses the same 80 g/m² A4 sheet as all other designs.',
};
