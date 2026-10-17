# Owns synthetic corruption and traversal checks for the reference asset readers.
import importlib.util
from pathlib import Path
import struct
import unittest


def module(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


class ArchiveTests(unittest.TestCase):
    def test_literal_and_overlapping_match(self):
        # Literal A, then distance 1 / length 4: AAAA after the literal.
        bits = 0x82 | (1 << 9) | (2 << 14)
        packet = struct.pack('<3I', 5, 1, 0x11111111) + struct.pack('<I', bits)
        self.assertEqual(module('unpack_cpr').decode_packet(packet), b'AAAAA')

    def test_truncated_packet(self):
        with self.assertRaises(ValueError):
            module('unpack_cpr').decode_packet(struct.pack('<3I', 100, 1, 0x11111111))

    def test_bad_back_reference(self):
        with self.assertRaises(ValueError):
            module('unpack_cpr').decode_packet(struct.pack('<4I', 2, 1, 0x11111111, 1))

    def test_path_traversal(self):
        for name in ['../outside', 'a/../../outside', 'C:\\outside', '/absolute']:
            with self.assertRaises(ValueError):
                module('unpack_cpr').safe_path(Path('/tmp/claude-1000/rip'), name)


class GeometryTests(unittest.TestCase):
    def test_6do_quad_strip_does_not_cross(self):
        triangles=module('mesh2obj').triangulate_strip(4,0)
        points=[(0,0),(1,0),(0,1),(1,1)]
        areas=[]
        for a,b,c in triangles:
            x,y=points[a];u,v=points[b];s,t=points[c]
            areas.append(((u-x)*(t-y)-(v-y)*(s-x))/2)
        self.assertEqual(areas,[0.5,0.5])
        self.assertEqual(sum(areas),1)

    @staticmethod
    def fixture(index=2, run_count=1):
        def chunk(tag, data=b''):
            return struct.pack('<2I', tag, len(data))+data+bytes((-len(data)) % 4)
        return (struct.pack('<I',1)+chunk(8,struct.pack('<2I',0,500))+
                chunk(2,struct.pack('<9f',0,0,0,1,0,0,0,0,1))+
                chunk(4,struct.pack('<9f',0,1,0,0,1,0,0,1,0))+
                chunk(3,struct.pack('<6f',0,0,1,0,0,1))+
                chunk(15,struct.pack('<I',0xffffffff))+
                chunk(6,bytes([0,1,index]))+chunk(7,bytes([1,run_count]))+
                chunk(10)+chunk(0xffffffff))

    def test_valid_geometry_and_material(self):
        result=module('mesh2obj').parse7(self.fixture())
        self.assertEqual(result['parts'][0]['face_materials'],[500])
        self.assertEqual(result['parts'][0]['faces'],[(0,1,2)])

    def test_invalid_index(self):
        with self.assertRaises(ValueError):
            module('mesh2obj').parse7(self.fixture(index=3))

    def test_material_run_overflow(self):
        with self.assertRaises(ValueError):
            module('mesh2obj').parse7(self.fixture(run_count=2))

    def test_tex_member_past_eof(self):
        with self.assertRaises(ValueError):
            module('unpack_tex').parse(struct.pack('<6I',0x1000001,1,1000,0,0,500)+b'BM')


if __name__ == '__main__':
    unittest.main()
