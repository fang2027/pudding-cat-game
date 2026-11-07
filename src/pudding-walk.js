import {SIT_DEFAULTS} from './sit-editor.js';
import * as THREE from 'three';
import {createPuddingJump} from './pudding-jump.js';

// These are the deform chains verified in pudding-cat.glb, not NPC rig names.
const CHAINS = [
  ['front_thigh.L', 'front_shin.L', 'front_foot.L', 0],
  ['thigh.L', 'shin.L', 'foot.L', .25],
  ['front_thigh.R', 'front_shin.R', 'front_foot.R', .5],
  ['thigh.R', 'shin.R', 'foot.R', .75],
];
export const WALK_STRIDE = 1.65; // Scene travel per four-beat cycle; gameplay speed is unchanged.
const TAIL_BONES = ['DEF-spine.003', 'DEF-spine.002', 'DEF-spine.001', 'DEF-spine'];
const TAIL_PITCH = [-.12, .06, .32, .70];

/** Four-foot locomotion on the existing skin, with a two-segment IK solve.
 * Planted feet keep their original orientation; intermediate deform bones retain
 * their rotations so the original split upper/lower limb lengths are preserved.
 * No mesh, morph target, material, source file, or collision data is changed.
 */
export function createPuddingWalk(model,{idle=false,sitSettings=SIT_DEFAULTS}={}) {
  // Presentational motion stays inside the actor, leaving physics and the
  // model's external placement/scale untouched. IK compensates at planted feet.
  const body = new THREE.Group(); body.name = 'PuddingGaitBody';
  for (const child of [...model.children]) body.add(child);
  model.add(body);
  const bones = new Map();
  model.traverse(o => {if (o.isBone) bones.set(o.userData.name ?? o.name, o);});
  model.updateWorldMatrix(true, true);
  const point = bone => model.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
  const referenceQ = model.getWorldQuaternion(new THREE.Quaternion()).invert();
  const legs = CHAINS.map(([upperName, lowerName, footName, offset], index) => {
    const [upper, lower, foot] = [upperName, lowerName, footName].map(n => bones.get('DEF-' + n));
    if (!upper || !lower || !foot) throw new Error('Missing Pudding Cat deform chain: ' + upperName);
    const hip = point(upper), knee = point(lower), ankle = point(foot);
    const direction = ankle.clone().sub(hip).normalize();
    const bend = knee.clone().sub(hip).addScaledVector(direction, -knee.clone().sub(hip).dot(direction)).normalize();
    return {upper, lower, foot, offset, hip, knee, ankle, bend, front: index % 2 === 0,
      a: hip.distanceTo(knee), b: knee.distanceTo(ankle),
      footOrientation: referenceQ.clone().multiply(foot.getWorldQuaternion(new THREE.Quaternion())),
      rest: [upper, lower, foot].map(b => b.quaternion.clone())};
  });
  // The exported deform chain runs tip-to-base, and its Blender constraints
  // are absent in glTF. Solve an arc-length-preserving centerline from the
  // attached base, then place deform joints in their actual parent-first order.
  const tailAnchor = bones.get('MCH-ROT-tail');
  if (!tailAnchor) throw new Error('Missing Pudding Cat tail anchor');
  const tailBase = point(tailAnchor);
  let previousTailPoint = tailBase;
  const tail = TAIL_BONES.map(name => {
    const bone = bones.get(name);
    if (!bone) throw new Error('Missing Pudding Cat tail joint: ' + name);
    const position = point(bone), direction = previousTailPoint.clone().sub(position).normalize();
    const length = previousTailPoint.distanceTo(position); previousTailPoint = position;
    return {bone, direction, length, rest: bone.quaternion.clone(), position: bone.position.clone(),
      orientation: referenceQ.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion()))};
  });
  const tailLength = tail.reduce((sum, segment) => sum + segment.length, 0);
  const height = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y / model.getWorldScale(new THREE.Vector3()).y;
  // Measured relative to the source model, independent of game/viewer scaling.
  const reach = height * .120, lift = height * .085;
  const jumpPivot = new THREE.Vector3(0, height * .45, 0);
  let phase = 0, blend = 0, idleTime=0, sit=0;
  const jump = createPuddingJump();
  const q = new THREE.Quaternion(), parentQ = new THREE.Quaternion();
  const from = new THREE.Vector3(), to = new THREE.Vector3(), origin = new THREE.Vector3();

  function poseTail(amount,cycle=phase) {
    const positions = [], directions = [];
    let cursor = tailBase.clone(), length = 0;
    tail.forEach((segment, i) => {
      const u = (length + segment.length / 2) / tailLength;
      const ripple = Math.sin(cycle * Math.PI * 2 - u * Math.PI * 2);
      const yaw = ripple * (.21 + .27 * u) * amount;
      const pitch = TAIL_PITCH[i] + ripple * .035 * amount;
      const direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      cursor = cursor.clone().addScaledVector(direction, segment.length);
      positions.push(cursor.clone().applyMatrix4(body.matrix));
      directions.push(direction.negate().applyQuaternion(body.quaternion));
      length += segment.length;
    });
    const modelQ = model.getWorldQuaternion(new THREE.Quaternion());
    for (let i = tail.length - 1; i >= 0; i--) {
      const segment = tail[i], bone = segment.bone;
      bone.position.copy(bone.parent.worldToLocal(model.localToWorld(positions[i].clone())));
      const original = segment.direction.clone().applyQuaternion(body.quaternion);
      q.setFromUnitVectors(original, directions[i])
        .multiply(body.quaternion).multiply(segment.orientation).premultiply(modelQ);
      bone.parent.getWorldQuaternion(parentQ).invert();
      bone.quaternion.copy(parentQ.multiply(q)).normalize();
      bone.updateWorldMatrix(false, true);
    }
  }
  function restore() {
    body.position.set(0, 0, 0); body.quaternion.identity(); body.updateMatrix();
    for (const leg of legs) [leg.upper, leg.lower, leg.foot].forEach((b, i) => b.quaternion.copy(leg.rest[i]));
    for (const segment of tail) {
      segment.bone.quaternion.copy(segment.rest); segment.bone.position.copy(segment.position);
    }
    model.updateWorldMatrix(true, true);
    poseTail(0);
    model.updateWorldMatrix(true, true);
  }
  function poseBody(amount, air, seated) {
    const theta = phase * Math.PI * 2;
    // Keep some knee bend even at the crest so the wider steps can land flat.
    body.position.set(Math.sin(theta) * height * .011 * amount,
      -height * ((.024 + Math.cos(theta * 2) * .014) * amount + air.landing * .055 + seated*sitSettings.drop/100), 0);
    body.quaternion.setFromEuler(new THREE.Euler(
      Math.sin(theta * 2) * .018 * amount + air.pitch - seated*THREE.MathUtils.degToRad(sitSettings.pitch),
      Math.sin(theta) * .024 * amount,
      Math.sin(theta) * .035 * amount, 'YXZ'));
    // Rotate the airborne torso about its center, rather than about the floor.
    const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), air.pitch);
    body.position.add(jumpPivot.clone().sub(jumpPivot.clone().applyQuaternion(pitchQ)));
    body.updateMatrix(); model.updateWorldMatrix(true, true);
  }
  function aim(bone, endBone, target) {
    bone.getWorldPosition(origin);
    endBone.getWorldPosition(from).sub(origin).normalize();
    to.copy(target).sub(origin).normalize();
    q.setFromUnitVectors(from, to).multiply(bone.getWorldQuaternion(parentQ));
    bone.parent.getWorldQuaternion(parentQ).invert();
    bone.quaternion.copy(parentQ.multiply(q)).normalize();
    bone.updateWorldMatrix(false, true);
  }
  function poseLeg(leg, cycle, amount, air, seated) {
    const t = (cycle + leg.offset) % 1;
    const swing = Math.max(0, (t - .62) / .38);
    // Recover forward early, then lower the extended paw onto the ground.
    // An early lift peak avoids lifting straight up beneath the shoulder.
    const recover = Math.min(swing / .80, 1);
    const forward = t < .62 ? 1 - 2 * t / .62 : -1 + 2 * recover * recover * (3 - 2 * recover);
    const arc = Math.sin(Math.PI * swing ** .65) ** 2;
    const target = leg.ankle.clone();
    target.z += (forward + .08) * reach * (leg.front ? 1 : .87) * amount;
    target.y += arc * lift * amount;
    if(leg.front)target.z-=height*.06*seated;
    else{
      target.x+=Math.sign(leg.ankle.x)*height*sitSettings.spread/100*seated;
      target.z+=height*sitSettings.forward/100*seated;
    }
    if (air.airborne) {
      if (leg.front) {
        target.y += height * .12 * air.tuck;
        target.z += height * (.045 * air.tuck + .035 * air.reach - .02 * air.launch);
      } else {
        target.y += height * (.075 * air.hindStretch + .045 * air.tuck);
        target.z -= height * .27 * air.hindStretch;
      }
      // Paws follow the torso's pitch in flight; only grounded paws use IK
      // compensation against the stage. Hind legs trail behind the pelvis.
      target.applyMatrix4(body.matrix);
    } else if (!leg.front) {
      target.y += height * .075 * air.hindStretch;
      target.z -= height * .27 * air.hindStretch;
    }
    const hip = point(leg.upper);
    const direction = target.clone().sub(hip);
    const distance = THREE.MathUtils.clamp(direction.length(), Math.abs(leg.a - leg.b) + 1e-5, leg.a + leg.b - 1e-5);
    direction.normalize();
    const pole = leg.bend.clone().applyQuaternion(body.quaternion);
    pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const along = (leg.a * leg.a + distance * distance - leg.b * leg.b) / (2 * distance);
    const across = Math.sqrt(Math.max(0, leg.a * leg.a - along * along));
    const knee = hip.clone().addScaledVector(direction, along).addScaledVector(pole, across);
    target.copy(hip).addScaledVector(direction, distance);
    aim(leg.upper, leg.lower, model.localToWorld(knee));
    aim(leg.lower, leg.foot, model.localToWorld(target));
    q.copy(leg.footOrientation);
    const footPitch = !leg.front && air.hindStretch > 0 ? .70 * air.hindStretch
      : air.airborne ? -.14 * air.tuck + .10 * air.reach
      : -.20 * Math.sin(Math.PI * swing) * amount;
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), footPitch));
    if (air.airborne) q.premultiply(body.quaternion);
    q.premultiply(model.getWorldQuaternion(parentQ));
    leg.foot.parent.getWorldQuaternion(parentQ).invert();
    leg.foot.quaternion.copy(parentQ.multiply(q)).normalize();
    leg.foot.updateWorldMatrix(false, true);
  }

  restore();
  return {
    update(dt, {distance = 0, moving = distance > 1e-6, grounded = true, verticalVelocity = 0,
      takeoff = false, landedSpeed = 0, paused = false} = {}) {
      if (paused || dt <= 0) return;
      dt = Math.min(dt, .05);
      const air = jump.update(dt, {grounded, verticalVelocity, takeoff, landedSpeed});
      const walking = grounded && moving;
      blend = THREE.MathUtils.damp(blend, walking ? 1 : 0, 20, dt);
      if (walking) phase = (phase + Math.abs(distance) / WALK_STRIDE) % 1;
      idleTime=idle&&grounded&&!moving&&!takeoff?idleTime+dt:0;
      sit=grounded&&!takeoff?THREE.MathUtils.damp(sit,idle&&grounded&&!moving&&idleTime>=sitSettings.delay?1:0,13,dt):0;
      if(sit<1e-4)sit=0;
      if (blend < 1e-4) blend = 0;
      if (blend === 0 && !air.active) {phase = 0; if(!idle){restore();return;}}
      const amount = air.airborne ? 0 : blend * (1 - air.landing * .75);
      restore();
      poseBody(amount, air, sit);
      for (const leg of legs) poseLeg(leg, phase, amount, air, sit);
      const resting=idleTime>0&&blend<.05;
      poseTail(resting?.42:Math.max(blend, air.weight * .55),resting?idleTime*.48:phase);
      model.updateWorldMatrix(true, true);
    },
    get seated(){return idleTime>0&&sit>=.98;},
    reset() {phase = 0; blend = 0; idleTime=0; sit=0; jump.reset(); restore();},
  };
}
