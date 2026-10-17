1. Delivered pipeline and [README](/home/tobias/Projects/castle-game/tools/blender/README.md).
2. Blender 4.5.14 asserted in every bpy script.
3. Simulated version mismatch exits non-zero.
4. Generated all 14 block GLBs, including transparent air.
5. Generated fourteen 256×256 thumbnails.
6. Geometry uses 8–84 triangles per block.
7. All 14 GLBs pass validation.
8. All 10 host tests pass.
9. GLB rebuilds are byte-identical.
10. Repeat 1024×768 PNGs are byte-identical.
11. Shared pose JSON remains unchanged.
12. [Inventory](/home/tobias/Projects/castle-game/assets-ripped/turntables/INVENTORY.md): 8/8 originals, four-view strips and shared-pose renders.
13. Dimensions assume 1 OBJ unit = 1 metre; calibration remains unverified.
14. Timings: kit 31.5s; reference batch 50.9s. Fixed exporter enum, UV handles, framing and PNG metadata; EGL warnings remained harmless.
15. Writes stayed within owned paths; ripped inputs remained reference-only; no git commands ran.