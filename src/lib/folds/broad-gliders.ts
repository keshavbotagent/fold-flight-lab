import type { FoldFrame, FoldGuide } from './schema';

// Schematic coordinates, not cutting templates. The original sheet is landscape
// A4: x18..222, y48..192. Its top long edge is the nose; x120 is the centreline.
// Ten diagram units represent approximately 1.5 cm on that original sheet.
function marked(frame: FoldFrame, marks: Partial<FoldFrame>): FoldFrame {
  const labels = (frame.labels ?? []).filter((label) => !(marks.labels ?? []).some((addition) =>
    label.y >= 195 && addition.y >= 195 && Math.abs(label.y - addition.y) < 20,
  ));
  return {
    ...frame,
    ...marks,
    shapes: marks.shapes ?? frame.shapes,
    lines: [...(frame.lines ?? []), ...(marks.lines ?? [])],
    arrows: [...(frame.arrows ?? []), ...(marks.arrows ?? [])],
    labels: [...labels, ...(marks.labels ?? [])],
  };
}

const sheet: FoldFrame = {
  view: 'top',
  shapes: [{ points: '18,48 222,48 222,192 18,192', tone: 'paper' }],
  labels: [{ x: 120, y: 30, text: 'NOSE EDGE' }],
};

const centredSheet: FoldFrame = marked(sheet, {
  lines: [{ points: '120,48 120,192', kind: 'crease' }],
});

const centreAction: FoldFrame = marked(sheet, {
  lines: [{ points: '120,48 120,192', kind: 'fold' }],
  arrows: [
    { path: 'M 53 119 C 58 81 119 80 167 116', kind: 'fold' },
    { path: 'M 169 144 C 156 175 88 176 59 148', kind: 'open' },
  ],
  labels: [{ x: 120, y: 215, text: 'Fold, then reopen' }],
});

const wideCorners: FoldFrame = {
  view: 'top',
  shapes: [
    { points: '120,48 222,150 222,192 18,192 18,150', tone: 'paper' },
    { points: '120,48 120,150 18,150', tone: 'underside' },
    { points: '120,48 222,150 120,150', tone: 'underside' },
  ],
  lines: [
    { points: '120,48 120,192', kind: 'crease' },
    { points: '18,150 120,150 222,150', kind: 'edge' },
  ],
  labels: [{ x: 120, y: 30, text: 'NOSE' }],
};

const wideBlunt: FoldFrame = {
  view: 'top',
  shapes: [
    { points: '99,69 141,69 222,150 222,192 18,192 18,150', tone: 'paper' },
    { points: '99,69 120,69 120,150 18,150', tone: 'underside' },
    { points: '120,69 141,69 222,150 120,150', tone: 'underside' },
    { points: '99,69 141,69 120,90', tone: 'accent' },
  ],
  lines: [
    { points: '120,90 120,192', kind: 'crease' },
    { points: '18,150 120,150 222,150', kind: 'edge' },
    { points: '99,69 141,69', kind: 'edge' },
  ],
  labels: [{ x: 120, y: 43, text: 'BLUNT NOSE' }],
};

const wideHalf: FoldFrame = {
  view: 'side',
  shapes: [
    { points: '117,71 138,71 219,152 219,194 117,194', tone: 'underside' },
    { points: '120,69 141,69 222,150 222,192 120,192', tone: 'paper' },
    { points: '120,90 141,69 222,150 120,150', tone: 'underside' },
    { points: '120,69 141,69 120,90', tone: 'accent' },
  ],
  lines: [{ points: '120,69 120,192', kind: 'edge' }],
  labels: [
    { x: 120, y: 43, text: 'NOSE' },
    { x: 151, y: 214, text: 'Layers outside' },
  ],
};

// Front views make the distinction between a whole-wing dihedral adjustment
// and a narrow upright tip fin explicit. The centre keel hangs below the wings.
function frontWings(withFins: boolean, raised: boolean): FoldFrame {
  const left = withFins ? 34 : 25;
  const right = 240 - left;
  const tip = raised ? 118 : 138;
  const frame: FoldFrame = {
    view: 'front',
    shapes: [
      { points: '114,138 126,138 126,175 114,175', tone: 'underside' },
      { points: `${left},${tip + 3} 114,141 114,147 ${left},${tip + 9}`, tone: 'underside' },
      { points: `126,141 ${right},${tip + 3} ${right},${tip + 9} 126,147`, tone: 'underside' },
      { points: `${left},${tip} 114,138 114,143 ${left},${tip + 5}`, tone: 'paper' },
      { points: `126,138 ${right},${tip} ${right},${tip + 5} 126,143`, tone: 'paper' },
      { points: '111,135 129,135 129,142 111,142', tone: 'accent' },
    ],
    lines: [
      { points: `${left},${tip + 3} 114,141`, kind: 'edge' },
      { points: `126,141 ${right},${tip + 3}`, kind: 'edge' },
      { points: '114,143 114,175 126,175 126,143', kind: 'edge' },
    ],
    labels: [
      { x: 120, y: 199, text: 'FRONT VIEW' },
      { x: 120, y: 217, text: raised ? 'Tips above roots' : 'Wings level' },
    ],
  };
  if (withFins) {
    frame.shapes.push(
      { points: `28,${tip - 30} 34,${tip - 30} 34,${tip + 5} 28,${tip + 5}`, tone: 'underside' },
      { points: `206,${tip - 30} 212,${tip - 30} 212,${tip + 5} 206,${tip + 5}`, tone: 'underside' },
    );
    frame.lines?.push(
      { points: `34,${tip - 30} 34,${tip + 5}`, kind: 'edge' },
      { points: `206,${tip - 30} 206,${tip + 5}`, kind: 'edge' },
    );
    frame.labels?.push(
      { x: 37, y: tip - 44, text: 'FIN' },
      { x: 203, y: tip - 44, text: 'FIN' },
    );
  }
  return frame;
}

function liftAction(frame: FoldFrame): FoldFrame {
  return marked(frame, {
    lines: [
      { points: '114,133 114,149', kind: 'fold' },
      { points: '126,133 126,149', kind: 'fold' },
    ],
    arrows: [
      { path: 'M 51 160 C 36 151 35 130 47 120', kind: 'open' },
      { path: 'M 189 160 C 204 151 205 130 193 120', kind: 'open' },
    ],
  });
}

const firstStrip: FoldFrame = {
  view: 'top',
  shapes: [
    { points: '18,58 222,58 222,192 18,192', tone: 'paper' },
    { points: '18,58 222,58 222,68 18,68', tone: 'underside' },
  ],
  lines: [
    { points: '120,58 120,192', kind: 'crease' },
    { points: '18,68 222,68', kind: 'edge' },
  ],
  labels: [{ x: 120, y: 34, text: 'FIRST NOSE STRIP' }],
};

const weightedStrip: FoldFrame = {
  view: 'top',
  shapes: [
    { points: '18,68 222,68 222,192 18,192', tone: 'paper' },
    { points: '18,68 222,68 222,78 18,78', tone: 'underside' },
    { points: '18,68 222,68 222,71 18,71', tone: 'accent' },
  ],
  lines: [
    { points: '120,78 120,192', kind: 'crease' },
    { points: '18,73 222,73', kind: 'edge' },
    { points: '18,78 222,78', kind: 'edge' },
  ],
  labels: [{ x: 120, y: 43, text: 'DOUBLE-FOLDED NOSE' }],
};

const condorCorners: FoldFrame = {
  view: 'top',
  shapes: [
    { points: '36,68 204,68 222,86 222,192 18,192 18,86', tone: 'paper' },
    { points: '36,68 204,68 214,78 26,78', tone: 'underside' },
    { points: '36,68 204,68 207,71 33,71', tone: 'accent' },
    { points: '36,68 36,86 18,86', tone: 'underside' },
    { points: '204,68 222,86 204,86', tone: 'underside' },
  ],
  lines: [
    { points: '120,78 120,192', kind: 'crease' },
    { points: '26,78 214,78', kind: 'edge' },
    { points: '36,86 18,86', kind: 'edge' },
    { points: '204,86 222,86', kind: 'edge' },
  ],
  labels: [{ x: 120, y: 43, text: 'WEIGHTED NOSE' }],
};

const condorHalf: FoldFrame = {
  view: 'side',
  shapes: [
    { points: '117,71 201,71 219,89 219,195 117,195', tone: 'underside' },
    { points: '120,68 204,68 222,86 222,192 120,192', tone: 'paper' },
    { points: '120,68 204,68 214,78 120,78', tone: 'underside' },
    { points: '120,68 204,68 207,71 120,71', tone: 'accent' },
    { points: '204,68 222,86 204,86', tone: 'underside' },
  ],
  lines: [
    { points: '120,68 120,192', kind: 'edge' },
    { points: '120,78 214,78', kind: 'edge' },
  ],
  labels: [
    { x: 165, y: 43, text: 'LAYERS OUTSIDE' },
    { x: 149, y: 215, text: 'Layers outside' },
  ],
};

const condorWingsFolded: FoldFrame = {
  view: 'side',
  shapes: [
    { points: '120,68 127,68 127,192 120,192', tone: 'underside' },
    { points: '129,71 52,71 34,89 34,195 129,195', tone: 'underside' },
    { points: '127,68 50,68 32,86 32,192 127,192', tone: 'paper' },
    { points: '127,68 50,68 40,78 127,78', tone: 'underside' },
    { points: '127,68 50,68 47,71 127,71', tone: 'accent' },
    { points: '50,68 50,86 32,86', tone: 'underside' },
  ],
  lines: [
    { points: '127,68 127,192', kind: 'crease' },
    { points: '40,78 127,78', kind: 'edge' },
    { points: '32,86 50,86', kind: 'edge' },
  ],
  labels: [
    { x: 120, y: 43, text: 'STACKED WINGS' },
    { x: 120, y: 215, text: 'Both wings folded' },
  ],
};

function bodyHalfAction(frame: FoldFrame, top: number): FoldFrame {
  return marked(frame, {
    lines: [{ points: `120,${top} 120,192`, kind: 'mountain' }],
    arrows: [{ path: 'M 64 160 C 71 213 158 219 174 163', kind: 'turn' }],
    labels: [{ x: 69, y: 212, text: 'LEFT HALF UNDER' }],
  });
}

function wingFoldAction(frame: FoldFrame, top: number): FoldFrame {
  return marked(frame, {
    lines: [{ points: `127,${top} 127,192`, kind: 'fold' }],
    arrows: [{ path: 'M 196 170 C 178 116 120 113 78 158', kind: 'fold' }],
    labels: [
      { x: 72, y: top + 7, text: '1 cm KEEL' },
      { x: 173, y: 113, text: 'WING DOWN' },
    ],
  });
}

export const BROAD_GLIDER_GUIDES: FoldGuide[] = [
  {
    id: 'wide-glider',
    orientation: 'landscape',
    steps: [
      {
        title: 'Mark the centreline',
        instruction: 'Lay A4 paper landscape, with a long edge at the top. Fold the left half over the right, crease, then reopen.',
        detail: 'The vertical crease runs from the top nose edge to the bottom tail edge. It is an alignment guide.',
        before: centreAction,
        after: marked(centredSheet, { labels: [{ x: 120, y: 215, text: 'Sheet reopened' }] }),
      },
      {
        title: 'Fold the broad nose corners',
        instruction: 'Fold both top corners inward until their top edges meet the centreline. Match the two folds.',
        detail: 'Each original top corner lands on the centreline. The diagonal creases form a broad triangle.',
        before: marked(centredSheet, {
          lines: [
            { points: '18,150 120,48', kind: 'fold' },
            { points: '120,48 222,150', kind: 'fold' },
          ],
          arrows: [
            { path: 'M 39 75 C 79 69 105 91 112 128', kind: 'fold' },
            { path: 'M 201 75 C 161 69 135 91 128 128', kind: 'fold' },
          ],
        }),
        after: wideCorners,
      },
      {
        title: 'Blunt and weight the tip',
        instruction: 'Measure about 3 cm back from the point. Fold the pointed tip down on that crosswise line.',
        detail: 'The tip folds toward the tail and lies over the two corner layers. Keep the new front edge straight.',
        before: marked(wideCorners, {
          lines: [{ points: '99,69 141,69', kind: 'fold' }],
          arrows: [{ path: 'M 120 51 C 154 53 156 83 125 90', kind: 'fold' }],
          labels: [{ x: 174, y: 94, text: '3 cm' }],
        }),
        after: wideBlunt,
      },
      {
        title: 'Close the body, layers outside',
        instruction: 'Mountain-fold the centreline by taking the left half underneath the right half.',
        detail: 'The nose folds must remain on the two outside faces. Do not trap them between the halves.',
        before: bodyHalfAction(wideBlunt, 69),
        after: wideHalf,
      },
      {
        title: 'Fold two broad matching wings',
        instruction: 'Fold the visible wing down along a line parallel to the centreline, leaving a keel about 1 cm deep. Turn over and repeat.',
        detail: 'Use the first wing as the template for the second. Open them level to check symmetry; the result is shown from the nose.',
        before: wingFoldAction(wideHalf, 69),
        after: frontWings(false, false),
      },
      {
        title: 'Give the wings a gentle upward V',
        instruction: 'Adjust the existing wing folds so both tips sit a little above their roots. Leave the centre keel hanging below.',
        detail: 'Look from the nose. Lift both entire wings evenly, keep the trailing edges straight, and add no new sharp crease.',
        before: liftAction(frontWings(false, false)),
        after: frontWings(false, true),
      },
    ],
    tip: 'Use one uncut A4 sheet. Make the two sides match, press the nose layers firmly, and begin with a gentle level release. The diagrams show the fold sequence schematically.',
  },
  {
    id: 'condor',
    orientation: 'landscape',
    steps: [
      {
        title: 'Mark the centreline',
        instruction: 'Lay A4 paper landscape, with a long edge at the top. Fold the left half over the right, crease, then reopen.',
        detail: 'The centreline runs nose to tail. Keep this crease visible for the later body fold.',
        before: centreAction,
        after: marked(centredSheet, { labels: [{ x: 120, y: 215, text: 'Sheet reopened' }] }),
      },
      {
        title: 'Fold the first 1.5 cm nose strip',
        instruction: 'Measure 1.5 cm down from the top long edge. Fold that edge toward the tail on the marked line.',
        detail: 'This first strip lands on the front of the sheet. Keep its folded edge straight across the whole width.',
        before: marked(centredSheet, {
          lines: [{ points: '18,58 222,58', kind: 'fold' }],
          arrows: [{ path: 'M 164 46 C 198 47 200 70 170 74', kind: 'fold' }],
          labels: [{ x: 53, y: 36, text: '1.5 cm' }],
        }),
        after: firstStrip,
      },
      {
        title: 'Roll the strip over once more',
        instruction: 'Fold the entire strip down again on a line 1.5 cm behind the new nose edge.',
        detail: 'Fold at the lower edge of the first strip, not halfway through it. The doubled strip makes a straight, weighted leading edge.',
        before: marked(firstStrip, {
          lines: [{ points: '18,68 222,68', kind: 'fold' }],
          arrows: [{ path: 'M 164 58 C 198 59 200 81 170 85', kind: 'fold' }],
          labels: [{ x: 52, y: 47, text: '1.5 cm again' }],
        }),
        after: weightedStrip,
      },
      {
        title: 'Soften the two nose corners',
        instruction: 'Fold a small matching triangle inward at each front corner. Keep the long middle part of the nose straight.',
        detail: 'Use equal corner folds, about 2 cm across. These small triangles do not extend to the centreline.',
        before: marked(weightedStrip, {
          lines: [
            { points: '18,86 36,68', kind: 'fold' },
            { points: '204,68 222,86', kind: 'fold' },
          ],
          arrows: [
            { path: 'M 19 63 C 45 52 59 68 43 89', kind: 'fold' },
            { path: 'M 221 63 C 195 52 181 68 197 89', kind: 'fold' },
          ],
        }),
        after: condorCorners,
      },
      {
        title: 'Close the body, nose layers outside',
        instruction: 'Mountain-fold the centreline, taking the left half underneath the right half.',
        detail: 'The weighted strip and small corner folds stay on the outside faces. Match the nose and tail edges.',
        before: bodyHalfAction(condorCorners, 68),
        after: condorHalf,
      },
      {
        title: 'Make two broad wings',
        instruction: 'Fold the visible wing down parallel to the centreline, leaving about 1 cm of centre keel. Turn over and repeat the same fold.',
        detail: 'Align the two wing edges. The result shows the matched wings still stacked, ready for their separate tip folds.',
        before: wingFoldAction(condorHalf, 68),
        after: condorWingsFolded,
      },
      {
        title: 'Fold separate upright tip fins',
        instruction: 'Fold a narrow strip, about 1 cm wide, upward along the outer edge of each wing. Repeat on the other face.',
        detail: 'Only the narrow edge strips stand up as fins. Open the broad wings level afterward; the result is a front view with vertical fins.',
        before: marked(condorWingsFolded, {
          lines: [{ points: '39,79 39,192', kind: 'fold' }],
          arrows: [{ path: 'M 25 152 C 9 121 42 108 60 133', kind: 'fold' }],
          labels: [{ x: 80, y: 111, text: '1 cm tip strip' }],
        }),
        after: frontWings(true, false),
      },
      {
        title: 'Lift the whole wings into a gentle V',
        instruction: 'Raise both broad wings slightly at their root folds while keeping the two narrow tip fins upright.',
        detail: 'Viewed from the nose, the wing panels slope upward from the centre; each fin remains a separate upright edge. Match both sides.',
        before: liftAction(frontWings(true, false)),
        after: frontWings(true, true),
      },
    ],
    tip: 'Use one uncut A4 sheet. The two rolled strip folds supply nose weight without added material. Compare the two upright fins from the nose, and release gently with the whole wings in a shallow V.',
  },
];
