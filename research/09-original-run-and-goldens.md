<!-- Owns the original Ballerburg Wine recipe, reference-capture provenance, measurements and remaining gaps. -->
# Original Ballerburg run and reference goldens

The English game was fully installed, played and captured on 2026-10-17. This
replaces the earlier sandbox-failure report. Wine sockets and X11 now work.

The curated delivery is **120 lossless PNGs and three 30-second MP4s** in
[`assets-ripped/goldens-original/`](../assets-ripped/goldens-original/), with a
[row-by-row catalogue](../assets-ripped/goldens-original/catalogue.md).
There are also 87 catalogued additional takes and clips under
[`logs/auxiliary/`](../assets-ripped/goldens-original/logs/auxiliary/catalogue.md),
plus diagnostic logs and raw lossless frame bursts. These are reference-only
original-game assets, not application assets.

This is a substantial capture pass, not a claim that every requested weapon hit
and physical ballistics measurement was verified. The remaining gaps are explicit
below and tracked as **castle-game-kqn**. Installation/capture tracking is
**castle-game-8en**. No git commands were run. No changes were made to `src/`,
`tests/`, `docs/`, `package.json`, `CLAUDE.md`, `HANDOFF.md`, `README.md` or
`scripts/rip/`.

## Installation and launch recipe

Prerequisites used: the existing portable Wine 11.19 wow64 build, initialized
`/home/tobias/.wine-castle`, X11 `:0`, xdotool/xwininfo, ImageMagick, ffmpeg,
Poppler and Python/Pillow. No sudo, apt or additional package installation was used.

Initial checks succeeded:

```bash
DISPLAY=:0 xdotool getdisplaygeometry
# 2880 1800
WINEPREFIX=/home/tobias/.wine-castle WINEDEBUG=-all \
  /home/tobias/Apps/wine-11.19-wow64/bin/wine cmd /c ver
# Microsoft Windows 10.0.19045
```

From the project root:

```bash
scripts/original/configure.sh winxp opengl
scripts/original/launch.sh --install
# Complete the installer, then:
scripts/original/launch.sh
```

`configure.sh` provides a labelled CD view entirely inside the prefix:

- `dosdevices/d:` points to `~/.wine-castle/cdrom-ballerburg`.
- That directory contains symlinks to the extracted English CD entries and a
  `.windows-label` containing `BALLERBURG`. The volume label was verified from
  the raw CD image in the preceding attempt. `AUTORUN.INF` itself has no label.
- `HKLM\Software\Wine\Drives`, value `d:`, is `cdrom`.
- Per-application Wine versions for `Ballerburg.exe` and `MaxInst.exe` are `winxp`.
- The game has the `DirectDrawRenderer=opengl` preference.
- `HKCU\Software\Wine\Explorer\Desktops`, value `Ballerburg`, is `1024x768`.

The prefix-local CD view avoids modifying `downloads/en-iso/iso/` merely to add a
label. No raw optical device or mounted filesystem was needed.

The full installer, `D:\MaxInst.exe`, displayed normally. Confirm installation,
accept the default **`C:\Program Files (x86)\Ballerburg`** destination and
**Ballerburg** Start Menu folder, then install. Setup reported 590.1 MB required.
Choose **Standard** in the hardware preset dialog, untick the optional readme
and finish. There was no DirectX installer prompt or hang in this run.

The installed English executable reached the menu and 3D gameplay without a
CD-check dialog. **No German NoCD file, executable patch or replacement DLL was
used.** XP/OpenGL was the first live configuration tried successfully; other
versions/renderers were unnecessary, so this does not establish that XP is
required. The successful startup log contains two Vulkan instance-version
validation messages; these did not prevent rendering or play.

One ImageMagick capture during a campaign transition returned "Resource temporarily unavailable". Its temporary file was discarded; the frame was recaptured after the view settled.

The English menus identify the release as **(c) 2002 Ascaron, Version 1.00**; this
is the requested 2001 game with English release files dated 2002. The full
installer's output executable and the CD-root executable have different hashes;
no assertion of byte identity is made:

```text
CD Ballerburg.exe:
1856b61fb8654aaefcc3f8e2b16918999e9f3fc325b08ad761dd0079dac01c9a
Installed Ballerburg.exe:
29b83c8cda7b9ab013d94eb69be6f373440e77b3361c466207f828324720fea9
```

The CD readme and UK manual were read locally. Relevant notes: DirectX 8 is
recommended; the manual permits skipping its installation when already present;
the readme documents original-CD initialization issues and a 149-object build
limit. The readme also warns that an unsupported high resolution can fall back
to 640x480. None of those failures occurred here.

## Display, input and capture workarounds

The Standard preset already selected **1024x768 battle resolution, High texture
detail, and 16-bit game/texture colour**. This was checked in Options > Screen
Resolution / Texture Detail / Color Depth. The menus are fixed at **800x600**.
The Wine desktop can remain 1024x768 around an 800x600 menu surface; capturing the
desktop indiscriminately would include black padding.

The helpers find the window named exactly `Ballerburg`, then its unnamed native
DirectDraw child surface. They capture that surface without scaling. The desktop
title is `Ballerburg - Wine Desktop` with a capital D; the old title matcher was
corrected. Screenshots omit the window manager frame and unrelated desktop.

```bash
scripts/original/shot.sh NAME 'Screen' 'Visible content' 'Navigation'
scripts/original/record.sh NAME 'Sequence' 'Visible content' 'Navigation'
scripts/original/input.sh key F1
scripts/original/input.sh click 512 677
scripts/original/input.sh drag 3 500 350 330 0
```

`shot.sh` refuses overwrites, validates native dimensions and appends a catalogue
row. `record.sh` records 30 seconds at 30 fps, H.264 CRF 18, YUV420p, without
audio. PNGs are lossless; MP4s are lossy. `burst.sh` captures short lossless PNG
sequences at 10 fps; `weapon-series.sh` captures two aims, a launch phase, an
early-flight phase and a landing view. The latter needs visual review: a timed
frame is not proof that a projectile is visible or a target was hit.

Important input details discovered during the session:

- Keyboard input must focus the game's child window, not only the Wine desktop.
  The final helper pauses 0.5 seconds after focus and spaces key events by
  300 ms and holds Space for 0.5 seconds. Fast events can be missed during focus acquisition or animation.
- Mouse gestures use the desktop's client coordinates and paced button changes.
  Large instantaneous gestures and button transitions can be coalesced.
- Do not refocus the game while choosing an item from a scrolled map dropdown:
  doing so can reset its scroll position. The helper now avoids that focus
  change for mouse input. Always verify the selected map name and preview.
- **Ice princess does not mean snow terrain.** An early focus-reset trial kept
  Desert 1 while selecting Ice. Those captures are labelled accordingly and
  retained as auxiliary takes. The final Snow 1 and Volcano 1 maps were verified
  before launch.
- Custom scenario settings reset when returning to scenario setup. Reapply and
  visually verify them before every controlled match.
- Disabling repairs alone does not stop the AI from constructing fortifications.
  For persistent destruction references, disable **Repair**, **Build
  structure/weapon**, **Invent**, **Magic**, and **Day/night change**, and omit
  the starting mason's yard. The verified setup is capture `168`.
- An aiming readout can change before the weapon finishes turning. Firing too
  early produces **Positioning weapon** without a shot. A three-second wait can
  be insufficient after a large rotation. Rejected attempts are labelled as
  such in the auxiliary catalogue.

Useful original controls: F1 castle view; number keys select weapons; right-drag
orbits; Home/End zoom in/out in castle view; Space fires; held End gives impact
view in weapon view. Escape from weapon view first returns to castle view;
Escape there opens options. Exit from those options aborts to scenario setup
without producing an end-of-battle statistics screen.

## Curated coverage

| Capture class | Count |
|---|---:|
| Native 800x600 menu/setup/end-screen PNGs | 18 |
| Native 1024x768 battle PNGs | 92 |
| Unscaled HUD pixel crops | 6 |
| Unscaled ammo-workshop detail crops, one per biome | 4 |
| Total curated PNGs | 120 |
| 1024x768, 30 fps, 30-second MP4s | 3 |

The catalogue covers all six main-menu branches, player/queen/map/level
selection, the first tutorial screens, skirmish overview quadrants, zoom limits,
build menus, HUD details and grouped building close-ups in Forest, Desert, Snow
and Volcano. The compass is visible in the quadrant views; these are visual
quadrants rather than mathematically exact reproducible camera headings. Castle
layout follows scenario/map generation; no separate free-form castle picker was
found. The native detail crops identify the ammo workshop by its paired roofs,
barrel and pipe, cross-checked against the manual's building illustration.

Twelve weapon types have aiming/launch/landing reference series: Catapult,
Cannon, Fire Catapult, Ballista, Trebuchet, Long John, Hot Helga, Double Cannon, Rocket Launcher,
Arcaballista, Fat Freda and Hellfire. Fire Catapult was additionally captured in Forest Campaign level 1; its default 007/040 shot landed short in this run, so the manual starting aim is not treated as a verified hit. The royal variants were accessed through
Quick game with the corresponding princess. In Quick game there were initially
six weapons and capacity for eight; Ballista and Rocket Launcher were built in
the free slots. A new weapon can change the number-key ordering; verify its HUD
name rather than assuming a stable slot.

Key damage references:

- `057` and `059`: damaged and destroyed tutorial windmill.
- `170`, `174`: impact marks and severe corner-tower damage.
- `183`: destroyed wall with a full-height gap and rubble.
- `185`: corner tower removed, with a separate surviving wall gap.
- `187`: own palace heavily damaged after the below-25% integrity warning.
- `190`: actual battle-end statistics, not an abort dialog.

The three curated videos are:

1. `061-cannon-aimed-shot.mp4`: firing from the aiming view and a full reload.
2. `075-forest-overview-rotation.mp4`: continuous overview-camera orbit.
3. `184-wall-demolition.mp4`: a selected small wall removed using the native Scrap command.

The third video is a direct 30-second X11 recording of the native **Scrap** action.
It shows the intact selected wall and its removal, without synthetic frames. It
is **not a projectile-caused collapse**. Final QA rejected the earlier bombardment
trim because the gap was already present at its start. Combat destruction stills
remain valid, but a continuous projectile-caused wall-collapse clip is an open
coverage item. Trial videos and raw PNG sequences remain under `logs/`.

## Observed mechanics and numbers

**Reload timing.** Measuring the visible ready-gold/reload-bar transitions in
30 fps recordings gave:

| Weapon | Reload begins | Ready again | Observed interval |
|---|---:|---:|---:|
| Cannon, recording 061 | frame 34, 1.133 s | frame 686, 22.867 s | 21.73 s |
| Catapult, recording 194 | frame 49, 1.633 s | frame 583, 19.433 s | 17.80 s |

These are one UI measurement per weapon, consistent with approximately 22 and
18 seconds. They are not engine-tick measurements; rendering and capture cadence
limit practical precision. Rectangles, thresholds and frame transitions are saved
in `logs/061-reload-measurement.json` and `logs/194-reload-measurement.json`.
The second recording is retained in `logs/auxiliary/`.

**Readouts.** The catapult range stopped at **001** when decreasing and **255**
when increasing; a further two seconds of Ctrl+Up left it at 255 (`171`, `176`).
Direction wraps through zero. The mechanical digits scroll through fractional
settings, so a screenshot can show parts of two adjacent numerals. Ordinary
horizontal arrow taps moved by roughly half a degree; vertical taps moved by one
range unit. Ctrl accelerates changes, but a multiplier was not rigorously measured.

**Range is weapon-dependent.** In Tutorial 1, cannon aim around **037/048**
overshot the windmill, while **037/045** hit it. Catapult **037/018** fell short,
**037/028** placed the impact view around that windmill, and **037/038** landed
beyond the hill. In the later no-rebuild Forest 1 match, cannon aim around
**045/048** damaged a corner tower; about two degrees left targeted the adjoining
wall. These are map-, position- and weapon-specific observations. There is no
metre ruler in the HUD, and this session did **not** establish a metres-per-range
conversion. A universal "one range unit = 5 m" should not be treated as a measured
property of the original.

**Wind.** Most geometry/damage captures used wind 0. A separate verified match
used strength **5** and change **5**; the compass hub displayed **5** with a red
direction arrow (`191`, `192`, `195`). Two shots at unchanged aim around
**092/038** produced the landing views `196` and `197`. This establishes the
nonzero UI and repeat-shot reference, not a numerical drift coefficient: shot
scatter and changing wind were not isolated. No m/s unit is printed in the HUD,
and no physical wind-unit conversion is claimed.

**Costs and state.** Observed shot-price displays included Catapult 52, Cannon 90,
Fire Catapult 150, Ballista 22, Trebuchet 225, Long John 135, Hot Helga 225, Double Cannon 150,
Rocket Launcher 150, Arcaballista 200, Fat Freda 150 and Hellfire 220 gold.
These are the values in the captured states, not a universal base-price table.
Ammo-workshop availability changes prices; several forest buildings were lost
while capturing. Weapon health remained visible while firing: the controlled
cannon was still usable at 55% and 11% before it was destroyed. Losing houses
reduced the population capacity, for example from 60 to 50, 40, 30 and 20.

**Completed battle.** The no-repair/no-build match ended after our palace had
been badly damaged. Its actual statistics screen reports **36m32s**, **14 shots**,
**7 direct hits**, **50% accuracy**, **828 gold damage value**, and **37 farmers
lost** for the player. The AI had **199 shots**, **60 direct hits**, **30%
accuracy**, and **8585 gold damage value**. Damage in this screen is a monetary
value, not defence points. The long duration includes substantial idle time for
capture, inspection and scripting; it is not a normal-play pacing estimate.

## Validation and remaining coverage

Validation in `logs/final-validation.json` confirms 120 readable PNGs, three
1024x768 H.264 videos with **900 frames and 30.000 seconds each**, unique catalogue
rows and existing linked files. All shell helpers pass `bash -n`. Invalid capture
names, invalid configuration/launch options and overwriting an existing golden
were rejected; the existing file's hash was unchanged. No application tests were
run because no application code was changed. The game was left at its main menu.

Remaining work is tracked in **castle-game-kqn**:

- A continuous projectile-caused wall-collapse clip remains unverified; the
  curated third clip is clearly labelled native Scrap demolition.
- Some weapon-series landing views are misses, and some early-flight frames have
  a tiny or out-of-frame projectile. This delivery does not verify the complete
  successful enemy-hit/visible-flight matrix for every one of the twelve types.
  Raw lossless bursts are preserved for further selection and targeted recapture.
- Fire Ballista, Quad Launcher, Zeppelin and Super Weapon were not
  separately captured. Quick game exposed upgraded variants and princess-specific
  weapons; the full research tree was not exhausted.
- Physical distance at each range value and wind-number-to-drift response remain
  uncalibrated. Repeated shots with fixed positions and controlled wind are needed
  to separate trajectory, scatter, altitude and wind effects.
- Overview compass poses are approximate quadrants. The original is not a
  deterministic screenshot harness; population, AI fire, clouds and damage can
  change between captures.

## 15-line summary

1. Wine sockets and X11 :0 worked in this unrestricted session.
2. MaxInst completed a full English installation at the default location.
3. D: is a labelled BALLERBURG CD-ROM view inside the Wine prefix.
4. Per-app XP compatibility and the OpenGL preference worked on the first live run.
5. No NoCD, executable patch or replacement DLL was used.
6. Native menus are 800x600 and battle captures are 1024x768.
7. The curated set contains 120 lossless PNGs, including ten unscaled detail crops.
8. Three validated 30-second, 30-fps videos cover firing, rotation and native Scrap wall demolition.
9. All four biome appearances and twelve weapon types are represented.
10. Confirmed references include damaged fortifications, a wall breach and a removed tower.
11. A damaged palace and the actual 36m32s battle-end statistics are captured.
12. Visible reload intervals measured 17.80s for catapult and 21.73s for cannon.
13. Catapult range clamps at 001-255; a nonzero-wind test displayed strength 5.
14. Combat-collapse video, complete per-weapon hits and physical ballistics calibration remain in castle-game-kqn.
15. The game is left at its main menu; no git or protected application-file changes were made.
