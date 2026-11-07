import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPuddingWalk, WALK_STRIDE} from '../src/pudding-walk.js';
import {loadPuddingModel, bone} from './helpers/pudding-model.js';
import {step} from '../src/physics.js';

const feet = ['DEF-front_toe.L', 'DEF-toe.L', 'DEF-front_toe.R', 'DEF-toe.R'];
const pose = model => {
  const result = [];
  const body = model.getObjectByName('PuddingGaitBody');
  if (body) result.push(...body.position, ...body.quaternion, ...body.scale);
  model.traverse(o => {if (o.isBone) result.push(...o.position, ...o.quaternion, ...o.scale);});
  return result;
};
const point = (model, name) => model.worldToLocal(bone(model, name).getWorldPosition(new THREE.Vector3()));
function advance(walk, seconds, options) {
  for (let i = 0; i < Math.round(seconds * 120); i++) walk.update(1 / 120, options);
}

test('actual GLB deforms all four feet and remains above the standing foot plane through a cycle', async () => {
  const model = await loadPuddingModel();
  model.updateMatrixWorld(true);
  const rest = feet.map(n => point(model, n));
  const walk = createPuddingWalk(model);
  const ranges = feet.map(() => ({forward: [], height: [], lowReach: []}));
  for (let frame = 0; frame < 240; frame++) {
    walk.update(1 / 120, {distance: WALK_STRIDE / 120, grounded: true});
    feet.forEach((name, i) => {
      const foot = point(model, name);
      ranges[i].forward.push(foot.z - rest[i].z); ranges[i].height.push(foot.y - rest[i].y);
      if (foot.y - rest[i].y < .04) ranges[i].lowReach.push(foot.z - rest[i].z);
      assert(foot.y >= rest[i].y - .003, `${name} must not stomp below the rest ground plane`);
    });
  }
  for (const range of ranges) {
    assert(Math.max(...range.forward) - Math.min(...range.forward) > .48,
      'Each paw must reach ahead and push behind, rather than only marching vertically');
    assert(Math.max(...range.lowReach) > .24, 'Paws should stay extended forward as they lower to contact');
    assert(Math.max(...range.height) > .10, 'Each foot must clearly lift during its own swing');
  }
  assert.notDeepEqual(ranges[0].height, ranges[2].height, 'Left and right front feet must alternate');
});

test('walk changes weighted mesh vertices without changing the source mesh or facial expressions', async () => {
  const model = await loadPuddingModel();
  const walk = createPuddingWalk(model);
  const mesh = model.getObjectByProperty('isSkinnedMesh', true);
  model.updateMatrixWorld(true); mesh.skeleton.update();
  const geometry = mesh.geometry.attributes.position.array.slice();
  const morphs = mesh.morphTargetInfluences.slice();
  const vertices = [];
  for (let i = 0; i < mesh.geometry.attributes.position.count; i += 11) vertices.push(mesh.getVertexPosition(i, new THREE.Vector3()).clone());
  advance(walk, .31, {distance: 4.2 / 120, grounded: true});
  model.updateMatrixWorld(true); mesh.skeleton.update();
  let changed = 0;
  for (let i = 0, n = 0; i < mesh.geometry.attributes.position.count; i += 11, n++) {
    if (vertices[n].distanceTo(mesh.getVertexPosition(i, new THREE.Vector3())) > .01) changed++;
  }
  assert(changed > 10, 'Animation must deform the skin, not just move unweighted controls');
  assert.deepEqual(mesh.geometry.attributes.position.array, geometry);
  assert.deepEqual(mesh.morphTargetInfluences, morphs);
});

test('stopping, landing recovery and reset restore the complete starting skeleton', async () => {
  const model = await loadPuddingModel(), walk = createPuddingWalk(model), rest = pose(model);
  advance(walk, .4, {distance: 4.2 / 120}); assert.notDeepEqual(pose(model), rest);
  advance(walk, 1, {distance: 0}); assert.deepEqual(pose(model), rest);
  advance(walk, .4, {distance: 4.2 / 120});
  advance(walk, .3, {distance: 4.2 / 120, grounded: false, verticalVelocity: 4});
  assert.notDeepEqual(pose(model), rest);
  advance(walk, 1, {grounded: true, landedSpeed: 0}); assert.deepEqual(pose(model), rest);
  advance(walk, .4, {distance: 4.2 / 120}); walk.reset(); assert.deepEqual(pose(model), rest);
});

test('dialogue/demo pause freezes the pose and resuming does not accumulate paused time', async () => {
  const model = await loadPuddingModel(), walk = createPuddingWalk(model);
  advance(walk, .3, {distance: 4.2 / 120}); const pausedPose = pose(model);
  advance(walk, 5, {distance: 100, paused: true}); assert.deepEqual(pose(model), pausedPose);
  walk.update(1 / 120, {distance: 4.2 / 120}); assert.notDeepEqual(pose(model), pausedPose);
});

test('facing and model scale do not change the gait in character coordinates', async () => {
  const model = await loadPuddingModel(), actor = new THREE.Group(); actor.add(model);
  const walk = createPuddingWalk(model);
  advance(walk, .3, {distance: 4.2 / 120}); const first = feet.map(n => point(model, n));
  const firstTail = point(model, 'DEF-spine');
  walk.reset(); actor.rotation.y = -Math.PI / 2; model.scale.setScalar(.32); model.position.set(.7, -.4, 2);
  advance(walk, .3, {distance: 4.2 / 120});
  feet.forEach((n, i) => assert(point(model, n).distanceTo(first[i]) < 1e-5));
  assert(point(model, 'DEF-spine').distanceTo(firstTail) < 1e-5);
});

test('holding movement against a real physics crate stops stepping when actual travel stops', async () => {
  const model = await loadPuddingModel(), walk = createPuddingWalk(model), rest = pose(model);
  const player = {x: -.3, y: 0, vy: 0, grounded: true};
  for (let i = 0; i < 360; i++) {
    const before = player.x; step(player, 1, false, 1 / 120);
    walk.update(1 / 120, {distance: Math.abs(player.x - before), grounded: player.grounded});
  }
  assert(Math.abs(player.x - .19) < 1e-6); assert.deepEqual(pose(model), rest);
});

test('tail curls upward at rest, sways from its attached root when walking, and settles into its raised pose', async () => {
  const model = await loadPuddingModel(); model.updateMatrixWorld(true);
  const originalTip = point(model, 'DEF-spine');
  const originalRoot = point(model, 'MCH-ROT-tail');
  const walk = createPuddingWalk(model);
  const raisedTip = point(model, 'DEF-spine');
  assert(raisedTip.y > originalTip.y + .15, 'Tail tip should be visibly higher than the source straight tail');
  assert(raisedTip.y > originalRoot.y, 'Tail should finish above its base');
  const resting = pose(model), sideways = [];
  for (let i = 0; i < 240; i++) {
    walk.update(1 / 120, {distance: WALK_STRIDE / 120});
    const tip = point(model, 'DEF-spine'); sideways.push(tip.x);
    assert(tip.y > originalRoot.y, 'Walking should retain the upward curl');
    const body = model.getObjectByName('PuddingGaitBody');
    const attached = originalRoot.clone().applyMatrix4(body.matrix);
    assert(point(model, 'MCH-ROT-tail').distanceTo(attached) < 1e-6, 'Tail base must follow the body without detaching');
  }
  assert(Math.max(...sideways) - Math.min(...sideways) > .15, 'Tail should swing in both directions');
  advance(walk, 1, {distance: 0}); assert.deepEqual(pose(model), resting);
  walk.reset(); assert.deepEqual(pose(model), resting);
});

test('tail has opposing bends along its length throughout a full traveling S-wave cycle', async () => {
  const model = await loadPuddingModel(), walk = createPuddingWalk(model);
  const body = model.getObjectByName('PuddingGaitBody');
  const names = ['MCH-ROT-tail', 'DEF-spine.003', 'DEF-spine.002', 'DEF-spine.001', 'DEF-spine'];
  const points = () => names.map(n => body.worldToLocal(bone(model, n).getWorldPosition(new THREE.Vector3())));
  const rest = points(), lengths = rest.slice(1).map((p, i) => p.distanceTo(rest[i]));
  advance(walk, 1, {distance: WALK_STRIDE / 120});
  for (let frame = 0; frame < 120; frame++) {
    walk.update(1 / 120, {distance: WALK_STRIDE / 120});
    const p = points(), bends = [];
    for (let i = 1; i < p.length - 1; i++) {
      const a = p[i].clone().sub(p[i - 1]), b = p[i + 1].clone().sub(p[i]);
      bends.push(a.x * b.z - a.z * b.x);
    }
    assert(Math.min(...bends) < -.001 && Math.max(...bends) > .001, 'Tail must bend both ways, rather than swing as a rigid rod');
    for (let i = 1; i < p.length; i++) assert(Math.abs(p[i].distanceTo(p[i - 1]) - lengths[i - 1]) < 1e-5, 'Tail segments must not stretch');
  }
});

test('body bobs and sways with the gait while stance feet stay planted and actor placement is unchanged', async () => {
  const model = await loadPuddingModel(); model.updateMatrixWorld(true);
  const restFeet = feet.map(n => point(model, n)), placement = [...model.position, ...model.quaternion, ...model.scale];
  const walk = createPuddingWalk(model), body = model.getObjectByName('PuddingGaitBody');
  const heights = [], rolls = [], headHeights = [];
  for (let frame = 0; frame < 360; frame++) {
    walk.update(1 / 120, {distance: WALK_STRIDE / 120});
    if (frame < 120) continue;
    heights.push(body.position.y); rolls.push(new THREE.Euler().setFromQuaternion(body.quaternion).z);
    headHeights.push(point(model, 'DEF-spine.011').y);
    const cycle = ((frame + 1) / 120) % 1;
    feet.forEach((name, i) => {
      if ((cycle + i * .25) % 1 < .62) {
        assert(Math.abs(point(model, name).y - restFeet[i].y) < .0001, 'Body motion must not make stance feet hover or penetrate the stage');
      }
    });
    assert.deepEqual([...model.position, ...model.quaternion, ...model.scale], placement);
  }
  assert(Math.max(...heights) - Math.min(...heights) > .015);
  assert(Math.max(...rolls) > .02 && Math.min(...rolls) < -.02);
  assert(Math.max(...headHeights) - Math.min(...headHeights) > .01, 'Body/head should visibly follow the gait');
  advance(walk, 1, {distance: 0});
  assert.deepEqual(body.position.toArray(), [0, 0, 0]);
  assert.deepEqual(body.quaternion.toArray(), [0, 0, 0, 1]);
});

test('idle tail sways before sitting and moving restores a standing gait', async () => {
  const model=await loadPuddingModel();
  const walk=createPuddingWalk(model,{idle:true});
  const body=model.getObjectByName('PuddingGaitBody');
  advance(walk,.4,{});
  const joint=bone(model,'DEF-spine.001');
  const tail=joint.quaternion.clone();
  advance(walk,.25,{});
  assert.ok(tail.angleTo(joint.quaternion)>.01);
  assert.ok(Math.abs(body.position.y)<1e-6);
  const paws=['DEF-foot.L','DEF-foot.R'];
  const standing=paws.map(name=>Math.abs(point(model,name).x));
  const frontZ=point(model,'DEF-front_foot.L').z;
  advance(walk,2.2,{});
  paws.forEach((name,i)=>assert.ok(Math.abs(point(model,name).x)>standing[i]+.25));
  assert.ok(new THREE.Euler().setFromQuaternion(body.quaternion).x<-.3);
  assert.ok(point(model,'DEF-front_foot.L').z<frontZ-.08);
  assert.equal(walk.seated,true);
  const seated=body.position.y;
  assert.ok(seated<-.1);
  advance(walk,.6,{distance:.03});
  assert.equal(walk.seated,false);
  assert.ok(body.position.y>seated/2);
});
