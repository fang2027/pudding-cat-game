import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createFrankieRun} from '../src/frankie-run.js';
import {setupAudioStage} from '../src/audio-stage.js';
import {Mission} from '../src/mission.js';
import {CONSOLE, CHASE} from '../src/audio-mission.js';

async function loadFrankie() {
  const bytes = fs.readFileSync(new URL('../public/assets/characters/frankie.glb', import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
const snapshot = object => {
  object.updateMatrixWorld(true); const values = [];
  object.traverse(o => {if (o.isBone) values.push(...o.position, ...o.quaternion, ...o.scale);});
  return values;
};

test('actual Frankie asset has one character, 48 bones, preserved UVs/morphs and a 4.23-second seamless clip', async () => {
  const gltf = await loadFrankie(), bones = [], meshes = [];
  gltf.scene.traverse(o => {if (o.isBone) bones.push(o); if (o.isSkinnedMesh) meshes.push(o);});
  assert.equal(gltf.scenes.length, 1); assert.equal(bones.length, 48); assert.equal(meshes.length, 2);
  assert.equal(gltf.animations.length, 1);
  const clip = gltf.animations[0]; assert.equal(clip.name, 'FrankieRun');
  assert(Math.abs(clip.duration - 127 / 30) < 1e-5, 'Source frames must play in seconds, rather than hundreds of seconds');
  assert.equal(meshes.reduce((sum, m) => sum + m.morphTargetInfluences.length, 0), 6);
  for (const mesh of meshes) {
    const {uv, skinWeight, skinIndex} = mesh.geometry.attributes;
    assert(uv && skinWeight && skinIndex); assert.equal(mesh.material.map, null);
    for (let i = 0; i < skinWeight.count; i++) {
      let total = 0;
      for (let c = 0; c < 4; c++) {
        total += skinWeight.getComponent(i, c);
        assert(skinIndex.getComponent(i, c) < 48);
      }
      assert(Math.abs(total - 1) < .001, 'Every vertex needs a normalized four-influence skin');
    }
  }
  for (const track of clip.tracks) {
    const n = track.getValueSize(), first = track.values.slice(0, n), last = track.values.slice(-n);
    assert(track.times[0] === 0);
    assert(first.every((value, i) => Math.abs(value - last[i]) < 1e-4), 'Loop closing pose should match its beginning');
  }
});

test('actual run moves the four paws and weighted skin without drifting its root or changing geometry', async () => {
  const gltf = await loadFrankie(), model = gltf.scene;
  const mixer = new THREE.AnimationMixer(model); mixer.clipAction(gltf.animations[0]).play();
  const paws = ['前腳掌_L', '前腳掌_R', '後腳掌_L', '後腳掌_R'].map(name => model.getObjectByName(name));
  assert(paws.every(Boolean));
  const root = model.getObjectByName('骨骼'), positions = paws.map(() => []), roots = [];
  const mesh = model.getObjectByProperty('isSkinnedMesh', true), original = mesh.geometry.attributes.position.array.slice();
  let firstVertex, changed = false;
  for (let i = 0; i < 40; i++) {
    mixer.setTime(i * .1); model.updateMatrixWorld(true); mesh.skeleton.update();
    paws.forEach((paw, k) => positions[k].push(paw.getWorldPosition(new THREE.Vector3())));
    roots.push(root.getWorldPosition(new THREE.Vector3()));
    const vertex = mesh.getVertexPosition(Math.floor(mesh.geometry.attributes.position.count / 2), new THREE.Vector3());
    assert([...vertex].every(Number.isFinite));
    if (!firstVertex) firstVertex = vertex.clone(); else if (vertex.distanceTo(firstVertex) > .01) changed = true;
  }
  positions.forEach(points => assert(points.some(p => p.distanceTo(points[0]) > .15), 'Every paw must participate in the source run'));
  assert(roots.every(p => Math.abs(p.x - roots[0].x) < 1e-4 && Math.abs(p.z - roots[0].z) < 1e-4));
  assert(changed); assert.deepEqual(mesh.geometry.attributes.position.array, original);
});

test('animated paw soles stay on the route surface through the run loop',async()=>{
 const runner=createFrankieRun(await loadFrankie());
 const carrier=new THREE.Group();
 carrier.add(runner.object);
 for(let i=0;i<96;i++){
  carrier.position.set(i*.15,2+Math.sin(i*.12),-6+i*.03);
  runner.update(.05,{moving:true});
  if(i%4!==0)continue;
  const feet=new THREE.Box3().setFromObject(runner.object,true).min.y;
  assert.ok(Math.abs(feet-carrier.position.y)<.006, 'lowest skinned vertex follows the floor');
 }
});

test('Frankie pauses, stops into idle, turns, resets and leaves external route placement untouched', async () => {
  const gltf = await loadFrankie(), runner = createFrankieRun(gltf), object = runner.object;
  const idle = snapshot(object); object.position.set(7, 2, -.15);
  for (let i = 0; i < 60; i++) runner.update(1 / 120, {moving: true, direction: 1});
  assert(runner.weight > .99); assert(runner.time > .4); assert.equal(object.rotation.y, Math.PI / 2);
  const running = snapshot(object), time = runner.time;
  for (let i = 0; i < 120; i++) runner.update(1 / 60, {moving: true, direction: -1, paused: true});
  assert.deepEqual(snapshot(object), running); assert.equal(runner.time, time);
  runner.update(1 / 120, {moving: true, direction: -1}); assert.equal(object.rotation.y, -Math.PI / 2);
  assert.deepEqual(object.position.toArray(), [7, 2, -.15]);
  for (let i = 0; i < 120; i++) runner.update(1 / 120, {moving: false});
  assert.equal(runner.weight, 0); assert.equal(runner.time, 0);
  assert(snapshot(object).every((value, i) => Math.abs(value - idle[i]) < 1e-6));
  runner.update(.05, {moving: true}); runner.reset();
  assert.equal(runner.time, 0); assert.equal(runner.weight, 0);
});

test('real dog replaces the chase pole, follows both floors, freezes during dialogue and resets on failure', async () => {
  const gltf = await loadFrankie();
  const element = () => ({textContent: '', hidden: false, children: [], dataset: {},
    append(child) {this.children.push(child);}, setAttribute(){}, getContext() {return {fillRect() {}, fillText() {}};}});
  const nodes = Object.fromEntries(['audio-panel','speaker-states','chase-progress','chase-feedback','audio-objective'].map(id => ['#' + id, element()]));
  const previous = globalThis.document;
  globalThis.document = {querySelector: selector => nodes[selector], createElement: element};
  try {
    const scene = new THREE.Scene(), update = setupAudioStage(scene, {loadFrankie: () => gltf});
    await new Promise(resolve => setImmediate(resolve));
    const chase = scene.getObjectByName('FrankieChase'), model = scene.getObjectByName('FrankieModel'); assert(model);
    assert(chase.children.some(o => o.geometry?.type === 'BoxGeometry' && o.visible === false));
    const m = new Mission(), player = {...CONSOLE, grounded: true}, dt = 1 / 120;
    update(m, player, {dt}); m.start('audio'); update(m, player, {dt});
    for (let i = 0; i < 60; i++) {m.tick(dt); update(m, player, {dt});}
    const pose = snapshot(model), x = chase.position.x;
    for (let i = 0; i < 120; i++) update(m, player, {dt, paused: true});
    assert.deepEqual(snapshot(model), pose); assert.equal(chase.position.x, x);
    for (let stage = 0; stage < 3; stage++) {
      m.tick(m.audio.readyRemaining + m.audio.reactionRemaining + m.audio.routeLength / m.audio.speed + .01); update(m, player, {dt});
      assert.equal(chase.position.x, m.audio.target.x); assert.equal(chase.position.y, m.audio.target.y);
      for (let i = 0; i < 120; i++) update(m, player, {dt});
      const still = snapshot(model); update(m, player, {dt}); assert.deepEqual(snapshot(model), still);
      const target = {...m.audio.target, grounded: true}; m.interactAudio(target); update(m, target, {dt});
      if (stage < 2) {
        m.tick(m.audio.readyRemaining + m.audio.reactionRemaining + .1); update(m, target, {dt});
        assert.equal(model.rotation.y, stage === 0 ? Math.PI / 2 : -Math.PI / 2);
      }
    }
    assert.equal(chase.visible, true);
    m.tick(.8); update(m, player, {dt});
    assert.equal(chase.visible, false);
    m.fail('reset test'); update(m, player, {dt}); assert.equal(chase.visible, true);assert.equal(chase.position.x, CONSOLE.x);
    m.start('audio'); update(m, player, {dt}); assert.equal(chase.visible, true); assert.equal(chase.position.x, CONSOLE.x);
  } finally {globalThis.document = previous;}
});
