"""Bake only garment Solidify/Subdivision geometry, retaining named skin weights.

Run in a separate Blender process:
blender --background --factory-startup --python scripts/export_clothing_geometry.py --
  --source SOURCE.blend --input-dir CURRENT_GLB_DIR --output clothing.geometry.json

Never saves the source .blend. Armature deformation is excluded from the bake;
the existing game skeleton will deform the interpolated garment weights.
"""
import argparse
import json
import struct
import sys
from pathlib import Path
import bpy


def gltf_json(file):
    data = file.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + length])


def gltf_vector(vector):
    return (vector[0], vector[2], -vector[1])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--input-dir', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    output = Path(args.output).resolve()
    if output.suffix != '.json':
        raise SystemExit('Output must be a separate JSON file')
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.source).resolve()), load_ui=False, use_scripts=False)
    report = {'characters': []}
    for file, name in [('jiayin-baby.glb', '身體_1.002'), ('jiayin-girl.glb', '裙')]:
        model = gltf_json(Path(args.input_dir) / file)
        node = next(n for n in model['nodes'] if n.get('name') == name and 'mesh' in n)
        original = model['meshes'][node['mesh']]
        skin = model['skins'][node['skin']]
        joint_indices = {model['nodes'][n]['name']: i for i, n in enumerate(skin['joints'])}
        obj = bpy.data.objects[name]
        obj.data.calc_loop_triangles()
        raw_triangles = len(obj.data.loop_triangles)
        old_triangles = sum(model['accessors'][p['indices']]['count'] // 3 for p in original['primitives'])
        if raw_triangles != old_triangles:
            raise ValueError(f'{name}: input garment no longer matches the unmodified source')
        # The existing export bakes a uniform scale into mesh coordinates. Infer
        # it from source/input bounds and verify every axis, keeping nodes intact.
        points = [gltf_vector(v.co) for v in obj.data.vertices]
        source_min = [min(p[i] for p in points) for i in range(3)]
        source_max = [max(p[i] for p in points) for i in range(3)]
        accessors = [model['accessors'][p['attributes']['POSITION']] for p in original['primitives']]
        old_min = [min(a['min'][i] for a in accessors) for i in range(3)]
        old_max = [max(a['max'][i] for a in accessors) for i in range(3)]
        scale = (old_max[0] - old_min[0]) / (source_max[0] - source_min[0])
        for i in range(3):
            if abs(source_min[i] * scale - old_min[i]) > 1e-5 or abs(source_max[i] * scale - old_max[i]) > 1e-5:
                raise ValueError(f'{name}: unexpected input coordinate transform')
        applied = []
        for modifier in obj.modifiers:
            if modifier.type == 'ARMATURE':
                modifier.show_viewport = False
            elif modifier.type in {'SOLIDIFY', 'SUBSURF'}:
                modifier.show_viewport = True
                if modifier.type == 'SUBSURF':
                    modifier.levels = modifier.render_levels
                applied.append({'type': modifier.type,
                                'levels': getattr(modifier, 'levels', None),
                                'thickness': getattr(modifier, 'thickness', None),
                                'offset': getattr(modifier, 'offset', None)})
            else:
                raise ValueError(f'{name}: unexpected garment modifier {modifier.type}')
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=depsgraph)
        try:
            mesh.calc_loop_triangles()
            if not mesh.uv_layers.active:
                raise ValueError(f'{name}: missing garment UVs')
            uv = mesh.uv_layers.active.data
            group_names = {g.index: g.name for g in obj.vertex_groups}
            weights = []
            for v in mesh.vertices:
                influences = [(joint_indices[group_names[g.group]], g.weight) for g in v.groups
                              if group_names[g.group] in joint_indices and g.weight > 0]
                influences.sort(key=lambda item: item[1], reverse=True)
                influences = influences[:4]
                total = sum(w for _, w in influences)
                if not total:
                    raise ValueError(f'{name}: garment vertex has no skin weights')
                weights.append(([j for j, _ in influences] + [0] * (4 - len(influences)),
                                [w / total for _, w in influences] + [0] * (4 - len(influences))))
            primitives = {}
            caches = {}
            for triangle in mesh.loop_triangles:
                material = obj.material_slots[triangle.material_index].material.name
                primitive = primitives.setdefault(material, {'material': material, 'positions': [], 'normals': [],
                                                             'uvs': [], 'joints': [], 'weights': [], 'indices': []})
                cache = caches.setdefault(material, {})
                for loop_index in triangle.loops:
                    vertex_index = mesh.loops[loop_index].vertex_index
                    normal = gltf_vector(mesh.corner_normals[loop_index].vector)
                    texcoord = (uv[loop_index].uv[0], 1 - uv[loop_index].uv[1])
                    key = (vertex_index, tuple(round(n, 6) for n in normal), tuple(round(t, 7) for t in texcoord))
                    if key not in cache:
                        cache[key] = len(primitive['positions']) // 3
                        primitive['positions'].extend(c * scale for c in gltf_vector(mesh.vertices[vertex_index].co))
                        primitive['normals'].extend(normal)
                        primitive['uvs'].extend(texcoord)
                        primitive['joints'].extend(weights[vertex_index][0])
                        primitive['weights'].extend(weights[vertex_index][1])
                    primitive['indices'].append(cache[key])
            report['characters'].append({'file': file, 'object': name, 'mesh': node['mesh'],
                                         'raw_triangles': raw_triangles, 'triangles': len(mesh.loop_triangles),
                                         'scale': scale, 'modifiers': applied,
                                         'primitives': list(primitives.values())})
        finally:
            evaluated.to_mesh_clear()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('BAKED GARMENTS:', [(c['object'], c['raw_triangles'], c['triangles']) for c in report['characters']])


if __name__ == '__main__':
    main()
