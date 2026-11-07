import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const [file, garmentName] of [['jiayin-baby', '身體_1.002'], ['jiayin-girl', '裙']]) {
  test(`${file}: garment has a closed subdivided shell and valid skin weights`, () => {
    const bytes = fs.readFileSync(new URL(`../public/assets/characters/${file}.glb`, import.meta.url));
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
    const bin = bytes.subarray(28 + jsonLength);
    const node = gltf.nodes.find(n => n.name === garmentName);
    const mesh = gltf.meshes[node.mesh];
    const joints = gltf.skins[node.skin].joints;
    const read = index => {
      const a = gltf.accessors[index], v = gltf.bufferViews[a.bufferView];
      const size = a.type === 'SCALAR' ? 1 : Number(a.type.slice(3));
      const width = a.componentType === 5123 ? 2 : 4;
      const get = a.componentType === 5126 ? 'readFloatLE' : a.componentType === 5123 ? 'readUInt16LE' : 'readUInt32LE';
      const result = [];
      for (let i = 0; i < a.count; i++) for (let j = 0; j < size; j++) {
        result.push(bin[get]((v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (v.byteStride ?? size * width) + j * width));
      }
      return result;
    };
    const edges = new Map();
    let triangles = 0;
    for (const p of mesh.primitives) {
      const positions = read(p.attributes.POSITION), normals = read(p.attributes.NORMAL);
      const skinWeights = read(p.attributes.WEIGHTS_0), skinIndices = read(p.attributes.JOINTS_0);
      const indices = read(p.indices);
      const vertexKeys = [];
      assert.equal(p.attributes.WEIGHTS_1, undefined, 'Garment weights must fit the browser four-influence limit');
      for (let i = 0; i < positions.length / 3; i++) {
        vertexKeys.push(positions.slice(i * 3, i * 3 + 3).join(','));
        assert(positions.slice(i * 3, i * 3 + 3).every(Number.isFinite));
        const length = Math.hypot(...normals.slice(i * 3, i * 3 + 3));
        assert(Math.abs(length - 1) < 1e-4, 'Clothing normals must be normalized');
        const weights = skinWeights.slice(i * 4, i * 4 + 4);
        assert(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-5);
        assert(weights.every(w => w >= 0 && w <= 1));
        assert(skinIndices.slice(i * 4, i * 4 + 4).every(j => j >= 0 && j < joints.length));
      }
      triangles += indices.length / 3;
      for (let i = 0; i < indices.length; i += 3) {
        const t = indices.slice(i, i + 3).map(n => vertexKeys[n]);
        for (let j = 0; j < 3; j++) {
          const edge = [t[j], t[(j + 1) % 3]].sort().join('|');
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
    }
    assert.equal(triangles, mesh.extras.evaluatedTriangles);
    assert(triangles > mesh.extras.sourceTriangles * 4, 'Export evaluated subdivision rather than the control cage');
    assert(mesh.extras.garmentModifiers.some(m => m.type === 'SOLIDIFY' && m.thickness > 0 && m.offset === 1));
    const openEdges = [...edges.values()].filter(n => n === 1).length;
    assert.equal(openEdges, 0, 'Solidify must include sleeve, neckline and hem rims');
  });
}
