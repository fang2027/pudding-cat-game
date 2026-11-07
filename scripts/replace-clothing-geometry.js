/** Replace only garment primitives with Blender's evaluated, skinned geometry.
 * node scripts/replace-clothing-geometry.js GEOMETRY_JSON INPUT_DIR OUTPUT_DIR
 * Leaves head/body geometry, morphs, materials, images, nodes and skins intact.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const [geometryFile, inputDir, outputDir] = process.argv.slice(2);
assert(geometryFile && inputDir && outputDir, 'Expected GEOMETRY_JSON INPUT_DIR OUTPUT_DIR');
assert.notEqual(path.resolve(inputDir), path.resolve(outputDir), 'Use a separate output directory');
const report = JSON.parse(fs.readFileSync(geometryFile, 'utf8'));
const pad = bytes => Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4)]);
fs.mkdirSync(outputDir, {recursive: true});

for (const character of report.characters) {
  assert(['jiayin-baby.glb', 'jiayin-girl.glb'].includes(character.file));
  const input = fs.readFileSync(path.join(inputDir, character.file));
  const jsonLength = input.readUInt32LE(12);
  const model = JSON.parse(input.subarray(20, 20 + jsonLength));
  const originalLength = model.buffers[0].byteLength;
  const parts = [pad(input.subarray(28 + jsonLength, 28 + jsonLength + originalLength))];
  let byteLength = parts[0].length;
  function accessor(values, size, componentType, target, bounds = false) {
    const Data = componentType === 5126 ? Float32Array : componentType === 5123 ? Uint16Array : Uint32Array;
    const bytes = Buffer.from(new Data(values).buffer);
    const bufferView = model.bufferViews.length;
    model.bufferViews.push({buffer: 0, byteOffset: byteLength, byteLength: bytes.length, target});
    const padded = pad(bytes); parts.push(padded); byteLength += padded.length;
    const entry = {bufferView, componentType, count: values.length / size,
                   type: size === 1 ? 'SCALAR' : `VEC${size}`};
    if (bounds) {
      entry.min = Array(size).fill(Infinity); entry.max = Array(size).fill(-Infinity);
      for (let i = 0; i < values.length; i++) {
        entry.min[i % size] = Math.min(entry.min[i % size], values[i]);
        entry.max[i % size] = Math.max(entry.max[i % size], values[i]);
      }
    }
    const index = model.accessors.length; model.accessors.push(entry); return index;
  }
  const node = model.nodes.find(n => n.name === character.object && n.mesh === character.mesh);
  assert(node, 'Garment node must match the audited input');
  const mesh = model.meshes[node.mesh];
  const originalTriangles = mesh.primitives.reduce((n, p) => n + model.accessors[p.indices].count / 3, 0);
  assert.equal(originalTriangles, character.raw_triangles, 'Expected the unbaked input garment');
  mesh.primitives = character.primitives.map(p => {
    const material = model.materials.findIndex(m => m.name === p.material);
    assert(material >= 0, `Unknown source garment material: ${p.material}`);
    assert.equal(p.positions.length / 3, p.weights.length / 4);
    assert.equal(p.joints.length, p.weights.length);
    const attributes = {
      POSITION: accessor(p.positions, 3, 5126, 34962, true),
      NORMAL: accessor(p.normals, 3, 5126, 34962),
      TEXCOORD_0: accessor(p.uvs, 2, 5126, 34962),
      JOINTS_0: accessor(p.joints, 4, 5123, 34962),
      WEIGHTS_0: accessor(p.weights, 4, 5126, 34962),
    };
    return {attributes, indices: accessor(p.indices, 1, 5125, 34963), material, mode: 4};
  });
  mesh.extras = {...mesh.extras, garmentModifiers: character.modifiers,
                 sourceTriangles: character.raw_triangles, evaluatedTriangles: character.triangles};
  model.buffers[0].byteLength = byteLength;
  const jsonRaw = Buffer.from(JSON.stringify(model));
  const json = Buffer.concat([jsonRaw, Buffer.alloc((4 - jsonRaw.length % 4) % 4, 0x20)]);
  const bin = Buffer.concat(parts);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + bin.length, 8);
  const chunk = (length, type) => {const b = Buffer.alloc(8); b.writeUInt32LE(length); b.writeUInt32LE(type, 4); return b;};
  fs.writeFileSync(path.join(outputDir, character.file), Buffer.concat([
    header, chunk(json.length, 0x4e4f534a), json, chunk(bin.length, 0x004e4942), bin,
  ]));
  console.log(`${character.file}: baked Solidify + Subdivision, ${character.raw_triangles} -> ${character.triangles} garment triangles`);
}
