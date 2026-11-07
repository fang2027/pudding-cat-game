/**
 * Convert the audited Jiayin Blender materials to glTF-compatible materials.
 * Usage: node scripts/repair-character-materials.js AUDIT TEXTURE_DIR INPUT_DIR OUTPUT_DIR
 * Run scripts/audit_character_materials.py in Blender first to generate AUDIT.
 * Writes separate GLBs; never edits a .blend, source texture, or input GLB.
 * The source clothing OVERLAY with neutral gray is an identity operation, so its
 * logo texture can connect directly to baseColor. Fabric roughness is omitted.
 * Reflection-coordinate eye gradients have no portable UV representation; use
 * the original eye shader's dark brown base color and preserve its roughness.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const [auditFile, textureDir, inputDir, outputDir] = process.argv.slice(2);
assert(auditFile && textureDir && inputDir && outputDir,
  'Expected AUDIT TEXTURE_DIR INPUT_DIR OUTPUT_DIR');
assert.notEqual(path.resolve(inputDir), path.resolve(outputDir), 'Use a separate output directory');
const audit = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
const source = new Map(audit.material_graphs.map(m => [m.name, m]));
const eye = source.get('眼睛.001').nodes.find(n => n.type === 'BSDF_PRINCIPLED');
const black = source.get('黑.001');
const clothing = source.get('基本服.001');
const clothShader = clothing.nodes.find(n => n.type === 'BSDF_PRINCIPLED');
const textureName = clothing.nodes.find(n => n.type === 'TEX_IMAGE' && n.image === '默认材质_baseColor.png')?.image;
assert(textureName, 'Source clothing logo texture is missing');
const png = fs.readFileSync(path.join(textureDir, textureName));
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Expected a PNG logo texture');
fs.mkdirSync(outputDir, {recursive: true});
const pad = (bytes, value = 0) => Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4, value)]);

for (const file of ['jiayin-baby.glb', 'jiayin-girl.glb']) {
  const original = fs.readFileSync(path.join(inputDir, file));
  assert.equal(original.readUInt32LE(0), 0x46546c67);
  assert.equal(original.readUInt32LE(4), 2);
  const jsonLength = original.readUInt32LE(12);
  const model = JSON.parse(original.subarray(20, 20 + jsonLength).toString());
  const binHeader = 20 + jsonLength;
  assert.equal(original.readUInt32LE(binHeader + 4), 0x004e4942);
  const geometry = original.subarray(binHeader + 8, binHeader + 8 + model.buffers[0].byteLength);
  const prefix = pad(geometry);
  const viewIndex = model.bufferViews.length;
  model.bufferViews.push({buffer: 0, byteOffset: prefix.length, byteLength: png.length});
  model.images ??= [];
  const imageIndex = model.images.length;
  model.images.push({name: 'Jiayin clothing logo', bufferView: viewIndex, mimeType: 'image/png'});
  model.samplers ??= [];
  const samplerIndex = model.samplers.length;
  model.samplers.push({magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497});
  model.textures ??= [];
  const textureIndex = model.textures.length;
  model.textures.push({source: imageIndex, sampler: samplerIndex});
  const changed = new Set();
  for (const material of model.materials) {
    if (material.name === '眼睛.001') {
      material.pbrMetallicRoughness = {
        baseColorFactor: eye.inputs['Base Color'],
        metallicFactor: eye.inputs.Metallic,
        roughnessFactor: eye.inputs.Roughness,
      };
      changed.add(material.name);
    } else if (material.name === '黑.001') {
      material.pbrMetallicRoughness = {
        baseColorFactor: black.diffuse, metallicFactor: 0, roughnessFactor: 0.5,
      };
      changed.add(material.name);
    } else if (material.name === '基本服.001') {
      material.pbrMetallicRoughness = {
        baseColorFactor: [1, 1, 1, 1], baseColorTexture: {index: textureIndex},
        metallicFactor: 0, roughnessFactor: clothShader.inputs.Roughness,
      };
      changed.add(material.name);
    }
  }
  assert.equal(changed.size, 3, 'Expected eye, black and clothing materials on each character');
  const binary = Buffer.concat([prefix, png]);
  model.buffers[0].byteLength = binary.length;
  const jsonChunk = pad(Buffer.from(JSON.stringify(model)), 0x20);
  const binaryChunk = pad(binary);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binaryChunk.length, 8);
  const chunkHeader = (length, type) => {
    const result = Buffer.alloc(8); result.writeUInt32LE(length); result.writeUInt32LE(type, 4); return result;
  };
  const result = Buffer.concat([header, chunkHeader(jsonChunk.length, 0x4e4f534a), jsonChunk,
    chunkHeader(binaryChunk.length, 0x004e4942), binaryChunk]);
  fs.writeFileSync(path.join(outputDir, file), result);
  console.log(`${file}: repaired ${[...changed].join(', ')}; preserved geometry, skins and morphs`);
}
