# 02 Runtime environment (2026-10-17)

## Downloads (myabandonware, via headless Chromium)
The site 302-redirects /download/<code>-... to a tokenised direct URL (https://d2.xp.myabandonware.com/t/<uuid>/<file>) after a click in a real browser (cookie banner must be hidden, else click is intercepted; Linkvertise ad scripts load but do not block). The tokenised URL then works with plain curl/wget. Script: /tmp/claude-1000/pw3.js (node, playwright-core from the global @playwright/cli, chromium-1248 at ~/.cache/ms-playwright).
NOTE: labels on the page were swapped vs the brief. pgqy = English ISO (727,468,939 B, ~694 MiB); pgqz = English Rip (274,641,507 B, 262 MB).

| dir (under ~/Projects/castle-game/downloads) | file | status |
|---|---|---|
| en-iso/ | Ballerburg-Castle-Siege_Win_EN_ISO.zip (727468939 B) | wget -c running in background, PID 1372549, log en-iso/wget.log (quiet mode, watch file size) |
| manual-en/ | Ballerburg-Castle-Siege_Manual_Win_EN.pdf (674,995 B) | done, `file`: PDF 6 pages |
| manual-de/ | Ballerburg-Castle-Siege_Manual_Win_DE.pdf (14,786,309 B) | done, PDF |
| nocd-de/ | Ballerburg-Castle-Siege_NoCD_Win_DE.zip (552,796 B) | done, zip (UNTRUSTED, not extracted) |
Not fetched: EN rip (pgqz), DE ISO (pgqm), RU ISO (pgoz). Tokens come from re-running pw3.js with the code. If wget dies, rerun pw3.js pgqy for a new token and `wget -c` into en-iso/. Compute sha256sum after completion (not done yet). Extract zip/ISO only into a fresh dir; never execute on host (only inside wine prefix).

## Wine (no root)
- flatpak 1.14.6 works per-user: flathub remote exists; `flatpak --user install -y flathub com.usebottles.bottles` SUCCEEDED (Bottles 67.4 installed; not needed).
- Portable Wine used instead: Kron4ek wine-11.19 **amd64-wow64** build at /home/tobias/Apps/wine-11.19-wow64 (the plain amd64 build needs 32-bit host libs, which are absent; discard).
- Prefix (64-bit, runs 32-bit apps via WoW64, reports Windows 10): /home/tobias/.wine-castle
- Use: `export WINEPREFIX=$HOME/.wine-castle WINEDEBUG=-all; ~/Apps/wine-11.19-wow64/bin/wine <exe>`; `wine cmd /c ver` and reg query verified. Winetricks not installed (could curl the script to ~/Apps if dxvk/dlls needed; Wine's WineD3D uses OpenGL).
- GL: Mesa Intel Iris Xe (RPL-U), hardware accelerated, GL 4.6 compat. Vulkan ICDs present. Good for WineD3D.
- DOSBox-X 2024.03.01 exists; Win98-in-DOSBox-X is possible but needs a Win98 install image (not available), so Wine is the path. 86Box (flatpak, with ROMs) is also installed and could host Win98/XP as a fallback.
- Not yet tested: the game itself (ISO still downloading).

## Blender
No prior install. Installed Blender 4.5.14 LTS at /home/tobias/Apps/blender-4.5.14-linux-x64.
- Launch: `~/Apps/blender-4.5.14-linux-x64/blender` ; headless: `... blender -b --python script.py`
- Verified: `blender --version` -> 4.5.14 LTS; `blender -b --python-expr "import bpy;print(bpy.app.version)"` -> (4, 5, 14).
(Newer 5.2.2 exists on download.blender.org but is not LTS.)

## Screen capture tools
Present: xdotool, import (ImageMagick), xwd, ffmpeg (x11grab). scrot absent. e.g. `import -window root shot.png`, `xdotool search --name <title>`, `import -window <id> w.png`, `ffmpeg -f x11grab -i :0 ...`.

## Codex
codex-cli 0.163.0. `codex features list` shows computer_use, browser_use, browser_use_external, browser_use_full_cdp_access, in_app_browser, browser_annotation_api all stable/true. ~/.codex/config.toml enables plugins unified-computer-use@openai-bundled and browser@openai-bundled. ~/.codex/computer-use/config.json is only UI strings ("ChatGPT is using your computer", Esc to cancel). Not exercised.

## Blockers needing the user
None hard. Notes: no sudo (not needed so far). Possible later: if the game needs 32-bit-only host libs or dxvk, handle in-prefix; if the game requires CD check, use ISO mount via wine (`wine mount` unsupported; use extracted files or the DE NoCD only for the DE version).
