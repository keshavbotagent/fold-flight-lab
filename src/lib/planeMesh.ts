import * as THREE from 'three';
import type { PlaneDesign, PlaneShape } from './types';

type Point = [number, number];

// Each outline is one half of the sheet, viewed from above. The point is +X.
const outlines: Record<PlaneShape, Point[]> = {
  dart: [[.5, 0], [-.23, 1], [-.5, .86], [-.5, .1]],
  glider: [[.5, .08], [.29, .30], [.12, .92], [-.36, 1], [-.5, .72], [-.5, .10]],
  delta: [[.5, 0], [-.36, 1], [-.5, .90], [-.5, .1]],
  nakamura: [[.5, 0], [.27, .28], [.10, .87], [-.44, 1], [-.5, .10]],
  stunt: [[.5, 0], [.26, .42], [-.29, 1], [-.5, .72], [-.5, .10]],
  canard: [[.5, 0], [.40, .36], [.20, .42], [.17, .12], [-.10, 1], [-.5, .90], [-.5, .10]],
  wide: [[.5, 0], [.20, .72], [-.02, 1], [-.43, 1], [-.5, .18]],
  needle: [[.5, 0], [-.38, 1], [-.5, .57], [-.5, .08]],
  suzanne: [[.5, 0], [-.10878, 1], [-.5, .64838], [-.43648, 0]],
  'sky-king': [[.5, .14], [.39, .36], [.19, .94], [-.42, 1], [-.5, .87], [-.5, .09]],
  krstic: [[.5, .015], [.22, .27], [-.40, 1], [-.5, 1], [-.5, .12]],
};

function triangle(points: THREE.Vector3[], material: THREE.Material): THREE.Mesh {
  const positions = new Float32Array(points.flatMap((point) => [point.x, point.y, point.z]));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function segments(points: THREE.Vector3[], material: THREE.LineBasicMaterial): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineSegments(geometry, material);
}

/** A folded, faceted sheet. Physical dimensions are multiplied by 3 for legibility. */
export function createPlaneModel(design: PlaneDesign): THREE.Group {
  const plane = new THREE.Group();
  plane.name = `paper-plane-${design.id}`;
  plane.userData.designId = design.id;
  const length = design.length;
  const halfSpan = design.span / 2;
  const dihedral = THREE.MathUtils.degToRad(Math.max(-18, Math.min(18, design.dihedral)));
  const narrowBeam = design.shape === 'krstic';
  const dorsalKeel = design.shape === 'sky-king';
  const wingHeight = (x: number, width: number) => {
    // Collins's front and mid-wing V differ. This is a static visual approximation.
    const elevation = design.shape === 'suzanne'
      ? THREE.MathUtils.degToRad(7.5 + 5 * THREE.MathUtils.clamp((.5 - x) / .61, 0, 1))
      : dihedral;
    return .014 * length + width * halfSpan * Math.tan(elevation);
  };
  const paper = new THREE.MeshStandardMaterial({
    color: '#f1eee6', roughness: .85, metalness: 0, side: THREE.DoubleSide,
  });
  const paperLight = new THREE.MeshStandardMaterial({
    color: '#fffaf0', roughness: .9, metalness: 0, side: THREE.DoubleSide,
  });
  const paperFold = new THREE.MeshStandardMaterial({
    color: '#d9d7ce', roughness: .92, metalness: 0, side: THREE.DoubleSide,
  });
  const paperUnderside = new THREE.MeshStandardMaterial({
    color: '#cfcbc2', roughness: .95, metalness: 0, side: THREE.DoubleSide,
  });
  const crease = new THREE.LineBasicMaterial({ color: '#bd9581', transparent: true, opacity: .35 });
  const edge = new THREE.LineBasicMaterial({ color: '#ded7c9', transparent: true, opacity: .75 });
  const spine = new THREE.LineBasicMaterial({ color: design.color, transparent: true, opacity: .93 });
  const outline = outlines[design.shape];

  for (const side of [-1, 1]) {
    const points = outline.map(([x, width]) => new THREE.Vector3(
      x * length,
      wingHeight(x, width),
      side * width * halfSpan,
    ));
    // A shallow ridge catches the key light and reveals the folded triangular panels.
    const root = new THREE.Vector3(-.12 * length, (narrowBeam ? .0021 : .046 * length) + .20 * halfSpan * Math.tan(dihedral), side * .20 * halfSpan);
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      plane.add(triangle([root, a, b], i % 3 === 0 ? paperLight : i % 3 === 1 ? paper : paperFold));
    }
    const outside: THREE.Vector3[] = [];
    const folds: THREE.Vector3[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i].clone(); a.y += .00035;
      const b = points[(i + 1) % points.length].clone(); b.y += .00035;
      outside.push(a, b);
      if (i !== 0 && i !== points.length - 1) {
        const r = root.clone(); r.y += .0005;
        folds.push(r, a);
      }
    }
    plane.add(segments(outside, edge));
    plane.add(segments(folds, crease));

    const topNose = new THREE.Vector3(.5 * length, .014 * length, 0);
    const topRear = new THREE.Vector3(-.5 * length, .014 * length, side * .045 * halfSpan);
    const bodyDepth = dorsalKeel ? .0154 : narrowBeam ? -.0045 : -.125 * length;
    const bottomRear = new THREE.Vector3(-.47 * length, bodyDepth, side * .02 * halfSpan);
    const belly = new THREE.Vector3(.25 * length, dorsalKeel ? .006 : narrowBeam ? -.0015 : -.028 * length, 0);
    plane.add(triangle([topNose, topRear, bottomRear, topNose, bottomRear, belly], paperUnderside));

    // Keep the sheet continuous from the wing's diagonal root edge into the keel.
    // Wide airframes need a larger web here; an open strip would split the wings.
    const wingNose = points[0];
    const wingRear = points[points.length - 1];
    plane.add(triangle([topNose, wingNose, wingRear, topNose, wingRear, topRear], paper));

    // Two slender folded strips create a real centre seam rather than a flat decal.
    const seamRear = new THREE.Vector3(-.5 * length, narrowBeam ? .0028 : .034 * length, side * .025 * halfSpan);
    const seamNose = new THREE.Vector3(.5 * length, .015 * length, 0);
    plane.add(triangle([seamNose, seamRear, topRear], paperLight));
    const centreRear = new THREE.Vector3(-.5 * length, narrowBeam ? .0030 : .036 * length, 0);
    plane.add(triangle([seamNose, centreRear, seamRear], paperLight));

    if (design.shape === 'glider' || design.shape === 'wide' || design.shape === 'stunt') {
      // Raised trailing flaps make the slower glider families visibly distinct.
      const flapWidth = design.shape === 'wide' ? .9 : .7;
      const inner = new THREE.Vector3(-.43 * length, .022 * length + .18 * halfSpan * Math.tan(dihedral), side * .18 * halfSpan);
      const outer = new THREE.Vector3(-.43 * length, .022 * length + flapWidth * halfSpan * Math.tan(dihedral), side * flapWidth * halfSpan);
      const a = new THREE.Vector3(-.50 * length, inner.y + .044 * length, inner.z);
      const b = new THREE.Vector3(-.50 * length, outer.y + .044 * length, outer.z);
      plane.add(triangle([inner, outer, b, inner, b, a], paperLight));
      plane.add(segments([inner, outer], crease));
    }
    if (design.shape === 'glider') {
      const a = new THREE.Vector3(.12 * length, .014 * length + .92 * halfSpan * Math.tan(dihedral), side * .92 * halfSpan);
      const b = new THREE.Vector3(-.36 * length, .014 * length + halfSpan * Math.tan(dihedral), side * halfSpan);
      const highA = a.clone().add(new THREE.Vector3(0, .035 * length, -side * .012 * halfSpan));
      const highB = b.clone().add(new THREE.Vector3(0, .095 * length, -side * .022 * halfSpan));
      plane.add(triangle([a, b, highB, a, highB, highA], paperLight));
      plane.add(segments([a, b], crease));
    }
    if (design.shape === 'stunt') {
      const a = new THREE.Vector3(-.29 * length, .014 * length + halfSpan * Math.tan(dihedral), side * halfSpan);
      const b = new THREE.Vector3(-.5 * length, .014 * length + .72 * halfSpan * Math.tan(dihedral), side * .72 * halfSpan);
      const tucked = new THREE.Vector3(-.43 * length, b.y + .09 * length, side * .63 * halfSpan);
      plane.add(triangle([a, b, tucked], paperFold));
      plane.add(segments([a, b], crease));
    }
    if (dorsalKeel) {
      // Toda's photographed guide shows downturned tip strips and a dorsal body.
      const a = new THREE.Vector3(.19 * length, wingHeight(.19, .94), side * .94 * halfSpan);
      const b = new THREE.Vector3(-.42 * length, wingHeight(-.42, 1), side * halfSpan);
      const lowA = a.clone().add(new THREE.Vector3(0, -.0154, -side * .004));
      const lowB = b.clone().add(new THREE.Vector3(0, -.0154, -side * .004));
      plane.add(triangle([a, b, lowB, a, lowB, lowA], paperFold));
      plane.add(segments([a, b], crease));
    }
    if (narrowBeam) {
      // The dense rolled spine stays millimetres deep rather than a tall tent.
      const nose = new THREE.Vector3(.47 * length, .0022, side * .0004);
      const rail = new THREE.Vector3(-.47 * length, .0018, side * .004);
      const lowerRail = rail.clone().add(new THREE.Vector3(0, -.0035, 0));
      plane.add(triangle([nose, rail, lowerRail], paperFold));
      plane.add(segments([nose, rail], crease));
    }
  }

  const spinePoints = [
    new THREE.Vector3(.46 * length, .016 * length, 0),
    new THREE.Vector3(-.5 * length, narrowBeam ? .0030 : .036 * length, 0),
  ];
  plane.add(segments(spinePoints, spine));
  if (design.shape === 'glider') {
    plane.add(triangle([
      new THREE.Vector3(.5 * length, .014 * length, -.08 * halfSpan),
      new THREE.Vector3(.5 * length, .014 * length, .08 * halfSpan),
      new THREE.Vector3(.28 * length, .028 * length, 0),
    ], paperLight));
  }
  if (dorsalKeel) {
    const front = .5 * length, rear = .28 * length;
    const low = .014 * length, high = .006;
    plane.add(triangle([
      new THREE.Vector3(front, low, -.14 * halfSpan), new THREE.Vector3(front, low, .14 * halfSpan), new THREE.Vector3(rear, high, 0),
    ], paperLight));
  }

  // A tiny dark crease at the nose adds a paper-thin edge to the silhouette.
  const noseCrease = new THREE.LineBasicMaterial({ color: '#9f998f', transparent: true, opacity: .5 });
  plane.add(segments([
    new THREE.Vector3(.50 * length, .014 * length, 0),
    new THREE.Vector3(.25 * length, dorsalKeel ? .006 : narrowBeam ? -.0015 : -.028 * length, 0),
  ], noseCrease));
  plane.scale.setScalar(3);
  return plane;
}

/** Free every geometry, material and texture owned by an object tree once. */
export function disposeObject(object: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  object.traverse((child) => {
    const renderable = child as THREE.Mesh;
    if (renderable.geometry) geometries.add(renderable.geometry);
    if (renderable.material) {
      const list = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
      list.forEach((material) => {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      });
    }
  });
  textures.forEach((texture) => texture.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
