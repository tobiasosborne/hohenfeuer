# Hohenfeuer — scoping decisions (Socratic rounds with Tobias, 2026-10-17)

Source game: Ballerburg: Castle Siege (Ascaron, 2001, Windows). Confirmed by Tobias as the target.
Working name: **Hohenfeuer**.

## Round 1
- Scope of original gameplay: **only the artillery duel**. No research, no spells/mana, no campaigns. (Building returns in round 2 in a different form, see below.)
- First person: **everywhere**. No RTS overview camera at all; building, economy and firing all happen from inside the castle.
- NPCs: **gameplay-relevant**, not cosmetic.
- Assets: **reverse-engineer / dump the 3D assets from the ISO**, use them as the initial design target, then iterate (re-authored in Blender).

## Round 2
- NPC rules: gun crews, ammo/powder runners, repair crews, population as hit points, **plus morale**. Look into Dwarf Fortress and Timberborn for the needs/hauling/morale dynamics.
- Opponent/pacing: **real time**, AI first, **players take AI slots** (slot model: each castle is a slot that is AI or human; hot-seat/network later by swapping a slot).
- Castles: **Minecraft-style block building** (block-based, not necessarily Minecraft fidelity); rip the original castles/pieces as design targets; "add some additional" (clarified in round 3).
- Name: **Hohenfeuer**.

## Round 3
- "Add some additional": **prefer a plugin architecture** for weapons, characters (NPC types), maps/castles, etc., so content can be added as modules.
- Build loop: **designate in first person, masons build, during battle** (Rampart/DF style, one continuous real-time loop, no phases). Budget-limited designations; enemy fire interrupts.
- Avatar: **the ruler, mortal**. You walk your own castle, can be killed by a shot (lose condition), fire guns yourself or order crews; stairs/ladders in the block set matter.

## Consolidated scope (what we build)
Hohenfeuer: a real-time, first-person-only castle artillery duel. Castles are coarse block structures; the player (mortal ruler) walks the ramparts, designates blocks/weapons/repairs, mans guns or orders crews. NPCs gate everything: gun crews, ammo runners from a magazine, masons, civilians as population/HP, one morale number per castle with spiral guards. Opponents are AI castles in slots that humans can take over (hot-seat/network later). Weapons, NPC types, maps and blocks are plugins. Original 2001 numbers (reload times, costs, defence points, palace as win target, wind HUD) from the manuals are the baseline; the original 3D assets ripped from the ISO are the visual design target, re-authored in Blender.
Out of scope: research tree, spells/mana, campaigns, RTS camera.
