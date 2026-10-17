# tools/blender/kit_v0.py - owns the independently authored fourteen-entry placeholder block kit.
from array import array
import argparse
import json
from pathlib import Path
import sys
import time

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import common

common.assert_blender_version()
assert bpy.app.version == (4, 5, 14)


# DESIGN 2.2 includes the empty air cell, not an extra weapon or walkway type.
BLOCKS = (
    (0, "air", (0.65, 0.82, 0.92)),
    (1, "stone", (0.64, 0.62, 0.56)),
    (2, "tower", (0.52, 0.55, 0.57)),
    (3, "gate", (0.59, 0.51, 0.39)),
    (4, "wood", (0.55, 0.31, 0.13)),
    (5, "floor", (0.67, 0.44, 0.22)),
    (6, "stairs", (0.63, 0.60, 0.50)),
    (7, "ladder", (0.72, 0.47, 0.22)),
    (8, "door", (0.39, 0.23, 0.12)),
    (9, "roof", (0.58, 0.15, 0.09)),
    (10, "magazine", (0.52, 0.34, 0.22)),
    (11, "palace", (0.77, 0.66, 0.45)),
    (12, "mount", (0.39, 0.44, 0.43)),
    (13, "foundation", (0.32, 0.34, 0.35)),
)


def make_atlas(path):
    """Original grayscale motifs; vertex colour supplies palette and baked light."""
    pixels = array("f")
    for y in range(512):
        for x in range(512):
            tile = x // 128 + (y // 128) * 4
            u, v = min(111, max(0, x % 128 - 8)), min(111, max(0, y % 128 - 8))
            value = 0.91 + ((u * 13 + v * 7) % 9) * 0.004
            if tile in (1, 2, 3, 6, 11, 12, 13):
                row = v // 28
                if v % 28 < 2 or (u + (row % 2) * 28) % 56 < 2:
                    value = 0.49
            if tile in (4, 5, 7, 8, 10):
                if u % 28 < 2:
                    value = 0.45
                elif (u * 3 + v // 6) % 21 < 2:
                    value = 0.76
            if tile == 9:
                if v % 28 < 3 or (u + (v // 28 % 2) * 14) % 28 < 2:
                    value = 0.51
            if tile == 3 and 32 < u < 80 and v < 88:
                value = 0.30 if u % 12 < 4 or v % 20 < 3 else 0.66
            if tile == 8 and (v in range(26, 33) or v in range(80, 87)):
                value = 0.28
            if tile == 10 and 36 < v < 75 and 29 < u < 82:
                value = 0.24 if (u + v) % 24 < 10 else 0.98
            if tile == 11 and (17 < u < 36 or 76 < u < 95) and 40 < v < 88:
                value = 0.20
            if tile == 12 and 20 < (u - 56) ** 2 + (v - 56) ** 2 < 28 ** 2:
                value = 0.62
            pixels.extend((value, value, value, 1))
    image = bpy.data.images.new("KitV0Atlas", width=512, height=512, alpha=True)
    image.colorspace_settings.name = "sRGB"
    image.pixels.foreach_set(pixels)
    image.filepath_raw, image.file_format = str(path), "PNG"
    image.save()
    image.pack()
    return image


def geometry(key):
    if key == "stairs":
        profile = [(-0.5, 0), (0.5, 0), (0.5, 1), (0, 1), (0, 0.5), (-0.5, 0.5)]
        vertices = [(x, y, z) for x in (-0.5, 0.5) for y, z in profile]
        faces = [tuple(reversed(range(6))), tuple(range(6, 12))]
        faces.extend((i, (i+1) % 6, (i+1) % 6+6, i+6) for i in range(6))
        return vertices, faces
    if key == "ladder":
        vertices, faces = [], []
        boxes = [((-0.4, 0.40, 0), (-0.30, 0.50, 1)),
                 ((0.30, 0.40, 0), (0.40, 0.50, 1))]
        boxes.extend(((-0.30, 0.40, z), (0.30, 0.50, z+0.06)) for z in (0.08, 0.27, 0.46, 0.65, 0.84))
        for low, high in boxes:
            new_vertices, new_faces = common.box_geometry(low, high)
            faces.extend(tuple(i+len(vertices) for i in face) for face in new_faces)
            vertices.extend(new_vertices)
        return vertices, faces
    if key == "door":
        return common.box_geometry((-0.45, 0.40, 0), (0.45, 0.50, 1))
    if key == "floor":
        return common.box_geometry((-0.5, -0.5, 0.82), (0.5, 0.5, 1))
    if key == "roof":
        return ([(-0.5,-0.5,0), (0.5,-0.5,0), (0.5,0.5,0), (-0.5,0.5,0),
                 (-0.5,0.5,1), (0.5,0.5,1)],
                [(0,3,2,1), (0,1,5,4), (3,4,5,2), (0,4,3), (1,2,5)])
    return common.box_geometry()


def generate(output):
    started = time.perf_counter()
    output = output.resolve()
    if not output.is_relative_to(common.ROOT / "assets"):
        raise ValueError("The authored kit must stay under assets/")
    output.mkdir(parents=True, exist_ok=True)
    (output / "thumbs").mkdir(exist_ok=True)
    common.reset_scene()
    common.setup_scene()
    atlas = make_atlas(output / "atlas.png")
    material = common.base_material("KitV0Base", atlas, vertex_colors=True)
    air_material = common.base_material("AirInvisible", atlas, vertex_colors=True, alpha=0)
    cam = common.camera("ThumbnailCamera")
    cam.data.type, cam.data.ortho_scale = "ORTHO", 1.75
    cam.location = (2.3, -3.2, 2.4)
    common.aim(cam, (0, 0, 0.5))
    manifest = dict(blender="4.5.14", units="metres", up="+Y", north="-Z", seed=common.SEED,
                    bounds_min_m=[-0.5, 0, -0.5], bounds_max_m=[0.5, 1, 0.5],
                    atlas=dict(file="atlas.png", size_px=512, tile_px=128, gutter_px=8),
                    provenance="Independent procedural placeholder geometry and texels.", blocks=[])
    for block_id, key, tint in BLOCKS:
        block_started = time.perf_counter()
        obj = common.mesh_object(key, *geometry(key), air_material if key == "air" else material,
                                 colors=tint, tile=block_id)
        obj["block_id"], obj["block_key"] = block_id, key
        obj["cell_size_m"] = 1.0
        obj["damage_state"] = 0
        if key == "air":
            obj["preview_only"] = True
        obj.data.calc_loop_triangles()
        triangles = len(obj.data.loop_triangles)
        if triangles >= 200:
            raise ValueError(f"{key}: too many triangles: {triangles}")
        common.export_glb(output / f"{key}.glb", [obj])
        label = None
        if key == "air":
            # Air exports as one fully transparent mesh so all 14 entries obey the
            # structural contract. Its labelled thumbnail is a preview aid only.
            text = bpy.data.curves.new("AirLabel", "FONT")
            text.body, text.align_x, text.size = "AIR\nempty cell", "CENTER", 0.24
            label = bpy.data.objects.new("AirLabel", text)
            bpy.context.scene.collection.objects.link(label)
            label.location = (0, 0, 0.5)
            label.rotation_euler = cam.rotation_euler
            text.materials.append(common.base_material("AirLabel"))
        common.render_png(output / "thumbs" / f"{key}.png", (256, 256))
        note = {"air": "Transparent preview proxy; runtime empty cells emit no mesh.",
                "floor": "Walkway slab: cell top at Y=1, thickness 0.18 m.",
                "stairs": "Two 0.5 m steps; rises toward north (-Z).",
                "ladder": "Non-solid ladder on the north (-Z) cell face.",
                "door": "One 1 m half of the required two-cell door pair; walkers pass.",
                "roof": "Default north-rising slope; ridge/corner variants are later skins.",
                "magazine": "Single cell; eight cells compose the 2x2x2 prefab.",
                "mount": "Weapon support cell; weapons are separate node hierarchies."}.get(key, "One 1 m cell.")
        manifest["blocks"].append(dict(id=block_id, key=key, mesh=f"{key}.glb", thumbnail=f"thumbs/{key}.png",
                                       triangles=triangles, note=note))
        if label:
            bpy.data.objects.remove(label, do_unlink=True)
        bpy.data.objects.remove(obj, do_unlink=True)
        print(f"KIT {block_id:02d} {key}: {triangles} tris, {time.perf_counter()-block_started:.3f}s", flush=True)
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    print(f"KIT_TOTAL {len(BLOCKS)} blocks in {time.perf_counter()-started:.3f}s -> {output}", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Generate the DESIGN 2.2 placeholder block palette")
    parser.add_argument("--output", type=Path, default=common.ROOT / "assets/kit-v0")
    args = parser.parse_args(common.argv())
    generate(args.output)


if __name__ == "__main__":
    common.run(main)
