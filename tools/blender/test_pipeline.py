# tools/blender/test_pipeline.py - owns isolated adversarial GLB checks and generated kit checks.
import importlib.util
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("validate_glb", ROOT / "validate_glb.py")
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


def fixture():
    positions = [(-0.5, 0, -0.5), (0.5, 0, -0.5), (0, 1, 0.5)]
    normals = [(0, 1, 0)] * 3
    uvs = [(0, 0), (1, 0), (0.5, 1)]
    payload = b"".join(struct.pack("<3f", *v) for v in positions + normals)
    payload += b"".join(struct.pack("<2f", *v) for v in uvs)
    doc = {
        "asset": {"version": "2.0"},
        "buffers": [{"byteLength": len(payload)}],
        "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": 36},
                        {"buffer": 0, "byteOffset": 36, "byteLength": 36},
                        {"buffer": 0, "byteOffset": 72, "byteLength": 24}],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3",
             "min": [-0.5, 0, -0.5], "max": [0.5, 1, 0.5]},
            {"bufferView": 1, "componentType": 5126, "count": 3, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": 3, "type": "VEC2"}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2}}]}],
        "nodes": [{"mesh": 0}], "scenes": [{"nodes": [0]}], "scene": 0,
    }
    return doc, payload


def encode(doc, payload):
    raw = json.dumps(doc, separators=(",", ":")).encode()
    raw += b" " * (-len(raw) % 4)
    payload += b"\0" * (-len(payload) % 4)
    chunks = struct.pack("<I4s", len(raw), b"JSON") + raw
    chunks += struct.pack("<I4s", len(payload), b"BIN\0") + payload
    return struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks


class GlbContract(unittest.TestCase):
    def check_doc(self, doc, payload):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.glb"
            path.write_bytes(encode(doc, payload))
            return validator.validate(path)

    def test_valid_triangle(self):
        self.assertEqual(self.check_doc(*fixture())["triangles"], 1)

    def test_missing_uv(self):
        doc, payload = fixture()
        del doc["meshes"][0]["primitives"][0]["attributes"]["TEXCOORD_0"]
        with self.assertRaisesRegex(ValueError, "TEXCOORD_0"):
            self.check_doc(doc, payload)

    def test_draco_hidden_on_primitive(self):
        doc, payload = fixture()
        doc["meshes"][0]["primitives"][0]["extensions"] = {"KHR_draco_mesh_compression": {}}
        with self.assertRaisesRegex(ValueError, "[Dd]raco"):
            self.check_doc(doc, payload)

    def test_node_scale_is_measured(self):
        doc, payload = fixture()
        doc["nodes"][0]["scale"] = [100, 100, 100]
        with self.assertRaisesRegex(ValueError, "bounds"):
            self.check_doc(doc, payload)

    def test_positions_cannot_lie_about_bounds(self):
        doc, payload = fixture()
        payload = struct.pack("<f", -500) + payload[4:]
        with self.assertRaisesRegex(ValueError, "bounds"):
            self.check_doc(doc, payload)

    def test_accessor_cannot_overrun_buffer_view(self):
        doc, payload = fixture()
        doc["accessors"][0]["count"] = 100
        with self.assertRaisesRegex(ValueError, "(range|bounds|extent)"):
            self.check_doc(doc, payload)

    def test_normal_is_finite(self):
        doc, payload = fixture()
        payload = payload[:36] + struct.pack("<f", float("nan")) + payload[40:]
        with self.assertRaisesRegex(ValueError, "finite"):
            self.check_doc(doc, payload)

    def test_corrupt_header_length(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "broken.glb"
            path.write_bytes(encode(*fixture())[:-4])
            with self.assertRaisesRegex(ValueError, "length"):
                validator.validate(path)

    def test_material_cannot_have_normal_map(self):
        doc, payload = fixture()
        doc["materials"] = [{"normalTexture": {"index": 0}}]
        with self.assertRaisesRegex(ValueError, "material"):
            self.check_doc(doc, payload)


class GeneratedKit(unittest.TestCase):
    def test_palette_and_thumbnails(self):
        directory = ROOT.parents[1] / "assets/kit-v0"
        expected = ("air", "stone", "tower", "gate", "wood", "floor", "stairs", "ladder",
                    "door", "roof", "magazine", "palace", "mount", "foundation")
        self.assertEqual({p.stem for p in directory.glob("*.glb")}, set(expected))
        for tile, key in enumerate(expected):
            with self.subTest(key=key):
                result = validator.validate(directory / f"{key}.glb")
                self.assertEqual(result["meshes"], 1)
                self.assertLessEqual(result["triangles"], 96)
                document, payload = validator.parse_glb(directory / f"{key}.glb")
                primitive = document["meshes"][0]["primitives"][0]
                attributes = primitive["attributes"]
                _, uvs = validator.accessor(document, payload, attributes["TEXCOORD_0"])
                low_u = (tile % 4 * 128 + 8) / 512
                high_v = 1 - (tile // 4 * 128 + 8) / 512
                for u, v in uvs:
                    self.assertGreaterEqual(u, low_u - 1e-5)
                    self.assertLessEqual(u, low_u + 112 / 512 + 1e-5)
                    self.assertLessEqual(v, high_v + 1e-5)
                    self.assertGreaterEqual(v, high_v - 112 / 512 - 1e-5)
                _, colors = validator.accessor(document, payload, attributes["COLOR_0"])
                self.assertTrue(all(color[3] == 1 for color in colors))
                self.assertTrue(all(0 <= c <= 1 for color in colors for c in color))
                material = document["materials"][primitive["material"]]
                self.assertIn("KHR_materials_unlit", material["extensions"])
                if key != "air":
                    self.assertIn("baseColorTexture", material["pbrMetallicRoughness"])
                else:
                    self.assertEqual(material["pbrMetallicRoughness"]["baseColorFactor"][3], 0)
                png = (directory / "thumbs" / f"{key}.png").read_bytes()
                self.assertEqual(png[:8], b"\x89PNG\r\n\x1a\n")
                self.assertEqual(struct.unpack_from(">II", png, 16), (256, 256))


if __name__ == "__main__":
    unittest.main()
