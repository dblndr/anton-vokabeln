"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const {execFileSync} = require("child_process");
const {load, loadHtml, htmlPath} = require("./load-app");

function plain(x){ return JSON.parse(JSON.stringify(x)); }
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function v07State(){
  return {
    version: 1,
    stats: {"v001|en": {r: 4, f: 1, s: 2, n: 5, last: 3}},
    settings: {dir: "de", seiten: [1, 2, 8]},
    turn: 4, queue: [], best: 3, streak: 2, history: ["v001|en"],
    tage: {"2026-11-13": {r: 2, f: 0, g: 1, k: 2, t: 40}},
    start: {d: "2026-11-13", k: 1, n: 4},
    abzeichen: {},
    grammatik: {stats: {}, tage: {}, thema: "mix"},
    mathe: {
      stats: {zahlen: {r: 3, f: 1, n: 4}},
      tage: {"2026-11-13": {r: 2, f: 1}},
      wdh: {}, wdhQ: {},
      settings: {blitzSek: 8, fach: "mathe"},
      abzeichen: {}, richtig: {zahlen: 3},
      punkte: 30, streak: 1, best: 2, bestStars: 1, runden: 1
    },
    ui: {fach: "mathe", bereich: "zahlen", modus: "runde"},
    extraFeld: {notiz: "bitte behalten"}
  };
}
function v08State(){
  const s = v07State();
  s.sa = {mathe: {aktiv: "mathe-sa1-kap1", items: {"mathe-sa1-kap1": {
    datum: "2026-11-17", archiviert: false, gestartet: "2026-11-14",
    selbst: {"1.5": 0}, erledigt: {"1.1:heft": "2026-11-14"},
    zuletzt: {"1.3": [1, 0, 1]}, probe: [], merk: "bleibt"
  }}}};
  return s;
}

test("Titel v0.8.1, Karten-ID v001 bleibt, kein Klarname", () => {
  const w = load();
  assert.equal(w.VT.APP_VERSION, "0.8.1");
  assert.equal(w.document.title, "Lerntrainer – v0.8.1");
  assert.equal(w.VT.STORE_KEY, "anton-vokabeln-v1");
  assert.equal("sa" in w.VT.state, false);
  assert.match(w.document.getElementById("appTitle").textContent, /^Lerntrainer – v0\.8\.1$/);
  assert.doesNotMatch(w.document.getElementById("v-start").textContent + w.document.getElementById("page-sa").textContent, /Anton|Greta/);
});

test("v0.7- und v0.8-Spielstand bleiben byte-gleich", () => {
  const v07html = execFileSync("git", ["show", "0e0628d:index.html"], {encoding: "utf8", maxBuffer: 20 * 1024 * 1024});
  const v08html = execFileSync("git", ["show", "8c9b76f:index.html"], {encoding: "utf8", maxBuffer: 20 * 1024 * 1024});
  const neu = fs.readFileSync(htmlPath, "utf8");
  const alt7 = loadHtml(v07html, {storage: v07State()});
  const neu7 = loadHtml(neu, {storage: v07State()});
  assert.equal(neu7.localStorage.getItem("anton-vokabeln-v1"), alt7.localStorage.getItem("anton-vokabeln-v1"));
  const alt8 = loadHtml(v08html, {storage: v08State()});
  const neu8 = loadHtml(neu, {storage: v08State()});
  assert.equal(neu8.localStorage.getItem("anton-vokabeln-v1"), alt8.localStorage.getItem("anton-vokabeln-v1"));
  assert.equal(neu8.VT.state.sa.mathe.items["mathe-sa1-kap1"].merk, "bleibt");
  assert.equal(neu8.VT.state.stats["v001|en"].r, 4);
});

test("Zahlengerade Mitte und Abstand", () => {
  const w = load();
  const rnd = mulberry32(3);
  for (let i = 0; i < 20; i++) {
    const q = w.VT.mathe.makeZahlenQ(2, rnd, "mitte");
    assert.equal(q.kind, "mitte");
    assert.equal(q.area, "zahlen");
    assert.equal(q.input, "mc");
    assert.match(q.svg, /Zahlengerade/);
    assert.match(q.svg, />A</);
    assert.match(q.svg, />B</);
    assert.ok(q.options.includes(q.answer));
    assert.equal(q.answer, w.VT.mathe.fmt((q.spec.a + q.spec.b) / 2, 0));
    const g = w.VT.mathe.makeZeichnenQ(3, rnd, "abstand");
    assert.equal(g.kind, "abstand");
    assert.equal(g.area, "geo-zeichnen");
    assert.equal(g.num, Math.abs(g.spec.b - g.spec.a));
  }
});

test("neue Aufgaben stimmen rechnerisch", () => {
  const w = load();
  const M = w.VT.mathe;
  const rnd = mulberry32(9);
  const gesehen = new Set();
  for (let i = 0; i < 12; i++) {
    const gegen = M.makeZahlenQ(2, rnd, "gegen");
    assert.equal(gegen.kind, "gegen");
    assert.equal(gegen.num, -gegen.spec.n);
    gesehen.add("gegen");
    const b = M.makeZahlenQ(2, rnd, "betrag-schreib");
    assert.equal(b.kind, "betrag-schreib");
    assert.match(b.text, /\|/);
    assert.equal(b.num, Math.abs(b.spec.n));
    gesehen.add("betrag-schreib");
    const k = M.makeZahlenQ(2, rnd, "kette");
    assert.equal(k.kind, "kette");
    const sorted = k.spec.nums.slice().sort((a, c) => a - c).map(n => M.fmt(n, 0)).join(" < ");
    assert.equal(k.answer, sorted);
    assert.ok(k.options.includes(k.answer));
    gesehen.add("kette");
    const d = M.makeZahlenQ(2, rnd, "dezimal");
    assert.equal(d.kind, "dezimal");
    if (d.spec.op === "nullen") assert.equal(d.answer, String(d.spec.z));
    else assert.equal(d.answer, "10^" + d.spec.z);
    gesehen.add("dezimal");
    const t = M.makeMulDivQ(2, rnd, "teiler");
    assert.equal(t.kind, "teiler");
    if (t.spec.op === "teiler") assert.equal(t.spec.n % t.spec.x, 0);
    else assert.match(t.answer, new RegExp("(^|, )" + t.spec.n + "$"));
    gesehen.add("teiler");
    const v = M.makeMulDivQ(2, rnd, "vielfach");
    assert.equal(v.kind, "vielfach");
    assert.equal(v.spec.x % v.spec.base, 0);
    gesehen.add("vielfach");
    const z = M.makeMulDivQ(2, rnd, "zehn");
    assert.equal(z.kind, "zehn");
    const wert = z.spec.c * Math.pow(10, z.spec.e);
    if (z.input === "num") assert.equal(z.num, wert);
    else assert.equal(z.answer, z.spec.c + "·10^" + z.spec.e);
    gesehen.add("zehn");
    const r = M.makeGroessenQ(2, rnd, "rund-einheit");
    assert.equal(r.kind, "rund-einheit");
    assert.equal(r.num, r.spec.m >= 500 ? r.spec.km + 1 : r.spec.km);
    gesehen.add("rund-einheit");
    const q = M.makeZeichnenQ(3, rnd, "quadrant");
    assert.equal(q.kind, "quadrant");
    assert.match(q.svg, /Gitter|circle/);
    const name = q.spec.x > 0 && q.spec.y > 0 ? "I" : q.spec.x < 0 && q.spec.y > 0 ? "II" : q.spec.x < 0 && q.spec.y < 0 ? "III" : "IV";
    assert.equal(q.answer, name);
    gesehen.add("quadrant");
    const s = M.makeZeichnenQ(3, rnd, "spiegel");
    assert.equal(s.kind, "spiegel");
    const ix = s.spec.axis === "y" ? -s.spec.x : s.spec.x;
    const iy = s.spec.axis === "x" ? -s.spec.y : s.spec.y;
    assert.equal(s.answer, M.koordLabel(ix, iy));
    gesehen.add("spiegel");
    const e = M.makeZeichnenQ(3, rnd, "eintragen");
    assert.equal(e.kind, "eintragen");
    assert.ok(["A", "B", "C", "D"].includes(e.answer));
    assert.ok(e.text.includes(M.koordLabel(e.spec.x, e.spec.y)));
    gesehen.add("eintragen");
  }
  const bys = new Set();
  for (let i = 0; i < 80; i++) {
    const q = M.makeMulDivQ(2, rnd, "teilbar");
    assert.equal(q.kind, "teilbar");
    assert.equal(q.answer, q.spec.n % q.spec.by === 0 ? "ja" : "nein");
    bys.add(q.spec.by);
  }
  assert.ok(bys.has(4) && bys.has(9));
  assert.equal(gesehen.size, 11);
});

test("Probe und Themen nutzen die neuen Arten", () => {
  const w = load();
  const kat = w.VT.SA_KATALOG[0];
  const erlaubt = {};
  for (const t of kat.themen) {
    erlaubt[t.id] = new Set();
    for (const u of t.uebungen) for (const k of u.kinds) erlaubt[t.id].add(k);
  }
  assert.ok(erlaubt["1.5"].has("mitte"));
  assert.ok(erlaubt["1.5"].has("quadrant"));
  assert.ok(erlaubt["1.5"].has("spiegel"));
  assert.ok(erlaubt["1.3"].has("teiler"));
  assert.ok(erlaubt["1.3"].has("vielfach"));
  assert.ok(erlaubt["1.2"].has("zehn"));
  assert.ok(erlaubt["1.2"].has("dezimal"));
  assert.ok(erlaubt["1.4"].has("rund-einheit"));
  assert.ok(erlaubt["1.6"].has("kette"));
  assert.ok(erlaubt["1.6"].has("betrag-schreib"));
  assert.ok(erlaubt["1.5"].has("gegen"));
  const rnd = mulberry32(4);
  const qs = w.VT.saProbeFragen(kat, 20, rnd, {});
  assert.equal(qs.length, 20);
  const je = {};
  const neu = new Set();
  const neue = new Set(["mitte", "abstand", "gegen", "kette", "betrag-schreib", "dezimal", "teiler", "vielfach", "zehn", "rund-einheit", "quadrant", "spiegel", "eintragen"]);
  for (const q of qs) {
    assert.ok(erlaubt[q.saThema].has(q.kind), q.saThema + " " + q.kind);
    je[q.saThema] = (je[q.saThema] || 0) + 1;
    if (neue.has(q.kind)) neu.add(q.kind);
  }
  for (const id of ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"]) assert.ok(je[id] >= 3, id);
  let fund = neu.size;
  for (let n = 0; n < 40 && fund < 4; n++) {
    for (const q of w.VT.saProbeFragen(kat, 20, mulberry32(20 + n), {})) if (neue.has(q.kind)) neu.add(q.kind);
    fund = neu.size;
  }
  assert.ok(neu.size >= 4, [...neu].join(","));
});

test("Lösungsmarkierung erst nach der Antwort", () => {
  const w = load();
  const M = w.VT.mathe;
  const rnd = mulberry32(21);
  const kreise = s => (s.match(/<circle/g) || []).length;
  for (let i = 0; i < 12; i++) {
    const m = M.makeZahlenQ(2, rnd, "mitte");
    assert.equal(m.svg.includes("data-loesung"), false);
    assert.equal(m.svg.includes(">?</text>"), false);
    assert.equal(m.svgLoesung.includes(">?</text>"), true);
    const a = M.makeZeichnenQ(3, rnd, "abstand");
    assert.equal(a.svg.includes("data-loesung"), false);
    assert.equal(a.svgLoesung.includes("data-loesung"), true);
    const q = M.makeZeichnenQ(3, rnd, "quadrant");
    assert.equal(kreise(q.svg), 0);
    assert.equal(kreise(q.svgLoesung), 1);
    const e = M.makeZeichnenQ(3, rnd, "eintragen");
    assert.equal(e.svg.includes("data-loesung"), false);
    assert.equal(e.svgLoesung.includes("data-loesung"), true);
    for (const buchstabe of ["A", "B", "C", "D"]) assert.ok(e.svg.includes(">" + buchstabe + "<"));
    const s = M.makeZeichnenQ(3, rnd, "spiegel");
    assert.equal(kreise(s.svg), 1);
    assert.equal(kreise(s.svgLoesung), 2);
    assert.equal(s.svg.includes(s.answer), false);
  }
  const frage = M.makeZahlenQ(2, mulberry32(2), "mitte");
  frage.saThema = "1.5";
  frage.saThemaName = "Negative Zahlen";
  w.VT.saZeigeFragen([frage]);
  const draw = w.document.getElementById("mDraw");
  assert.equal(draw.innerHTML.includes(">?</text>"), false);
  w.VT.mathe.grade(frage.answer);
  assert.equal(draw.innerHTML.includes(">?</text>"), true);
});
