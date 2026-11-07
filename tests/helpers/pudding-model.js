import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Load the actual skin/morph data without browser image decoding for CPU tests.
// Only the test copy's material references are stripped; the asset is untouched.
export async function loadPuddingModel() {
  const file = fs.readFileSync(new URL('../../public/assets/characters/pudding-cat.glb', import.meta.url));
  const length = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + length));
  delete json.images; delete json.textures; delete json.materials;
  for (const mesh of json.meshes) for (const p of mesh.primitives) delete p.material;
  const text = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 0x20)]);
  const binChunk = file.subarray(20 + length);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + jsonChunk.length + binChunk.length, 8);
  header.writeUInt32LE(jsonChunk.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const data = Buffer.concat([header, jsonChunk, binChunk]);
  const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  return gltf.scene;
}

export function bone(model, name) {
  let result;
  model.traverse(o => {if (o.isBone && (o.userData.name ?? o.name) === name) result = o;});
  return result;
}
