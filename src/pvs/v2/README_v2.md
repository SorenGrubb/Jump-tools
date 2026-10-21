# Perivascular space, version 2 (2026-10-21)

Søren: "The PVS looks very fragmented, and instead of increasing or decreasing the collective space it
seems that each small fragment is increasing or decreasing in size."

Why it was fragmented: a given structure is traced in every ~4th section (in-column gaps are mostly
3 µm), and between sections it shifts sideways (the pia curves; a penetrating vessel is cut
lengthwise, so its sleeve is two strips whose position changes from section to section). Closing in z
alone could not join pieces that do not overlap.

Pipeline (run in this folder, the TriSAM mesh from vessel_inputs.zip):
1. `build2.py` -- the notebook's own per-section filling, split into the pial sheet (pial), the loops
   around vessels (loops, lumen subtracted) and the TriSAM lumen in every 1 µm slice (lumen).
2. `interp2.py pial`, `interp2.py loops` (-> pial_interp, loops_interp) -- shape-based interpolation:
   per 40 µm tile, between consecutive traced sections ≤ 12 µm apart, through signed distance maps;
   the lumen is then taken out again.
3. `thickness_samples.py` -- the distance of each traced loop's outer wall from the lumen (median 4 µm).
4. `surf4.py v6.bin 12 6 6 3 0.002 1.0 2.5 4` -- the interpolated sheet and sleeves (σ 0.8 µm) plus a
   shell around the larger vessels (lumen opened by 2.5 µm, so capillaries carry none) whose thickness
   is the Gaussian-weighted local mean of those samples, only within 4 µm of a traced/interpolated
   sleeve -- it closes the tube where the tracing left it open. Marching cubes, step 2.
5. `anchor.py v6.bin v6_anchor.bin` -- per vertex, how it moves when the space widens: sleeve vertices
   away from the nearest point of the lumen surface by their distance from it; sheet vertices upward by
   their height above the glia-limitans side of their own run (capped 20 µm, smoothed over the mesh).
6. `make_vr_mesh.py` -> vr/pvs.drc + pvs.json (draco, anchors as a generic attribute) for the VR;
   `make_ng_mesh.py` -> ng/ (Neuroglancer multilod draco); `patch_ujump_pvs.py` refreshes µJump's
   nucleus distances.

## v3 of the sheet (same day)
Søren: "large parts of the SAS PVS look more patchy than before". Shape-based (SDF) interpolation makes
a sheet thinner than its own sideways shift between sections vanish half-way, and step-2 marching cubes
missed the 2-3 µm thin parts. Now:
- `sheet_interp.py`: per x column, the sheet's top and bottom y in each traced section (thickness
  ≤ 45 µm), interpolated linearly along z between that column's traced sections ≤ 12 µm apart.
- `sheet_fill.py`: holes in the sheet's map seen from above that a closing with an 8 µm disk bridges
  are filled from the surrounding top/bottom (Gaussian σ 4 µm); the lumen is taken out again.
- `surf6.py`: as surf4 but with the filled sheet, marching cubes at step 1, then decimated to 1.8M
  triangles (fast-simplification).
- `anchor.py` uses the filled sheet to tell sheet from sleeve.
