import type { FoldFrame, FoldGuide, FoldLine, FoldShape } from './schema';

/**
 * ORIGINAL instructional geometry, not a reproduction of a published diagram.
 * Representative adaptation of the Toda-supervised Honda Sky King construction.
 * The zero-gap nose pocket is a schematic squash and inside reverse; its stack
 * is not certified to match the aircraft used for the 2009 record.
 * Primary photographed instructions:
 * https://www.honda.co.jp/kids/jiyuu-kenkyu/challenge/c-13/skyking/
 * Dimensions below come from our idealized A4 crease geometry, not record data.
 */
type Point = readonly [number, number];
type Layer = { polygon: Point[]; tone: NonNullable<FoldShape['tone']>; tag: string; half?: 'left' | 'right' };
const p = (...values: Point[]): Point[] => values;
const coordinates = (polygon: readonly Point[]): string => polygon.map(([x, y]) => `${Number(x.toFixed(3))},${Number(y.toFixed(3))}`).join(' ');
const line = (kind: FoldLine['kind'], ...polygon: Point[]): FoldLine => ({ points: coordinates(polygon), kind });
const polygonArea = (polygon: readonly Point[]): number => Math.abs(polygon.reduce((sum, a, i) => {
  const b = polygon[(i + 1) % polygon.length];
  return sum + a[0] * b[1] - a[1] * b[0];
}, 0)) / 2;
const cross = (a: Point, b: Point, point: Point): number => (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);

// Split flat paper along a hinge and reflect only the specified moving layers.
// No detached patch is added to the fold sequence. All original paper area is
// retained as overlapping layers, including the concealed nose pocket.
function clip(polygon: readonly Point[], a: Point, b: Point, positive: boolean): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const u = polygon[i], v = polygon[(i + 1) % polygon.length];
    const cu = cross(a, b, u), cv = cross(a, b, v);
    const insideU = positive ? cu >= -1e-8 : cu <= 1e-8;
    const insideV = positive ? cv >= -1e-8 : cv <= 1e-8;
    if (insideU) result.push(u);
    if (insideU !== insideV) {
      const t = cu / (cu - cv);
      result.push([u[0] + t * (v[0] - u[0]), u[1] + t * (v[1] - u[1])]);
    }
  }
  return result.filter((value, i) => i === 0 || Math.hypot(value[0] - result[i - 1][0], value[1] - result[i - 1][1]) > 1e-7);
}
function reflect(point: Point, a: Point, b: Point): Point {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy);
  return [2 * (a[0] + t * dx) - point[0], 2 * (a[1] + t * dy) - point[1]];
}
function folded(layers: readonly Layer[], a: Point, b: Point, movingPoint: Point, select: (layer: Layer) => boolean = () => true, movedTag?: string): Layer[] {
  const positive = cross(a, b, movingPoint) > 0;
  const fixed: Layer[] = [], moved: Layer[] = [];
  for (const layer of layers) {
    if (!select(layer)) { fixed.push(layer); continue; }
    const still = clip(layer.polygon, a, b, !positive);
    const moving = clip(layer.polygon, a, b, positive);
    if (still.length >= 3 && polygonArea(still) > 1e-7) fixed.push({ ...layer, polygon: still });
    if (moving.length >= 3 && polygonArea(moving) > 1e-7) moved.push({
      ...layer, polygon: moving.map(point => reflect(point, a, b)),
      tone: layer.tone === 'paper' ? 'underside' : 'paper', tag: movedTag ?? layer.tag,
    });
  }
  return [...fixed, ...moved.reverse()];
}
function reflected(layers: readonly Layer[], a: Point, b: Point): Layer[] {
  return layers.map(layer => ({ ...layer, polygon: layer.polygon.map(point => reflect(point, a, b)), tone: layer.tone === 'paper' ? 'underside' : 'paper' }));
}
function frame(layers: readonly Layer[], lines: FoldLine[] = [], extra: Partial<FoldFrame> = {}): FoldFrame {
  return { shapes: layers.map(layer => ({ points: coordinates(layer.polygon), tone: layer.tone })), lines, ...extra };
}

const X = 120, L = 48, R = 192, TOP = 18, TAIL = 222;
const FIRST_SHOULDER = 90, MID = 120, FRONT = 105, SHOULDER = 177;
const BISECTOR_X = L + 72 * Math.tan(Math.PI / 8);
const JUNCTION = SHOULDER - 72 * Math.tan(Math.PI / 8);
const TAB_TIP = 192, TAB_HINGE = (TAB_TIP + JUNCTION) / 2;
const TAB_RETURN = (JUNCTION + TAB_HINGE) / 2;
const TAB_FINAL = 2 * TAB_HINGE - TAB_RETURN;
const NOSE_HINGE = (FRONT + JUNCTION) / 2;
const D = NOSE_HINGE - FRONT;
const ROOT = X - D / 2;
const TIP_EDGE = 2 * ROOT - L;
const TIP_HINGE = TIP_EDGE - (X - ROOT);
const TIP_HINGE_FRONT = X + FRONT - 2 * ROOT + TIP_HINGE;
const noseBaseA: Point = [X - D, NOSE_HINGE];
const noseBaseB: Point = [X, NOSE_HINGE];
const diamondTop: Point = [ROOT, NOSE_HINGE - D / 2];
const diamondBottom: Point = [ROOT, NOSE_HINGE + D / 2];
const center = line('crease', [X, TOP], [X, TAIL]);

const sheet: Layer[] = [{ polygon: p([L, TOP], [R, TOP], [R, TAIL], [L, TAIL]), tone: 'paper', tag: 'sheet' }];
let firstCorners = folded(sheet, [X, TOP], [L, FIRST_SHOULDER], [L, TOP]);
firstCorners = folded(firstCorners, [X, TOP], [R, FIRST_SHOULDER], [R, TOP]);
const firstOutline = [center, line('crease', [L, FIRST_SHOULDER], [R, FIRST_SHOULDER])];
const noseDown = folded(firstCorners, [L, FRONT], [R, FRONT], [X, TOP], () => true, 'front');
let secondCorners = folded(noseDown, [X, FRONT], [L, SHOULDER], [L, FRONT]);
secondCorners = folded(secondCorners, [X, FRONT], [R, SHOULDER], [R, FRONT]);
const cornerCreases = [line('crease', [X, FRONT], [L, SHOULDER]), line('crease', [X, FRONT], [R, SHOULDER])];
let narrowCorners = folded(noseDown, [L, SHOULDER], [BISECTOR_X, FRONT], [L, FRONT]);
narrowCorners = folded(narrowCorners, [R, SHOULDER], [240 - BISECTOR_X, FRONT], [R, FRONT]);
let compoundCorners = folded(narrowCorners, [X, FRONT], [L, SHOULDER], [L, FRONT]);
compoundCorners = folded(compoundCorners, [X, FRONT], [R, SHOULDER], [R, FRONT]);
// Only the old central nose flap is pleated; the wing/body sheet beneath stays.
const taggedTip = compoundCorners.map(layer => ({ ...layer, tag: layer.polygon.some(([x, y]) => Math.abs(x - X) < 1e-6 && Math.abs(y - TAB_TIP) < 1e-6) ? 'nose-tip' : layer.tag }));
const tabUp = folded(taggedTip, [L, TAB_HINGE], [R, TAB_HINGE], [X, TAB_TIP], layer => layer.tag === 'nose-tip', 'tab-end');
const tabBack = folded(tabUp, [L, TAB_RETURN], [R, TAB_RETURN], [X, JUNCTION], layer => layer.tag === 'tab-end', 'tab-lip');
const tabDone = [
  ...tabBack.filter(layer => !['tab-end', 'tab-lip'].includes(layer.tag)),
  ...reflected(tabBack.filter(layer => ['tab-end', 'tab-lip'].includes(layer.tag)), [L, TAB_HINGE], [R, TAB_HINGE]).reverse(),
];
const closed = folded(tabDone.map(layer => ({ ...layer, half: 'left' as const })), [X, FRONT], [X, TAIL], [R, TAIL], () => true, 'right-half')
  .map(layer => ({ ...layer, half: layer.tag === 'right-half' ? 'right' as const : 'left' as const }));

// A local, continuous squash of the two closed nose halves. The shared old tip
// maps to noseBaseA on both halves, and their common edge maps to the same base
// segment. Every facet is an exact reflection, with conserved paper area.
const body: Layer[] = [], leftCap: Layer[] = [], rightCap: Layer[] = [];
for (const layer of closed) {
  const below = clip(layer.polygon, noseBaseA, noseBaseB, true);
  const above = clip(layer.polygon, noseBaseA, noseBaseB, false);
  if (below.length >= 3 && polygonArea(below) > 1e-7) body.push({ ...layer, polygon: below });
  if (above.length >= 3 && polygonArea(above) > 1e-7) (layer.half === 'right' ? rightCap : leftCap).push({ ...layer, polygon: above });
}
const upperCap = folded(leftCap, diamondTop, noseBaseB, [X, FRONT]).map(layer => ({ ...layer, tag: 'upper-cap' }));
const lowerCap = folded(reflected(rightCap, noseBaseA, noseBaseB), diamondBottom, noseBaseB, [X, JUNCTION]).map(layer => ({ ...layer, tag: 'lower-cap' }));
const squashed = [...body, ...lowerCap, ...upperCap];
const tuckedCap = [...lowerCap, ...reflected(upperCap, noseBaseA, noseBaseB)];
const tucked = [...tuckedCap, ...body]; // Nose layers are inside the body packet.
const pocketLines = [line('hidden', noseBaseA, diamondBottom, noseBaseB), line('crease', noseBaseA, noseBaseB)];
const firstWing = folded(tucked, [ROOT, NOSE_HINGE], [ROOT, TAIL], [L, TAIL], layer => layer.half === 'right', 'wing-right');
const bothWings = folded(firstWing, [ROOT, NOSE_HINGE], [ROOT, TAIL], [L, TAIL], layer => layer.half === 'left', 'wing-left');
let fins = folded(bothWings, [TIP_HINGE, NOSE_HINGE], [TIP_HINGE, TAIL], [TIP_EDGE, TAIL], layer => layer.tag === 'wing-right', 'fin-right');
fins = folded(fins, [TIP_HINGE, NOSE_HINGE], [TIP_HINGE, TAIL], [TIP_EDGE, TAIL], layer => layer.tag === 'wing-left', 'fin-left');

const frontClosed: FoldFrame = {
  view: 'front',
  shapes: [
    { points: '120,108 117,132 120,136 123,132', tone: 'accent' },
    { points: '117,132 117,205 120,205 120,136', tone: 'underside' },
    { points: '120,136 120,205 123,205 123,132', tone: 'paper' },
    { points: '117,188 112,188 112,205 117,205', tone: 'paper' },
    { points: '123,188 128,188 128,205 123,205', tone: 'underside' },
  ],
  lines: [line('mountain', [117,132], [120,136], [123,132]), line('crease', [112,188], [117,188]), line('crease', [123,188], [128,188])],
  arrows: [
    { path: 'M 113 176 C 88 194 56 180 49 148', kind: 'open' },
    { path: 'M 127 176 C 152 194 184 180 191 148', kind: 'open' },
  ],
  labels: [{ x: 120, y: 43, text: 'Front view' }, { x: 120, y: 76, text: 'Dorsal keel up' }],
};
const frontOpen: FoldFrame = {
  view: 'front',
  shapes: [
    { points: '120,134 48,140 55,144 120,138', tone: 'paper' },
    { points: '120,134 192,140 185,144 120,138', tone: 'paper' },
    { points: '48,140 48,163 55,163 55,144', tone: 'underside' },
    { points: '192,140 192,163 185,163 185,144', tone: 'underside' },
    { points: '120,108 117,133 120,138 123,133', tone: 'accent' },
  ],
  lines: [line('crease', [48,140], [55,144]), line('crease', [192,140], [185,144]), line('edge', [120,108], [120,135])],
  labels: [{ x: 120, y: 43, text: 'Adapted Sky King' }, { x: 120, y: 76, text: 'Dorsal keel up' }, { x: 54, y: 187, text: 'Tips down' }, { x: 120, y: 220, text: 'Slight down-slope' }],
};

export const SKY_KING_GUIDE: FoldGuide = {
  id: 'sky-king',
  orientation: 'portrait',
  steps: [
    {
      title: 'A4 and the long center crease',
      instruction: 'Fold lengthwise, then reopen.',
      detail: 'One A4 sheet: 210 × 297 mm. Original representative diagrams; tiny gaps and the nose pocket stack are idealized. No cuts or added pieces.',
      before: frame(sheet, [line('fold', [X, TOP], [X, TAIL])], { arrows: [{ path: 'M 68 115 C 88 65 144 65 169 113' }], labels: [{ x: 120, y: 18, text: 'A4 210 × 297 mm' }] }),
      after: frame(sheet, [center], { labels: [{ x: 120, y: 18, text: 'Center crease' }] }),
    },
    {
      title: 'Fold the first shoulder corners',
      instruction: 'Bring both top edges to the center.',
      detail: 'Make the two sides match; the source recommends a tiny center gap, omitted from this schematic.',
      before: frame(sheet, [center, line('fold', [X, TOP], [L, FIRST_SHOULDER]), line('fold', [X, TOP], [R, FIRST_SHOULDER])], { arrows: [{ path: 'M 55 29 C 65 61 92 79 116 86' }, { path: 'M 185 29 C 175 61 148 79 124 86' }] }),
      after: frame(firstCorners, firstOutline),
    },
    {
      title: 'Mark the nose-to-tail midpoint',
      instruction: 'Fold nose to tail; crease and reopen.',
      before: frame(firstCorners, [...firstOutline, line('fold', [L, MID], [R, MID])], { arrows: [{ path: 'M 126 27 C 170 91 165 171 126 214' }] }),
      after: frame(firstCorners, [...firstOutline, line('crease', [L, MID], [R, MID])], { labels: [{ x: 211, y: 124, text: 'Midline' }] }),
    },
    {
      title: 'Bring the shoulders to the midpoint',
      instruction: 'Fold the nose forward, matching both shoulders.',
      detail: 'The hinge lies halfway between the shoulder line and the transverse midpoint: approximately 126.75 mm from the original A4 top edge.',
      before: frame(firstCorners, [center, line('crease', [L, FIRST_SHOULDER], [R, FIRST_SHOULDER]), line('crease', [L, MID], [R, MID]), line('fold', [L, FRONT], [R, FRONT])], { arrows: [{ path: 'M 128 31 C 169 72 166 145 126 187' }] }),
      after: frame(noseDown, [line('crease', [X, FRONT], [X, TAIL]), line('crease', [L, MID], [R, MID])]),
    },
    {
      title: 'Precrease the second pair of corners',
      instruction: 'Bring the new top edges to center.',
      before: frame(noseDown, [line('crease', [X, FRONT], [X, TAIL]), line('fold', [X, FRONT], [L, SHOULDER]), line('fold', [X, FRONT], [R, SHOULDER])], { arrows: [{ path: 'M 55 111 C 66 145 91 163 115 171' }, { path: 'M 185 111 C 174 145 149 163 125 171' }] }),
      after: frame(secondCorners, [line('crease', [X, FRONT], [X, TAIL])]),
    },
    {
      title: 'Reopen those two corners',
      instruction: 'Undo only the two most recent folds.',
      before: frame(secondCorners, [line('crease', [X, FRONT], [X, TAIL])], { arrows: [{ path: 'M 114 163 C 99 148 74 121 54 111', kind: 'open' }, { path: 'M 126 163 C 141 148 166 121 186 111', kind: 'open' }] }),
      after: frame(noseDown, [line('crease', [X, FRONT], [X, TAIL]), ...cornerCreases]),
    },
    {
      title: 'Fold the outer edges to their creases',
      instruction: 'Align each side edge with its diagonal precrease.',
      detail: 'Align the short outer vertical edges, not the horizontal top edges. Each new hinge starts at its outer shoulder.',
      before: frame(noseDown, [...cornerCreases, line('fold', [L, SHOULDER], [BISECTOR_X, FRONT]), line('fold', [R, SHOULDER], [240 - BISECTOR_X, FRONT])], { arrows: [{ path: 'M 53 112 C 64 114 90 117 97 128' }, { path: 'M 187 112 C 176 114 150 117 143 128' }], labels: [{ x: 120, y: 67, text: 'Side to precrease' }] }),
      after: frame(narrowCorners, cornerCreases),
    },
    {
      title: 'Refold along the original diagonals',
      instruction: 'Fold both narrowed corners along their old creases.',
      before: frame(narrowCorners, [line('fold', [X, FRONT], [L, SHOULDER]), line('fold', [X, FRONT], [R, SHOULDER])], { arrows: [{ path: 'M 83 112 C 93 126 106 139 116 145' }, { path: 'M 157 112 C 147 126 134 139 124 145' }] }),
      after: frame(compoundCorners, [line('crease', [X, FRONT], [X, TAIL])], { labels: [{ x: 120, y: 79, text: 'Layered nose' }] }),
    },
    {
      title: 'Lift the exposed lower nose tab',
      instruction: 'Bring its point up to the V junction.',
      detail: 'Fold only the exposed central tab. The large wing/body sheet underneath stays in place.',
      before: frame(taggedTip, [line('fold', [X - (TAB_TIP - TAB_HINGE), TAB_HINGE], [X + (TAB_TIP - TAB_HINGE), TAB_HINGE])], { arrows: [{ path: `M 126 ${TAB_TIP - 2} C 151 180 145 154 126 ${JUNCTION + 2}` }] }),
      after: frame(tabUp, [line('crease', [X - (TAB_TIP - TAB_HINGE), TAB_HINGE], [X + (TAB_TIP - TAB_HINGE), TAB_HINGE])]),
    },
    {
      title: 'Fold the small tip back',
      instruction: 'Bring the lifted point back to its lower hinge.',
      before: frame(tabUp, [line('fold', [X - (TAB_RETURN - JUNCTION), TAB_RETURN], [X + (TAB_RETURN - JUNCTION), TAB_RETURN])], { arrows: [{ path: `M 126 ${JUNCTION + 2} C 143 151 142 165 126 ${TAB_HINGE - 1}` }] }),
      after: frame(tabBack, [line('crease', [X - (TAB_RETURN - JUNCTION), TAB_RETURN], [X + (TAB_RETURN - JUNCTION), TAB_RETURN])]),
    },
    {
      title: 'Reopen the outer tab fold',
      instruction: 'Undo the first tab fold; retain the tiny pleat.',
      detail: 'The small end fold stays tucked. The formerly pointed lower flap now ends in a short flat edge.',
      before: frame(tabBack, [line('fold', [X - (TAB_TIP - TAB_HINGE), TAB_HINGE], [X + (TAB_TIP - TAB_HINGE), TAB_HINGE])], { arrows: [{ path: `M 128 ${TAB_RETURN + 3} C 150 171 145 178 129 ${TAB_FINAL - 1}`, kind: 'open' }] }),
      after: frame(tabDone, [line('crease', [X - (TAB_TIP - TAB_FINAL), TAB_FINAL], [X + (TAB_TIP - TAB_FINAL), TAB_FINAL])]),
    },
    {
      title: 'Precrease the small upper point',
      instruction: 'Fold the upper point to the V junction; reopen.',
      before: frame(tabDone, [line('fold', noseBaseA, [X + D, NOSE_HINGE])], { arrows: [{ path: `M 124 ${FRONT + 2} C 145 115 141 139 124 ${JUNCTION - 1}` }] }),
      after: frame(tabDone, [line('crease', noseBaseA, [X + D, NOSE_HINGE])], { labels: [{ x: 120, y: 79, text: 'Pocket precrease' }] }),
    },
    {
      title: 'Turn over and close the body',
      instruction: 'Turn over; close lengthwise with nose layers outside.',
      detail: 'The diagrams keep the nose pointing up. Two paper halves now overlap; the next views show the closed packet from its side.',
      before: frame(tabDone, [line('mountain', [X, FRONT], [X, TAIL]), line('crease', noseBaseA, [X + D, NOSE_HINGE])], { arrows: [{ path: 'M 181 194 C 159 217 104 217 65 195', kind: 'turn' }] }),
      after: frame(closed, [line('crease', noseBaseA, noseBaseB), line('edge', [X, FRONT], [X, TAIL])], { view: 'side', labels: [{ x: 174, y: 176, text: 'Closed packet' }] }),
    },
    {
      title: 'Open and squash the nose pocket',
      instruction: 'Open the upper pocket; flatten an attached diamond.',
      detail: 'This is a local schematic of the multilayer squash. Both halves share the same base hinge; nothing is cut or added. See source step 11 for the exact pocket handling.',
      before: frame(closed, [line('fold', noseBaseA, noseBaseB), line('mountain', diamondTop, noseBaseB)], { view: 'side', arrows: [{ path: `M 123 ${FRONT + 5} C 145 111 149 127 128 ${NOSE_HINGE + 6}`, kind: 'open' }], labels: [{ x: 166, y: 91, text: 'Adapted nose' }] }),
      after: frame(squashed, [line('crease', noseBaseA, noseBaseB), line('edge', diamondTop, noseBaseB, diamondBottom, noseBaseA, diamondTop)], { view: 'side', labels: [{ x: 174, y: 113, text: 'Attached diamond' }] }),
    },
    {
      title: 'Reverse the diamond into the packet',
      instruction: 'Turn the upper facet inside; close the nose.',
      detail: 'The visible cap folds about its attached base. Original diagrams simplify the source’s extra layer turns; this is an adapted nose, not a certified record-aircraft recipe.',
      before: frame(squashed, [line('mountain', noseBaseA, noseBaseB)], { view: 'side', arrows: [{ path: `M 112 ${diamondTop[1] - 1} C 139 112 142 133 116 ${diamondBottom[1] - 1}` }], labels: [{ x: 179, y: 91, text: 'Tuck inside' }] }),
      after: frame(tucked, pocketLines, { view: 'side', labels: [{ x: 178, y: 127, text: 'Snub nose' }] }),
    },
    {
      title: 'Fold the first main wing',
      instruction: 'Fold one wing from the diamond’s lower vertex aft.',
      detail: 'The root hinge parallels the long body seam. Its zero-gap A4 margin is about 15.4 mm; follow the vertex reference rather than an invented official measurement.',
      before: frame(tucked, [...pocketLines, line('fold', [ROOT, NOSE_HINGE], [ROOT, TAIL])], { view: 'side', arrows: [{ path: 'M 61 197 C 89 158 141 164 161 194' }], labels: [{ x: 179, y: 101, text: 'One wing only' }] }),
      after: frame(firstWing, [line('crease', [ROOT, NOSE_HINGE], [ROOT, TAIL]), line('edge', [X, NOSE_HINGE], [X, TAIL])], { view: 'side' }),
    },
    {
      title: 'Match the other main wing',
      instruction: 'Turn over; fold the remaining wing to match.',
      detail: 'Both wing roots use the same straight hinge. The folded wings now overlap; the narrow body strip will become the dorsal keel.',
      before: frame(firstWing, [line('fold', [ROOT, NOSE_HINGE], [ROOT, TAIL])], { view: 'side', arrows: [{ path: 'M 62 206 C 91 167 138 165 163 204' }], labels: [{ x: 178, y: 94, text: 'Other face' }] }),
      after: frame(bothWings, [line('crease', [ROOT, NOSE_HINGE], [ROOT, TAIL])], { view: 'side', labels: [{ x: 80, y: 195, text: 'Keel margin' }] }),
    },
    {
      title: 'Crease the two wingtip strips',
      instruction: 'Fold each tip strip to equal the keel margin.',
      detail: 'Work one wing at a time. The strips remain attached along straight hinges; open them downward in the final step.',
      before: frame(bothWings, [line('crease', [ROOT, NOSE_HINGE], [ROOT, TAIL]), line('fold', [TIP_HINGE, TIP_HINGE_FRONT], [TIP_HINGE, TAIL])], { view: 'side', arrows: [{ path: 'M 169 186 C 182 172 184 161 157 177' }, { path: 'M 169 207 C 183 217 172 225 153 211' }], labels: [{ x: 120, y: 98, text: 'Equal-width strips' }] }),
      after: frame(fins, [line('crease', [ROOT, NOSE_HINGE], [ROOT, TAIL]), line('crease', [TIP_HINGE, TIP_HINGE_FRONT], [TIP_HINGE, TAIL])], { view: 'side' }),
    },
    {
      title: 'Open, compare, and trim',
      instruction: 'Open wings; lower fins; gently raise both rear edges.',
      detail: 'View changes to the front cross-section. Keep the dorsal keel above the wings. The depicted slight downward wing slope and near-vertical fins are representative angles. Rear-edge trim is a tiny bend, not a new large flap.',
      before: frontClosed,
      after: frontOpen,
    },
  ],
  tip: 'Sky King: former 27.9 s duration champion, April 2009. This is an original representative adaptation, not the exact record specimen. Follow the Toda-supervised Honda photographed guide for precise nose layers: https://www.honda.co.jp/kids/jiyuu-kenkyu/challenge/c-13/skyking/ . Estimated simulator coefficients do not reproduce a record throw.',
};
