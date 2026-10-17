<!-- src/plugins/castles/CONVERSION.md - owns the generated content's conversion policy. -->
# Authored block castles

Regenerate: `python3 -I scripts/rip/castles_to_defs.py --previews`.
Verify byte identity: `python3 -I scripts/rip/castles_to_defs.py --check`.
The generator reads decoded reference JSON locally. Shipped modules contain our
own ASCII block grids and metadata; they load without any reference directory.

Original cells are 5 m. We map them to **1.25 one-metre blocks**, a **1:4 horizontal
scale**: a 32x24-cell plateau becomes roughly 40x30 m, offset 4 m inside a 48x48 m
plot. Anchors use integer half-up rounding, independent of iteration order. Small
structures expand to usable minimum widths. Vertical dimensions are authored for
a 1.75 m ruler, rather than scaling the original walls below head height.

| Reference piece | Authored composition |
|---|---|
| Small / big wall | 2x2 stone union, 2 / 3 high; walkable top; alternating boundary merlons |
| Small / big tower | 3x3 / 4x4 tower shell; floor at 4 / 5 m; ladder access; corner merlons |
| Gun station | nearest unoccupied 3x3 platform; ladder shaft, floor and corner merlons |
| Gatehouse | gate-block 3x3 arch, 3 high; paired doors along the source orientation axis |
| Farmhouse / tavern | 4x4 wood shell, 3 high, tile roof, door and interior shelter |
| Mason / smithy | 4x4 stone workshop, roof and sheltered interior |
| Ammo workshop | full 2x2x2 magazine bay within a roofed workshop |
| Treasury | stone vault with a wood chest (core has no treasury block) |
| Windmill | taller timber building with a stationary timber cross |
| Superbrain / mage tower / idol | timber landmark; mage tower is taller; no spell/economy effects |
| Palace | 6x6 tower keep, roof, a single connected 2x2x3 palace core, front aisle and shelters |
| Wall weapons | cannon at nearby reachable station, capped by current tuning |
| Ground weapons | omitted; original type counts retained in metadata |

Mount sites reserve 3x3 areas, avoid the palace and magazine, and shift the minimum
Manhattan distance from the reference anchor (ties Z, X). Tower/gun ladders have
floors and two-cell clearance. Every marker is connected to the spawn by authored
ground access; least-cost routing prefers existing open space, adding paired doors
through blocked ground routes only when needed. Unsupported decorative fragments
are removed. Layouts without a gate get an explicit south escape arch. The metadata
reports those additions and removals. The unit suite checks all voxels for support,
exactly one connected palace, all marker volumes, and every mount/operator route
using the game's directed NPC graph, plus ten 600-tick two-AI runs.

`METADATA` beside each `CASTLE`, and `CASTLE_METADATA` in the generated index, supply
name-independent biome and provenance: CastleDef's strict contract has no biome
field. The earliest campaign usage gives the preferred biome; all known campaigns
and biomes are retained. Unreferenced layouts default to forest. Template IDs are
stable; no names were decoded, so names are descriptive rather than invented history.

The 32 primary mission maps use variant 1, missions 1..8, campaigns 1..4. Every
non-255 template reference is retained in source slot order (including three and
four castles); absent slots are compacted. MapDef supports one common starting
gold amount, so tuning supplies it; candidate per-slot gold stays in metadata.
Terrain height units and original slot positions are unresolved: only a coarse
authored 3/6/9 m relief class from each referenced terrain's range is used, with
new seeded terrain and standard duel/ring placements. Raw height/tile data is not
shipped. Secondary stages, scripted objectives, alliances and exact original
orientation meaning are lost. Source orientation ordinals map to N/E/S/W by policy.

Desert, ice and volcano palettes are authored after inspecting queen captures
019..021 and verified biome battles 122/125, 140/143, 145/147 (research/09).
Snow terrain is distinguished from the ice princess's auxiliary desert captures.
Skies, fog and rock props use existing BiomeView fields; no ripped textures,
unavailable palm/ice meshes, animated sails, special economies or lava mechanics
are introduced. Renderers decide how these view descriptions are displayed.

The deduplicated ASCII rows and layers keep all 145 castles enabled below 2 MB.
`tests/evidence/castles-generated-manifest.json` lists files, SHA256 and conversion
counts. Local reference-only previews: `castles-preview/contact-sheet.png` and
`castles-preview/orig-N.png` below the reference asset directory; thumbnails are
explicitly labelled reference and are never included in shipped content.
