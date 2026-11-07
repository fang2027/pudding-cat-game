"""Run from Blender's Python Console without launching another executable.

Appends a private copy of the supplied scene. Existing user scenes, objects,
frame positions and source files are preserved; no user project is saved.
"""
import contextlib
import hashlib
import json
from pathlib import Path
import re
import runpy
import shutil
import struct
import subprocess
import tempfile
import traceback
from types import SimpleNamespace
import webbrowser

import bpy


def validate_glb(path):
    data = path.read_bytes()
    if data[:4] != b'glTF' or struct.unpack_from('<II', data, 4) != (2, len(data)):
        raise RuntimeError('Invalid GLB header')
    size = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + size])
    if not document.get('meshes') or not document.get('skins') or not document.get('animations'):
        raise RuntimeError('Expected meshes, a skin and sampled animation')
    if document.get('images'):
        raise RuntimeError('Placeholder export unexpectedly contains texture images')
    if any(re.search(r'貓|WGT-|Camera', node.get('name', '')) for node in document.get('nodes', [])):
        raise RuntimeError('Unexpected non-Frankie objects in the exported file')
    for mesh in document['meshes']:
        for primitive in mesh['primitives']:
            if not {'JOINTS_0', 'WEIGHTS_0', 'TEXCOORD_0'}.issubset(primitive['attributes']):
                raise RuntimeError('Missing skin weights or UV coordinates')
    return len(document['meshes']), len(document['skins'][0]['joints']), len(document['animations'])


def audit_source(audit, scene, source, destination):
    objects = list(scene.objects)
    materials = {slot.material for obj in objects if obj.type == 'MESH' for slot in obj.material_slots if slot.material}
    images = {node.image for material in materials if material.node_tree is not None
        for node in material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image}
    report = dict(source_blend=str(source), blender_version=bpy.app.version_string,
        scene_name=scene.name, scope='Private scene appended from the supplied file; existing user scenes excluded',
        objects=[audit['object_info'](obj) for obj in objects],
        materials=[audit['material_info'](material) for material in materials],
        images=[audit['image_info'](image) for image in images])
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    project = Path(__file__).resolve().parent.parent
    source = project / 'source_assets/frankie-source/frankie-source.blend'
    folder = source.parent
    args = SimpleNamespace(output=str(folder / 'frankie.raw.glb'),
        editable=str(folder / 'frankie-character.blend'), report=str(folder / 'export.report.json'))
    if not source.is_file():
        raise RuntimeError('The supplied source file is missing: ' + str(source))
    window = bpy.context.window
    if window is None:
        raise RuntimeError('Run this script from the Python Console in an open Blender window')
    previous_scene = window.scene
    before = hashlib.sha256(source.read_bytes()).hexdigest()
    # A temporary copy also works if the user currently has the supplied file
    # open. Blender prevents appending the current main file into itself.
    with tempfile.NamedTemporaryFile(prefix='frankie-working-', suffix='.blend', dir=folder, delete=False) as temporary:
        working = Path(temporary.name)
    try:
        shutil.copyfile(source, working)
        with bpy.data.libraries.load(str(working), link=False) as (available, requested):
            if len(available.scenes) != 1:
                raise RuntimeError('Source has multiple scenes; choose the correct source scene before exporting')
            requested.scenes = [available.scenes[0]]
        imported_scene = requested.scenes[0]
        if imported_scene is None:
            raise RuntimeError('Could not append the supplied source scene')
        window.scene = imported_scene
        def find(name, kind):
            matches = [obj for obj in imported_scene.objects
                if obj.type == kind and re.sub(r'\.\d+$', '', obj.name) == name]
            if len(matches) != 1:
                raise RuntimeError('Expected one source object: ' + name)
            return matches[0]
        rig = find('狗骨頭', 'ARMATURE')
        meshes = [find(name, 'MESH') for name in ('狗身體', '狗眼')]
        if len(rig.data.bones) != 48:
            raise RuntimeError('Source rig does not match the verified 48-bone inventory')
        audit = runpy.run_path(str(project / 'scripts/audit_blend.py'), run_name='frankie_audit_helpers')
        audit_source(audit, imported_scene, source, folder / 'source.audit.json')
        exporter = runpy.run_path(str(project / 'scripts/export_frankie.py'), run_name='frankie_export_helpers')
        with (folder / 'export.log').open('w', encoding='utf-8') as log, contextlib.redirect_stdout(log):
            exporter['extract'](args, source_path=source, rig_override=rig, meshes_override=meshes)
        node = shutil.which('node')
        if node is None:
            raise RuntimeError('Raw GLB was exported; Node.js is needed to prepare the game animation')
        game_glb = project / 'public/assets/characters/frankie.glb'
        prepared = subprocess.run([node, str(project / 'scripts/prepare-frankie-glb.mjs'),
            args.output, str(game_glb), args.report], capture_output=True, text=True, encoding='utf-8')
        if prepared.returncode:
            raise RuntimeError('Raw GLB was exported but game preparation failed: ' + prepared.stderr)
        report = json.loads(Path(args.report).read_text(encoding='utf-8'))
        report['raw_glb'] = args.output
        report['glb'] = str(game_glb)
        report['game_prepared'] = True
        Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        counts = validate_glb(game_glb)
        if hashlib.sha256(source.read_bytes()).hexdigest() != before:
            raise RuntimeError('Source checksum changed')
        (folder / 'in-blender.status.json').write_text(json.dumps(dict(status='complete',
            meshes=counts[0], joints=counts[1], clips=counts[2], source_unchanged=True,
            user_scene_restored=True), indent=2), encoding='utf-8')
        (folder / 'in-blender.error.log').unlink(missing_ok=True)
        print('FRANKIE EXPORT COMPLETE:', game_glb)
        print('Editable character:', args.editable)
        print('Preview: http://127.0.0.1:5173/source_assets/frankie-run.html')
        webbrowser.open('http://127.0.0.1:5173/source_assets/frankie-run.html')
    except Exception:
        error = traceback.format_exc()
        (folder / 'in-blender.error.log').write_text(error, encoding='utf-8')
        print(error)
        raise
    finally:
        window.scene = previous_scene
        if working.is_file():
            working.unlink()


if __name__ == '__main__': main()
