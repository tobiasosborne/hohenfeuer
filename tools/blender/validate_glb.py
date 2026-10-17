# tools/blender/validate_glb.py - owns dependency-free validation of metre-scale block GLBs.
import argparse
import json
import math
from pathlib import Path
import struct
import sys


CELL_MIN = (-0.5, 0.0, -0.5)
CELL_MAX = (0.5, 1.0, 0.5)
EPSILON = 1e-5
COMPONENTS = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def parse_glb(path):
    raw = Path(path).read_bytes()
    require(len(raw) >= 20, "GLB header length is too short")
    magic, version, total = struct.unpack_from("<4sII", raw)
    require(magic == b"glTF" and version == 2, "expected a GLB 2.0 header")
    require(total == len(raw), "GLB header length does not match file length")
    offset, chunks = 12, []
    while offset < len(raw):
        require(offset + 8 <= len(raw), "truncated chunk header")
        size, kind = struct.unpack_from("<I4s", raw, offset)
        offset += 8
        require(size % 4 == 0 and offset + size <= len(raw), "invalid chunk length")
        chunks.append((kind, raw[offset:offset + size]))
        offset += size
    require(chunks and chunks[0][0] == b"JSON", "first GLB chunk must be JSON")
    require(sum(kind == b"JSON" for kind, _ in chunks) == 1, "duplicate JSON chunk")
    require(sum(kind == b"BIN\0" for kind, _ in chunks) == 1, "expected one embedded BIN chunk")
    document = json.loads(chunks[0][1].decode("utf8"),
                          parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f"non-finite JSON {value}")))
    require(document.get("asset", {}).get("version") == "2.0", "expected glTF asset version 2.0")
    payload = next(data for kind, data in chunks if kind == b"BIN\0")
    buffers = document.get("buffers", [])
    require(len(buffers) == 1 and "uri" not in buffers[0], "expected one embedded buffer")
    length = buffers[0].get("byteLength", -1)
    require(0 <= length <= len(payload) <= length + 3, "BIN buffer length mismatch")
    return document, payload[:length]


def accessor(document, payload, index):
    accessors = document.get("accessors", [])
    require(type(index) is int and 0 <= index < len(accessors), "accessor index out of range")
    item = accessors[index]
    require("sparse" not in item and "bufferView" in item, "sparse/missing accessor bufferView is unsupported")
    views = document.get("bufferViews", [])
    view_index = item["bufferView"]
    require(type(view_index) is int and 0 <= view_index < len(views), "bufferView index out of range")
    view = views[view_index]
    require(view.get("buffer", 0) == 0, "bufferView references an external buffer")
    start, length = view.get("byteOffset", 0), view.get("byteLength", -1)
    require(start >= 0 and length >= 0 and start + length <= len(payload), "bufferView extent out of range")
    require(item.get("componentType") in COMPONENTS and item.get("type") in WIDTHS, "unsupported accessor type")
    fmt, size = COMPONENTS[item["componentType"]]
    width = WIDTHS[item["type"]]
    stride = view.get("byteStride", width * size)
    count, relative = item.get("count", 0), item.get("byteOffset", 0)
    require(type(count) is int and count > 0, "empty accessor")
    require(stride >= width * size and stride % size == 0 and relative >= 0,
            "invalid accessor byte stride/offset")
    require(relative + (count - 1) * stride + width * size <= length, "accessor extent out of range")
    values = [struct.unpack_from("<" + fmt * width, payload, start + relative + n * stride)
              for n in range(count)]
    require(all(math.isfinite(v) for row in values for v in row), "accessor contains non-finite values")
    if item.get("normalized"):
        require(item["componentType"] in (5121, 5123), "invalid normalized component type")
        maximum = 255 if item["componentType"] == 5121 else 65535
        values = [tuple(value / maximum for value in row) for row in values]
    return item, values


def identity():
    return [[1 if i == j else 0 for j in range(4)] for i in range(4)]


def multiply(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def node_matrix(node):
    if "matrix" in node:
        values = node["matrix"]
        require(len(values) == 16 and all(math.isfinite(v) for v in values), "invalid node matrix")
        return [[values[j * 4 + i] for j in range(4)] for i in range(4)]
    t, s, q = node.get("translation", [0, 0, 0]), node.get("scale", [1, 1, 1]), node.get("rotation", [0, 0, 0, 1])
    require(len(t) == len(s) == 3 and len(q) == 4 and all(math.isfinite(v) for v in t + s + q),
            "invalid node transform")
    x, y, z, w = q
    require(abs(sum(v * v for v in q) - 1) < EPSILON, "invalid node quaternion")
    rotation = [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]
    matrix = identity()
    for i in range(3):
        for j in range(3):
            matrix[i][j] = rotation[i][j] * s[j]
        matrix[i][3] = t[i]
    return matrix


def no_draco(value):
    if isinstance(value, dict):
        for key, child in value.items():
            require(key != "KHR_draco_mesh_compression", "Draco compression is forbidden")
            no_draco(child)
    elif isinstance(value, list):
        for child in value:
            require(child != "KHR_draco_mesh_compression", "Draco compression is forbidden")
            no_draco(child)


def inspect_base_materials(document):
    """Reusable by the bpy exporter to reject unsupported material graphs."""
    for material in document.get("materials", []):
        forbidden = {"normalTexture", "occlusionTexture", "emissiveTexture", "emissiveFactor"} & material.keys()
        pbr = material.get("pbrMetallicRoughness", {})
        require(not forbidden and "metallicRoughnessTexture" not in pbr and pbr.get("metallicFactor", 0) == 0,
                "material must contain base colour/texture only")
        require(not (material.get("extensions", {}).keys() - {"KHR_materials_unlit"}),
                "material has a non-base-colour extension")


def validate(path, bounds_min=CELL_MIN, bounds_max=CELL_MAX, max_triangles=199):
    document, payload = parse_glb(path)
    no_draco(document)
    inspect_base_materials(document)
    require(all("uri" not in image for image in document.get("images", [])), "GLB textures must be embedded")
    meshes = document.get("meshes", [])
    require(meshes, "GLB contains no meshes")
    vertices, total = [], 0
    for mesh in meshes:
        require(mesh.get("primitives"), "mesh has no primitives")
        points = []
        for primitive in mesh["primitives"]:
            attributes = primitive.get("attributes", {})
            for key, kind in (("POSITION", "VEC3"), ("NORMAL", "VEC3"), ("TEXCOORD_0", "VEC2")):
                require(key in attributes, f"mesh is missing {key}")
                item, values = accessor(document, payload, attributes[key])
                require(item["type"] == kind and item["componentType"] == 5126, f"invalid {key} accessor")
                if key == "POSITION":
                    positions, count = values, len(values)
                    low = [min(v[i] for v in positions) for i in range(3)]
                    high = [max(v[i] for v in positions) for i in range(3)]
                    require(all(abs(a-b) < EPSILON for a,b in zip(item.get("min", []), low)) and
                            all(abs(a-b) < EPSILON for a,b in zip(item.get("max", []), high)) and
                            len(item.get("min", [])) == len(item.get("max", [])) == 3,
                            "POSITION declared bounds disagree with vertex data")
                else:
                    require(len(values) == count, f"{key} count differs from POSITION")
                    if key == "NORMAL":
                        require(all(abs(sum(x*x for x in v)-1) < 1e-3 for v in values), "NORMAL must be unit length")
            require(primitive.get("mode", 4) == 4, "only triangle primitives are supported")
            require("targets" not in primitive, "block morph targets are unsupported")
            if "indices" in primitive:
                item, indices = accessor(document, payload, primitive["indices"])
                require(item["type"] == "SCALAR" and item["componentType"] in (5121, 5123, 5125), "invalid index accessor")
                require(all(row[0] < count for row in indices), "triangle index out of range")
                index_count = len(indices)
            else:
                index_count = count
            require(index_count % 3 == 0, "incomplete triangle")
            total += index_count // 3
            points.extend(positions)
        vertices.append(points)
    require(total <= max_triangles, f"triangle budget exceeded: {total} > {max_triangles}")
    nodes, world_points, visited = document.get("nodes", []), [], set()

    def visit(index, parent, ancestors):
        require(type(index) is int and 0 <= index < len(nodes), "node index out of range")
        require(index not in ancestors, "cyclic node tree")
        node = nodes[index]
        world = multiply(parent, node_matrix(node))
        if "mesh" in node:
            mesh_index = node["mesh"]
            require(0 <= mesh_index < len(vertices), "mesh index out of range")
            visited.add(mesh_index)
            world_points.extend(tuple(sum(world[i][j] * p[j] for j in range(3)) + world[i][3]
                                      for i in range(3)) for p in vertices[mesh_index])
        for child in node.get("children", []):
            visit(child, world, ancestors | {index})

    scenes = document.get("scenes", [])
    scene_index = document.get("scene", 0)
    require(scenes and 0 <= scene_index < len(scenes), "missing/default scene out of range")
    for root in scenes[scene_index].get("nodes", []):
        visit(root, identity(), set())
    require(len(visited) == len(meshes), "every mesh must be referenced by the default scene")
    require(world_points, "scene has no positions")
    low = [min(p[i] for p in world_points) for i in range(3)]
    high = [max(p[i] for p in world_points) for i in range(3)]
    require(all(bounds_min[i] - EPSILON <= low[i] <= high[i] <= bounds_max[i] + EPSILON for i in range(3)),
            f"world bounds outside expected metres: {low} .. {high}")
    require(all(high[i] - low[i] > EPSILON for i in range(3)), "degenerate world bounds")
    return dict(file=str(path), meshes=len(meshes), triangles=total,
                bounds_min_m=low, bounds_max_m=high, dimensions_m=[high[i] - low[i] for i in range(3)])


def main():
    parser = argparse.ArgumentParser(description="Validate embedded GLB block geometry in Y-up metres")
    parser.add_argument("paths", nargs="+", type=Path, help="GLBs or directories (recursively searched)")
    parser.add_argument("--min", dest="bounds_min", nargs=3, type=float, default=CELL_MIN, metavar=("X", "Y", "Z"))
    parser.add_argument("--max", dest="bounds_max", nargs=3, type=float, default=CELL_MAX, metavar=("X", "Y", "Z"))
    parser.add_argument("--max-triangles", type=int, default=199)
    parser.add_argument("--json", action="store_true", help="emit machine-readable validation results")
    args = parser.parse_args()
    paths = sorted({file for path in args.paths for file in (path.rglob("*.glb") if path.is_dir() else [path])})
    if not paths:
        parser.error("no GLBs found")
    results, failures = [], []
    for path in paths:
        try:
            result = validate(path, args.bounds_min, args.bounds_max, args.max_triangles)
            results.append(result)
            if not args.json:
                print(f"PASS {path.name}: {result['meshes']} mesh, {result['triangles']} tris, "
                      f"dimensions (X,Y,Z) {tuple(round(v, 5) for v in result['dimensions_m'])} m")
        except (ValueError, OSError, KeyError, IndexError, TypeError, struct.error, RecursionError) as error:
            failures.append(dict(file=str(path), error=str(error)))
            print(f"FAIL {path}: {error}", file=sys.stderr)
    if args.json:
        print(json.dumps(dict(results=results, failures=failures), indent=2, allow_nan=False))
    else:
        print(f"Validated {len(results)}/{len(paths)} GLBs")
    return int(bool(failures))


if __name__ == "__main__":
    sys.exit(main())
