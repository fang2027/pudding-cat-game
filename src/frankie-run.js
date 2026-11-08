import * as THREE from 'three';

/** Play Frankie's own sampled rig animation inside a presentation-only group. */
export function createFrankieRun(gltf, {height = 1.25} = {}) {
  const model = gltf.scene, clip = gltf.animations.find(c => c.name === 'FrankieRun');
  if (!clip || !(clip.duration > 0 && clip.duration < 10)) throw Error('FrankieRun clip is missing or has an invalid time base');
  const object = new THREE.Group(); object.name = 'FrankieModel'; object.add(model);
  const mixer = new THREE.AnimationMixer(model), action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity).play(); mixer.update(0);
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if (!(size.y > 0 && Number.isFinite(size.y))) throw Error('Invalid Frankie model bounds');
  model.scale.multiplyScalar(height / size.y); model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.add(new THREE.Vector3(-center.x, -box.min.y, -center.z));
  const meshes=[];
  model.traverse(o => {if (o.isSkinnedMesh) {o.frustumCulled = false;meshes.push(o);}});
  let blend = 0;
  action.weight = 0; action.paused = true; mixer.update(0);
  model.updateMatrixWorld(true);
  const tail = [['尾巴', 32], ['尾巴001', 28], ['尾巴002', 31]]
    .map(([name, degrees]) => idleJoint(name, new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(degrees)))
    .filter(Boolean);
  const head = idleJoint('頭', new THREE.Vector3(0, 1, 0));
  const idleJoints = head ? [...tail, head] : tail;
  const offset = new THREE.Quaternion();
  const audienceHeading = Math.atan2(.17, 1);

  function idleJoint(name, axis, angle = 0) {
    const bone = model.getObjectByName(name);
    if (!bone?.isBone) return null;
    axis.applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
    return {bone, axis, angle, sampled: bone.quaternion.clone()};
  }

  function updatePose(dt, heading) {
    // Restore the mixer's last sample before it writes the next pose.
    for (const {bone, sampled} of idleJoints) bone.quaternion.copy(sampled);
    mixer.update(dt);
    if (head) {
      const turn = audienceHeading - heading;
      head.angle = THREE.MathUtils.clamp(Math.atan2(Math.sin(turn), Math.cos(turn)), -.4, .4);
    }
    for (const {bone, axis, angle, sampled} of idleJoints) {
      sampled.copy(bone.quaternion);
      bone.quaternion.multiply(offset.setFromAxisAngle(axis, angle * (1 - blend)));
    }
  }
  const restY=model.position.y;
  const vertex=new THREE.Vector3(),relative=new THREE.Matrix4(),inverse=new THREE.Matrix4();
  object.updateMatrixWorld(true);
  inverse.copy(object.matrixWorld).invert();
  // Sample the lower part of the real skinned mesh, including the paw soles.
  const soles=meshes.map(mesh=>{
    relative.multiplyMatrices(inverse,mesh.matrixWorld);
    const vertices=[];
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      if(mesh.getVertexPosition(i,vertex).applyMatrix4(relative).y<height*.32)vertices.push(i);
    }
    return {mesh,vertices};
  });

  function groundPaws(){
    model.position.y=restY;
    // SkinnedMesh refreshes its inverse bind matrix in updateMatrixWorld.
    object.parent?.updateWorldMatrix(true,false);
    object.updateMatrixWorld(true);
    inverse.copy(object.matrixWorld).invert();
    let bottom=Infinity;
    for(const {mesh,vertices} of soles){
      relative.multiplyMatrices(inverse,mesh.matrixWorld);
      for(const i of vertices)bottom=Math.min(bottom,mesh.getVertexPosition(i,vertex).applyMatrix4(relative).y);
    }
    if(Number.isFinite(bottom))model.position.y-=bottom;
    object.updateMatrixWorld(true);
  }

  updatePose(0, Math.PI / 2);
  groundPaws();
  return {
    object,
    get time() {return action.time;},
    get weight() {return blend;},
    update(dt, {moving = false, direction = 1, heading = Math.sign(direction) * Math.PI / 2, paused = false} = {}) {
      if (paused || dt <= 0) return;
      dt = Math.min(dt, .05);
      object.rotation.y = heading;
      blend = THREE.MathUtils.damp(blend, moving ? 1 : 0, 18, dt);
      if (blend < 1e-4) {blend = 0; action.time = 0;}
      action.weight = blend; action.paused = !moving;
      updatePose(dt, heading);
      groundPaws();
    },
    reset() {
      blend = 0; action.time = 0; action.weight = 0; action.paused = true;
      updatePose(0, object.rotation.y);
      groundPaws();
    },
  };
}
