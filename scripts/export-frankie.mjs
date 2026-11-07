import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn, spawnSync} from 'node:child_process';
import {prepareFrankieGlb} from './prepare-frankie-glb.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(project, 'source_assets/frankie-source/frankie-source.blend');
const outputs = {
  glb: path.join(project, 'public/assets/characters/frankie.glb'),
  editable: path.join(project, 'source_assets/frankie-source/frankie-character.blend'),
  report: path.join(project, 'source_assets/frankie-source/export.report.json'),
  audit: path.join(project, 'source_assets/frankie-source/source.audit.json'),
};

function blenderPath() {
  if (process.env.BLENDER_EXE && fs.existsSync(process.env.BLENDER_EXE)) return process.env.BLENDER_EXE;
  const known = 'C:/Program Files/WindowsApps/BlenderFoundation.Blender_5.2.3.0_x64__ppwjx1n5r4v9t/Blender/blender.exe';
  if (fs.existsSync(known)) return known;
  const base = 'HKCU\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages';
  const query = spawnSync('reg.exe', ['query', base, '/s', '/f', 'BlenderFoundation.Blender_', '/k'], {encoding: 'utf8', windowsHide: true});
  for (const key of (query.stdout ?? '').split(/\r?\n/).map(s => s.trim()).filter(s => s.startsWith('HKEY') && s.includes('BlenderFoundation.Blender_'))) {
    const value = spawnSync('reg.exe', ['query', key, '/v', 'PackageRootFolder'], {encoding: 'utf8', windowsHide: true});
    const install = value.stdout?.match(/PackageRootFolder\s+REG_SZ\s+([^\r\n]+)/)?.[1]?.trim();
    if (install) {
      const executable = path.join(install, 'Blender/blender.exe');
      if (fs.existsSync(executable)) return executable;
    }
  }
  throw new Error('Blender was not found. Set BLENDER_EXE to its blender.exe path, then run again.');
}

function runBlender(executable, script, args, logName) {
  console.log(`Running ${path.basename(script)}...`);
  const result = spawnSync(executable, ['--background', '--disable-autoexec', source,
    '--python-exit-code', '1', '--python', path.join(project, script), '--', ...args],
    {cwd: project, encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024,
      env: {...process.env, PYTHONUTF8: '1'}});
  const log = [result.stdout ?? '', result.stderr ?? '', result.error?.message ?? ''].join('\n');
  fs.writeFileSync(path.join(project, 'source_assets/frankie-source', logName), log);
  if (result.error || result.status !== 0) {
    const consoleScript = path.join(project, 'scripts/export_frankie_in_blender.py');
    const command = `import runpy; _ = runpy.run_path(${JSON.stringify(consoleScript)}, run_name="__main__")`;
    fs.writeFileSync(path.join(project, 'source_assets/frankie-source/run-in-blender.txt'), command + '\n');
    throw new Error(`Blender could not complete ${path.basename(script)}.\n${log.slice(-3500)}\nOpen Blender, press Shift+F4 to open its Python Console, then paste this command:\n${command}\nThe command appends a private working scene and does not save or overwrite your current project.`);
  }
}

function checkAsset() {
  const bytes = fs.readFileSync(outputs.glb);
  if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid GLB output.');
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  if (!json.skins?.length || !json.meshes?.length || !json.animations?.length) throw new Error('The output must contain skin, geometry and a sampled animation.');
  if (json.images?.length) throw new Error('Placeholder GLB unexpectedly includes image textures.');
  if (json.nodes?.some(n => /貓|WGT-|Camera/.test(n.name ?? ''))) throw new Error('Unrelated scene objects appeared in the GLB.');
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    if (primitive.attributes.JOINTS_0 === undefined || primitive.attributes.WEIGHTS_0 === undefined || primitive.attributes.TEXCOORD_0 === undefined) throw new Error('Skin weights or future texture UVs are missing.');
  }
  const report = JSON.parse(fs.readFileSync(outputs.report, 'utf8'));
  if (!report.source_unchanged || report.bones !== 48 || report.source_frames.join('-') !== '277-404') throw new Error('Extraction report differs from the verified source.');
  console.log(`Extracted ${json.meshes.length} meshes, ${json.skins[0].joints.length} joints and ${json.animations.length} animation clip(s).`);
  console.log(`Editable character: ${outputs.editable}\nGame GLB: ${outputs.glb}`);
}

async function main() {
  if (!fs.existsSync(source)) throw new Error('The supplied Frankie Blender file is missing from source_assets/frankie-source.');
  const executable = blenderPath();
  if (process.argv.includes('--check')) {
    console.log(`Source: ${source}\nBlender: ${executable}\nFrames: 277-404\nRig: dog rig, 48 bones\nNo Blender process launched; export not yet verified.`);
    return;
  }
  runBlender(executable, 'scripts/audit_blend.py', ['--output', outputs.audit], 'audit.log');
  runBlender(executable, 'scripts/export_frankie.py', ['--output', outputs.glb, '--editable', outputs.editable, '--report', outputs.report], 'export.log');
  const raw=fs.readFileSync(outputs.glb),report=JSON.parse(fs.readFileSync(outputs.report,'utf8'));
  fs.writeFileSync(path.join(project,'source_assets/frankie-source/frankie.raw.glb'),raw);
  fs.writeFileSync(outputs.glb,prepareFrankieGlb(raw,{frames:report.source_frames,fps:report.fps}).bytes);
  checkAsset();
  const url = 'http://127.0.0.1:5173/source_assets/frankie-run.html';
  const existing = await fetch(url, {signal: AbortSignal.timeout(2000)}).then(r => r.ok).catch(() => false);
  if (existing) {
    spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {windowsHide: true, stdio: 'ignore'}).unref();
  } else {
    console.log('Starting the local preview. Keep this window open.');
    const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort', '--open', '/source_assets/frankie-run.html'], {cwd: project, stdio: 'inherit', windowsHide: true});
    await new Promise((resolve, reject) => {server.on('error', reject); server.on('exit', code => code ? reject(new Error(`Preview exited with code ${code}`)) : resolve());});
  }
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
