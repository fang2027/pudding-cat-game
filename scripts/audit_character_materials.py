"""Read-only character material audit for the Jiayin GLB conversion.

blender --background source.blend --python scripts/audit_character_materials.py -- --output source.audit.json
"""
import argparse
import json
import runpy
import sys
from pathlib import Path
import bpy


def socket_value(socket):
    value = getattr(socket, 'default_value', None)
    if isinstance(value, (str, bool, int, float)) or value is None:
        return value
    try:
        return list(value)
    except TypeError:
        return str(value)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    output = Path(args.output).resolve()
    if output.suffix != '.json':
        raise SystemExit('The audit must be a separate .json file')
    report = runpy.run_path(str(Path(__file__).with_name('audit_blend.py')))['build_report']()
    report['material_graphs'] = [{
        'name': m.name, 'diffuse': list(m.diffuse_color),
        'nodes': [{
            'name': n.name, 'type': n.type,
            'image': n.image.name if n.type == 'TEX_IMAGE' and n.image else None,
            'inputs': {s.name: socket_value(s) for s in n.inputs},
        } for n in m.node_tree.nodes] if m.node_tree else [],
        'links': [(l.from_node.name, l.from_socket.name, l.to_node.name, l.to_socket.name)
                  for l in m.node_tree.links] if m.node_tree else [],
    } for m in bpy.data.materials]
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Character material audit:', output)


if __name__ == '__main__':
    main()
