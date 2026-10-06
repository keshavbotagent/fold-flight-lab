import type { FoldArrow, FoldFrame, FoldGuide, FoldLabel, FoldLine, FoldShape } from './schema';

type Point = readonly [number, number];
const points = (vertices: readonly Point[]) => vertices.map(([x, y]) => `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`).join(' ');
const polygon = (vertices: readonly Point[], tone: FoldShape['tone'] = 'paper'): FoldShape => ({ points: points(vertices), tone });
const line = (vertices: readonly Point[], kind: FoldLine['kind']): FoldLine => ({ points: points(vertices), kind });
const frame = (shapes: FoldShape[], lines: FoldLine[] = [], view: FoldFrame['view'] = 'top'): FoldFrame => ({ shapes, lines, view });
function action(base: FoldFrame, lines: FoldLine[], arrows: FoldArrow[], labels: FoldLabel[] = []): FoldFrame {
  return { ...base, shapes: base.shapes.map(shape => ({ ...shape })), lines: [...(base.lines ?? []), ...lines], arrows, labels };
}
function reflected(point: Point, a: Point, b: Point): Point {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const projection = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy);
  return [2 * (a[0] + projection * dx) - point[0], 2 * (a[1] + projection * dy) - point[1]];
}

const sheet = frame([polygon([[48, 18], [192, 18], [192, 222], [48, 222]])]);
const centerCreased = frame(sheet.shapes, [line([[120, 18], [120, 222]], 'crease')]);
const firstNose = frame([
  polygon([[120, 18], [192, 90], [192, 222], [48, 222], [48, 90]]),
  polygon([[120, 18], [48, 90], [120, 90]], 'underside'),
  polygon([[120, 18], [120, 90], [192, 90]], 'underside'),
], [
  line([[120, 18], [120, 222]], 'crease'),
  line([[48, 90], [120, 90], [192, 90]], 'edge'),
]);
const centerStep = {
  title: 'Crease the center and reopen',
  instruction: 'Start with portrait A4 paper. Fold the left half onto the right, crease, then open it flat.',
  detail: 'The long center crease will guide every matching fold. Keep the nose end at the top.',
  before: action(sheet, [line([[120, 18], [120, 222]], 'fold')], [
    { path: 'M48 92 C64 44 176 44 192 92', kind: 'fold' },
    { path: 'M192 160 C176 206 64 206 48 160', kind: 'open' },
  ]),
  after: centerCreased,
};
const firstCornersStep = {
  title: 'Bring the top corners to center',
  instruction: 'Fold both top corners inward so their original top edges meet the center crease.',
  detail: 'Match the two triangular flaps and keep their pointed nose at the top.',
  before: action(centerCreased, [
    line([[120, 18], [48, 90]], 'fold'),
    line([[120, 18], [192, 90]], 'fold'),
  ], [
    { path: 'M48 18 C28 50 68 112 120 90', kind: 'fold' },
    { path: 'M192 18 C212 50 172 112 120 90', kind: 'fold' },
  ]),
  after: firstNose,
};

// Nakamura: the second corner folds meet above the original downward tip.
// The corner destinations (120,142) reflect across the indicated creases.
const nLeftTop: Point = [102.7777778, 90];
const nRightTop: Point = [137.2222222, 90];
const nLeftSide: Point = [48, 165.8461538];
const nRightSide: Point = [192, 165.8461538];
const nCornerDestination: Point = [120, 142];
const nBody = polygon([nLeftTop, nRightTop, nRightSide, [192, 222], [48, 222], nLeftSide]);
const noseDown = frame([
  polygon([[48, 90], [192, 90], [192, 222], [48, 222]]),
  polygon([[48, 90], [192, 90], [120, 162]], 'underside'),
], [
  line([[48, 90], [192, 90]], 'crease'),
  line([[120, 90], [120, 222]], 'crease'),
  line([[120, 90], [120, 162]], 'hidden'),
]);
const nInnerNose = [nLeftTop, nRightTop, [160.1935484, 121.8064516], [120, 162], [79.8064516, 121.8064516]] as Point[];
const nLeftFlap = polygon([nLeftTop, nLeftSide, nCornerDestination], 'underside');
const nRightFlap = polygon([nRightTop, nCornerDestination, nRightSide], 'underside');
const exposedTab = frame([
  nBody,
  polygon(nInnerNose, 'underside'),
  nLeftFlap, nRightFlap,
  polygon([[108, 150], [132, 150], [120, 162]], 'accent'),
], [
  line([[120, 90], [120, 222]], 'crease'),
  line([nLeftSide, nCornerDestination, nRightSide], 'edge'),
  line([[108, 150], [132, 150]], 'crease'),
]);
const lockedTab = frame([
  nBody,
  polygon([nLeftTop, nRightTop, [160.1935484, 121.8064516], [132, 150], [108, 150], [79.8064516, 121.8064516]], 'underside'),
  nLeftFlap, nRightFlap,
  polygon([[108, 150], [132, 150], [120, 138]], 'accent'),
], [
  line([[120, 90], [120, 222]], 'crease'),
  line([nLeftSide, nCornerDestination, nRightSide], 'edge'),
  line([[108, 150], [132, 150]], 'edge'),
]);
const nClosedBody = polygon([[120, 90], nRightTop, nRightSide, [192, 222], [120, 222]]);
const nClosed = frame([
  nClosedBody,
  polygon([[120, 90], nRightTop, [160.1935484, 121.8064516], [132, 150], [120, 150]], 'underside'),
  nRightFlap,
  polygon([[120, 138], [132, 150], [120, 150]], 'accent'),
], [
  line([[120, 90], [120, 222]], 'edge'),
  line([nCornerDestination, nRightSide], 'edge'),
  line([[122, 152], [122, 220], [190, 220]], 'hidden'),
]);
const nWingHinge: Point[] = [[130, 90], [130, 222]];
const nOriginalWing: Point[] = [[130, 90], nRightTop, nRightSide, [192, 222], [130, 222]];
const nFoldedWing = nOriginalWing.map(point => reflected(point, nWingHinge[0], nWingHinge[1]));
const nFirstWing = frame([
  nClosedBody,
  polygon(nFoldedWing, 'underside'),
], [
  line(nWingHinge, 'crease'),
  line([[120, 90], [120, 222]], 'hidden'),
  line([[70, 220], [128, 220]], 'edge'),
], 'side');
const nBothWings = frame([
  polygon([[120, 90], [130, 90], [130, 222], [120, 222]]),
  polygon(nFoldedWing, 'underside'),
], [
  line(nWingHinge, 'crease'),
  line([[120, 90], [120, 222]], 'hidden'),
  line([[70, 220], [128, 220]], 'edge'),
  line([[71, 218], [126, 218]], 'hidden'),
], 'side');

// Delta leading folds leave a central gap. The crease bisects the angle
// between the original edge and its destination, preserving flap lengths.
const deltaSource: Point = [48, 90];
const deltaDestination: Point = [110, 18 + Math.sqrt(72 * 72 * 2 - 10 * 10)];
const deltaSlope = (72 + deltaDestination[1] - 18) / 82;
const deltaSideY = 18 + 72 * deltaSlope;
const dLeftSide: Point = [48, deltaSideY];
const dRightSide: Point = [192, deltaSideY];
const dLeftInner: Point = [120 - 72 / deltaSlope, 90];
const dRightInner: Point = [120 + 72 / deltaSlope, 90];
const dRightDestination: Point = [130, deltaDestination[1]];
const dLeftFold = polygon([[120, 18], dLeftSide, deltaDestination], 'underside');
const dRightFold = polygon([[120, 18], dRightDestination, dRightSide], 'underside');
const deltaLeftDone = frame([
  polygon([[120, 18], [192, 90], [192, 222], [48, 222], dLeftSide]),
  polygon([[120, 18], dLeftInner, [120, 90]], 'underside'),
  polygon([[120, 18], [120, 90], [192, 90]], 'underside'),
  dLeftFold,
], [
  line([[120, 18], [120, 222]], 'crease'),
  line([[120, 18], deltaDestination], 'edge'),
  line([[120, 90], [192, 90]], 'edge'),
]);
const deltaBothDone = frame([
  polygon([[120, 18], dRightSide, [192, 222], [48, 222], dLeftSide]),
  polygon([[120, 18], dLeftInner, [120, 90]], 'underside'),
  polygon([[120, 18], [120, 90], dRightInner], 'underside'),
  dLeftFold, dRightFold,
], [
  line([[120, 18], [120, 222]], 'crease'),
  line([[120, 18], deltaDestination], 'edge'),
  line([[120, 18], dRightDestination], 'edge'),
]);
const dTipLeft: Point = [120 - 12 / deltaSlope, 30];
const dTipRight: Point = [120 + 12 / deltaSlope, 30];
const dInnerLeftAtTip: Point = [120 - 120 / (deltaDestination[1] - 18), 30];
const dInnerRightAtTip: Point = [240 - dInnerLeftAtTip[0], 30];
const deltaTipDone = frame([
  polygon([dTipLeft, dTipRight, dRightSide, [192, 222], [48, 222], dLeftSide]),
  polygon([dTipLeft, [120, 30], [120, 90], dLeftInner], 'underside'),
  polygon([[120, 30], dTipRight, dRightInner, [120, 90]], 'underside'),
  polygon([dTipLeft, dInnerLeftAtTip, deltaDestination, dLeftSide], 'underside'),
  polygon([dInnerRightAtTip, dTipRight, dRightSide, dRightDestination], 'underside'),
  polygon([dTipLeft, dTipRight, [120, 42]], 'accent'),
], [
  line([[120, 30], [120, 222]], 'crease'),
  line([dInnerLeftAtTip, deltaDestination], 'edge'),
  line([dInnerRightAtTip, dRightDestination], 'edge'),
  line([dTipLeft, dTipRight], 'edge'),
]);
const dClosedBody = polygon([[120, 30], dTipRight, dRightSide, [192, 222], [120, 222]]);
const dClosed = frame([
  dClosedBody,
  polygon([[120, 30], dTipRight, dRightInner, [120, 90]], 'underside'),
  polygon([dInnerRightAtTip, dTipRight, dRightSide, dRightDestination], 'underside'),
  polygon([[120, 30], dTipRight, [120, 42]], 'accent'),
], [
  line([[120, 30], [120, 222]], 'edge'),
  line([dInnerRightAtTip, dRightDestination], 'edge'),
  line([[122, 44], [122, 220], [190, 220]], 'hidden'),
]);
const dWingHinge: Point[] = [[122, 30], [132, 222]];
const dOriginalWing: Point[] = [dWingHinge[0], dTipRight, dRightSide, [192, 222], dWingHinge[1]];
const dFoldedWing = dOriginalWing.map(point => reflected(point, dWingHinge[0], dWingHinge[1]));
const dFirstWing = frame([dClosedBody, polygon(dFoldedWing, 'underside')], [
  line(dWingHinge, 'crease'),
  line([[120, 30], [120, 222]], 'hidden'),
  line([[74, 225], [130, 220]], 'edge'),
], 'side');
const dBothWings = frame([
  polygon([[120, 30], dWingHinge[0], dWingHinge[1], [120, 222]]),
  polygon(dFoldedWing, 'underside'),
], [
  line(dWingHinge, 'crease'),
  line([[120, 30], [120, 222]], 'hidden'),
  line([[74, 225], [130, 220]], 'edge'),
  line([[76, 223], [128, 218]], 'hidden'),
], 'side');

function wingOpening(tipY: number, keelBottom: number): { before: FoldFrame; after: FoldFrame } {
  const foldedTipY = 114 + Math.hypot(80, 114 - tipY);
  const keel = polygon([[115, 114], [125, 114], [125, keelBottom - 9], [120, keelBottom], [115, keelBottom - 9]]);
  const before = frame([
    keel,
    polygon([[113, 114], [117, 114], [117, foldedTipY], [113, foldedTipY]], 'underside'),
    polygon([[123, 114], [127, 114], [127, foldedTipY], [123, foldedTipY]]),
  ], [
    line([[115, 114], [115, foldedTipY]], 'edge'),
    line([[125, 114], [125, foldedTipY]], 'edge'),
  ], 'front');
  before.arrows = [
    { path: `M115 ${foldedTipY} C70 213 20 178 35 ${tipY}`, kind: 'open' },
    { path: `M125 ${foldedTipY} C170 213 220 178 205 ${tipY}`, kind: 'open' },
  ];
  before.labels = [{ x: 120, y: 216, text: 'Open' }];
  const after = frame([
    keel,
    polygon([[115, 114], [35, tipY], [35, tipY + 4], [115, 118]], 'underside'),
    polygon([[125, 114], [205, tipY], [205, tipY + 4], [125, 118]]),
  ], [
    line([[120, 114], [120, keelBottom]], 'crease'),
    line([[35, tipY + 2], [115, 116]], 'edge'),
    line([[125, 116], [205, tipY + 2]], 'edge'),
  ], 'front');
  after.labels = [{ x: 120, y: 178, text: 'Slight V' }];
  return { before, after };
}
const nOpening = wingOpening(100, 145);
const dOpening = wingOpening(108, 140);
const dWingSource: Point = dRightSide;
const dWingDestination = reflected(dWingSource, dWingHinge[0], dWingHinge[1]);
const dSecondSource: Point = [192, 206];
const dSecondDestination = reflected(dSecondSource, dWingHinge[0], dWingHinge[1]);

export const LOCKED_DELTA_GUIDES: FoldGuide[] = [
  {
    id: 'nakamura-lock',
    orientation: 'portrait',
    tip: 'Keep the small locking tab on the outside when closing the body. Match both wings and make tiny equal trim adjustments.',
    steps: [
      { ...centerStep },
      { ...firstCornersStep },
      {
        title: 'Fold the whole nose down',
        instruction: 'Fold the entire triangular nose downward across its horizontal base.',
        detail: 'The upper edge becomes flat, like an envelope. The old nose point now faces down toward the tail.',
        before: action(firstNose, [line([[48, 90], [192, 90]], 'fold')], [
          { path: 'M120 18 C164 44 164 136 120 162', kind: 'fold' },
        ]),
        after: noseDown,
      },
      {
        title: 'Fold new corners; leave the tab',
        instruction: 'Fold the new top corners inward until they meet above the downward-pointing nose tip.',
        detail: 'Leave the small triangular tip exposed below the two corner flaps. Do not cover or tuck it inside.',
        before: action(noseDown, [line([nLeftTop, nLeftSide], 'fold'), line([nRightTop, nRightSide], 'fold')], [
          { path: 'M48 90 C42 136 88 161 120 142', kind: 'fold' },
          { path: 'M192 90 C198 136 152 161 120 142', kind: 'fold' },
        ]),
        after: exposedTab,
      },
      {
        title: 'Lift the tab to lock both folds',
        instruction: 'Fold the exposed triangular tip upward over the meeting edges of the two corner flaps.',
        detail: 'The small tab crosses both flaps. Press it flat so it holds the nose folds together.',
        before: action(exposedTab, [line([[108, 150], [132, 150]], 'fold')], [
          { path: 'M120 162 C147 167 147 133 120 138', kind: 'fold' },
        ]),
        after: lockedTab,
      },
      {
        title: 'Close with the locked folds outside',
        instruction: 'Fold the body in half along the long center crease, away from the layered face.',
        detail: 'Bring the plain backs together. The locking tab and layered nose stay outside the closed body.',
        before: action(lockedTab, [line([[120, 90], [120, 222]], 'mountain')], [
          { path: 'M72 184 C88 232 152 232 168 184', kind: 'fold' },
        ]),
        after: nClosed,
      },
      {
        title: 'Fold the first broad wing down',
        instruction: 'Fold the first wing down along a line parallel to the body center fold.',
        detail: 'Leave a keel about 1.5 cm deep. The unfolded wing on the other side is still behind it.',
        before: action({ ...nClosed, view: 'side' }, [line(nWingHinge, 'fold')], [
          { path: 'M192 184 C168 228 92 228 68 184', kind: 'fold' },
        ]),
        after: nFirstWing,
      },
      {
        title: 'Match the second wing',
        instruction: 'Turn the body over and fold the other wing down to match the first.',
        detail: 'Use the same crease position and keel depth. Align the tips and trailing edges before pressing flat.',
        before: action(nFirstWing, [line(nWingHinge, 'mountain')], [
          { path: 'M192 200 C170 234 88 234 68 200', kind: 'fold' },
          { path: 'M204 139 C225 126 225 163 204 152', kind: 'turn' },
        ]),
        after: nBothWings,
      },
      {
        title: 'Open into a gentle upward V',
        instruction: 'Look at the nose and spread one wing to each side. Raise both wing tips slightly.',
        detail: 'This front view shows the keel hanging below the wings. Keep the two sides at matching angles.',
        ...nOpening,
      },
    ],
  },
  {
    id: 'delta-wing',
    orientation: 'portrait',
    tip: 'Keep equal gaps beside the center on the second leading folds. Match the diagonal wing creases and remove any twist.',
    steps: [
      { ...centerStep },
      { ...firstCornersStep },
      {
        title: 'Fold the left edge short of center',
        instruction: 'Fold the left sloping leading edge inward, leaving a narrow gap beside the center crease.',
        detail: 'Bring the edge near the center rather than onto it. This keeps the folded nose broader than a narrow dart.',
        before: action(firstNose, [line([[120, 18], dLeftSide], 'fold')], [
          { path: `M${deltaSource[0]} ${deltaSource[1]} C52 135 94 146 ${deltaDestination[0]} ${deltaDestination[1]}`, kind: 'fold' },
        ]),
        after: deltaLeftDone,
      },
      {
        title: 'Match the right leading fold',
        instruction: 'Fold the right sloping edge inward, leaving the same gap on the other side of center.',
        detail: 'The two new inner edges sit beside the center crease. Keep the left and right folded panels symmetrical.',
        before: action(deltaLeftDone, [line([[120, 18], dRightSide], 'fold')], [
          { path: `M192 90 C188 135 146 146 ${dRightDestination[0]} ${dRightDestination[1]}`, kind: 'fold' },
        ]),
        after: deltaBothDone,
      },
      {
        title: 'Fold back only the small point',
        instruction: 'Fold a small part of the pointed nose back over the short horizontal crease.',
        detail: 'Make a small reinforcing triangle. Leave the larger leading-edge folds and their central gaps intact.',
        before: action(deltaBothDone, [line([dTipLeft, dTipRight], 'fold')], [
          { path: 'M120 18 C143 18 143 46 120 42', kind: 'fold' },
        ]),
        after: deltaTipDone,
      },
      {
        title: 'Close with nose layers outside',
        instruction: 'Fold the body in half along the center crease, away from the layered nose face.',
        detail: 'Bring the plain backs together. Keep the small reinforcing triangle and leading folds on the outside.',
        before: action(deltaTipDone, [line([[120, 30], [120, 222]], 'mountain')], [
          { path: 'M72 188 C86 232 154 232 168 188', kind: 'fold' },
        ]),
        after: dClosed,
      },
      {
        title: 'Set the first diagonal wing crease',
        instruction: 'Fold the first wing down along the line from near the nose toward the rear, leaving a slim keel.',
        detail: 'The crease slopes slightly away from center toward the tail. Fold the broad outer panel across it.',
        before: action({ ...dClosed, view: 'side' }, [line(dWingHinge, 'fold')], [
          { path: `M${dWingSource[0]} ${dWingSource[1]} C168 214 90 214 ${dWingDestination[0]} ${dWingDestination[1]}`, kind: 'fold' },
        ]),
        after: dFirstWing,
      },
      {
        title: 'Match the second diagonal crease',
        instruction: 'Turn the body over and fold the second wing down along the matching diagonal crease.',
        detail: 'Align the two wing tips and rear edges. The folded wing can extend a little below the original sheet outline.',
        before: action(dFirstWing, [line(dWingHinge, 'mountain')], [
          { path: `M${dSecondSource[0]} ${dSecondSource[1]} C168 234 90 234 ${dSecondDestination[0]} ${dSecondDestination[1]}`, kind: 'fold' },
          { path: 'M204 141 C225 128 225 165 204 154', kind: 'turn' },
        ]),
        after: dBothWings,
      },
      {
        title: 'Spread the triangular wings',
        instruction: 'Look at the nose and open one wing to each side. Raise the tips just above level.',
        detail: 'This front view shows the small upward V. Keep the swept leading edges straight and both wings free of twist.',
        ...dOpening,
      },
    ],
  },
];
