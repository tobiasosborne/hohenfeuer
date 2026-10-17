# tools/blender/turntable.py - owns reference-only OBJ measurement and four-view turntable strips.
from array import array
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import time

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import common

common.assert_blender_version()
assert bpy.app.version == (4, 5, 14)

VIEWS = (("front", (0, -1, 0)), ("left", (-1, 0, 0)),
         ("back", (0, 1, 0)), ("top", (0, 0, 1)))
RIPPED = common.ROOT / "assets-ripped"
OUTPUT = RIPPED / "turntables"


def bounds(objects):
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    if not points:
        raise ValueError("No mesh bounds to measure")
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    if not all(math.isfinite(v) for v in (*low, *high)) or max(high - low) <= 0:
        raise ValueError("Invalid/empty OBJ bounds")
    return low, high


def text_object(name, body, material):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = body
    curve.materials.append(material)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def stitch(paths, output):
    """Keep the four PNG panels at native resolution, using Blender's image API."""
    images = [bpy.data.images.load(str(path), check_existing=False) for path in paths]
    width, height = images[0].size
    target = array("f", [0]) * (width * len(images) * height * 4)
    for number, image in enumerate(images):
        if tuple(image.size) != (width, height):
            raise ValueError("Panel dimensions differ")
        source = array("f", [0]) * (width * height * 4)
        image.pixels.foreach_get(source)
        for y in range(height):
            start = (y * width * len(images) + number * width) * 4
            target[start:start + width * 4] = source[y * width * 4:(y+1) * width * 4]
    strip = bpy.data.images.new("TurntableStrip", width=width * len(images), height=height, alpha=True)
    strip.colorspace_settings.name = "sRGB"
    strip.pixels.foreach_set(target)
    strip.filepath_raw, strip.file_format = str(output), "PNG"
    strip.save()
    for image in images + [strip]:
        bpy.data.images.remove(image)


def render(paths, output, name=None, scale=1.0, pose=None, poses=common.POSES):
    started = time.perf_counter()
    paths = [Path(path).resolve() for path in paths]
    output = Path(output).resolve()
    if not output.is_relative_to(OUTPUT) and not output.is_relative_to(common.ROOT / "assets"):
        raise ValueError("Turntable output must be in assets/ or assets-ripped/turntables/")
    if any(path.is_relative_to(RIPPED) for path in paths) and not output.is_relative_to(OUTPUT):
        raise ValueError("Reference renders must remain under assets-ripped/turntables/")
    if not math.isfinite(scale) or scale <= 0:
        raise ValueError("Scale must be a positive finite metres-per-OBJ-unit value")
    name = re.sub(r"[^A-Za-z0-9_.-]", "_", name or paths[0].stem)
    common.reset_scene()
    common.setup_scene()
    reference = bpy.data.collections.new("ReferenceOnly")
    bpy.context.scene.collection.children.link(reference)
    imported = []
    for path in paths:
        if path.suffix.lower() != ".obj":
            raise ValueError(f"Expected OBJ, not an executable or blend file: {path.name}")
        before = set(bpy.data.objects)
        with bpy.context.temp_override(scene=bpy.context.scene, collection=reference):
            result = bpy.ops.wm.obj_import(filepath=str(path), forward_axis="NEGATIVE_Z", up_axis="Y",
                                           global_scale=scale, clamp_size=0, validate_meshes=True)
        if "FINISHED" not in result:
            raise ValueError(f"Failed to import {path}")
        for obj in set(bpy.data.objects) - before:
            for collection in list(obj.users_collection):
                collection.objects.unlink(obj)
            reference.objects.link(obj)
            obj["reference_only"] = True
            if obj.type == "MESH":
                imported.append(obj)
    low, high = bounds(imported)
    center, dimensions = (low + high) / 2, high - low
    common.reference_materials(imported)
    reference_material = common.base_material("MetreReference", vertex_colors=True)
    cube = common.mesh_object("OneMetreReference", *common.box_geometry(), reference_material,
                              colors=(0.92, 0.82, 0.32))
    label_material = common.base_material("DiagnosticText")
    title = text_object("ViewLabel", "", label_material)
    ruler_label = text_object("OneMetreLabel", "1 m", label_material)
    cam = common.camera()
    cam.data.type = "ORTHO"
    cam.data.sensor_fit = "VERTICAL"
    extent = max(dimensions)
    # Exactly the same metres/pixel for all four panels of this asset; no auto-fit per view.
    cam.data.ortho_scale = max(extent + 2.5, (extent + 4.5) / (1024 / 768)) * 1.08
    cam.data.clip_start, cam.data.clip_end = 0.01, max(1500, extent * 12)
    distance = extent * 3 + 10
    output.mkdir(parents=True, exist_ok=True)
    frame_dir = output / ".frames" / name
    frame_dir.mkdir(parents=True, exist_ok=True)
    frames = []
    for view, direction in VIEWS:
        cam.location = center + Vector(direction) * distance
        common.aim(cam, center)
        rotation = cam.rotation_euler.to_quaternion()
        right, up = rotation @ Vector((1, 0, 0)), rotation @ Vector((0, 1, 0))
        horizontal_radius = sum(abs(right[i]) * dimensions[i] for i in range(3)) / 2
        cube_center = center - right * (horizontal_radius + 1.15)
        if view != "top":
            cube_center.z = low.z + 0.5
        cube.location = cube_center - Vector((0, 0, 0.5))
        ruler_label.location = cube_center + up * 0.7
        ruler_label.rotation_euler = cam.rotation_euler
        ruler_label.data.size = max(0.16, cam.data.ortho_scale * 0.023)
        title.parent = cam
        title.location = (-cam.data.ortho_scale * (1024 / 768) * 0.46,
                          cam.data.ortho_scale * 0.44, -distance * 0.5)
        title.rotation_euler = (0, 0, 0)
        title.data.size = cam.data.ortho_scale * 0.032
        title.data.body = f"{name} | {view}"
        frames.append(common.render_png(frame_dir / f"{view}.png"))
    strip_path = output / f"{name}.png"
    stitch(frames, strip_path)
    # Blender Z-up -> game Y-up, accounting for the sign of the depth axis.
    game_low = [low.x, low.z, -high.y]
    game_high = [high.x, high.z, -low.y]
    for obj in imported:
        obj.data.calc_loop_triangles()
    metadata = dict(name=name, blender="4.5.14", source_kind="reference_only", units="metres",
                    scale_metres_per_obj_unit=scale,
                    scale_note="1 OBJ unit assumed 1 m; no normalization or independent SI calibration.",
                    sources=[dict(path=str(path.relative_to(common.ROOT)) if path.is_relative_to(common.ROOT) else str(path),
                                  sha256=hashlib.sha256(path.read_bytes()).hexdigest()) for path in paths],
                    assembly="Multiple parts retain authored OBJ origins; animated hierarchy is not reconstructed.",
                    bounds_min_m=game_low, bounds_max_m=game_high,
                    dimensions_m=dict(width=dimensions.x, height=dimensions.z, depth=dimensions.y),
                    triangles=sum(len(obj.data.loop_triangles) for obj in imported),
                    views=[view for view, _ in VIEWS], projection="orthographic",
                    ortho_scale_m=cam.data.ortho_scale, metres_per_pixel=cam.data.ortho_scale / 768,
                    reference_cube_m=1.0, panel_size_px=[1024, 768], strip_size_px=[4096, 768],
                    strip=strip_path.name, seconds=round(time.perf_counter() - started, 3))
    # Render a fifth, separate frame when requested; it uses the exact shared pose,
    # without centering or scaling the reference geometry to hide alignment errors.
    if pose:
        cube.hide_render = title.hide_render = ruler_label.hide_render = True
        cam.parent = None
        common.apply_pose(cam, common.load_poses(poses)[pose])
        golden = common.render_png(output / f"{name}.pose-{pose}.png")
        metadata["golden_pose"] = dict(name=pose, source=str(poses), render=golden.name)
    metadata["seconds"] = round(time.perf_counter() - started, 3)
    (output / f"{name}.json").write_text(json.dumps(metadata, indent=2, allow_nan=False) + "\n", encoding="utf8")
    d = metadata["dimensions_m"]
    print(f"TURNTABLE {name}: {d['width']:.4f} x {d['height']:.4f} x {d['depth']:.4f} m (W,H,D), "
          f"{metadata['seconds']:.3f}s", flush=True)
    return metadata


def inventory_jobs(directory):
    files = [path for path in sorted(directory.rglob("*.obj"))
             if not any(part.casefold() in {"shadows", "objectshighlight"} for part in path.parts)]
    jobs = []
    for name in ("palast", "MauerKlein", "MauerGross", "TurmKlein", "TurmGross", "Burgtor"):
        candidates = [path for path in files if path.stem.casefold() in
                      {f"{name}_z0".casefold(), f"{name}_0_z0".casefold(), name.casefold()}]
        if candidates:
            jobs.append((name, [candidates[0]]))
    for name in ("Kanone", "Katapult"):
        parts = [path for path in files if path.stem.casefold().startswith(name.casefold() + "_")
                 and not any(suffix in path.stem.casefold() for suffix in ("_hl", "_lp", "_z"))]
        if parts:
            jobs.append((name, parts))
    return jobs


def write_inventory(output, records, requested):
    present = {record["name"] for record in records}
    lines = ["<!-- tools/blender/turntable.py output - owns measured reference turntable inventory. -->",
             "# Reference turntable inventory", "",
             "Blender 4.5.14; metres at 1 OBJ unit = 1 m unless the sidecar scale says otherwise.",
             "Source units have not been independently calibrated. No normalization is applied.",
             "Original coordinates and textures stay in the reference tree; these are inspection renders.",
             "Weapon parts retain their OBJ origins; this does not reconstruct animation or pivots.",
             "Each strip is front / left / back / top, four 1024x768 orthographic panels.",
             "All four panels share one scale and include a 1 m cube; JSON records metres per pixel.", "",
             "| Asset | Width m | Height m | Depth m | Parts | Seconds | Strip | Measurements |",
             "|---|---:|---:|---:|---:|---:|---|---|"]
    for record in records:
        name, d = record["name"], record["dimensions_m"]
        lines.append(f"| {name} | {d['width']:.4f} | {d['height']:.4f} | {d['depth']:.4f} | "
                     f"{len(record['sources'])} | {record['seconds']:.3f} | [{name}.png]({name}.png) | [{name}.json]({name}.json) |")
    lines += ["", f"Inventory: {len(present & set(requested))}/{len(requested)} requested originals rendered."]
    if set(requested) - present:
        lines.append("Unavailable names: " + ", ".join(sorted(set(requested) - present)) + ".")
    (output / "INVENTORY.md").write_text("\n".join(lines) + "\n", encoding="utf8")


def main():
    parser = argparse.ArgumentParser(description="Measure an OBJ and render front/left/back/top at one scale")
    parser.add_argument("obj", type=Path, nargs="?", help="Y-up OBJ; adjacent MTL/textures are loaded as data")
    parser.add_argument("output", type=Path, nargs="?", default=OUTPUT)
    parser.add_argument("--part", type=Path, action="append", default=[], help="additional part at its authored OBJ origin")
    parser.add_argument("--name")
    parser.add_argument("--scale", type=float, default=1.0, help="metres per OBJ unit, never automatic normalization")
    parser.add_argument("--inventory", type=Path, help="batch the eight DESIGN Phase 0 originals under this OBJ directory")
    parser.add_argument("--pose", help="also render this exact shared golden pose")
    parser.add_argument("--poses", type=Path, default=common.POSES)
    args = parser.parse_args(common.argv())
    if args.inventory:
        jobs = inventory_jobs(args.inventory)
        if not jobs:
            raise ValueError("No requested ripped OBJs found; supply an authored OBJ for a fallback demonstration")
        records = [render(paths, args.output, name, args.scale, args.pose, args.poses) for name, paths in jobs]
        write_inventory(args.output.resolve(), records,
                        ("palast", "MauerKlein", "MauerGross", "TurmKlein", "TurmGross", "Burgtor", "Kanone", "Katapult"))
    elif args.obj:
        render([args.obj, *args.part], args.output, args.name, args.scale, args.pose, args.poses)
    else:
        parser.error("provide an OBJ or --inventory directory")


if __name__ == "__main__":
    common.run(main)
