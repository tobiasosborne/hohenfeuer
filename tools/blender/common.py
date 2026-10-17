# tools/blender/common.py - owns the pinned Blender scene, pose, lighting and export contract.
import argparse
import importlib.util
import json
import math
import os
from pathlib import Path
import random
import sys
import traceback

import bpy
from mathutils import Matrix, Vector


VERSION = (4, 5, 14)
ROOT = Path(__file__).resolve().parents[2]
POSES = ROOT / "tests/goldens/poses.json"
SEED = 1
SUN_DIRECTION = Vector((1, -2, 3)).normalized()  # Blender Z-up, surface toward sun.
SUN_COLOR = (1.0, 0.94, 0.82)
SKY_COLOR = (0.52, 0.65, 0.82)
GROUND_COLOR = (0.24, 0.20, 0.15)


def assert_blender_version():
    print(f"Blender version: {bpy.app.version_string}; required: 4.5.14", flush=True)
    try:
        assert bpy.app.version == (4, 5, 14), f"Expected {VERSION}, got {bpy.app.version}"
    except AssertionError:
        traceback.print_exc()
        # Blender otherwise returns success for Python exceptions unless its caller set
        # --python-exit-code. Enforce the pin for the short invocation as well.
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(1)


assert_blender_version()


def argv():
    """Only arguments following Blender's standalone -- belong to the script."""
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def run(main):
    """Keep failures non-zero even if the caller omitted --python-exit-code."""
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(1)


def reset_scene():
    """Remove startup state and previous jobs without UI/context-dependent deletion."""
    scene = bpy.context.scene
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    scene.world = None
    for groups in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.cameras,
                   bpy.data.lights, bpy.data.worlds, bpy.data.curves):
        for block in list(groups):
            if block.users == 0:
                groups.remove(block)
    if scene.node_tree:
        scene.node_tree.nodes.clear()
    scene.use_nodes = False
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    scene.frame_set(1)
    random.seed(SEED)
    scene.cycles.seed = SEED
    scene.cycles.use_animated_seed = False
    scene.cycles.use_denoising = False
    return scene


def setup_scene(size=(1024, 768)):
    scene = bpy.context.scene
    engines = {item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    if "BLENDER_EEVEE_NEXT" not in engines:
        raise RuntimeError(f"EEVEE NEXT missing; available engines: {sorted(engines)}")
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.use_compositing = False
    scene.render.use_sequencer = False
    scene.render.use_motion_blur = False
    scene.render.use_border = False
    scene.render.use_crop_to_border = False
    scene.render.dither_intensity = 0
    scene.view_settings.use_curve_mapping = False
    # Even when the visible stamp is disabled Blender otherwise writes Date and
    # RenderTime PNG text chunks, making byte-identical renders hash differently.
    for prop in scene.render.bl_rna.properties:
        if prop.identifier.startswith("use_stamp") and prop.type == "BOOLEAN":
            setattr(scene.render, prop.identifier, False)
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 4
    scene.eevee.taa_render_samples = 1  # No temporal jitter/MSAA in diagnostic frames.
    scene.eevee.use_taa_reprojection = False
    scene.eevee.use_shadows = False
    scene.eevee.use_shadow_jitter_viewport = False
    scene.eevee.use_raytracing = False
    scene.eevee.use_gtao = False
    scene.eevee.use_fast_gi = False
    scene.eevee.use_bokeh_jittered = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    world = bpy.data.worlds.new("ForestAmbient")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (*SKY_COLOR, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.45
    scene.world = world
    light = bpy.data.lights.new("Sun", "SUN")
    light.color, light.energy, light.use_shadow = SUN_COLOR, 1.25, False
    sun = bpy.data.objects.new("Sun", light)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (-SUN_DIRECTION).to_track_quat("-Z", "Y").to_euler()
    scene["seed"] = SEED
    scene["lighting"] = "one sun + normal-weighted hemisphere; no realtime shadows"
    return scene


def game_to_blender(point):
    """Game/glTF (X, Y up, Z) -> Blender (X, -Z, Y up)."""
    return Vector((point[0], -point[2], point[1]))


def load_poses(path=POSES):
    """Read the shared name -> {position|pos,yaw,pitch,fov?,width?,height?} JSON.

    Existing Playwright yaw/pitch are radians, Three Euler order YXZ. Do not
    reinterpret yaw as the sim's clockwise compass azimuth (which has opposite sign).
    """
    with Path(path).open(encoding="utf8") as handle:
        poses = json.load(handle)
    if not isinstance(poses, dict) or not poses:
        raise ValueError("poses must be a non-empty object keyed by pose name")
    result = {}
    for name, pose in poses.items():
        if not isinstance(pose, dict):
            raise ValueError(f"{name}: pose must be an object")
        pos = pose.get("position", pose.get("pos"))
        if not isinstance(pos, list) or len(pos) != 3:
            raise ValueError(f"{name}: expected position or pos with three coordinates")
        numeric = [*pos, pose.get("yaw", 0), pose.get("pitch", 0), pose.get("fov", 60)]
        if not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
                   for v in numeric):
            raise ValueError(f"{name}: pose values must be finite numbers")
        if not 0 < pose.get("fov", 60) < 180:
            raise ValueError(f"{name}: invalid vertical FOV")
        for key in ("width", "height"):
            if key in pose and (type(pose[key]) is not int or pose[key] <= 0):
                raise ValueError(f"{name}: {key} must be a positive integer")
        result[name] = dict(pose, position=pos, yaw=pose.get("yaw", 0),
                            pitch=pose.get("pitch", 0), fov=pose.get("fov", 60))
    return result


def camera(name="Camera"):
    data = bpy.data.cameras.new(name)
    data.clip_start, data.clip_end = 0.1, 1500
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.scene.camera = obj
    return obj


def apply_pose(obj, pose, size=(1024, 768)):
    if isinstance(pose, str):
        pose = load_poses()[pose]
    yaw, pitch = pose.get("yaw", 0), pose.get("pitch", 0)
    cy, sy, cp, sp = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch)
    # Camera-local right, up, back, transformed from Three YXZ into Z-up.
    basis = Matrix(((cy, sy * sp, sy * cp),
                    (sy, -cy * sp, -cy * cp),
                    (0, cp, -sp))).to_4x4()
    basis.translation = game_to_blender(pose.get("position", pose.get("pos")))
    obj.matrix_world = basis
    obj.data.type = "PERSP"
    obj.data.sensor_fit = "VERTICAL"
    obj.data.sensor_height = 24
    obj.data.lens = 12 / math.tan(math.radians(pose.get("fov", 60)) / 2)
    if size is None:
        size = (pose.get("width", 1024), pose.get("height", 768))
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = size
    return obj


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def mesh_object(name, vertices, faces, material=None, colors=None, tile=None, collection=None):
    """Flat mesh with explicit loop UVs and optional baked vertex colours."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.uv_layers.new(name="UVMap")
    if colors:
        mesh.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="CORNER")
    # Adding a color layer reallocates CustomData and invalidates a previously
    # retained UV-layer RNA handle. Fill buffers, then look up each layer afresh.
    uvs = [0.0] * (len(mesh.loops) * 2)
    rgba = [0.0] * (len(mesh.loops) * 4)
    for polygon in mesh.polygons:
        polygon.use_smooth = False
        normal = polygon.normal
        dropped = max(range(3), key=lambda i: abs(normal[i]))
        axes = [i for i in range(3) if i != dropped]
        for loop in polygon.loop_indices:
            point = mesh.vertices[mesh.loops[loop].vertex_index].co
            u, v = (point[i] + (0.5 if i < 2 else 0) for i in axes)
            if tile is not None:
                # 4x4 tiles, 128 px each, 8 px gutter in the 512 px v0 atlas.
                u, v = ((tile % 4 * 128 + 8 + u * 112) / 512,
                        (tile // 4 * 128 + 8 + v * 112) / 512)
            uvs[loop * 2:loop * 2 + 2] = (u, v)
            if colors:
                hemi = (normal.z + 1) * 0.5
                direct = max(0, normal.dot(SUN_DIRECTION))
                tint = colors[polygon.index] if isinstance(colors[0], (list, tuple)) else colors
                rgba[loop * 4:loop * 4 + 4] = tuple(
                    min(1, tint[i] * (0.28 + 0.18 * hemi + 0.48 * direct * SUN_COLOR[i]))
                    for i in range(3)) + (1,)
    mesh.uv_layers["UVMap"].data.foreach_set("uv", uvs)
    if colors:
        mesh.color_attributes["Color"].data.foreach_set("color", rgba)
    mesh.update()
    if material:
        mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def box_geometry(low=(-0.5, -0.5, 0), high=(0.5, 0.5, 1)):
    x, y, z = low
    X, Y, Z = high
    return ([(x,y,z), (X,y,z), (X,Y,z), (x,Y,z), (x,y,Z), (X,y,Z), (X,Y,Z), (x,Y,Z)],
            [(0,3,2,1), (0,1,5,4), (1,2,6,5), (2,3,7,6), (3,0,4,7), (4,5,6,7)])


def base_material(name, image=None, vertex_colors=False, alpha=1.0):
    """Base colour/texture only, recognized by glTF as KHR_materials_unlit."""
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    if image:
        texture = nodes.new("ShaderNodeTexImage")
        texture.image, texture.interpolation = image, "Linear"
        socket = texture.outputs["Color"]
    else:
        rgb = nodes.new("ShaderNodeRGB")
        rgb.outputs[0].default_value = (0.65, 0.65, 0.65, 1)
        socket = rgb.outputs[0]
    if vertex_colors:
        attribute = nodes.new("ShaderNodeVertexColor")
        attribute.layer_name = "Color"
        multiply = nodes.new("ShaderNodeMixRGB")
        multiply.blend_type = "MULTIPLY"
        multiply.inputs[0].default_value = 1
        links.new(socket, multiply.inputs[1])
        links.new(attribute.outputs["Color"], multiply.inputs[2])
        socket = multiply.outputs[0]
    if alpha < 1:
        transparent = nodes.new("ShaderNodeBsdfTransparent")
        mix = nodes.new("ShaderNodeMixShader")
        mix.inputs[0].default_value = alpha
        links.new(transparent.outputs[0], mix.inputs[1])
        links.new(socket, mix.inputs[2])
        socket = mix.outputs[0]
        material.surface_render_method = "BLENDED"
    links.new(socket, output.inputs["Surface"])
    material.use_backface_culling = True
    return material


def reference_materials(objects):
    """Lambert + normal-weighted ambient, preserving imported base colour/texture.

    EEVEE world backgrounds do not illuminate diffuse meshes without probes. The
    explicit emission term is a deterministic HemisphereLight equivalent; it is
    preview-only and is never exported into the clean-room asset kit.
    """
    materials = {slot.material for obj in objects for slot in obj.material_slots if slot.material}
    for material in materials:
        material.use_nodes = True
        nodes, links = material.node_tree.nodes, material.node_tree.links
        principled = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
        textures = [node for node in nodes if node.type == "TEX_IMAGE"]
        base = principled.inputs["Base Color"] if principled else None
        source = base.links[0].from_socket if base and base.is_linked else None
        if not source and textures:
            source = textures[0].outputs["Color"]
        output = next((node for node in nodes if node.type == "OUTPUT_MATERIAL"), None)
        output = output or nodes.new("ShaderNodeOutputMaterial")
        diffuse = nodes.new("ShaderNodeBsdfDiffuse")
        diffuse.inputs["Roughness"].default_value = 0
        geometry = nodes.new("ShaderNodeNewGeometry")
        separate = nodes.new("ShaderNodeSeparateXYZ")
        links.new(geometry.outputs["Normal"], separate.inputs[0])
        remap = nodes.new("ShaderNodeMapRange")
        remap.inputs[1].default_value = -1
        remap.inputs[2].default_value = 1
        links.new(separate.outputs["Z"], remap.inputs[0])
        hemi = nodes.new("ShaderNodeMixRGB")
        hemi.inputs[1].default_value = (*GROUND_COLOR, 1)
        hemi.inputs[2].default_value = (*SKY_COLOR, 1)
        links.new(remap.outputs[0], hemi.inputs[0])
        multiply = nodes.new("ShaderNodeMixRGB")
        multiply.blend_type = "MULTIPLY"
        multiply.inputs[0].default_value = 1
        multiply.inputs[1].default_value = tuple(base.default_value) if base else (0.65, 0.65, 0.65, 1)
        if source:
            links.new(source, diffuse.inputs["Color"])
            links.new(source, multiply.inputs[1])
        else:
            diffuse.inputs["Color"].default_value = multiply.inputs[1].default_value
        links.new(hemi.outputs[0], multiply.inputs[2])
        ambient = nodes.new("ShaderNodeEmission")
        ambient.inputs["Strength"].default_value = 0.45
        links.new(multiply.outputs[0], ambient.inputs["Color"])
        add = nodes.new("ShaderNodeAddShader")
        links.new(diffuse.outputs[0], add.inputs[0])
        links.new(ambient.outputs[0], add.inputs[1])
        links.new(add.outputs[0], output.inputs["Surface"])
        material.use_backface_culling = False


def render_png(path, size=(1024, 768)):
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.filepath = str(path)
    with bpy.context.temp_override(scene=scene):
        bpy.ops.render.render(write_still=True)
    return path


def export_glb(path, objects):
    """Export only selected authored objects, checking option names against 4.5 RNA."""
    path = Path(path).resolve()
    if not path.is_relative_to(ROOT / "assets"):
        raise ValueError("Shippable GLBs must stay under assets/")
    path.parent.mkdir(parents=True, exist_ok=True)
    for obj in bpy.context.view_layer.objects:
        obj.select_set(False)
    for obj in objects:
        if obj.get("reference_only"):
            raise ValueError("Reference geometry must never be exported")
        for slot in obj.material_slots:
            material = slot.material
            if material and material.use_nodes:
                for node in material.node_tree.nodes:
                    if node.type == "TEX_IMAGE" and node.image and node.image.filepath:
                        source = Path(bpy.path.abspath(node.image.filepath)).resolve()
                        if any(source.is_relative_to(ROOT / directory) for directory in ("assets-ripped", "downloads")):
                            raise ValueError("Reference textures must never be exported")
        obj.select_set(True)
    if bpy.context.scene.unit_settings.scale_length != 1:
        raise ValueError("Export requires unit scale 1: one Blender unit is one metre")
    bpy.context.view_layer.objects.active = objects[0]
    options = dict(filepath=str(path), check_existing=False, export_format="GLB",
                   use_selection=True, export_yup=True, export_apply=True,
                   export_texcoords=True, export_normals=True, export_tangents=False,
                   export_materials="EXPORT", export_vertex_color="ACTIVE",
                   export_all_vertex_colors=False, export_image_format="AUTO",
                   export_draco_mesh_compression_enable=False, export_use_gltfpack=False,
                   export_animations=False, export_cameras=False, export_lights=False,
                   export_extras=True)
    supported = {prop.identifier for prop in bpy.ops.export_scene.gltf.get_rna_type().properties}
    unknown = options.keys() - supported
    if unknown:
        raise RuntimeError(f"Pinned glTF exporter lacks options: {sorted(unknown)}")
    with bpy.context.temp_override(scene=bpy.context.scene, active_object=objects[0],
                                   selected_objects=objects, selected_editable_objects=objects):
        result = bpy.ops.export_scene.gltf(**options)
    if "FINISHED" not in result:
        raise RuntimeError(f"Export did not finish: {path}")
    spec = importlib.util.spec_from_file_location("block_glb_validator", Path(__file__).with_name("validate_glb.py"))
    validator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(validator)
    document, _ = validator.parse_glb(path)
    validator.no_draco(document)
    validator.inspect_base_materials(document)
    return path


def main():
    parser = argparse.ArgumentParser(description="Render an authored metre cube at a shared golden pose")
    parser.add_argument("--poses", type=Path, default=POSES)
    parser.add_argument("--pose", default="example-wall")
    parser.add_argument("--output", type=Path, default=ROOT / "assets/kit-v0/qa/example-wall.png")
    args = parser.parse_args(argv())
    reset_scene()
    setup_scene()
    material = base_material("MetreCube", vertex_colors=True)
    mesh_object("MetreCube", *box_geometry(), material, colors=(0.65, 0.60, 0.50))
    cam = camera()
    apply_pose(cam, load_poses(args.poses)[args.pose])
    render_png(args.output)
    print(f"POSE_RENDER {args.pose} -> {args.output} 1024x768", flush=True)


if __name__ == "__main__":
    run(main)
