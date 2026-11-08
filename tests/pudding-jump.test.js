import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPuddingJump, LANDING_SECONDS} from '../src/pudding-jump.js';
import {createPuddingWalk} from '../src/pudding-walk.js';
import {loadPuddingModel, bone} from './helpers/pudding-model.js';
import {step} from '../src/physics.js';

const dt = 1 / 120;
const footNames = ['DEF-front_toe.L', 'DEF-toe.L', 'DEF-front_toe.R', 'DEF-toe.R'];
const point = (model, name) => model.worldToLocal(bone(model, name).getWorldPosition(new THREE.Vector3()));
function tick(jump, n, state) {let pose; for (let i = 0; i < n; i++) pose = jump.update(dt, state); return pose;}

test('spawn placement has no phantom jump or landing, then velocity drives rise, apex, fall and finite landing recovery', () => {
  const jump = createPuddingJump();
  assert.equal(tick(jump, 4, {grounded: false, verticalVelocity: -1}).active, false);
  assert.equal(jump.update(dt, {grounded: true}).landing, 0);
  const launch = jump.update(dt, {grounded: false, verticalVelocity: 8, takeoff: true});
  assert.equal(launch.phase, 'rising'); assert(launch.launch > 0);
  const rising = tick(jump, 20, {grounded: false, verticalVelocity: 4});
  assert(rising.pitch < -.15 && rising.hindStretch > .9);
  const apex = tick(jump, 15, {grounded: false, verticalVelocity: 0});
  assert.equal(apex.phase, 'apex'); assert(apex.tuck > rising.tuck);
  const falling = tick(jump, 20, {grounded: false, verticalVelocity: -6});
  assert.equal(falling.phase, 'falling'); assert(falling.reach > .9); assert(falling.tuck < apex.tuck);
  assert(falling.pitch > .35 && falling.hindStretch > .65);
  const landing = jump.update(dt, {grounded: true, landedSpeed: 6});
  assert.equal(landing.phase, 'landing'); assert(landing.landing > 0);
  assert.equal(tick(jump, 120, {grounded: true}).active, false);
});

test('walking off a ledge reaches down without playing a false upward launch', () => {
  const jump = createPuddingJump(); jump.update(dt, {grounded: true});
  const fall = jump.update(dt, {grounded: false, verticalVelocity: -.2});
  assert.equal(fall.phase, 'falling'); assert.equal(fall.launch, 0);
  const fastFall = tick(jump, 35, {grounded: false, verticalVelocity: -7});
  assert(fastFall.reach > .99); assert(fastFall.tuck < .02); assert(fastFall.pitch > 0);
});

test('a higher drop produces stronger but bounded landing compression and never repeats the impact', () => {
  function impact(speed) {
    const jump = createPuddingJump(); jump.update(dt, {grounded: true});
    tick(jump, 30, {grounded: false, verticalVelocity: -speed});
    let maximum = jump.update(dt, {grounded: true, landedSpeed: speed}).landing;
    for (let i = 0; i < Math.ceil(LANDING_SECONDS / dt); i++) {
      const p = jump.update(dt, {grounded: true}); maximum = Math.max(maximum, p.landing);
      assert(p.landing >= 0 && p.landing <= 1);
    }
    assert.equal(tick(jump, 120, {grounded: true}).landing, 0);
    return maximum;
  }
  assert(impact(10) > impact(3) * 2);
});

test('pause freezes airborne timing and reset clears an unfinished jump or landing', () => {
  const jump = createPuddingJump(); jump.update(dt, {grounded: true});
  const pose = tick(jump, 15, {grounded: false, verticalVelocity: 5});
  assert.deepEqual(tick(jump, 300, {grounded: false, verticalVelocity: -12, paused: true}), pose);
  jump.reset(); assert.equal(jump.update(dt, {grounded: true}).active, false);
  tick(jump, 20, {grounded: false, verticalVelocity: -6});
  assert(jump.update(dt, {grounded: true}).landing > 0);
  jump.reset(); assert.equal(jump.update(dt, {grounded: true}).active, false);
});

async function trajectory({start, jumpOnFirst = true, moveSteps = 40, frames = 180}) {
  const model = await loadPuddingModel(), animation = createPuddingWalk(model), motion = createPuddingJump();
  const player = {...start, vy: 0, grounded: true};
  animation.update(dt, player); motion.update(dt, player);
  const feet = footNames.map(n => point(model, n));
  const placement = [...model.position, ...model.quaternion, ...model.scale];
  const body = model.getObjectByName('PuddingGaitBody');
  const record = [];
  for (let i = 0; i < frames; i++) {
    const x = player.x, wasGrounded = player.grounded, previousVy = player.vy;
    assert.equal(step(player, i < moveSteps ? 1 : 0, i === 0 && jumpOnFirst, dt), false);
    const state = {grounded: player.grounded, verticalVelocity: player.vy,
      distance: Math.abs(player.x - x), takeoff: i === 0 && jumpOnFirst && !player.grounded,
      landedSpeed: !wasGrounded && player.grounded ? Math.max(0, -previousVy) : 0};
    const pose = motion.update(dt, state); animation.update(dt, state);
    assert.deepEqual([...model.position, ...model.quaternion, ...model.scale], placement);
    const footHeights = footNames.map((n, k) => point(model, n).y - feet[k].y);
    const frontForward = [0, 2].map(k => body.worldToLocal(bone(model, footNames[k]).getWorldPosition(new THREE.Vector3())).z - feet[k].z);
    const hindBack = [1, 3].map(k => body.worldToLocal(bone(model, footNames[k]).getWorldPosition(new THREE.Vector3())).z - feet[k].z);
    record.push({player: {...player}, pose, footHeights, bodyY: body.position.y,
      frontForward, hindBack, pitch: new THREE.Euler().setFromQuaternion(body.quaternion).x});
  }
  return {model, animation, record};
}

test('actual low-platform jump reaches both forefeet forward, stretches hind legs back, cushions and recovers', async () => {
  const {record} = await trajectory({start: {x: -.3, y: 0}, moveSteps: 40});
  assert(record.some(r => r.pose.phase === 'rising' && r.pitch < -.20));
  const apex = record.find(r => r.pose.phase === 'apex'); assert(apex);
  assert([0, 2].every(i => apex.footHeights[i] > .10), 'Forefeet should tuck above their standing height');
  assert(record.some(r => r.pose.phase === 'rising' && r.frontForward.every(z => z > .20)));
  assert(apex.frontForward.every(z => z > .35), 'Both forefeet should reach forward relative to the torso at the apex');
  assert(record.some(r => r.pose.phase === 'falling' && r.frontForward.every(z => z > .15)));
  assert(apex.hindBack.every(z => z < -.40), 'Both hind paws must trail behind the torso rather than tuck underneath');
  assert(record.some(r => r.pose.phase === 'falling' && r.pitch > .20 && r.hindBack.every(z => z < -.25)));
  const land = record.findIndex(r => r.pose.phase === 'landing'); assert(land > 0);
  assert.equal(record[land].player.y, .7);
  assert(Math.min(...record.slice(land, land + 25).map(r => r.bodyY)) < -.07);
  assert(record.slice(land, land + 25).every(r => r.footHeights.every(h => h > -.005)));
  assert.equal(record.at(-1).pose.active, false); assert.equal(record.at(-1).bodyY, 0);
  assert(record.at(-1).hindBack.every(z => Math.abs(z) < 1e-6));
});

test('actual higher-platform jump follows physical contact and does not squash before reaching the platform', async () => {
  const {record} = await trajectory({start: {x: 2.8, y: 0}, moveSteps: 42});
  assert.equal(record.at(-1).player.y, 1.3);
  assert(record.filter(r => !r.player.grounded).every(r => r.pose.landing === 0));
  assert(record.some(r => r.pose.phase === 'landing' && r.player.grounded && r.player.y === 1.3));
});

test('actual step-off and downward jump both reach the lower floor and play one landing', async () => {
  for (const jumpOnFirst of [false, true]) {
    const {record} = await trajectory({start: {x: -6, y: .7}, jumpOnFirst, moveSteps: 55});
    const airborne = record.filter(r => !r.player.grounded);
    assert(airborne.length > 10);
    assert(airborne.some(r => r.pitch > .20 && r.hindBack.every(z => z < -.25)));
    if (!jumpOnFirst) assert(airborne.every(r => r.pose.phase === 'falling'));
    assert.equal(record.at(-1).player.y, 0);
    const contacts = record.filter((r, i) => r.pose.phase === 'landing' && record[i - 1]?.pose.phase !== 'landing');
    assert.equal(contacts.length, 1);
    assert.equal(record.at(-1).pose.active, false);
  }
});

test('real skinned jump freezes, follows either facing and model scale, and resets feet and body to idle', async () => {
  const model = await loadPuddingModel(), animation = createPuddingWalk(model);
  const actor = new THREE.Group(); actor.add(model);
  animation.update(dt, {grounded: true});
  const restFeet = footNames.map(n => point(model, n));
  animation.update(dt, {grounded: false, verticalVelocity: 8, takeoff: true});
  for (let i = 0; i < 25; i++) animation.update(dt, {grounded: false, verticalVelocity: 3});
  const pausedFeet = footNames.map(n => point(model, n));
  for (let i = 0; i < 300; i++) animation.update(dt, {grounded: false, verticalVelocity: -10, paused: true});
  footNames.forEach((n, i) => assert(point(model, n).distanceTo(pausedFeet[i]) < 1e-8));
  for (const facing of [-Math.PI / 2, Math.PI / 2]) {
    animation.reset(); actor.rotation.y = facing; model.scale.setScalar(.32); model.position.set(.7, -.4, 2);
    animation.update(dt, {grounded: true});
    animation.update(dt, {grounded: false, verticalVelocity: 8, takeoff: true});
    for (let i = 0; i < 25; i++) animation.update(dt, {grounded: false, verticalVelocity: 3});
    // Near-straight IK chains amplify tiny roundoff from the exported rig.
    footNames.forEach((n, i) => assert(point(model, n).distanceTo(pausedFeet[i]) < 5e-5,
      'Airborne feet must follow torso pitch in either facing without a scale-dependent offset'));
  }
  animation.reset();
  footNames.forEach((n, i) => assert(point(model, n).distanceTo(restFeet[i]) < 1e-6));
  assert.deepEqual(model.getObjectByName('PuddingGaitBody').position.toArray(), [0, 0, 0]);
});
