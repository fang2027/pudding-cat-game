import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const name of ['jiayin-baby', 'jiayin-girl']) {
  test(`${name}: visible eyes and logo, embedded textures and preserved facial rig`, () => {
    const bytes = fs.readFileSync(new URL(`../public/assets/characters/${name}.glb`, import.meta.url));
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
    const materials = new Map(gltf.materials.map(m => [m.name, m]));
    const eye = materials.get('眼睛.001').pbrMetallicRoughness;
    assert(eye.baseColorFactor[0] > 0 && eye.baseColorFactor[0] < 0.16, 'Eyes must keep their dark brown source color');
    assert(eye.baseColorFactor[1] < eye.baseColorFactor[0]);
    assert.equal(eye.metallicFactor, 0);
    assert.deepEqual(materials.get('黑.001').pbrMetallicRoughness.baseColorFactor, [0, 0, 0, 1]);
    const shirt = materials.get('基本服.001').pbrMetallicRoughness;
    assert.deepEqual(shirt.baseColorFactor, [1, 1, 1, 1], 'Keep the embedded logo colors untinted');
    assert.equal(shirt.roughnessFactor, 0.718181848526001);
    const image = gltf.images[gltf.textures[shirt.baseColorTexture.index].source];
    assert.equal(image.mimeType, 'image/png');
    const view = gltf.bufferViews[image.bufferView];
    const offset = 20 + jsonLength + 8 + view.byteOffset;
    assert.equal(bytes.subarray(offset, offset + 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(offset + 16), 1024);
    assert.equal(bytes.readUInt32BE(offset + 20), 1024);
    assert(gltf.images.every(i => Number.isInteger(i.bufferView)), 'Textures must load without external files');
    const head = gltf.meshes.find(m => m.primitives.some(p => p.targets?.length === 13));
    assert(head, 'Preserve all 13 facial expressions');
    assert(gltf.skins.length > 0 && gltf.skins[0].joints.length > 20);
    for (const primitive of gltf.meshes.flatMap(m => m.primitives)) {
      assert(primitive.attributes.JOINTS_0 !== undefined && primitive.attributes.WEIGHTS_0 !== undefined);
      if (gltf.materials[primitive.material].name === '基本服.001') {
        assert(primitive.attributes.TEXCOORD_0 !== undefined, 'Logo requires the original clothing UV map');
      }
    }
  });
}
