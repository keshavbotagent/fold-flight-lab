import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { FlightResult, FlightSample, PlaneDesign } from './types';
import { getDesign } from './designs';
import { createPlaneModel, disposeObject } from './planeMesh';

type CameraMode = 'orbit' | 'follow' | 'top';

interface FlightView {
  result: FlightResult;
  group: THREE.Group;
  plane: THREE.Group;
  line: THREE.Line;
  positions: Float32Array;
  cursor: number;
  overwrittenIndex: number;
  position: THREE.Vector3;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const PAPER_HEIGHT = .68;

function textSprite(text: string, color = '#8b969e'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, 256, 64);
    context.font = '500 28px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = color;
    context.fillText(text, 128, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: .86 }));
  sprite.scale.set(1.28, .32, 1);
  return sprite;
}

function lineSegments(points: THREE.Vector3[], color: string, opacity: number): THREE.LineSegments {
  return new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
}

function atTime(samples: FlightSample[], seconds: number): { sample: FlightSample; lower: number; upper: number } | null {
  if (!samples.length) return null;
  if (seconds <= samples[0].t) return { sample: samples[0], lower: 0, upper: 0 };
  const last = samples.length - 1;
  if (seconds >= samples[last].t) return { sample: samples[last], lower: last, upper: last };
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = (high + low) >> 1;
    if (samples[middle].t <= seconds) low = middle;
    else high = middle;
  }
  const a = samples[low];
  const b = samples[high];
  const fraction = (seconds - a.t) / Math.max(.000001, b.t - a.t);
  const lerp = (key: keyof FlightSample) => THREE.MathUtils.lerp(a[key], b[key], fraction);
  return {
    lower: low,
    upper: high,
    sample: {
      t: seconds,
      x: lerp('x'), y: lerp('y'), z: lerp('z'),
      vx: lerp('vx'), vy: lerp('vy'), vz: lerp('vz'),
      pitch: lerp('pitch'), roll: lerp('roll'),
    },
  };
}

/** Three.js stage. Replay positions use the simulation's metres and seconds. */
export class FlightScene {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, .012, 800);
  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private frame = 0;
  private destroyed = false;
  private contextLost = false;
  private onError?: (message: string) => void;
  private readonly keyLight = new THREE.DirectionalLight('#fff7e8', 3.2);
  private readonly world = new THREE.Group();
  private readonly measuring = new THREE.Group();
  private readonly flightLayer = new THREE.Group();
  private readonly comparisonLayer = new THREE.Group();
  private displayPlane: THREE.Group | null = null;
  private primary: FlightView | null = null;
  private comparisons: FlightView[] = [];
  private currentDesign: PlaneDesign | null = null;
  private cameraMode: CameraMode = 'orbit';
  private seconds = 0;
  private previousFrame = 0;
  private readonly focus = new THREE.Vector3(0, PAPER_HEIGHT, 0);
  private readonly cameraGoal = new THREE.Vector3();
  private readonly targetGoal = new THREE.Vector3();
  private readonly comparisonBounds = new THREE.Box3();
  private readonly comparisonCenter = new THREE.Vector3();
  private comparisonRadius = 10;
  private lastMeasureLength = 0;
  private lastMeasureHeight = 0;

  constructor(container: HTMLElement, onError?: (message: string) => void) {
    this.container = container;
    this.onError = onError;
    this.scene.background = new THREE.Color('#11171c');
    this.scene.fog = new THREE.FogExp2('#11171c', .0105);
    this.scene.add(this.world, this.measuring, this.flightLayer, this.comparisonLayer);
    this.camera.position.set(1.28, 1.65, 1.35);
    this.camera.lookAt(this.focus);

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const canvas = this.renderer.domElement;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      canvas.style.touchAction = 'none';
      canvas.setAttribute('aria-label', '3D paper plane simulator. Drag to orbit, scroll to zoom, right-drag to pan.');
      canvas.setAttribute('role', 'img');
      canvas.addEventListener('webglcontextlost', this.handleContextLost);
      canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
      container.appendChild(canvas);
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = .07;
      this.controls.minDistance = .75;
      this.controls.maxDistance = 230;
      this.controls.maxPolarAngle = Math.PI * .49;
      this.controls.target.copy(this.focus);
      this.controls.update();
      this.setupWorld();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
      this.resize();
      this.frame = requestAnimationFrame(this.animate);
    } catch (error) {
      this.renderer?.dispose();
      this.renderer?.domElement.remove();
      this.renderer = null;
      this.onError?.(error instanceof Error ? `3D view unavailable: ${error.message}` : '3D view unavailable in this browser.');
    }
  }

  private setupWorld(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshStandardMaterial({ color: '#141b20', roughness: .98, metalness: .04 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -.035;
    ground.receiveShadow = true;
    this.world.add(ground);

    const grid = new THREE.GridHelper(220, 110, '#344249', '#29363d');
    grid.position.y = -.026;
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = .28;
    this.world.add(grid);

    const fineGrid = new THREE.GridHelper(8, 32, '#344249', '#2d3940');
    fineGrid.position.y = -.024;
    const fineMaterial = fineGrid.material as THREE.Material;
    fineMaterial.transparent = true;
    fineMaterial.opacity = .18;
    this.world.add(fineGrid);

    const launchRing = new THREE.Mesh(
      new THREE.RingGeometry(.21, .215, 72),
      new THREE.MeshBasicMaterial({ color: '#cf714d', transparent: true, opacity: .44, side: THREE.DoubleSide }),
    );
    launchRing.rotation.x = -Math.PI / 2;
    launchRing.position.y = -.020;
    this.world.add(launchRing);
    const originCross = lineSegments([
      new THREE.Vector3(-.30, -.019, 0), new THREE.Vector3(.30, -.019, 0),
      new THREE.Vector3(0, -.019, -.30), new THREE.Vector3(0, -.019, .30),
    ], '#c77354', .32);
    this.world.add(originCross);

    const ambient = new THREE.HemisphereLight('#e8e7da', '#26313a', 2.0);
    this.scene.add(ambient);
    this.keyLight.position.set(5, 11, 5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.left = -12;
    this.keyLight.shadow.camera.right = 12;
    this.keyLight.shadow.camera.top = 12;
    this.keyLight.shadow.camera.bottom = -12;
    this.keyLight.shadow.camera.near = .5;
    this.keyLight.shadow.camera.far = 90;
    this.keyLight.shadow.normalBias = .01;
    this.keyLight.shadow.bias = -.00015;
    this.keyLight.shadow.radius = 3;
    this.scene.add(this.keyLight, this.keyLight.target);

    const rim = new THREE.DirectionalLight('#a8c3ce', 1.45);
    rim.position.set(-3, 5, -7);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight('#f6d3b8', .45);
    fill.position.set(3, 2, -1);
    this.scene.add(fill);
  }

  setDesign(design: PlaneDesign): void {
    if (this.destroyed) return;
    this.currentDesign = design;
    this.clearPrimary();
    this.clearComparison();
    if (this.displayPlane) {
      this.scene.remove(this.displayPlane);
      disposeObject(this.displayPlane);
    }
    this.displayPlane = createPlaneModel(design);
    this.displayPlane.position.set(0, PAPER_HEIGHT, 0);
    this.scene.add(this.displayPlane);
    this.focus.copy(this.displayPlane.position);
    this.seconds = 0;
    this.clearMeasurements();
    this.reset();
  }

  setFlight(result: FlightResult): void {
    if (this.destroyed) return;
    this.clearPrimary();
    this.clearComparison();
    const design = this.findDesign(result.designId);
    if (!design) return;
    this.currentDesign = design;
    if (this.displayPlane) this.displayPlane.visible = false;
    this.primary = this.createFlightView(result, design);
    this.flightLayer.add(this.primary.group);
    this.seconds = 0;
    this.updateView(this.primary, 0);
    this.focus.copy(this.primary.position);
    this.updateMeasurements(result.distance, result.maxHeight);
    this.placeCameraAtLaunch();
  }

  setTime(seconds: number): void {
    if (this.destroyed) return;
    this.seconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    if (this.primary) this.updateView(this.primary, this.seconds);
    for (const view of this.comparisons) this.updateView(view, this.seconds);
    if (this.primary) this.focus.copy(this.primary.position);
    else if (this.displayPlane) this.focus.copy(this.displayPlane.position);
  }

  setComparison(results: FlightResult[] | null): void {
    if (this.destroyed) return;
    this.clearComparison();
    if (!results?.length) {
      this.flightLayer.visible = true;
      if (this.displayPlane) this.displayPlane.visible = !this.primary;
      if (this.primary) this.updateMeasurements(this.primary.result.distance, this.primary.result.maxHeight);
      if (this.primary) this.placeCameraAtLaunch();
      else this.reset();
      return;
    }
    this.flightLayer.visible = false;
    if (this.displayPlane) this.displayPlane.visible = false;
    this.comparisonBounds.makeEmpty();
    for (const result of results) {
      const design = this.findDesign(result.designId);
      if (!design || !result.samples.length) continue;
      const view = this.createFlightView(result, design);
      this.comparisonLayer.add(view.group);
      this.comparisons.push(view);
      this.updateView(view, this.seconds);
      for (const sample of result.samples) this.comparisonBounds.expandByPoint(new THREE.Vector3(sample.x, sample.y, sample.z));
    }
    if (!this.comparisons.length) return;
    this.comparisonBounds.getCenter(this.comparisonCenter);
    const size = this.comparisonBounds.getSize(new THREE.Vector3());
    this.comparisonRadius = Math.max(4, size.length() / 2);
    this.updateMeasurements(
      Math.max(...results.map((result) => result.distance)),
      Math.max(...results.map((result) => result.maxHeight)),
    );
    this.fitComparisonCamera();
  }

  setCamera(mode: CameraMode): void {
    if (this.destroyed || !this.controls) return;
    this.cameraMode = mode;
    this.controls.enabled = mode === 'orbit';
    if (this.comparisons.length) {
      this.fitComparisonCamera();
    } else if (mode === 'orbit') {
      this.controls.target.copy(this.focus);
      this.controls.update();
    } else if (mode === 'top') {
      this.camera.position.copy(this.focus).add(new THREE.Vector3(.01, this.primary ? 11 : 3.2, .01));
      this.controls.target.copy(this.focus);
      this.camera.lookAt(this.focus);
    } else {
      this.camera.position.copy(this.focus).add(new THREE.Vector3(-2.3, 1.35, 2.9));
      this.controls.target.copy(this.focus);
      this.camera.lookAt(this.focus);
    }
  }

  reset(): void {
    if (this.destroyed || !this.controls) return;
    if (this.comparisons.length) {
      this.fitComparisonCamera();
      return;
    }
    if (this.primary) {
      this.placeCameraAtLaunch();
      return;
    }
    this.focus.set(0, PAPER_HEIGHT, 0);
    if (this.cameraMode === 'top') this.camera.position.set(.01, 3.8, .01);
    else if (this.cameraMode === 'follow') this.camera.position.set(-1.15, 1.30, 1.28);
    else this.camera.position.set(1.28, 1.65, 1.35);
    this.controls.target.copy(this.focus);
    this.camera.lookAt(this.focus);
    this.controls.update();
  }

  resize(): void {
    if (this.destroyed || !this.renderer) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.controls = null;
    disposeObject(this.scene);
    this.scene.clear();
    this.keyLight.shadow.dispose();
    if (this.renderer) {
      const canvas = this.renderer.domElement;
      canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
      this.renderer.renderLists.dispose();
      this.renderer.dispose();
      canvas.remove();
      this.renderer = null;
    }
  }

  private findDesign(id: string): PlaneDesign | null {
    try { return getDesign(id); }
    catch { return this.currentDesign; }
  }

  private createFlightView(result: FlightResult, design: PlaneDesign): FlightView {
    const group = new THREE.Group();
    group.name = `flight-${result.designId}`;
    const plane = createPlaneModel(design);
    group.add(plane);
    const positions = new Float32Array(Math.max(result.samples.length, 2) * 3);
    for (let i = 0; i < result.samples.length; i++) {
      const sample = result.samples[i];
      positions.set([sample.x, Math.max(.012, sample.y), sample.z], i * 3);
    }
    const ghostGeometry = new THREE.BufferGeometry();
    ghostGeometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
    const ghost = new THREE.Line(ghostGeometry, new THREE.LineDashedMaterial({
      color: design.color, transparent: true, opacity: .21, dashSize: .17, gapSize: .15,
      depthWrite: false,
    }));
    ghost.computeLineDistances();
    group.add(ghost);
    const progressGeometry = new THREE.BufferGeometry();
    progressGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    progressGeometry.setDrawRange(0, 0);
    const line = new THREE.Line(progressGeometry, new THREE.LineBasicMaterial({
      color: design.color, transparent: true, opacity: .92, depthWrite: false,
    }));
    line.frustumCulled = false;
    group.add(line);

    const last = result.samples[result.samples.length - 1];
    if (last) {
      const landingRing = new THREE.Mesh(
        new THREE.RingGeometry(.16, .18, 48),
        new THREE.MeshBasicMaterial({ color: design.color, transparent: true, opacity: .42, side: THREE.DoubleSide, depthWrite: false }),
      );
      landingRing.rotation.x = -Math.PI / 2;
      landingRing.position.set(last.x, -.018, last.z);
      group.add(landingRing);
      const endpoint = new THREE.Mesh(
        new THREE.SphereGeometry(.025, 10, 8),
        new THREE.MeshBasicMaterial({ color: design.color, transparent: true, opacity: .45 }),
      );
      endpoint.position.set(last.x, Math.max(.012, last.y), last.z);
      group.add(endpoint);
    }
    return { result, group, plane, line, positions, cursor: 0, overwrittenIndex: -1, position: new THREE.Vector3() };
  }

  private updateView(view: FlightView, seconds: number): void {
    const interpolated = atTime(view.result.samples, seconds);
    if (!interpolated) { view.plane.visible = false; return; }
    const { sample, upper } = interpolated;
    view.position.set(sample.x, Math.max(.045, sample.y), sample.z);
    view.plane.position.copy(view.position);
    const yaw = Math.atan2(-sample.vz, sample.vx);
    // Local bank around +X, local nose pitch around +Z, then heading around Y.
    const heading = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, yaw);
    const attitude = new THREE.Quaternion().setFromEuler(new THREE.Euler(sample.roll, 0, sample.pitch, 'ZXY'));
    view.plane.quaternion.copy(heading).multiply(attitude);
    if (sample.y <= .045 && seconds >= view.result.duration) {
      view.plane.position.y = .065;
      view.plane.rotation.x *= .3;
      view.plane.rotation.z *= .25;
    }
    if (view.overwrittenIndex >= 0) {
      const original = view.result.samples[view.overwrittenIndex];
      view.positions.set([original.x, Math.max(.012, original.y), original.z], view.overwrittenIndex * 3);
    }
    view.positions.set([sample.x, Math.max(.012, sample.y), sample.z], upper * 3);
    view.overwrittenIndex = upper;
    view.cursor = upper;
    (view.line.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    view.line.geometry.setDrawRange(0, upper + 1);
  }

  private clearPrimary(): void {
    if (this.primary) {
      this.flightLayer.remove(this.primary.group);
      disposeObject(this.primary.group);
      this.primary = null;
    }
    this.flightLayer.visible = true;
  }

  private clearComparison(): void {
    for (const view of this.comparisons) {
      this.comparisonLayer.remove(view.group);
      disposeObject(view.group);
    }
    this.comparisons = [];
  }

  private clearMeasurements(): void {
    disposeObject(this.measuring);
    this.measuring.clear();
    this.lastMeasureLength = 0;
    this.lastMeasureHeight = 0;
  }

  private updateMeasurements(distance: number, height: number): void {
    const length = Math.max(10, Math.ceil(Math.min(distance || 10, 200) / 5) * 5);
    const ceiling = Math.max(2, Math.ceil(Math.min(height || 2, 24)));
    if (length === this.lastMeasureLength && ceiling === this.lastMeasureHeight) return;
    this.clearMeasurements();
    this.lastMeasureLength = length;
    this.lastMeasureHeight = ceiling;
    const points: THREE.Vector3[] = [];
    const step = length > 80 ? 10 : 5;
    points.push(new THREE.Vector3(0, -.017, -.72), new THREE.Vector3(length, -.017, -.72));
    for (let x = 0; x <= length; x += step) {
      points.push(new THREE.Vector3(x, -.016, -.57), new THREE.Vector3(x, -.016, -.88));
      const label = textSprite(`${x} m`);
      label.position.set(x, .12, -1.18);
      label.scale.multiplyScalar(.63);
      this.measuring.add(label);
    }
    this.measuring.add(lineSegments(points, '#667982', .29));

    const heightPoints = [new THREE.Vector3(-.8, 0, -1.1), new THREE.Vector3(-.8, ceiling, -1.1)];
    for (let y = 0; y <= ceiling; y++) {
      heightPoints.push(new THREE.Vector3(-.92, y, -1.1), new THREE.Vector3(-.68, y, -1.1));
      if (y > 0) {
        const label = textSprite(`${y} m`, '#728992');
        label.position.set(-1.25, y, -1.1);
        label.scale.multiplyScalar(.42);
        this.measuring.add(label);
      }
    }
    this.measuring.add(lineSegments(heightPoints, '#59717b', .21));
  }

  private placeCameraAtLaunch(): void {
    if (!this.controls) return;
    if (this.primary) this.focus.copy(this.primary.position);
    if (this.cameraMode === 'top') {
      this.camera.position.copy(this.focus).add(new THREE.Vector3(.01, 10, .01));
    } else {
      this.camera.position.copy(this.focus).add(new THREE.Vector3(this.cameraMode === 'follow' ? -2.3 : 2.4, 1.6, 3.1));
    }
    this.controls.target.copy(this.focus);
    this.camera.lookAt(this.focus);
    this.controls.update();
  }

  private fitComparisonCamera(): void {
    if (!this.controls || !this.comparisons.length) return;
    const radius = this.comparisonRadius;
    const aspect = this.camera.aspect;
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) / Math.min(aspect, 1) * .92;
    this.controls.target.copy(this.comparisonCenter);
    if (this.cameraMode === 'top') {
      this.camera.position.copy(this.comparisonCenter).add(new THREE.Vector3(.01, distance, .01));
    } else {
      const direction = new THREE.Vector3(-.26, .70, 1).normalize();
      this.camera.position.copy(this.comparisonCenter).addScaledVector(direction, distance);
    }
    this.camera.lookAt(this.comparisonCenter);
    this.controls.update();
  }

  private animate = (milliseconds: number): void => {
    if (this.destroyed) return;
    this.frame = requestAnimationFrame(this.animate);
    if (!this.renderer || this.contextLost) return;
    const elapsed = milliseconds / 1000;
    const delta = this.previousFrame ? Math.min((milliseconds - this.previousFrame) / 1000, .1) : 1 / 60;
    this.previousFrame = milliseconds;
    if (!this.primary && !this.comparisons.length && this.displayPlane) {
      this.displayPlane.position.y = PAPER_HEIGHT + Math.sin(elapsed * .9) * .012;
      this.displayPlane.rotation.set(Math.sin(elapsed * .5) * .035, 0, .075 + Math.sin(elapsed * .6) * .015);
      this.focus.copy(this.displayPlane.position);
    }
    const shadowFocus = this.comparisons.length ? this.comparisonCenter : this.focus;
    this.keyLight.target.position.copy(shadowFocus);
    this.keyLight.target.position.y = 0;
    this.keyLight.position.copy(shadowFocus).add(new THREE.Vector3(5 + Math.sin(elapsed * .11) * .3, 12, 5));

    if (!this.comparisons.length && this.cameraMode !== 'orbit') {
      if (this.cameraMode === 'follow') {
        this.cameraGoal.copy(this.focus).add(new THREE.Vector3(this.primary ? -2.3 : -1.15, this.primary ? 1.35 : .65, this.primary ? 2.9 : 1.28));
        this.targetGoal.copy(this.focus);
        if (this.primary) this.targetGoal.x += .45;
      } else {
        this.cameraGoal.copy(this.focus).add(new THREE.Vector3(.01, this.primary ? 10 : 3.2, .01));
        this.targetGoal.copy(this.focus);
      }
      const smoothing = 1 - Math.exp(-delta * 5);
      this.camera.position.lerp(this.cameraGoal, smoothing);
      if (this.controls) this.controls.target.lerp(this.targetGoal, smoothing);
      this.camera.lookAt(this.controls?.target ?? this.targetGoal);
    }
    if (this.cameraMode === 'orbit') this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  };

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.onError?.('The 3D view lost its graphics context. Flight results and controls remain available.');
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
    this.previousFrame = 0;
    this.resize();
    this.onError?.('');
  };
}
