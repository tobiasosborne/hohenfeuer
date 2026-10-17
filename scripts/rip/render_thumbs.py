# Owns Blender 4.5 headless visual verification of extracted textured OBJ assets.
import argparse
import json
import math
from pathlib import Path
import sys
import bpy
from mathutils import Vector


def aim(obj, point):
    obj.rotation_euler = (Vector(point)-obj.location).to_track_quat('-Z', 'Y').to_euler()


def render(paths, target):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for path in paths:
        bpy.ops.wm.obj_import(filepath=str(path.resolve()), forward_axis='NEGATIVE_Z', up_axis='Y')
    objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if not objects:
        raise ValueError('No imported meshes')
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    low = Vector(tuple(min(v[i] for v in points) for i in range(3)))
    high = Vector(tuple(max(v[i] for v in points) for i in range(3)))
    center, extent = (low+high)/2, max(high-low)
    for material in bpy.data.materials:
        if material.use_nodes:
            for node in material.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    node.inputs['Roughness'].default_value = 0.85
                    for texture in material.node_tree.nodes:
                        if texture.type == 'TEX_IMAGE' and texture.image and texture.image.channels == 4:
                            material.node_tree.links.new(texture.outputs['Alpha'],node.inputs['Alpha'])
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('Reference studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.20, 0.23, 0.29, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.65
    bpy.ops.object.camera_add(location=center+Vector((1.4, -1.9, 1.15))*extent)
    camera = bpy.context.object
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = extent*1.55
    aim(camera, center)
    scene.camera = camera
    for direction, energy, scale in [((1,-2,3), 1300, 2), ((-2,-1,1.3), 650, 2)]:
        bpy.ops.object.light_add(type='AREA', location=center+Vector(direction)*extent)
        light = bpy.context.object
        light.data.energy = energy*extent*extent/25
        light.data.shape = 'DISK'
        light.data.size = extent*scale
        aim(light, center)
    scene.view_settings.view_transform = 'Standard'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(target.resolve())
    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print('VERIFIED_RENDER', target, 'meshes', len(objects), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--meshes', type=Path, default=Path('assets-ripped/meshes'))
    parser.add_argument('--output', type=Path, default=Path('assets-ripped/thumbs'))
    parser.add_argument('--single', type=Path)
    parser.add_argument('--extras', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.single:
        jobs = [(args.single.stem, [args.single])]
    else:
        selected = ['Buildings/TurmKlein_z0', 'Buildings/MauerKlein_0_z0', 'Buildings/palast_z0',
                    'Buildings/bauernhaus_z0', 'Buildings/schatzkammer_z0', 'Buildings/windmuehle_z0',
                    'Objects/Katapult_Gestell', 'Objects/Kanone_Rohr', 'Objects/Trebuchet_Gestell',
                    'Objects/Ballista_Gestell', 'Objects/Hoellenorgel_Gestell', 'Objects/Zeppelin_Ballon']
        jobs = [(Path(name).name, [args.meshes/(name+'.obj')]) for name in selected]
        if args.extras:
            root=args.meshes.parent
            jobs.extend([
                ('Schnee_palast_z0',[root/'variants/Schnee/palast_z0.obj']),
                ('Vulkan_TurmKlein_z0',[root/'variants/Vulkan/TurmKlein_z0.obj']),
                ('Eiszapfen1_6do',[args.meshes/'Misc/Eiszapfen1.obj']),
                ('palast_shadow_6do',[args.meshes/'Shadows/palast_z0.obj']),
                ('tree_billboard_reference',[root/'reference/Tree_Level00_1_1.obj'])])
    log = []
    for name, paths in jobs:
        render(paths, args.output/(name+'.png'))
        log.append(dict(name=name, sources=[str(p) for p in paths], png=str(args.output/(name+'.png'))))
    name='renders.json' if not args.single else args.single.stem+'-render.json'
    (args.output/name).write_text(json.dumps(log, indent=2)+'\n')
