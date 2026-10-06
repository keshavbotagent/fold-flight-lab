import type { FoldGuide, FoldFrame, FoldLine, FoldArrow, FoldLabel } from './schema';

type Point = readonly [number, number];
const points = (vertices: readonly Point[]) => vertices
  .map(([x, y]) => `${Number(x.toFixed(2))},${Number(y.toFixed(2))}`).join(' ');
const polygon = (vertices: readonly Point[], tone: 'paper' | 'underside' | 'accent' = 'paper') => ({
  points: points(vertices), tone,
});
const line = (vertices: readonly Point[], kind: FoldLine['kind']): FoldLine => ({ points: points(vertices), kind });
const mirror = (vertices: readonly Point[]): Point[] => vertices.map(([x, y]) => [240 - x, y]);
const action = (frame: FoldFrame, additions: FoldLine[], arrows: FoldArrow[], labels: FoldLabel[] = []): FoldFrame => ({
  ...frame, lines: [...(frame.lines ?? []), ...additions], arrows, labels,
});

// Flat-paper positions are preserved between steps. Coordinates come from
// reflecting the moving regions in the actual crease, rather than shortening
// the sheet to make a dart-shaped illustration. Small edge insets below indicate
// stacked paper layers; they do not describe an extra cut or extra crease.
const nose: Point = [120, 18];
const bottomCenter: Point = [120, 222];
const sheet: Point[] = [[48, 18], [192, 18], [192, 222], [48, 222]];
const leftShoulder: Point = [48, 90];
const rightShoulder: Point = [192, 90];
const firstFlapTip: Point = [120, 90];
const tan22 = Math.tan(Math.PI / 8);
const dartShoulder: Point = [48, 18 + 72 / tan22];
const dartFlapTip: Point = [120, 18 + Math.hypot(72, 72)];
const oldCornerEdge: Point = [120 - 72 * tan22, 90];

function reflect(p: Point, a: Point, b: Point): Point {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  return [2 * (a[0] + t * dx) - p[0], 2 * (a[1] + t * dy) - p[1]];
}

const tan11 = Math.tan(Math.PI / 16);
const needleBottomCrease: Point = [120 - 204 * tan11, 222];
const needleFlapTip = reflect(dartShoulder, nose, needleBottomCrease);
const needleTail = reflect([48, 222], nose, needleBottomCrease);
const needleLayerY = (dartFlapTip[1] - 18 * tan11) / (1 - tan11);
const needleLayerEdge: Point = [120 - (needleLayerY - 18) * tan11, needleLayerY];

const plain: FoldFrame = { view: 'top', shapes: [polygon(sheet)] };
const centered: FoldFrame = {
  view: 'top', shapes: [polygon(sheet)],
  lines: [line([nose, bottomCenter], 'crease')],
  labels: [{ x: 157, y: 201, text: 'Center crease' }],
};
const corners: FoldFrame = {
  view: 'top',
  shapes: [
    polygon([nose, rightShoulder, [192, 222], [48, 222], leftShoulder]),
    polygon([nose, firstFlapTip, leftShoulder], 'underside'),
    polygon([nose, rightShoulder, firstFlapTip], 'underside'),
  ],
  lines: [
    line([firstFlapTip, bottomCenter], 'crease'),
    line([leftShoulder, firstFlapTip, rightShoulder], 'edge'),
    line([nose, firstFlapTip], 'edge'),
  ],
};
const dartFlat: FoldFrame = {
  view: 'top',
  shapes: [
    polygon([nose, ...mirror([dartShoulder]), [192, 222], [48, 222], dartShoulder]),
    polygon([nose, dartFlapTip, dartShoulder], 'underside'),
    polygon([nose, ...mirror([dartShoulder]), dartFlapTip], 'underside'),
  ],
  lines: [
    line([dartFlapTip, bottomCenter], 'crease'),
    line([dartShoulder, dartFlapTip, ...mirror([dartShoulder])], 'edge'),
    line([nose, dartFlapTip], 'edge'),
    line([oldCornerEdge, dartFlapTip], 'hidden'),
    line(mirror([oldCornerEdge, dartFlapTip]), 'hidden'),
  ],
};
const needleFlat: FoldFrame = {
  view: 'top',
  shapes: [
    polygon([nose, ...mirror([needleBottomCrease]), needleBottomCrease]),
    polygon([nose, needleFlapTip, needleTail, needleBottomCrease], 'underside'),
    polygon([nose, ...mirror([needleBottomCrease, needleTail]), needleFlapTip], 'underside'),
  ],
  lines: [
    line([needleFlapTip, bottomCenter], 'crease'),
    line([nose, needleFlapTip], 'edge'),
    line([needleBottomCrease, needleTail, needleFlapTip], 'edge'),
    line(mirror([needleBottomCrease, needleTail, needleFlapTip]), 'edge'),
    line([needleLayerEdge, needleFlapTip], 'hidden'),
    line(mirror([needleLayerEdge, needleFlapTip]), 'hidden'),
  ],
};

const dartHalf: FoldFrame = {
  view: 'top',
  shapes: [
    polygon([nose, dartShoulder, [48, 222], bottomCenter]),
    polygon([nose, dartFlapTip, dartShoulder], 'underside'),
  ],
  lines: [
    line([nose, bottomCenter], 'edge'),
    line([dartShoulder, dartFlapTip], 'edge'),
    line([oldCornerEdge, dartFlapTip], 'hidden'),
  ],
  labels: [{ x: 169, y: 119, text: 'Layers outside' }],
};
const needleHalf: FoldFrame = {
  view: 'top',
  shapes: [
    polygon([nose, needleBottomCrease, bottomCenter]),
    polygon([nose, needleFlapTip, needleTail, needleBottomCrease], 'underside'),
  ],
  lines: [
    line([nose, bottomCenter], 'edge'),
    line([needleBottomCrease, needleTail, needleFlapTip], 'edge'),
    line([needleLayerEdge, needleFlapTip], 'hidden'),
  ],
  labels: [{ x: 175, y: 129, text: 'Layers outside' }],
};

// 13 viewBox units are approximately 1.9 cm on the original A4 sheet.
const wingRootX = 107;
const dartWingStart: Point = [wingRootX, 18 + (120 - wingRootX) / tan22];
const dartWingEnd: Point = [wingRootX, 222];
const dartWing: Point[] = [dartWingStart, dartShoulder, [48, 222], dartWingEnd];
const dartWingFolded = dartWing.map(p => reflect(p, dartWingStart, dartWingEnd));
const needleWingStart: Point = [wingRootX, 18 + (120 - wingRootX) / tan11];
const needleWingEnd: Point = [wingRootX,
  needleBottomCrease[1] + (wingRootX - needleBottomCrease[0])
    * (needleTail[1] - needleBottomCrease[1]) / (needleTail[0] - needleBottomCrease[0]),
];
const needleWing: Point[] = [needleWingStart, needleBottomCrease, needleWingEnd];
const needleWingFolded = needleWing.map(p => reflect(p, needleWingStart, needleWingEnd));

function stackedEdge(vertices: Point[]): FoldLine {
  const center: Point = [
    vertices.reduce((v, p) => v + p[0], 0) / vertices.length,
    vertices.reduce((v, p) => v + p[1], 0) / vertices.length,
  ];
  const inset: Point[] = vertices.map(p => [
    center[0] + 0.96 * (p[0] - center[0]), center[1] + 0.96 * (p[1] - center[1]),
  ]);
  return line([...inset, inset[0]], 'edge');
}

const dartKeelFlapEdge: Point = [wingRootX, dartFlapTip[0] + dartFlapTip[1] - wingRootX];
const dartWingsClosed: FoldFrame = {
  view: 'top',
  shapes: [
    polygon([nose, dartWingStart, dartWingEnd, bottomCenter]),
    polygon([nose, dartFlapTip, dartKeelFlapEdge, dartWingStart], 'underside'),
    polygon(dartWingFolded),
  ],
  lines: [
    line([dartWingStart, dartWingEnd], 'crease'),
    stackedEdge(dartWingFolded),
    line([dartKeelFlapEdge, dartFlapTip], 'hidden'),
  ],
  labels: [{ x: 177, y: 98, text: 'Matched wings' }],
};
const needleWingsClosed: FoldFrame = {
  view: 'top',
  shapes: [
    polygon([nose, needleWingStart, [wingRootX, 222], bottomCenter]),
    polygon([nose, needleFlapTip, needleTail, needleWingEnd, needleWingStart], 'underside'),
    polygon(needleWingFolded),
  ],
  lines: [
    line([needleWingStart, needleWingEnd], 'crease'),
    stackedEdge(needleWingFolded),
    line([needleFlapTip, needleTail], 'edge'),
  ],
  labels: [{ x: 178, y: 99, text: 'Matched wings' }],
};

const dartFront: FoldFrame = {
  view: 'front',
  shapes: [
    polygon([[112, 127], [120, 131], [128, 127], [128, 167], [120, 174], [112, 167]], 'underside'),
    polygon([[40, 120], [112, 127], [120, 131], [48, 124]]),
    polygon([[120, 131], [128, 127], [200, 120], [192, 124]]),
  ],
  lines: [
    line([[46, 123], [114, 129]], 'edge'),
    line([[126, 129], [194, 123]], 'edge'),
    line([[120, 133], [120, 169]], 'edge'),
    line([[40, 134], [200, 134]], 'hidden'),
  ],
  labels: [{ x: 120, y: 96, text: 'Tips slightly up' }, { x: 120, y: 199, text: 'Keel below' }],
};
const needleFront: FoldFrame = {
  view: 'front',
  shapes: [
    polygon([[113, 128], [120, 131], [127, 128], [127, 171], [120, 179], [113, 171]], 'underside'),
    polygon([[59, 125], [113, 128], [120, 131], [65, 129]]),
    polygon([[120, 131], [127, 128], [181, 125], [175, 129]]),
  ],
  lines: [
    line([[65, 128], [115, 130]], 'edge'),
    line([[125, 130], [175, 128]], 'edge'),
    line([[120, 133], [120, 174]], 'edge'),
    line([[59, 135], [181, 135]], 'hidden'),
  ],
  labels: [{ x: 120, y: 98, text: 'Tips slightly up' }, { x: 120, y: 201, text: 'Deep center keel' }],
};

const centerStep = {
  title: 'Make the center crease',
  instruction: 'Fold the portrait A4 sheet lengthwise in half, crease firmly, then reopen it.',
  detail: 'Bring the two long edges together. The result is the full rectangle with one nose-to-tail reference crease.',
  before: action(plain, [line([nose, bottomCenter], 'fold')], [
    { path: 'M 177 112 C 151 74 89 74 63 112', kind: 'fold' },
  ]),
  after: centered,
};
const cornerStep = {
  title: 'Bring in the top corners',
  instruction: 'Fold both top corners inward until the two top edges meet the center crease.',
  detail: 'The original top corners land together on the centerline. Match the two triangular flaps before pressing them flat.',
  before: action(centered, [
    line([nose, leftShoulder], 'fold'), line([nose, rightShoulder], 'fold'),
  ], [
    { path: 'M 65 35 C 73 60 97 82 116 88', kind: 'fold' },
    { path: 'M 175 35 C 167 60 143 82 124 88', kind: 'fold' },
  ]),
  after: corners,
};
const leadingStep = {
  title: 'Narrow the pointed nose',
  instruction: 'Fold each sloping leading edge inward until it lies along the center crease.',
  detail: 'Keep the nose tip fixed. The two new creases bisect the angles beside the centerline, producing a long, symmetrical point.',
  before: action(corners, [
    line([nose, dartShoulder], 'fold'), line([nose, ...mirror([dartShoulder])], 'fold'),
  ], [
    { path: 'M 57 96 C 67 84 94 93 117 116', kind: 'fold' },
    { path: 'M 183 96 C 173 84 146 93 123 116', kind: 'fold' },
  ]),
  after: dartFlat,
};

export const DART_GUIDES: FoldGuide[] = [
  {
    id: 'classic-dart', orientation: 'portrait',
    tip: 'Use one uncut A4 sheet. Match the left and right folds carefully; the wings open above a center keel rather than flattening the keel.',
    steps: [
      centerStep,
      cornerStep,
      leadingStep,
      {
        title: 'Fold the body in half',
        instruction: 'Fold the right half behind the left along the center crease, keeping the nose layers outside.',
        detail: 'This is a mountain fold viewed from the folded side. The visible left-side nose folds stay on the outside; the right-side folds face outward on the back.',
        before: action(dartFlat, [line([nose, bottomCenter], 'mountain')], [
          { path: 'M 174 173 C 177 111 74 103 70 165', kind: 'fold' },
        ], [{ x: 177, y: 77, text: 'Fold behind' }]),
        after: dartHalf,
      },
      {
        title: 'Fold two matching wings',
        instruction: 'Fold the near wing down, leaving a keel about 2 cm deep. Turn over and fold the far wing to match.',
        detail: 'Keep the wing crease parallel to the center fold from its intersection with the leading edge to the tail. Turn back to the shown orientation; both wings are stacked. The small inner outline makes their layer edges visible.',
        before: action(dartHalf, [line([dartWingStart, dartWingEnd], 'fold')], [
          { path: 'M 54 207 C 69 160 136 156 161 198', kind: 'fold' },
          { path: 'M 179 113 C 207 125 207 157 179 170', kind: 'turn' },
        ], [{ x: 177, y: 95, text: 'Repeat far side' }]),
        after: dartWingsClosed,
      },
      {
        title: 'Open a gentle upward V',
        instruction: 'Open the wings apart. Viewed from the nose, leave both tips slightly above their roots.',
        detail: 'The before drawing is a top view of the stacked wings; the result is a front view. Let the center keel hang below. Paper thickness is exaggerated to make the layers visible.',
        before: action(dartWingsClosed, [], [
          { path: 'M 151 177 C 191 156 201 123 175 109', kind: 'open' },
          { path: 'M 150 193 C 112 210 79 187 88 157', kind: 'open' },
        ], [{ x: 177, y: 91, text: 'Open both wings' }]),
        after: dartFront,
      },
    ],
  },
  {
    id: 'needle', orientation: 'portrait',
    tip: 'Use one uncut A4 sheet. The extra nose fold makes a narrow dart; keep the layers aligned and leave only a shallow upward V when opening the wings.',
    steps: [
      centerStep,
      cornerStep,
      leadingStep,
      {
        title: 'Fold the leading edges again',
        instruction: 'Fold the outer sloping edges inward once more until they meet the centerline.',
        detail: 'Keep the nose tip fixed. Each crease reaches the bottom edge before reaching the original side edge. The folded lower corners extend slightly below the old sheet bottom; retain those points.',
        before: action(dartFlat, [
          line([nose, needleBottomCrease], 'fold'),
          line([nose, ...mirror([needleBottomCrease])], 'fold'),
        ], [
          { path: 'M 54 179 C 62 194 91 202 118 202', kind: 'fold' },
          { path: 'M 186 179 C 178 194 149 202 122 202', kind: 'fold' },
        ]),
        after: needleFlat,
      },
      {
        title: 'Keep the folded layers outside',
        instruction: 'Fold the right half behind the left along the center crease, leaving the layered nose on the outside.',
        detail: 'Use a mountain fold viewed from the folded side. Keep the long nose and the small tail points aligned without folding them off or removing paper.',
        before: action(needleFlat, [line([nose, bottomCenter], 'mountain')], [
          { path: 'M 148 183 C 174 129 87 101 94 167', kind: 'fold' },
        ], [{ x: 178, y: 96, text: 'Fold behind' }]),
        after: needleHalf,
      },
      {
        title: 'Crease the narrow wings',
        instruction: 'Fold the near wing down, leaving a center keel about 2 cm deep. Turn over and match the far wing.',
        detail: 'The narrow wing crease is parallel to the center fold and begins where it meets the leading edge. Keep the small folded tail points. Turn back after matching the second wing; the layer inset shows the stacked pair.',
        before: action(needleHalf, [line([needleWingStart, needleWingEnd], 'fold')], [
          { path: 'M 84 207 C 90 179 123 181 132 214', kind: 'fold' },
          { path: 'M 170 128 C 200 141 200 173 172 186', kind: 'turn' },
        ], [{ x: 177, y: 110, text: 'Repeat far side' }]),
        after: needleWingsClosed,
      },
      {
        title: 'Open the wings just above level',
        instruction: 'Spread the two narrow wings. From the front, lift both tips a little above the wing roots.',
        detail: 'The before drawing is a top view; the result is a front view with the center keel below. Use a smaller V than the Classic Dart. Keep the leading edges straight and start without an extra tail bend.',
        before: action(needleWingsClosed, [], [
          { path: 'M 128 203 C 165 182 181 149 159 135', kind: 'open' },
          { path: 'M 127 219 C 100 220 83 197 93 170', kind: 'open' },
        ], [{ x: 176, y: 111, text: 'Open both wings' }]),
        after: needleFront,
      },
    ],
  },
];
