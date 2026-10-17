1. Implemented `modern`; `classic` remains the default.
2. Switch through `?style=modern` or `__hohenfeuer.setStyle(name)`.
3. Geometry and chunk remeshing remain unchanged.
4. Added block AO, damage decals, wrapped lighting and iron highlights.
5. Added terrain splatting, procedural sky and height fog.
6. Fire uses simulation ticks; water has the permitted dry-map stub.
7. Optional shadows, particle fade, SSAO and bloom are forced off in goldens.
8. Four modern goldens repeat at **0 pixels on the frozen build**.
9. Latest live peak: **57 calls, 121,664 triangles**.
10. SwiftShader medians: **67–110 ms classic; 94–162 ms modern**.
11. Blurred MAE: **27.857 classic; 51.227 modern**.
12. **408 unit tests passed**, along with browser smoke and build.
13. Live golden reconciliation remains in `castle-game-hyr` because parallel simulation edits continued.
14. [Report](/home/tobias/Projects/castle-game/research/14-modern-look.md) and [comparison sheet](/home/tobias/Projects/castle-game/assets-ripped/look-loop/modern/comparison-sheet.png); period follow-up `castle-game-uo7.1` stays open.
15. No git commands were run; changes and Beads records remain local.