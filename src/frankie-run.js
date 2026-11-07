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
  model.traverse(o => {if (o.isSkinnedMesh) o.frustumCulled = false;});
  let blend = 0;
  action.weight = 0; action.paused = true; mixer.update(0);
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
      mixer.update(dt);
    },
    reset() {
      blend = 0; action.time = 0; action.weight = 0; action.paused = true;
      mixer.update(0);
    },
  };
}
