// tests/unit/ui-font.test.js - owns glyph coverage and rasterisation checks for src/ui/font.js and src/ui/i18n.js.
import test from "node:test";
import assert from "node:assert/strict";
import { GLYPHS, FONT, measure, rasterize, hasGlyph } from "../../src/ui/font.js";
import { STRINGS, LANGS, t } from "../../src/ui/i18n.js";

const EXTRA = "0123456789 ()%/:.,!?-+'<>";

function neededChars() {
  const set = new Set(EXTRA);
  for (const lang of LANGS) for (const v of Object.values(STRINGS[lang])) for (const ch of String(v).replace(/\{\w+\}/g, "")) set.add(ch);
  return [...set].sort();
}

test("i18n: every key exists in every language and t() formats params", () => {
  const keys = Object.keys(STRINGS.en).sort();
  for (const lang of LANGS) assert.deepEqual(Object.keys(STRINGS[lang]).sort(), keys, lang);
  assert.equal(t("reloading", "de"), "Lädt nach");
  assert.equal(t("weaponCondition", "en", { name: "Cannon", pct: 100 }), "Cannon (100%)");
  assert.equal(t("nope", "en"), "nope");
});

test("font has a glyph for every character the UI needs", () => {
  const missing = neededChars().filter((ch) => !hasGlyph(ch));
  assert.deepEqual(missing, []);
});

test("every glyph has consistent rows and draws pixels (except space)", () => {
  for (const [ch, g] of Object.entries(GLYPHS)) {
    assert.equal(g.rows.length, FONT.rows, `glyph ${ch} rows`);
    for (const r of g.rows) assert.equal(r.length, g.w, `glyph ${ch} width`);
    const lit = g.rows.join("").includes("#");
    assert.equal(lit, ch !== " ", `glyph ${JSON.stringify(ch)} lit`);
  }
});

test("rasterize: size matches measure, outline surrounds fill, every needed glyph renders", () => {
  for (const ch of neededChars()) {
    if (ch === " ") continue;
    const r = rasterize(ch, { outline: true });
    const m = measure(ch, { outline: true });
    assert.equal(r.w, m.w); assert.equal(r.h, m.h);
    let fill = 0, line = 0;
    for (const v of r.data) { if (v === 1) fill++; else if (v === 2) line++; }
    assert.ok(fill > 0 && line > 0, `glyph ${ch}`);
  }
  const s = rasterize("355 048", { scale: 2, bold: true });
  assert.equal(s.w, measure("355 048", { scale: 2, bold: true }).w);
  assert.equal(s.h, FONT.rows * 2);
});

test("rasterize is deterministic and distinguishes glyphs", () => {
  const a = rasterize("Lädt nach").data.join("");
  assert.equal(a, rasterize("Lädt nach").data.join(""));
  const seen = new Map();
  for (const ch of "0123456789") {
    const key = rasterize(ch).data.join("");
    assert.ok(!seen.has(key), `${ch} looks like ${seen.get(key)}`);
    seen.set(key, ch);
  }
});
