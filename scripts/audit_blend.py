"""Read-only inventory of a currently opened Blender file.

Example:
    blender --background pudding_cat.blend --python scripts/audit_blend.py -- \
        --output /tmp/pudding_cat_audit.json

The script does not save, modify, pack, export, or remap the source .blend.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import bpy


def cli_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="唯讀檢查目前開啟的 Blender 素材")
    parser.add_argument("--output", required=True, help="JSON 報告輸出路徑（不可以是 .blend）")
    return parser.parse_args(argv)


def animation_info(data):
    animation = getattr(data, "animation_data", None)
    if animation is None:
        return {"has_animation_data": False, "action": None, "nla_tracks": [], "drivers": []}
    action = animation.action
    driver_paths = []
    for driver in animation.drivers:
        driver_paths.append({"data_path": driver.data_path, "array_index": driver.array_index})
    return {
        "has_animation_data": True,
        "action": action.name if action else None,
        "nla_tracks": [
            {"name": track.name, "strips": [strip.name for strip in track.strips]}
            for track in animation.nla_tracks
        ],
        "drivers": driver_paths,
    }


def image_info(image):
    raw_path = image.filepath or image.filepath_raw or ""
    abs_path = None
    if raw_path and image.source == "FILE":
        try:
            abs_path = bpy.path.abspath(raw_path, library=image.library)
        except (TypeError, ValueError):
            abs_path = bpy.path.abspath(raw_path)
    return {
        "name": image.name,
        "source": image.source,
        "file_format": image.file_format,
        "filepath": raw_path,
        "resolved_path": abs_path,
        "path_exists": os.path.isfile(abs_path) if abs_path else None,
        "packed": bool(image.packed_file),
        "size": list(image.size),
        "library": image.library.filepath if image.library else None,
    }


def shape_key_info(mesh):
    key_data = mesh.shape_keys
    if key_data is None:
        return {"keys": [], "animation": None}
    return {
        "keys": [
            {
                "name": item.name,
                "value": item.value,
                "relative_key": item.relative_key.name if item.relative_key else None,
                "vertex_group": item.vertex_group,
                "mute": item.mute,
            }
            for item in key_data.key_blocks
        ],
        "animation": animation_info(key_data),
    }


def object_info(obj):
    result = {
        "name": obj.name,
        "type": obj.type,
        "parent": obj.parent.name if obj.parent else None,
        "location": list(obj.location),
        "rotation_euler": list(obj.rotation_euler),
        "scale": list(obj.scale),
        "visible_render": not obj.hide_render,
        "animation": animation_info(obj),
        "modifiers": [
            {
                "name": modifier.name,
                "type": modifier.type,
                "object": modifier.object.name
                if modifier.type == "ARMATURE" and modifier.object
                else None,
            }
            for modifier in obj.modifiers
        ],
    }
    if obj.type == "MESH":
        mesh = obj.data
        result["mesh"] = {
            "name": mesh.name,
            "vertex_count": len(mesh.vertices),
            "polygon_count": len(mesh.polygons),
            "uv_layers": [layer.name for layer in mesh.uv_layers],
            "vertex_groups": [group.name for group in obj.vertex_groups],
            "material_slots": [slot.material.name if slot.material else None for slot in obj.material_slots],
            "shape_keys": shape_key_info(mesh),
        }
    elif obj.type == "ARMATURE":
        armature = obj.data
        result["armature"] = {
            "name": armature.name,
            "bones": [
                {
                    "name": bone.name,
                    "parent": bone.parent.name if bone.parent else None,
                    "deform": bone.use_deform,
                }
                for bone in armature.bones
            ],
            "pose_constraints": [
                {"bone": bone.name, "name": constraint.name, "type": constraint.type}
                for bone in obj.pose.bones
                for constraint in bone.constraints
            ],
        }
    return result


def material_info(material):
    images = []
    if material.use_nodes and material.node_tree:
        for node in material.node_tree.nodes:
            if node.type == "TEX_IMAGE":
                images.append(
                    {
                        "node": node.name,
                        "image": node.image.name if node.image else None,
                    }
                )
    return {"name": material.name, "use_nodes": material.use_nodes, "image_nodes": images}


def build_report():
    report = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "blender_version": bpy.app.version_string,
        "source_blend": bpy.data.filepath or None,
        "scene_name": bpy.context.scene.name if bpy.context.scene else None,
        "unit_system": bpy.context.scene.unit_settings.system if bpy.context.scene else None,
        "objects": [object_info(obj) for obj in bpy.data.objects],
        "materials": [material_info(item) for item in bpy.data.materials],
        "images": [image_info(item) for item in bpy.data.images],
        "actions": [item.name for item in bpy.data.actions],
    }

    missing = [
        item["resolved_path"]
        for item in report["images"]
        if item["source"] == "FILE" and not item["packed"] and item["path_exists"] is False
    ]
    shapes = [
        obj["mesh"]["shape_keys"]
        for obj in report["objects"]
        if obj["type"] == "MESH" and obj["mesh"]["shape_keys"]["keys"]
    ]
    report["summary"] = {
        "object_count": len(report["objects"]),
        "mesh_count": sum(obj["type"] == "MESH" for obj in report["objects"]),
        "armature_count": sum(obj["type"] == "ARMATURE" for obj in report["objects"]),
        "shape_key_sets": len(shapes),
        "shape_key_names": sorted({key["name"] for item in shapes for key in item["keys"]}),
        "missing_external_image_paths": missing,
    }
    return report


def main():
    args = cli_args()
    destination = Path(args.output).expanduser().resolve()
    source = Path(bpy.data.filepath).resolve() if bpy.data.filepath else None
    if destination.suffix.lower() != ".json":
        raise SystemExit("--output 請指定 .json 副檔名")
    if source and destination == source:
        raise SystemExit("報告輸出不得覆寫來源 .blend")
    if not destination.parent.exists():
        raise SystemExit("報告輸出資料夾不存在，請先建立並確認路徑")
    report = build_report()
    with destination.open("w", encoding="utf-8") as file:
        json.dump(report, file, ensure_ascii=False, indent=2)
    print("[BLEND_AUDIT] JSON:", destination)
    print("[BLEND_AUDIT] Summary:", json.dumps(report["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
