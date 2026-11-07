"""Extract the verified Frankie rig in an isolated Blender background process.

The source is never saved. Run through export-frankie.cmd from Windows.
An editable character-only .blend retains the original rig, missing texture
references and source animation. The game GLB uses placeholder materials and
a sampled in-place run from source frames 277-404.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Matrix

RIG = '狗骨頭'
MESHES = ('狗身體', '狗眼')
START, END = 277, 404


def arguments():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    parser.add_argument('--editable', required=True)
    parser.add_argument('--report', required=True)
    return parser.parse_args(argv)


def source_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def placeholder(source, eyes):
    material = bpy.data.materials.new('FrankiePlaceholder_' + (source.name if source else 'Default'))
    # Do not assume a new material contains default nodes or English node names.
    # In newer Blender builds use_nodes may be a no-op, leaving an empty tree.
    if material.node_tree is None:
        material.use_nodes = True
    tree = material.node_tree
    if tree is None:
        raise RuntimeError('Could not create the placeholder material node tree')
    tree.nodes.clear()
    principled = tree.nodes.new('ShaderNodeBsdfPrincipled')
    output = tree.nodes.new('ShaderNodeOutputMaterial')
    output.is_active_output = True
    tree.links.new(principled.outputs['BSDF'], output.inputs['Surface'])
    if not output.inputs['Surface'].is_linked:
        raise RuntimeError('Placeholder shader is not connected to Material Output')
    color = (.06, .055, .05, 1) if eyes else (.56, .50, .43, 1)
    principled.inputs['Base Color'].default_value = color
    principled.inputs['Roughness'].default_value = .8
    material.diffuse_color = color
    material['placeholder'] = True
    material['original_material'] = source.name if source else ''
    return material


def game_mesh(original, rig, scene, materials):
    """Bake non-armature modifiers identically on the basis and every morph."""
    key = original.data.shape_keys
    shapes = []
    if key:
        key.animation_data_clear()
        shapes = [(k.name, k.slider_min, k.slider_max) for k in key.key_blocks[1:]]
        for block in key.key_blocks: block.value = 0
    for modifier in original.modifiers:
        if modifier.type == 'ARMATURE': modifier.show_viewport = False
        if modifier.type == 'SUBSURF': modifier.levels = min(modifier.levels, 1)

    def evaluate():
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated = original.evaluated_get(depsgraph)
        result = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=depsgraph).copy()
        evaluated.to_mesh_clear()
        return result

    basis = evaluate()
    morphs = []
    for name, low, high in shapes:
        key.key_blocks[name].value = 1
        evaluated = evaluate()
        if len(evaluated.vertices) != len(basis.vertices):
            raise RuntimeError('Modifier topology differs across morphs: ' + original.name + '/' + name)
        coordinates = [component for vertex in evaluated.vertices for component in vertex.co]
        morphs.append((name, low, high, coordinates))
        bpy.data.meshes.remove(evaluated)
        key.key_blocks[name].value = 0
    result = original.copy()
    result.data = basis
    result.name = original.name + '_Game'
    scene.collection.objects.link(result)
    for modifier in list(result.modifiers): result.modifiers.remove(modifier)
    armature = result.modifiers.new('FrankieSkin', 'ARMATURE')
    armature.object = rig
    if morphs:
        result.shape_key_add(name='Basis')
        for name, low, high, coordinates in morphs:
            block = result.shape_key_add(name=name)
            block.slider_min = low
            block.slider_max = high
            block.data.foreach_set('co', coordinates)
    basis.materials.clear()
    for material in materials:
        basis.materials.append(material)
    result['source_object'] = original.name
    result['missing_textures'] = True
    return result


def extract(args, source_path=None, rig_override=None, meshes_override=None):
    source = Path(source_path or bpy.data.filepath).resolve()
    output, editable, report_path = [Path(p).resolve() for p in (args.output, args.editable, args.report)]
    if source in (output, editable, report_path) or output.suffix != '.glb' or editable.suffix != '.blend':
        raise RuntimeError('Outputs must be separate GLB, BLEND and JSON files; never overwrite the source.')
    for path in (output, editable, report_path): path.parent.mkdir(parents=True, exist_ok=True)
    before = source_hash(source)
    rig = rig_override if rig_override is not None else bpy.data.objects.get(RIG)
    originals = list(meshes_override) if meshes_override is not None else [bpy.data.objects.get(name) for name in MESHES]
    if rig is None or rig.type != 'ARMATURE' or any(obj is None or obj.type != 'MESH' for obj in originals):
        raise RuntimeError('Expected the verified dog rig and two original meshes; extraction stopped.')
    for obj in originals:
        if not any(m.type == 'ARMATURE' and m.object == rig for m in obj.modifiers):
            raise RuntimeError('Unexpected skin binding: ' + obj.name)

    # Validate shader creation before the expensive pose/morph sampling. Only
    # newly created game materials change; the editable source materials stay.
    material_sets = [[placeholder(slot.material, obj.name.split('.')[0] == '狗眼')
        for slot in obj.material_slots] or [placeholder(None, obj.name.split('.')[0] == '狗眼')]
        for obj in originals]

    original_scene = bpy.context.scene
    scene = bpy.data.scenes.new('FrankieCharacter')
    source_fps = original_scene.render.fps / original_scene.render.fps_base
    scene.render.fps = round(source_fps)
    scene.render.fps_base = round(source_fps) / source_fps
    scene.frame_start, scene.frame_end = START, END
    for obj in [rig, *originals]: scene.collection.objects.link(obj)
    bpy.context.window.scene = scene
    for obj in [rig, *originals]:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False
    scene.frame_set(START)
    # Write a standalone scene with only Frankie, while retaining his source
    # controls, full source action, UVs, modifiers, morphs and material slots.
    bpy.data.libraries.write(str(editable), {scene}, fake_user=True, compress=True)

    root = next((b for b in rig.pose.bones if b.parent is None), None)
    if root is None or root.name != '骨骼':
        raise RuntimeError('Unexpected root bone; stopped before changing animation data.')
    source_action = rig.animation_data.action.name if rig.animation_data and rig.animation_data.action else None
    frozen_world = rig.matrix_world.copy()
    samples, morph_values = [], []
    for frame in range(START, END + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        evaluated = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
        root_world = evaluated.matrix_world @ evaluated.pose.bones[root.name].matrix
        yaw = root_world.to_quaternion().to_euler('XYZ').z
        remove_travel = Matrix.Rotation(-yaw, 4, 'Z') @ Matrix.Translation((-root_world.translation.x, -root_world.translation.y, 0))
        world_to_rig = frozen_world.inverted() @ remove_travel @ evaluated.matrix_world
        samples.append({bone.name: world_to_rig @ bone.matrix for bone in evaluated.pose.bones})
        morph_values.append({obj.name: {k.name: float(k.value) for k in obj.data.shape_keys.key_blocks[1:]}
            if obj.data.shape_keys else {} for obj in originals})

    scene.frame_set(START)
    game_objects = [game_mesh(obj, rig, scene, materials) for obj, materials in zip(originals, material_sets)]
    for obj in originals: scene.collection.objects.unlink(obj)
    rig.animation_data_clear()
    rig.data.animation_data_clear()
    rig.matrix_world = frozen_world
    for constraint in list(rig.constraints): rig.constraints.remove(constraint)
    for pose_bone in rig.pose.bones:
        for constraint in list(pose_bone.constraints): pose_bone.constraints.remove(constraint)
        pose_bone.rotation_mode = 'QUATERNION'
    rig.animation_data_create()
    rig.animation_data.action = bpy.data.actions.new('FrankieRun')
    rig['source_frames'] = f'{START}-{END}'
    rig['root_motion_removed'] = True
    scene.frame_start, scene.frame_end = 0, END - START

    # Preserve the reference range, with a short closing transition to avoid
    # a hard jump at the repeat boundary. The editable .blend stays untouched.
    closing_frames = 6
    first = samples[0]
    for index, pose in enumerate(samples):
        blend = max(0, (index - (len(samples) - 1 - closing_frames)) / closing_frames)
        if blend:
            pose = {name: matrix.lerp(first[name], blend) for name, matrix in pose.items()}
        scene.frame_set(index)
        for bone in rig.pose.bones:
            if bone.parent:
                basis = bone.bone.convert_local_to_pose(pose[bone.name], bone.bone.matrix_local,
                    parent_matrix=pose[bone.parent.name], parent_matrix_local=bone.parent.bone.matrix_local, invert=True)
            else:
                basis = bone.bone.convert_local_to_pose(pose[bone.name], bone.bone.matrix_local, invert=True)
            bone.matrix_basis = basis
            bone.keyframe_insert(data_path='location', frame=index, group=bone.name)
            bone.keyframe_insert(data_path='rotation_quaternion', frame=index, group=bone.name)
            bone.keyframe_insert(data_path='scale', frame=index, group=bone.name)
        for obj, original in zip(game_objects, originals):
            if obj.data.shape_keys:
                for key in obj.data.shape_keys.key_blocks[1:]:
                    values = morph_values[index][original.name]
                    key.value = values.get(key.name, 0) * (1 - blend) + morph_values[0][original.name].get(key.name, 0) * blend
                    key.keyframe_insert(data_path='value', frame=index)

    scene.frame_set(0)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [rig, *game_objects]: obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    export_properties = bpy.ops.export_scene.gltf.get_rna_type().properties
    options = dict(filepath=str(output), export_format='GLB', use_selection=True,
        export_animations=True, export_frame_range=True, export_frame_step=1,
        export_force_sampling=True, export_skins=True, export_morph=True,
        export_extras=True, export_yup=True, export_apply=False,
        export_animation_mode='SCENE', use_active_scene=True, export_def_bones=False,
        export_nla_strips_merged_animation_name='FrankieRun')
    options = {key: value for key, value in options.items() if key in export_properties}
    result = bpy.ops.export_scene.gltf(**options)
    if 'FINISHED' not in result or not output.is_file(): raise RuntimeError('GLB export did not complete.')
    if source_hash(source) != before: raise RuntimeError('Source checksum changed; stop and inspect.')
    report = dict(source=str(source), source_sha256=before, source_unchanged=True,
        rig=RIG, bones=len(rig.data.bones), source_meshes=list(MESHES), source_action=source_action,
        source_frames=[START, END], fps=scene.render.fps / scene.render.fps_base,
        root_motion_removed=True, closing_transition_frames=closing_frames,
        placeholder_materials=True, editable=str(editable), glb=str(output),
        meshes=[dict(name=obj.name, vertices=len(obj.data.vertices), uv_layers=len(obj.data.uv_layers),
            morph_targets=len(obj.data.shape_keys.key_blocks)-1 if obj.data.shape_keys else 0) for obj in game_objects])
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('FRANKIE_EXPORT_COMPLETE', output)


if __name__ == '__main__': extract(arguments())
