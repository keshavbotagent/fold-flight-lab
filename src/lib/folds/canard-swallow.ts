import type { FoldArrow, FoldFrame, FoldGuide, FoldLine, FoldShape, FoldStep } from './schema';

type P = readonly [number, number];
const points = (ps: readonly P[]) => ps.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(' ');
const shape = (ps: readonly P[], tone: FoldShape['tone'] = 'paper'): FoldShape => ({ points: points(ps), tone });
const line = (ps: readonly P[], kind: FoldLine['kind'] = 'crease'): FoldLine => ({ points: points(ps), kind });
const arrow = (path: string, kind: FoldArrow['kind'] = 'fold'): FoldArrow => ({ path, kind });
const mirrorPoints = (ps: readonly P[]): P[] => ps.map(([x, y]) => [240 - x, y]);
const reflect = (p: P, a: P, b: P): P => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  return [2 * (a[0] + t * dx) - p[0], 2 * (a[1] + t * dy) - p[1]];
};
const frame = (shapes: FoldShape[], lines: FoldLine[] = [], view: FoldFrame['view'] = 'top'): FoldFrame => ({ shapes, lines, view });
const action = (base: FoldFrame, lines: FoldLine[], arrows: FoldArrow[], labels: FoldFrame['labels'] = []): FoldFrame => ({
  ...base, lines: [...(base.lines ?? []), ...lines], arrows, labels,
});
const step = (title: string, instruction: string, before: FoldFrame, after: FoldFrame, detail?: string): FoldStep => ({ title, instruction, before, after, ...(detail ? { detail } : {}) });

const sheet: P[] = [[48,18],[192,18],[192,222],[48,222]];
const flat = frame([shape(sheet)]);
const centerMarked = frame([shape(sheet)], [line([[120,18],[120,222]])]);
const noseOutline: P[] = [[120,18],[192,90],[192,222],[48,222],[48,90]];
const cornerLeft: P[] = [[120,18],[120,90],[48,90]];
const cornerRight = mirrorPoints(cornerLeft);
const nose = frame([shape(noseOutline), shape(cornerLeft, 'underside'), shape(cornerRight, 'underside')], [line([[120,18],[120,222]])]);
const centerStep = (): FoldStep => step(
  'Mark the centerline',
  'Start with portrait A4. Fold the left long edge onto the right long edge, crease, then reopen.',
  action(flat, [line([[120,18],[120,222]], 'fold')], [arrow('M 72 122 Q 120 166 170 122')]),
  centerMarked,
  'The original rectangle is 21 × 29.7 cm. The top of every top-view diagram is the nose.',
);
const cornersStep = (): FoldStep => step(
  'Fold the first corners',
  'Fold both upper corners inward. Their original top edges meet on the centerline.',
  action(centerMarked, [line([[120,18],[48,90]], 'fold'), line([[120,18],[192,90]], 'fold')], [
    arrow('M 61 31 Q 88 29 115 79'), arrow('M 179 31 Q 152 29 125 79'),
  ]), nose,
  'Match the two sloping leading edges and flatten each triangular corner layer.',
);

// CANARD: the two original corner layers must remain accessible. Folding the
// nose underneath and turning the packet over makes their free corners visible.
const canardRectangle: P[] = [[48,90],[192,90],[192,222],[48,222]];
const canardUnder = frame([shape(canardRectangle)], [line([[120,90],[120,222]]), line([[48,90],[120,162],[192,90]], 'hidden')]);
const originalLeft: P[] = [[48,90],[120,90],[120,162]];
const originalRight = mirrorPoints(originalLeft);
const canardExposed = frame([shape(canardRectangle), shape(originalLeft, 'underside'), shape(originalRight, 'underside')], [line([[120,90],[120,222]])]);
// Each little free triangle is cut off only by a NEW CREASE, never by scissors.
// Its root edge is shared exactly with the retained original corner-layer quad.
const leftParent: P[] = [[48,90],[84,90],[120,126],[120,162]];
const rightParent = mirrorPoints(leftParent);
const leftTab: P[] = [[84,90],[120,126],[84,126]];
const rightTab = mirrorPoints(leftTab);
const tabbed = frame([shape(canardRectangle), shape(leftParent, 'underside'), shape(rightParent, 'underside'), shape(leftTab, 'accent'), shape(rightTab, 'accent')], [
  line([[120,90],[120,222]]), line([[84,90],[120,126]]), line([[156,90],[120,126]]),
]);
const canardHalf: P[] = [[120,90],[192,90],[192,222],[120,222]];
const canardClosed = frame([shape(canardHalf), shape(rightParent, 'underside'), shape(rightTab, 'accent')], [line([[120,90],[120,222]], 'edge'), line([[156,90],[120,126]])], 'side');
const cRootA: P = [192,138], cRootB: P = [132,222];
const cFreeWing: P[] = [cRootA,[192,222],cRootB];
const cFoldWing = cFreeWing.map(p => reflect(p, cRootA, cRootB));
const cBody: P[] = [[120,90],[192,90],cRootA,cRootB,[120,222]];
const canardFirstWing = frame([shape(cBody), shape(rightParent, 'underside'), shape(rightTab, 'accent'), shape(cFoldWing, 'underside')], [
  line([cRootA,cRootB]), line([[120,90],[120,222]], 'edge'),
], 'side');
const canardBothWings = frame([shape(mirrorPoints(cBody)), shape(mirrorPoints(rightParent), 'underside'), shape(mirrorPoints(rightTab), 'accent'), shape(mirrorPoints(cFoldWing), 'underside')], [
  line(mirrorPoints([cRootA,cRootB])), line([[120,90],[120,222]], 'edge'), line(mirrorPoints(cFoldWing), 'hidden'),
], 'side');
const cKeelLeft: P[] = [[116,90],[120,90],[120,126],[120,138],[114,222],[120,222]];
const cKeelRight = mirrorPoints(cKeelLeft);
const cTopForeLeft: P[] = [[120,90],[96,108],[120,126]];
const cTopForeRight = mirrorPoints(cTopForeLeft);
const cClosedRearLeft: P[] = [[120,138],[104,200],[114,222]];
const canardForeOpen = frame([shape(cKeelLeft), shape(cKeelRight), shape(cClosedRearLeft, 'underside'), shape(mirrorPoints(cClosedRearLeft), 'underside'), shape(cTopForeLeft, 'accent'), shape(cTopForeRight, 'accent')], [
  line([[120,90],[120,126]], 'edge'), line([[120,138],[114,222]]), line([[120,138],[126,222]]),
]);
const canardFront = frame([
  shape([[116,116],[124,116],[124,126],[124,132],[124,138],[124,171],[120,181],[116,171],[116,138],[116,132],[116,126]]),
  shape([[116,116],[30,110],[30,118],[116,126]]), shape([[124,116],[210,110],[210,118],[124,126]]),
  shape([[116,132],[91,118],[116,138]], 'accent'), shape([[124,132],[149,118],[124,138]], 'accent'),
], [line([[116,116],[116,126]], 'edge'), line([[124,116],[124,126]], 'edge'), line([[116,132],[116,138]], 'edge'), line([[124,132],[124,138]], 'edge')], 'front');

const canard: FoldGuide = {
  id: 'canard', orientation: 'portrait',
  tip: 'This is a representative no-cut canard construction. The short foreplanes come from the two original corner layers. Their diagonal hinges create matched sloping tabs; they are not supposed to lie perfectly horizontal. Keep their angles equal and make only tiny trim changes.',
  steps: [
    centerStep(), cornersStep(),
    step('Fold the nose underneath', 'Fold the whole triangular nose away from you, underneath the rectangle, along the base of the triangle.',
      action(nose, [line([[48,90],[192,90]], 'mountain')], [arrow('M 120 30 C 163 45 164 129 120 157')]), canardUnder,
      'Use the horizontal line through the two shoulders. This is an underfold: the original corner layers end up on the back.'),
    step('Turn to the corner-layer face', 'Turn the entire packet over. The two original corner flaps should now be visible on top.',
      action(canardUnder, [], [arrow('M 201 107 C 227 124 229 182 201 202', 'turn')]), canardExposed,
      'The folded nose is now on top. Keep the two original corner flaps free so their tips can become the foreplanes.'),
    step('Crease the attached foreplane tips', 'Fold only the small free front corner of each exposed flap backward along the two marked diagonal hinges.',
      action(canardExposed, [line([[84,90],[120,126]], 'fold'), line([[156,90],[120,126]], 'fold')], [
        arrow('M 112 97 Q 82 98 87 121'), arrow('M 128 97 Q 158 98 153 121'),
      ]), tabbed,
      'Each free corner starts at the front center. Crease one top layer at a time, leaving the paper underneath flat. The colored triangles become the foreplanes.'),
    step('Close the center keel', 'Fold the left half behind the right half on the original centerline, with the foreplane flaps on the two outside faces.',
      action(tabbed, [line([[120,90],[120,222]], 'mountain')], [arrow('M 69 183 Q 119 232 174 183')]), canardClosed,
      'The following diagrams show one side of the closed packet. The nose is still at the top.'),
    step('Fold the first rear wing', 'Fold the rear outer corner inward along the marked diagonal, leaving a narrow keel at the tail.',
      action(canardClosed, [line([cRootA,cRootB], 'fold')], [arrow('M 185 214 Q 181 184 155 192')], [{x:8,y:132,text:'Tabs end here'}]), canardFirstWing,
      'Start the main-wing crease on the outer edge below both foreplane tips. Keep the front flaps free; the rear wing folds stay behind them.'),
    step('Turn and match the second wing', 'Turn the packet over and fold the other rear wing along the matching diagonal.',
      action(canardFirstWing, [line([cRootA,cRootB], 'hidden')], [arrow('M 202 139 C 226 154 225 189 200 204', 'turn'), arrow('M 53 212 Q 58 184 85 192')]), canardBothWings,
      'Use the first wing as a template. The result is the opposite side view, with both rear wing layers folded.'),
    step('Open the two foreplanes', 'Hold the keel and ease each small triangular tab out from its own diagonal crease. Match the two sloping tab angles.',
      action(canardBothWings, [line([[84,90],[120,126]], 'fold')], [arrow('M 89 109 Q 69 109 76 132', 'open'), arrow('M 151 109 Q 171 109 164 132', 'open')]), canardForeOpen,
      'The result switches to a top view. The rear wings are still folded. Ease the colored foreplanes outward while keeping their diagonal creases intact.'),
    step('Open the main wings into a gentle V', 'Spread the two rear wings to nearly level and raise their outer edges slightly. Keep the forward tabs ahead of the main wings.',
      action(canardForeOpen, [], [arrow('M 108 184 Q 78 159 59 174', 'open'), arrow('M 132 184 Q 162 159 181 174', 'open')]),
      {...canardFront, labels:[{x:8,y:22,text:'Front view'},{x:8,y:165,text:'Short foreplanes'}]},
      'Look at the nose from the front: main wings form a small upward V; the shorter forward tabs slope symmetrically. Avoid flattening their diagonal hinges or bending one tab more than the other.'),
  ],
};

// SWALLOW: a short folded nose and two swept main wings; no cuts or free parts.
const sNoseOutline: P[] = [[96,42],[144,42],[192,90],[192,222],[48,222],[48,90]];
const sNoseLeft: P[] = [[96,42],[120,42],[120,90],[48,90]];
const swallowNoseFold = frame([shape(sNoseOutline), shape(sNoseLeft, 'underside'), shape(mirrorPoints(sNoseLeft), 'underside'), shape([[96,42],[144,42],[120,66]], 'accent')], [line([[120,42],[120,222]])]);
const sEdgeA: P = [104,42], sEdgeB: P = [48,186];
const sOuterLeft: P[] = [sEdgeA,[96,42],[48,90],sEdgeB];
const sSecondLeft = sOuterLeft.map(p => reflect(p, sEdgeA, sEdgeB));
const sBodyOutline: P[] = [[104,42],[136,42],[192,186],[192,222],[48,222],[48,186]];
const swallowEdges = frame([shape(sBodyOutline), shape(sSecondLeft, 'underside'), shape(mirrorPoints(sSecondLeft), 'underside'), shape([[104,42],[136,42],[120,66]], 'accent')], [
  line([[120,42],[120,222]]), line([sEdgeA,sEdgeB]), line(mirrorPoints([sEdgeA,sEdgeB])),
]);
const sHalf: P[] = [[120,42],[136,42],[192,186],[192,222],[120,222]];
const swallowClosed = frame([shape(sHalf), shape(mirrorPoints(sSecondLeft), 'underside'), shape([[120,42],[136,42],[120,66]], 'accent')], [line([[120,42],[120,222]], 'edge')], 'side');
const sWingA: P = [148.444444,74], sWingB: P = [132,222];
const sFreeWing: P[] = [sWingA,[192,186],[192,222],sWingB];
const sFoldWing = sFreeWing.map(p => reflect(p, sWingA, sWingB));
const sKeelSide: P[] = [[120,42],[136,42],sWingA,sWingB,[120,222]];
const swallowFirstWing = frame([shape(sKeelSide), shape(sFoldWing, 'underside'), shape([[120,42],[136,42],[120,66]], 'accent')], [line([sWingA,sWingB]), line([[120,42],[120,222]], 'edge')], 'side');
const swallowBothWings = frame([shape(mirrorPoints(sKeelSide)), shape(mirrorPoints(sFoldWing), 'underside'), shape([[120,42],[104,42],[120,66]], 'accent')], [line(mirrorPoints([sWingA,sWingB])), line([[120,42],[120,222]], 'edge'), line(mirrorPoints(sFoldWing), 'hidden')], 'side');
const sKeelTop: P[] = [[114,42],[126,42],[124,74],[132,222],[108,222],[116,74]];
const sWingRightTop: P[] = [[124,74],[192,186],[192,222],[132,222]];
const sWingLeftTop = mirrorPoints(sWingRightTop);
const swallowOpen = frame([shape(sKeelTop), shape(sWingLeftTop), shape(sWingRightTop), shape([[114,42],[126,42],[120,66]], 'accent')], [line([[124,74],[132,222]]), line([[116,74],[108,222]])]);
const sTipA: P = [174,222], sTipB: P = [192,198], sTipFree: P = [192,222];
// 60° upward tip fold, shown in top projection: hinge fixed, free point foreshortened.
const sTipReflected = reflect(sTipFree, sTipA, sTipB);
const sTipProjected: P = [(3*sTipFree[0]+sTipReflected[0])/4, (3*sTipFree[1]+sTipReflected[1])/4];
const sTipRaised: P[] = [sTipA,sTipB,sTipProjected];
const sWingClipped: P[] = [[124,74],[192,186],sTipB,sTipA,[132,222]];
const swallowTips = frame([shape(sKeelTop), shape(mirrorPoints(sWingClipped)), shape(sWingClipped), shape(mirrorPoints(sTipRaised), 'accent'), shape(sTipRaised, 'accent'), shape([[114,42],[126,42],[120,66]], 'accent')], [
  line([sTipA,sTipB], 'crease'), line(mirrorPoints([sTipA,sTipB]), 'crease'), line([[124,74],[132,222]]), line([[116,74],[108,222]]),
]);
const swallowFront = frame([
  shape([[116,114],[124,114],[124,122],[124,167],[120,178],[116,167],[116,122]]),
  shape([[116,114],[54,110],[38,109],[38,117],[116,122]]), shape([[124,114],[186,110],[202,109],[202,117],[124,122]]),
  shape([[38,109],[54,110],[38,90]], 'accent'), shape([[202,109],[186,110],[202,90]], 'accent'),
], [line([[116,114],[116,122]], 'edge'), line([[124,114],[124,122]], 'edge'), line([[38,109],[54,110]], 'crease'), line([[202,109],[186,110]], 'crease')], 'front');

const swallow: FoldGuide = {
  id: 'swallow', orientation: 'portrait',
  tip: 'This is a representative Swallow-style swept glider. The two raised rear-corner triangles are wingtip fins, not the elevator trim. Start with an almost level, symmetric wing setting; use only 2–3 mm of equal trailing-edge bend if extra trim is needed.',
  steps: [
    centerStep(), cornersStep(),
    step('Shorten and reinforce the nose', 'Fold the small pointed tip toward the tail, using a horizontal crease about 3.5–4 cm behind the point.',
      action(nose, [line([[96,42],[144,42]], 'fold')], [arrow('M 120 23 C 145 31 145 53 122 62')]), swallowNoseFold,
      'Only the small triangle above the marked line moves. Its reflected tip lands below the line, creating a short blunt nose.'),
    step('Fold the leading edges inward again', 'Fold the two outer leading-edge layers inward along the matching sloping lines. Keep the blunt nose fold in place.',
      action(swallowNoseFold, [line([sEdgeA,sEdgeB], 'fold'), line(mirrorPoints([sEdgeA,sEdgeB]), 'fold')], [
        arrow('M 62 110 Q 76 96 109 114'), arrow('M 178 110 Q 164 96 131 114'),
      ]), swallowEdges,
      'These are matching second corner folds. Both long rear corners remain available for the main wings and their later tip folds.'),
    step('Fold the body in half', 'Fold the left half behind the right half along the centerline, keeping the nose layers outside.',
      action(swallowEdges, [line([[120,42],[120,222]], 'mountain')], [arrow('M 71 177 Q 119 225 174 177')]), swallowClosed,
      'This step makes the central keel. It does not make a wing yet.'),
    step('Fold the first swept wing', 'Fold one outer wing down along the long marked crease, leaving a narrow center keel.',
      action(swallowClosed, [line([sWingA,sWingB], 'fold')], [arrow('M 181 209 Q 143 188 85 211')]), swallowFirstWing,
      'The crease starts on the leading edge behind the reinforced nose and ends a little outboard of the centerline at the tail. The folded wing projects past the keel in this side view.'),
    step('Turn and fold the second wing', 'Turn the packet over and fold the other wing along the matching crease. Align the two trailing edges.',
      action(swallowFirstWing, [line([sWingA,sWingB], 'hidden')], [arrow('M 205 100 C 227 129 225 173 203 190', 'turn'), arrow('M 56 210 Q 100 188 154 211')]), swallowBothWings,
      'Use the first wing as the template rather than making a new angle. This result is the opposite side view with both wings folded.'),
    step('Open the wings for the tip folds', 'Hold the keel and spread both main wings nearly flat so the two outer rear corners are easy to reach.',
      action(swallowBothWings, [], [arrow('M 105 164 Q 72 142 52 171', 'open'), arrow('M 135 164 Q 168 142 188 171', 'open')]),
      {...swallowOpen, labels:[{x:8,y:22,text:'Top view'}]},
      'The nose is at the top. The two corners at the bottom outside edges are the REAR corners; the pointed leading corners are not folded in the next step.'),
    step('Raise the two rear-corner triangles', 'Crease a small triangle at each outer rear corner and lift both triangles upward about 45–60°.',
      action(swallowOpen, [line([sTipA,sTipB], 'fold'), line(mirrorPoints([sTipA,sTipB]), 'fold')], [
        arrow('M 48 229 Q 30 209 51 205'), arrow('M 192 229 Q 210 209 189 205'),
      ]), swallowTips,
      'The two accent triangles share their entire hinge with the remaining wing. Their top-view footprint becomes shorter because they stand up; do not flatten them onto the wing or detach them.'),
    step('Set a slight V and tiny optional trim', 'Set the main wings almost level, with their tips only a little above the roots. Keep the rear triangular tips upright.',
      action(swallowTips, [line([[73,216],[107,216]], 'fold'), line([[167,216],[133,216]], 'fold')], [
        arrow('M 85 231 Q 85 213 94 205'), arrow('M 155 231 Q 155 213 146 205'),
      ], [{x:8,y:22,text:'Optional trim'}]),
      {...swallowFront, labels:[{x:8,y:22,text:'Front view'},{x:8,y:151,text:'Almost level wings'}]},
      'The result is a front view: a slight V in the main wings and taller rear-corner fins. Start with straight trailing edges. For optional looping trim, bend only 2–3 mm of each marked trailing-edge strip upward equally; this is separate from the large triangular tip folds.'),
  ],
};

export const CANARD_SWALLOW_GUIDES: FoldGuide[] = [canard, swallow];
