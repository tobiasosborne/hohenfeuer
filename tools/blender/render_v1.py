# tools/blender/render_v1.py - owns sandbox-compatible CPU inspection rendering with the shared sun/hemisphere lighting.
import bpy

import common


def setup_scene():
    scene=common.setup_scene()
    # EEVEE's EGL context cannot initialize inside the restricted worker. CPU
    # Cycles keeps the exact authored base colours and common sun/hemisphere.
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU"
    scene.cycles.samples=8
    scene.cycles.use_denoising=False
    scene.cycles.max_bounces=0
    scene.cycles.use_adaptive_sampling=False
    nodes,links=scene.world.node_tree.nodes,scene.world.node_tree.links
    background=nodes["Background"]
    camera_ray=nodes.new("ShaderNodeLightPath")
    strength=nodes.new("ShaderNodeMath")
    strength.operation="MULTIPLY"
    strength.inputs[1].default_value=.45
    links.new(camera_ray.outputs["Is Camera Ray"],strength.inputs[0])
    links.new(strength.outputs[0],background.inputs["Strength"])
    # Reference previews already have common.reference_materials()' explicit
    # normal-weighted hemisphere. Camera-only world avoids adding a second GI term.
    return scene
