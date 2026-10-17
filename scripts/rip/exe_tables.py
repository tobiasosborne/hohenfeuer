# Owns read-only extraction of the English ISO executable's ballistic tables.
"""Read a PE as bytes; never load, emulate, or execute its code.

Usage: python3 -I scripts/rip/exe_tables.py [path/to/Ballerburg.exe]
JSON goes to stdout. Semantic confidence and code evidence live in research/11.
Only the explicitly fingerprinted ISO build is accepted. No third-party modules.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path

EXPECTED_SHA256 = '1856b61fb8654aaefcc3f8e2b16918999e9f3fc325b08ad761dd0079dac01c9a'
DEFAULT_EXE = Path(__file__).resolve().parents[2] / 'downloads/en-iso/iso/Ballerburg.exe'
NAMES = (
    'Catapult', 'Fire catapult', 'Long John', 'Hot Helga', 'Trebuchet',
    'Reserved 39', 'Reserved 40', 'Reserved 41', 'Reserved 42', 'Ballista',
    'Fire ballista', 'Arcaballista', 'Cannon', 'Double cannon', 'Quad launcher',
    'Fat Freda', 'Hellfire', 'Rocket launcher', 'Zeppelin', 'Transport balloon',
)
# name, VA, element format, count; integer values retain native units.
TABLES = (
    ('build_cost', 0x5347e0, 'h', 54),
    ('base_fire_cost', 0x534860, 'h', 20),
    ('building_hp', 0x5349c4, 'B', 34),
    ('footprint', 0x535cd8, 'b', 54),
    ('reload_nominal_seconds', 0x534a0c, 'B', 36),
    ('launch_delay_ticks', 0x534a30, 'B', 36),
    ('powder_cost_coefficient', 0x534a54, 'B', 20),
    ('primary_projectile_count', 0x534a68, 'B', 28),
    ('powder_disable_exemption', 0x534a84, 'B', 20),
    ('unused_loaded_flag', 0x534a98, 'B', 20),
    ('unassigned_padding', 0x534aac, 'B', 4),
    ('fire_classification', 0x534ab0, 'B', 28),
    ('shield_class', 0x534acc, 'B', 28),
    ('impact_camera_shake', 0x534ae8, 'B', 28),
    ('elevation_limits', 0x534b04, 'BB', 20),
    ('spread_angle_units', 0x534b2c, 'B', 20),
    ('drag_numerator_C', 0x534eac, 'h', 26),
    ('drag_denominator_M', 0x534ee0, 'h', 26),
    ('launch_speed_coefficient_K', 0x534f14, 'h', 26),
    ('impact_records', 0x534f48, 'HHHBBBB', 28),
    ('wind_change_base_slots', 0x534718, 'i', 6),
    ('wind_magnitude', 0x534730, 'i', 9),
    ('default_tick_ms', 0x518430, 'I', 1),
    ('coordinate_to_world', 0x4eece4, 'f', 1),
    ('powder_price_initial', 0x5348e4, 'h', 1),
    ('ai_target_score_by_selector', 0x534b40, 'BBB', 64),
)


class StaticPE:
    """Minimal, bounds-checked PE32 VA-to-file mapper, not a PE loader."""
    def __init__(self, data):
        self.data = data
        if len(data) < 64 or data[:2] != b'MZ':
            raise ValueError('Not a DOS/PE file')
        pe = struct.unpack_from('<I', data, 0x3c)[0]
        if pe + 24 > len(data) or data[pe:pe + 4] != b'PE\0\0':
            raise ValueError('Invalid PE header')
        machine, count, timestamp, _, _, optional_size, characteristics = struct.unpack_from('<HHIIIHH', data, pe + 4)
        optional = pe + 24
        if optional + optional_size + count * 40 > len(data):
            raise ValueError('Truncated PE headers')
        if machine != 0x14c or struct.unpack_from('<H', data, optional)[0] != 0x10b:
            raise ValueError('Expected x86 PE32')
        self.base = struct.unpack_from('<I', data, optional + 28)[0]
        self.timestamp = timestamp
        self.relocations_stripped = bool(characteristics & 1)
        self.sections = []
        for index in range(count):
            pos = optional + optional_size + index * 40
            name = data[pos:pos + 8].rstrip(b'\0').decode('ascii')
            virtual_size, rva, raw_size, raw_offset = struct.unpack_from('<IIII', data, pos + 8)
            if raw_offset + raw_size > len(data):
                raise ValueError('Truncated section')
            self.sections.append(dict(name=name, va=self.base + rva, virtual_size=virtual_size,
                                      raw_size=raw_size, raw_offset=raw_offset))

    def offset(self, address, size):
        for section in self.sections:
            relative = address - section['va']
            if 0 <= relative and relative + size <= section['raw_size']:
                return section['raw_offset'] + relative
        raise ValueError(f'VA 0x{address:x}+{size} is not backed by file bytes')

    def read(self, address, fmt, count):
        stride = struct.calcsize('<' + fmt)
        start = self.offset(address, count * stride)
        rows = [struct.unpack_from('<' + fmt, self.data, start + i * stride) for i in range(count)]
        return [r[0] if len(r) == 1 else list(r) for r in rows]


def extract(path):
    data = Path(path).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != EXPECTED_SHA256:
        raise ValueError(f'Unverified executable SHA256 {digest}; expected {EXPECTED_SHA256}')
    pe = StaticPE(data)
    tables = {}
    for name, address, fmt, count in TABLES:
        tables[name] = dict(va=f'0x{address:x}', file_offset=f'0x{pe.offset(address, struct.calcsize("<" + fmt) * count):x}',
                            format='<' + fmt, count=count, values=pe.read(address, fmt, count))
    values = {name: record['values'] for name, record in tables.items()}
    weapons = []
    per_weapon = [name for name, _, _, _ in TABLES[4:19]]
    for index, name in enumerate(NAMES):
        type_id = index + 34
        row = dict(type_id=type_id, projectile_index=index, name=name, reserved=5 <= index <= 8,
                   build_cost=values['build_cost'][type_id], footprint=values['footprint'][type_id],
                   base_fire_cost=values['base_fire_cost'][index],
                   ai_target_score_by_selector=values['ai_target_score_by_selector'][type_id])
        row.update({key: values[key][index] for key in per_weapon if key != 'unassigned_padding'})
        impact = values['impact_records'][index]
        row['impact'] = dict(zip(('splash_radius', 'effect_radius', 'hud_radius', 'unassigned_zero_6',
                                  'direct_damage', 'splash_damage', 'unassigned_zero_9'), impact))
        weapons.append(row)
    return dict(source=str(path), sha256=digest, image_base=f'0x{pe.base:x}',
                pe_timestamp=pe.timestamp, relocations_stripped=pe.relocations_stripped,
                verification='Static bytes and disassembly only; no runtime verification; see research/11.',
                sections=pe.sections, tables=tables, weapons=weapons)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('executable', nargs='?', type=Path, default=DEFAULT_EXE)
    args = parser.parse_args()
    try:
        result = extract(args.executable)
    except (OSError, ValueError, struct.error) as error:
        parser.exit(1, f'exe_tables: {error}\n')
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
