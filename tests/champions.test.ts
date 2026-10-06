import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BufferGeometry, Mesh } from 'three';
import { DESIGNS, getDesign } from '../src/lib/designs.ts';
import { FOLD_GUIDES, getFoldGuide } from '../src/lib/folds/index.ts';
import { createPlaneModel, disposeObject } from '../src/lib/planeMesh.ts';
import { DEFAULT_SETTINGS, simulateFlight } from '../src/lib/physics.ts';

test('three documented champions retain distinct achievement categories and sourced folding methods', () => {
  assert.equal(DESIGNS.length, 11);
  const champions = DESIGNS.filter(design => design.achievement);
  assert.deepEqual(champions.map(design => design.id), ['suzanne', 'sky-king', 'krstic-dart']);
  assert.deepEqual(champions.map(design => [design.achievement!.status, design.achievement!.metric, design.achievement!.value]), [
    ['former-world-record', 'distance', 69.14],
    ['former-world-record', 'duration', 27.9],
    ['world-final-winner', 'distance', 61.11],
  ]);
  assert.equal(new Set(champions.map(design => design.shape)).size, 3);
  const expected = new Map([
    ['suzanne', { date: '2012-02-26', names: ['John M. Collins', 'Joe Ayoob'] }],
    ['sky-king', { date: '2009-04', names: ['Takuo Toda'] }],
    ['krstic-dart', { date: '2022-05-14', names: ['Lazar Krstić'] }],
  ]);
  for (const design of champions) {
    const result = design.achievement!;
    assert.match(new URL(result.sourceUrl).hostname, /^www\.guinnessworldrecords\.(com|jp)$/);
    assert.equal(new URL(result.designSourceUrl).protocol, 'https:');
    assert.match(result.date, /^\d{4}-\d{2}(-\d{2})?$/);
    assert.equal(result.date, expected.get(design.id)!.date);
    assert.equal(result.unit, result.metric === 'duration' ? 's' : 'm');
    for (const name of expected.get(design.id)!.names) assert.ok(result.credit.includes(name));
    assert.ok(result.credit.length > 15);
    assert.match(design.modelNotes!, /schematic/i);
    assert.equal(design.mass, getDesign('classic-dart').mass, 'standardized paper mass');
  }
});

test('champion provenance cannot change an airframe flight prediction', () => {
  for (const design of DESIGNS.filter(design => design.achievement)) {
    const stripped = { ...design, achievement: undefined, modelNotes: undefined };
    assert.deepEqual(simulateFlight(design, DEFAULT_SETTINGS), simulateFlight(stripped, DEFAULT_SETTINGS));
  }
});

test('every catalogue entry has a complete matching illustrated guide', () => {
  assert.equal(FOLD_GUIDES.length, DESIGNS.length);
  assert.equal(new Set(FOLD_GUIDES.map(guide => guide.id)).size, FOLD_GUIDES.length);
  for (const design of DESIGNS) {
    const guide = getFoldGuide(design.id);
    assert.ok(guide.steps.length >= 6);
    if (design.achievement) assert.deepEqual(design.foldSteps, guide.steps.map(step => step.instruction));
    for (const step of guide.steps) {
      assert.ok(step.title && step.instruction.length > 15);
      assert.ok(step.before.shapes.length && step.after.shapes.length);
      assert.notDeepEqual(step.before, step.after, `${design.name}: ${step.title} changes the sheet or viewing pose`);
    }
  }
});

test('new folded meshes preserve physical size, finite geometry and distinct planforms', () => {
  const bounds: number[][] = [];
  for (const design of DESIGNS.filter(design => design.achievement)) {
    const plane = createPlaneModel(design);
    plane.updateMatrixWorld(true);
    const box = new Box3().setFromObject(plane);
    assert.ok(Math.abs(box.max.x - box.min.x - 3 * design.length) < 1e-6);
    assert.ok(Math.abs(box.max.z - box.min.z - 3 * design.span) < 1e-6);
    assert.ok(box.max.y - box.min.y < 3 * design.length / 2);
    bounds.push([box.max.x - box.min.x, box.max.z - box.min.z]);
    plane.traverse(object => {
      if (!(object instanceof Mesh) || !(object.geometry instanceof BufferGeometry)) return;
      const position = object.geometry.getAttribute('position');
      assert.ok([...position.array].every(Number.isFinite));
    });
    disposeObject(plane);
  }
  assert.equal(new Set(bounds.map(value => JSON.stringify(value))).size, 3);
});
