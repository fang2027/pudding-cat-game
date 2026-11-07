import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

/** Keep the exported character scene, merge its bone/morph clips, and express
 * the sampled source frames in seconds. Geometry, UVs and skin data are kept.
 */
export function prepareFrankieGlb(input, {frames = [277, 404], fps = 30} = {}) {
  const bytes = Buffer.from(input);
  if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2) throw Error('Expected GLB 2');
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length));
  const binOffset = 28 + length, bin = Buffer.from(bytes.subarray(binOffset));
  const active = document.scenes[document.scene ?? 0];
  const reachable = new Set();
  function visit(index) {if (reachable.has(index)) return; reachable.add(index); for (const child of document.nodes[index].children ?? []) visit(child);}
  active.nodes.forEach(visit);
  const clips = document.animations.filter(animation => animation.channels.some(channel => reachable.has(channel.target.node))
    && animation.samplers.every(sampler => (document.accessors[sampler.input].min?.[0] ?? 0) < 1e-3));
  if (!clips.length) throw Error('No zero-based animation on the exported character scene');
  const animation = {name: 'FrankieRun', channels: [], samplers: []}, channels = new Set(), timeAccessors = new Set();
  for (const clip of clips) {
    const samplers = new Map();
    for (const channel of clip.channels) {
      if (!reachable.has(channel.target.node)) continue;
      const key = `${channel.target.node}:${channel.target.path}`;
      if (channels.has(key)) throw Error('Conflicting animation channel: ' + key);
      channels.add(key);
      if (!samplers.has(channel.sampler)) {
        samplers.set(channel.sampler, animation.samplers.length);
        const sampler = structuredClone(clip.samplers[channel.sampler]);
        timeAccessors.add(sampler.input); animation.samplers.push(sampler);
      }
      animation.channels.push({...structuredClone(channel), sampler: samplers.get(channel.sampler)});
    }
  }
  const views = [...timeAccessors].map(index => {
    const accessor = document.accessors[index], view = document.bufferViews[accessor.bufferView];
    if (accessor.componentType !== 5126 || accessor.type !== 'SCALAR' || accessor.sparse) throw Error('Unsupported animation time accessor');
    return {accessor, offset: (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride: view.byteStride ?? 4};
  });
  const start = Math.min(...views.map(v => bin.readFloatLE(v.offset)));
  const end = Math.max(...views.map(v => bin.readFloatLE(v.offset + (v.accessor.count - 1) * v.stride)));
  const duration = (frames[1] - frames[0]) / fps;
  if (!(end > start && duration > 0)) throw Error('Invalid animation duration');
  const timeScale = duration / (end - start);
  for (const {accessor, offset, stride} of views) {
    let previous = -Infinity;
    for (let i = 0; i < accessor.count; i++) {
      const value = (bin.readFloatLE(offset + i * stride) - start) * timeScale;
      if (!(value >= previous)) throw Error('Non-monotonic animation times');
      bin.writeFloatLE(value, offset + i * stride); previous = value;
    }
    accessor.min = [bin.readFloatLE(offset)]; accessor.max = [previous];
  }
  const indices = [...reachable].sort((a, b) => a - b), remap = new Map(indices.map((index, i) => [index, i]));
  const skins = [...new Set(indices.flatMap(i => document.nodes[i].skin === undefined ? [] : [document.nodes[i].skin]))];
  const meshes = [...new Set(indices.flatMap(i => document.nodes[i].mesh === undefined ? [] : [document.nodes[i].mesh]))];
  document.nodes = indices.map(index => {
    const node = structuredClone(document.nodes[index]);
    if (node.children) node.children = node.children.map(i => remap.get(i));
    if (node.skin !== undefined) node.skin = skins.indexOf(node.skin);
    if (node.mesh !== undefined) node.mesh = meshes.indexOf(node.mesh);
    return node;
  });
  document.skins = skins.map(index => {
    const skin = structuredClone(document.skins[index]);
    if (skin.joints.some(i => !remap.has(i))) throw Error('A skin joint is outside the exported scene');
    skin.joints = skin.joints.map(i => remap.get(i));
    if (skin.skeleton !== undefined) skin.skeleton = remap.get(skin.skeleton);
    return skin;
  });
  document.meshes = meshes.map(index => document.meshes[index]);
  animation.channels.forEach(channel => channel.target.node = remap.get(channel.target.node));
  document.animations = [animation]; document.scenes = [{name: 'Frankie', nodes: active.nodes.map(i => remap.get(i))}]; document.scene = 0;
  document.extras = {...document.extras, frankie: {sourceFrames: frames, fps, duration, placeholderMaterials: true, prepared: 1}};
  const jsonBytes = Buffer.from(JSON.stringify(document)), json = Buffer.concat([jsonBytes, Buffer.alloc((4 - jsonBytes.length % 4) % 4, 0x20)]);
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + bin.length, 8);
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(bin.length); binHeader.writeUInt32LE(0x004e4942, 4);
  return {bytes: Buffer.concat([header, json, binHeader, bin]), summary: {nodes: indices.length, meshes: meshes.length, clips: 1, duration, timeScale}};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [input, output, report] = process.argv.slice(2);
  if (!input || !output || path.resolve(input) === path.resolve(output)) throw Error('Usage: node scripts/prepare-frankie-glb.mjs raw.glb output.glb [export.report.json]');
  const settings = report ? JSON.parse(fs.readFileSync(report, 'utf8')) : {};
  const prepared = prepareFrankieGlb(fs.readFileSync(input), {frames: settings.source_frames, fps: settings.fps});
  fs.writeFileSync(output, prepared.bytes); console.log(JSON.stringify(prepared.summary));
}
