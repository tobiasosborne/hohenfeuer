Created the [report](/home/tobias/Projects/castle-game/research/11-exe-ballistics-and-weapon-tables.md) and [extractor](/home/tobias/Projects/castle-game/scripts/rip/exe_tables.py). Static checks passed. No Git, Wine, or game execution. **H = high static confidence; runtime unverified.**

1. **H:** Default tick: **62 ms**.
2. **H:** Coordinate scale: **5/256 world units**.
3. **H:** Custom gravity: **33–40 native units/tick²**.
4. **H:** Converted gravity: **167.672–203.239 world units/s²**.
5. **H:** Quadratic drag uses **65536 divisor**, including vertical drag.
6. **H:** Ordinary charge range: **1–255**; speed = **K×charge**.
7. **H:** Speed coefficients: Cannon **40**, Catapult **60**.
8. **H:** Azimuth: **720 settings**; trigonometry: **4096 units/turn**.
9. **H:** Cannon elevation: **21.2695°**; Catapult: **36.7383°**.
10. **H:** Scatter parameters: Cannon **11**, Catapult **16**.
11. **H:** Cannon damage: **16 direct / 20 maximum splash**.
12. **H:** Cannon splash radius: **640 native = 12.5 world units**.
13. **H:** Ground supports: **60/96 HP**; weapon fails **below half**.
14. **H:** Rockets: speed **1000**, thrust **45**, payload damage **24/28**.
15. **H:** Wind: **9 strengths**, **256×32-tick cycle**, direction changes **±59.9414°**.