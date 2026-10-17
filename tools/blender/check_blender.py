# tools/blender/check_blender.py - owns Blender-side checks for shared camera poses and repeatable renders.
import hashlib
import json
import math
from pathlib import Path
import sys
import time

import bpy
from mathutils import Matrix, Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import common

common.assert_blender_version()
assert bpy.app.version == (4, 5, 14)


def near(actual, expected):
    assert (Vector(actual) - Vector(expected)).length < 1e-5, (tuple(actual), tuple(expected))


def main():
    started = time.perf_counter()
    saved = sys.argv[:]
    try:
        sys.argv = ["blender", "-b", "--", "--example", "value"]
        assert common.argv() == ["--example", "value"]
        sys.argv = ["blender", "-b"]
        assert common.argv() == []
    finally:
        sys.argv = saved
    pose_bytes = common.POSES.read_bytes()
    poses = common.load_poses()
    common.reset_scene()
    scene = common.setup_scene()
    cam = common.camera()
    # Independent Three YXZ rotation, followed by the coordinate conversion.
    for yaw, pitch in ((0, 0), (math.pi / 2, 0), (-0.7, 0.4)):
        pose = dict(position=[2, 3, 4], yaw=yaw, pitch=pitch, fov=60)
        common.apply_pose(cam, pose)
        near(cam.location, (2, -4, 3))
        # Blender's Euler order convention differs from Three's intrinsic YXZ.
        orientation = Matrix.Rotation(yaw, 3, "Y") @ Matrix.Rotation(pitch, 3, "X")
        near(cam.matrix_world.to_3x3() @ Vector((0, 0, -1)),
             common.game_to_blender(orientation @ Vector((0, 0, -1))))
        near(cam.matrix_world.to_3x3() @ Vector((0, 1, 0)),
             common.game_to_blender(orientation @ Vector((0, 1, 0))))
    common.apply_pose(cam, dict(position=[0, 1.7, 6], yaw=0, pitch=0, width=640, height=360), size=None)
    assert (scene.render.resolution_x, scene.render.resolution_y) == (640, 360)
    common.apply_pose(cam, poses[next(iter(poses))])
    assert (scene.render.resolution_x, scene.render.resolution_y) == (1024, 768)
    frame = cam.data.view_frame(scene=scene)
    vertical_fov = 2 * math.atan(max(abs(v.y / v.z) for v in frame))
    assert abs(vertical_fov - math.radians(poses[next(iter(poses))]["fov"])) < 1e-5
    assert scene.cycles.seed == 1 and not scene.cycles.use_animated_seed and not scene.cycles.use_denoising
    assert scene.eevee.taa_render_samples == 1 and not scene.eevee.use_raytracing and not scene.eevee.use_shadows
    material = common.base_material("MetreCube", vertex_colors=True)
    common.mesh_object("MetreCube", *common.box_geometry(), material, colors=(0.65, 0.60, 0.50))
    qa = common.ROOT / "assets/kit-v0/qa"
    common.render_png(qa / f"{next(iter(poses))}.png")
    # A fixed diagnostic view works even when the shared file later gains castle-only poses.
    common.apply_pose(cam, dict(position=[0, 1.7, 6], yaw=0, pitch=0))
    first = common.render_png(qa / "repeat-a.png")
    second = common.render_png(qa / "repeat-b.png")
    a, b = hashlib.sha256(first.read_bytes()).hexdigest(), hashlib.sha256(second.read_bytes()).hexdigest()
    assert a == b, "identical fixed scenes produced different PNGs"
    assert common.POSES.read_bytes() == pose_bytes, "shared camera file changed"
    result = dict(owns="Blender pose and repeat-render verification", blender="4.5.14", checks=8,
                  poses_loaded=list(poses), pose_file_sha256=hashlib.sha256(pose_bytes).hexdigest(),
                  render_size_px=[1024, 768], repeat_sha256=a, repeat_identical=True,
                  seconds=round(time.perf_counter() - started, 3))
    (qa / "checks.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")
    print("BLENDER_CHECKS " + json.dumps(result), flush=True)


if __name__ == "__main__":
    common.run(main)
