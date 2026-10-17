<!-- Owns the TB4 weapon plugin conventions and contract adaptations. -->
# Weapon plugins

The ten playable weapons use the existing defence-point/economy rows in `src/tuning.js`,
including 60/96 support HP for independent ground-weapon entities. The palace is unchanged.
Each folder owns its sim definition and kit-v1 view path; both indexes explicitly import and
register that folder. `weapon-def.js` projects a row into the strict `WeaponDef` shape. A new
ordinary plugin can provide a local row and use shared fire/burst/effect behavior without
changing engine switches. The folder-versus-index acceptance test remains enabled.

`WeaponDef` cannot express a fixed pitch/K, a powered trajectory, an air mount, `mapOnly`,
availability, or a muzzle offset. It also requires lobbed elevation bands to start at 45°.
Contracts were not edited. Core fixed pitch/K/rocket metadata comes from tuning; `elevDeg`
retains the validated legacy branch band. View modules export part names and muzzle offsets
separately; the GLB `Muzzle` node controls rendering. The shared simulator retains its cannon
muzzle convention (0.5 m high, half-cell plus two projectile radii forward) for all weapons so
existing controller muzzle geometry agrees. The reference cannon's legacy exported view
offset remains 0.75 m. A future contract revision should put fixed pitch, control law,
availability, muzzle geometry and physical coefficients in the hashed definition itself.

Zeppelin and bomb register as **mapOnly=true, available=false stubs**. Each exports
`AVAILABILITY`; their `onFire: unavailableWeapon` sentinel is retained by contracts' immutable
copy and is recognized before payment, placement and AI aiming. Their contract-valid ground
footprint/positive speed are placeholders, not air-unit mechanics. They have no damaging
payload. No flight controls, bomb drop, or transport functionality is implemented. Their
reserved kit-v1 paths safely use the shared cannon-box factory when a model is absent.

Ordinary weapons use fixed elevation and charge 1..255. Scatter is the recovered four angular
draws (including vertical asymmetry), with no invented speed noise. Double cannon uses the
requested 0.3 s stagger from DESIGN rather than the simultaneous original spawn. Hellfire uses
9 native ticks = 0.558 s; at 30 Hz its cumulative due ticks are 0,17,34,51,67. Fan spread is a
symmetric total angle: trebuchet 1.5°, arcaballista 0.8°. Each salvo pays gold and one load,
starts one reload, remembers aim, and emits one muzzle event per round. Queued rounds retain
launch settings and are canceled if the weapon is destroyed or its castle is eliminated.

Rocket charge controls burn duration, not launch speed. Its fixed speed is 1000 native units
per 62 ms, thrust 45 native units/tick², mass 55+2R reduced during burn, carrier C=54. Burnout
switches to the one child payload (C=53/M=60, direct 24/splash 28, native radius 1152).
The original half-speed stage followed by double-speed release is represented by a single
entity with unchanged velocity; the original small child random velocity offsets are omitted.
A collision before burnout uses the carrier's 1/1/0 payload. AI/range-table/prediction and real
flight use the same stage integrator. The reported nominal range is calm, equal-height,
full charge; conservative `maxRangeM` row bounds are descriptive, not a hard firing cap.

Ballista pierces up to three people along the unconsumed swept segment; blocks/terrain stop
it. It never resets age or creates phantom zero-radius splash. Fire-catapult ignition is
independent of splash: burnable block centres within 2 m ignite, burn 10 s at 2 dp/s, and
spread to burnable six-neighbours with seeded 0.15 probability each fire-second. New fires
start on the next tick, and only the fire RNG stream is consumed. Fire/burst/rocket state is
serialized by the normal sim save path.

The narrow placement integration removes the cannon-only castle-load guard and generalizes
`npc/designations.js` to wall mounts or supported, unoccupied 3x3x2 ground footprints. The
existing AI replacement planner already carries arbitrary definition ids and needs no edit.
`main.js` still exposes only cannon in its placement selector; expanding that UI belongs to
the player/UI owner. The renderer is unchanged and supplies its existing box fallback for
missing kit models; the new view factories also reject malformed node trees safely.
