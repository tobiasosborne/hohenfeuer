# tools/blender/verify_kit_v1.py - owns independent kit-v1 geometry, articulation and atlas acceptance checks.
import importlib.util
import io
import json
from pathlib import Path
import struct
import sys
import time

from PIL import Image

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("validator", Path(__file__).with_name("validate_glb.py"))
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)
KEYS = "air stone tower gate wood floor stairs ladder door roof magazine palace mount foundation".split()


def png_size(data):
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "Expected PNG"
    return struct.unpack_from(">II", data, 16)


def check(directory):
    started = time.perf_counter()
    manifest = json.loads((directory / "manifest.json").read_text())
    assert [b["key"] for b in manifest["blocks"]] == KEYS
    assert [b["id"] for b in manifest["blocks"]] == list(range(14))
    assert manifest["units"] == "metres" and manifest["up"] == "+Y"
    assert png_size((directory / "atlas.png").read_bytes()) == (4096, 4096)
    atlas=Image.open(directory/"atlas.png").convert("RGBA")
    results = []
    for block in manifest["blocks"]:
        assert len(block["damage_variants"]) == 3
        for state, name in enumerate([block["mesh"], *block["damage_variants"]]):
            result = validator.validate(directory / name, max_triangles=96)
            results.append(result)
            doc, binary = validator.parse_glb(directory / name)
            assert len(doc["meshes"]) == 1
            assert doc["nodes"][0]["name"] == block["key"] + (f"_z{state}" if state else "")
            for mesh in doc["meshes"]:
                for primitive in mesh["primitives"]:
                    assert "COLOR_0" in primitive["attributes"]
                    assert "TEXCOORD_1" in primitive["attributes"], "Local texture UVs are required"
                    _,global_uv=validator.accessor(doc,binary,primitive["attributes"]["TEXCOORD_0"])
                    _,local_uv=validator.accessor(doc,binary,primitive["attributes"]["TEXCOORD_1"])
                    for (u,v),(lu,lv) in zip(global_uv,local_uv):
                        col,row=int(u*16),int((1-v)*16)
                        region=col+row*16-(block["id"]*4+state)*4
                        assert 0<=region<4,"UV outside this block/state face set"
                        assert abs(u*4096-col*256-(lu*1024-region*256))<.002,"Atlas/local U mismatch"
                        assert abs((1-v)*4096-row*256-(1-lv)*256)<.002,"Atlas/local V mismatch"
            for material in doc["materials"]:
                if block["key"] != "air":
                    assert material["pbrMetallicRoughness"]["baseColorTexture"].get("texCoord", 0) == 1
            assert png_size((directory / "textures" / (Path(name).stem + ".png")).read_bytes()) == (1024, 256)
            strip=Image.open(directory/"textures"/(Path(name).stem+".png")).convert("RGBA")
            for region in range(4):
                tile=(block["id"]*4+state)*4+region
                x,y=(tile%16)*256,4096-(tile//16+1)*256
                assert atlas.crop((x,y,x+256,y+256)).tobytes()==strip.crop((region*256,0,(region+1)*256,256)).tobytes()
            if block["key"]!="air":
                assert len(doc["images"])==1
                view=doc["bufferViews"][doc["images"][0]["bufferView"]]
                offset=view.get("byteOffset",0)
                embedded=Image.open(io.BytesIO(binary[offset:offset+view["byteLength"]])).convert("RGBA")
                assert embedded.tobytes()==strip.tobytes(),"Embedded paint differs from the authored face set"
        assert png_size((directory / block["thumbnail"]).read_bytes()) == (256, 256)
    cannon = validator.validate(directory / "cannon.glb", [-0.8, 0, -1.6], [0.8, 1.4, 1.01], 1199)
    assert abs(cannon["dimensions_m"][1] - 1.4) < 0.005
    assert abs(cannon["dimensions_m"][2] - 2.6) < 0.005
    doc, _ = validator.parse_glb(directory / "cannon.glb")
    nodes = {node["name"]: (i, node) for i, node in enumerate(doc["nodes"])}
    for name in ["Base", "Yaw", "Pitch", "Muzzle", "Sight", "frame", "turntable", "barrel"]:
        assert name in nodes, f"Cannon missing {name}"
    assert nodes["Pitch"][0] in nodes["Yaw"][1]["children"]
    assert nodes["barrel"][0] in nodes["Pitch"][1]["children"]
    assert nodes["Muzzle"][0] in nodes["Pitch"][1]["children"]
    assert png_size((directory / "cannon-atlas.png").read_bytes()) == (512, 512)
    person = validator.validate(directory / "person.glb", [-0.6, 0, -0.4], [0.6, 1.75, 0.4], 300)
    assert abs(person["dimensions_m"][1] - 1.75) < 0.001
    results.extend([cannon, person])
    assert len(list(directory.rglob("*.glb"))) == len(results) == 58
    assert (directory / "thumbs/contact-sheet.png").is_file()
    return dict(results=results, failures=[], seconds=round(time.perf_counter() - started, 3))


if __name__ == "__main__":
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "assets/kit-v1"
    result = check(folder)
    if "--json" in sys.argv:
        print(json.dumps(result, indent=2))
    else:
        print(f"PASS {len(result['results'])} GLBs; articulation, scales, budgets, 14 palettes and 42 damage variants; {result['seconds']}s")
