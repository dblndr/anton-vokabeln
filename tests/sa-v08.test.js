"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const {execFileSync} = require("child_process");
const {load, loadHtml, htmlPath} = require("./load-app");

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function plain(x){ return JSON.parse(JSON.stringify(x)); }
function heftThemen(tag){
  return tag.schritte.filter(s => s.art === "heft").map(s => s.thema);
}
function v07State(){
  return {
    version: 1,
    stats: {"v001|en": {r: 4, f: 1, s: 2, n: 5, last: 3}},
    settings: {dir: "de", seiten: [1, 2, 8]},
    turn: 4,
    queue: [],
    best: 3,
    streak: 2,
    history: ["v001|en"],
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

test("App lädt als Lerntrainer v0.8, ohne Schulaufgaben-Speicher", () => {
  const w = load();
  assert.equal(w.VT.APP_VERSION, "0.8");
  assert.equal(w.document.title, "Lerntrainer – v0.8");
  assert.equal(w.document.getElementById("appTitle").textContent, "Lerntrainer – v0.8");
  assert.equal(w.VT.STORE_KEY, "anton-vokabeln-v1");
  assert.equal("sa" in w.VT.state, false);
  const stored = JSON.parse(w.localStorage.getItem("anton-vokabeln-v1"));
  assert.equal("sa" in stored, false);
  const cards = w.document.querySelectorAll("#v-start .fcard");
  assert.equal(cards.length, 2);
  assert.equal(cards[0].querySelector(".sastrip"), null);
  assert.match(cards[1].querySelector(".sastrip").textContent, /Datum eintragen/);
  assert.doesNotMatch(w.document.getElementById("appTitle").textContent, /Anton|Greta/);
});

test("v0.7-Spielstand bleibt ohne SA byte-gleich, Rollback behält state.sa", () => {
  const v07 = execFileSync("git", ["show", "0e0628d:index.html"], {encoding: "utf8", maxBuffer: 20 * 1024 * 1024});
  const raw = v07State();
  const w7 = loadHtml(v07, {storage: raw});
  const w8 = loadHtml(fs.readFileSync(htmlPath, "utf8"), {storage: raw});
  assert.equal(w8.localStorage.getItem("anton-vokabeln-v1"), w7.localStorage.getItem("anton-vokabeln-v1"));
  assert.equal("sa" in w8.VT.state, false);
  const withSa = v07State();
  withSa.sa = {mathe: {aktiv: "mathe-sa1-kap1", items: {"mathe-sa1-kap1": {
    datum: "2026-11-17", archiviert: false, gestartet: "2026-11-14",
    selbst: {"1.4": 2}, erledigt: {"rueck": "2026-11-14"}, zuletzt: {}, probe: [], merk: "bleibt"
  }}}};
  const old = loadHtml(v07, {storage: withSa});
  const neu = loadHtml(fs.readFileSync(htmlPath, "utf8"), {storage: withSa});
  assert.equal(old.VT.state.sa.mathe.items["mathe-sa1-kap1"].datum, "2026-11-17");
  assert.equal(neu.VT.state.sa.mathe.items["mathe-sa1-kap1"].merk, "bleibt");
  assert.equal(neu.localStorage.getItem("anton-vokabeln-v1"), old.localStorage.getItem("anton-vokabeln-v1"));
});

test("kaputtes SA-Datum wird repariert, fehlendes sa bleibt weg", () => {
  const w = load();
  const s = w.VT.migrate({version: 1, stats: {}, sa: {mathe: {items: {x: {datum: "2026-11-31", selbst: null}}}}});
  assert.equal(s.sa.mathe.items.x.datum, null);
  assert.deepEqual(plain(s.sa.mathe.items.x.selbst), {});
  const ohne = w.VT.migrate({version: 1, stats: {}});
  assert.equal("sa" in ohne, false);
});

test("fmtDatum, Prüfung und Plan-Sonderfälle", () => {
  const w = load();
  const VT = w.VT;
  const kat = VT.SA_KATALOG[0];
  assert.equal(VT.fmtDatum("2026-11-17"), "17.11.2026");
  assert.equal(VT.fmtDatum("2026-11-17", {wt: "kurz"}), "Di 17.11.2026");
  assert.equal(VT.fmtDatum("2026-11-17", {wt: "lang"}), "Dienstag, 17.11.2026");
  assert.equal(VT.fmtDatum("2027-03-01"), "01.03.2027");
  assert.equal(VT.parseDeDatum("31.11.2026"), null);
  assert.equal(VT.parseDeDatum("17.11.2026"), "2026-11-17");
  assert.equal(VT.isRealIso("2026-02-29"), false);
  assert.equal(VT.isRealIso("2024-02-29"), true);
  assert.equal(VT.saPruefeDatum("2026-11-31", "2026-11-14").ok, false);
  assert.equal(VT.saPruefeDatum("2026-11-13", "2026-11-14").ok, true);
  assert.equal(VT.saPruefeDatum("2026-11-13", "2026-11-14").vergangen, true);
  assert.equal(VT.saPruefeDatum(VT.addDays("2026-11-14", 366), "2026-11-14").ok, true);
  assert.equal(VT.saPruefeDatum(VT.addDays("2026-11-14", 367), "2026-11-14").ok, false);

  const normal = VT.saPlan(kat, "2026-11-17", "2026-11-14", {});
  assert.equal(normal.L, 3);
  assert.equal(normal.countdown, "noch 3 Tage");
  assert.deepEqual(plain(heftThemen(normal.tage[0])), ["1.1", "1.2", "1.3"]);
  assert.ok(normal.tage[0].schritte.some(s => s.id === "1.3:mat" && s.text.includes("AH S. 8")));
  assert.deepEqual(plain(heftThemen(normal.tage[1])), ["1.4", "1.5", "1.6"]);
  assert.ok(normal.tage[1].schritte.some(s => s.text.includes("AH S. 9")));
  assert.ok(normal.tage[1].schritte.some(s => s.text.includes("10")));
  assert.deepEqual(plain(normal.tage[2].schritte.map(s => s.id)), ["rueck", "test", "probe"]);
  assert.equal(normal.tage[3].datum, "2026-11-17");
  assert.equal(normal.tage[3].schritte[0].id, "kurz");
  assert.equal(normal.probeN, 20);

  const kompakt = VT.saPlan(kat, "2026-11-17", "2026-11-16", {selbst: {"1.5": 0}});
  assert.equal(kompakt.L, 1);
  assert.equal(kompakt.probeN, 10);
  assert.equal(kompakt.tage[0].schritte[0].thema, "1.5");
  assert.ok(kompakt.tage[0].schritte.some(s => s.id === "probe"));
  assert.equal(kompakt.tage[1].schritte[0].text, "kurz: Merksätze lesen 🍀");

  const zwei = VT.saPlan(kat, "2026-11-17", "2026-11-15", {selbst: {"1.5": 0}}, {carry: false});
  assert.equal(zwei.L, 2);
  assert.equal(heftThemen(zwei.tage[0])[0], "1.5");
  assert.ok(zwei.tage[1].schritte[0].id === "probe");

  assert.equal(VT.saPlan(kat, "2026-11-13", "2026-11-14", {}).lage, "vorbei");
  assert.equal(VT.saPlan(kat, "2026-11-13", "2026-11-14", {}).tage.length, 0);
  const heute = VT.saPlan(kat, "2026-11-14", "2026-11-14", {});
  assert.equal(heute.lage, "heute");
  assert.deepEqual(plain(heute.tage[0].schritte.map(s => s.id)), ["kurz"]);

  const deckel = VT.saPlan(kat, "2027-03-01", "2026-11-14", {});
  const lernen = deckel.tage.filter(t => t.rolle !== "sa");
  assert.equal(lernen.length, 10);
  assert.equal(lernen[0].datum, VT.addDays("2027-03-01", -10));
  assert.equal(deckel.hinweis, "bis 18.02.2027 frei, Plan startet 19.02.2027");
  assert.equal(deckel.tage.filter(t => t.rolle === "pause").length, 3);
  assert.equal(deckel.tage[deckel.tage.length - 1].datum, "2027-03-01");

  const stand = {selbst: {}, erledigt: {"1.4:heft": "2026-11-14"}, zuletzt: {}, probe: []};
  const neu = VT.saPlan(kat, "2026-11-19", "2026-11-14", stand, {carry: false});
  assert.equal(stand.erledigt["1.4:heft"], "2026-11-14");
  assert.ok(neu.tage.some(t => t.schritte.some(s => s.id === "1.4:heft")));

  const carry = VT.saPlan(kat, "2026-11-17", "2026-11-15", {gestartet: "2026-11-14", selbst: {}, erledigt: {}});
  const tag = carry.tage.find(t => t.datum === "2026-11-15");
  const heft = tag.schritte.filter(s => s.id === "1.1:heft");
  assert.equal(heft.length, 1);
  assert.equal(heft[0].nachholen, true);

  const dst = VT.saPlan(kat, "2026-03-31", "2026-03-28", {}, {carry: false});
  assert.deepEqual(plain(dst.tage.map(t => t.datum)), ["2026-03-28", "2026-03-29", "2026-03-30", "2026-03-31"]);

  const en = {
    id: "demo", fach: "englisch", probe: {n: 20, nKompakt: 10, minProThema: 3},
    vorgehen: [
      {id: "heft", t: "Heft", jeThema: true},
      {id: "vok", t: "15 Min. Vokabeln", taeglich: true},
      {id: "loes", t: "Lösungen", abschluss: true}
    ],
    themen: Array.from({length: 11}, (_, i) => ({id: "t" + (i + 1), t: "T"}))
  };
  const weit = VT.saPlan(en, "2026-11-23", "2026-11-14", {}, {carry: false});
  assert.equal(weit.L, 9);
  assert.deepEqual(plain(heftThemen(weit.tage[0])), ["t1"]);
  assert.deepEqual(plain(heftThemen(weit.tage[5])), ["t6", "t7"]);
  assert.deepEqual(plain(heftThemen(weit.tage[7])), ["t10", "t11"]);
  assert.ok(weit.tage[0].schritte.some(s => s.id === "vok@2026-11-14"));
  assert.ok(weit.tage[8].schritte.some(s => s.id === "probe"));
  assert.equal(weit.tage[9].schritte.length, 1);
});

test("Datum eintragen ändert den Plan, Häkchen bleiben, Abbrechen schreibt nichts", () => {
  const raw = v07State();
  const w = loadHtml(fs.readFileSync(htmlPath, "utf8"), {storage: raw});
  w.VT.setNow(() => new Date(2026, 10, 14, 12, 0, 0).getTime());
  const before = w.localStorage.getItem("anton-vokabeln-v1");
  w.VT.go("#/f/mathe/sa");
  const dlg = w.document.getElementById("saDialog");
  assert.equal(dlg.classList.contains("hidden"), false);
  w.document.getElementById("saAbbrechen").click();
  assert.equal(w.localStorage.getItem("anton-vokabeln-v1"), before);
  assert.equal(w.VT.state.sa, undefined);

  w.VT.go("#/f/mathe/sa");
  const input = w.document.getElementById("saDateInput");
  input.value = input.type === "date" ? "2026-11-17" : "17.11.2026";
  input.dispatchEvent(new w.Event("input", {bubbles: true}));
  const preview = w.document.getElementById("saPreview").textContent;
  assert.match(preview, /17\.11\.2026/);
  assert.match(preview, /Dienstag/);
  assert.match(preview, /in 3 Tagen/);
  w.document.getElementById("saSpeichern").click();
  const it = w.VT.state.sa.mathe.items["mathe-sa1-kap1"];
  assert.equal(it.datum, "2026-11-17");
  assert.equal(it.gestartet, "2026-11-14");
  const text = w.document.getElementById("page-sa").textContent;
  assert.match(text, /17\.11\.2026/);
  for (const wort of ["Zahlenstrahl", "Dezimalsystem", "Zehnerpotenzen", "T(n)", "V(n)", "Primzahlen", "Teilbarkeit", "Runden", "Gegenzahl", "Betrag", "Ungleichung", "Quadranten"]) {
    assert.ok(text.includes(wort), wort);
  }
  const box = [...w.document.querySelectorAll("[data-sa-steps]")].find(b => b.getAttribute("data-sa-steps").includes("1.1:heft"));
  box.checked = true;
  box.dispatchEvent(new w.Event("change", {bubbles: true}));
  assert.equal(w.VT.state.sa.mathe.items["mathe-sa1-kap1"].erledigt["1.1:heft"], "2026-11-14");
  w.document.querySelector("[data-sa-datum]").click();
  const input2 = w.document.getElementById("saDateInput");
  input2.value = input2.type === "date" ? "2026-11-19" : "19.11.2026";
  input2.dispatchEvent(new w.Event("input", {bubbles: true}));
  w.document.getElementById("saSpeichern").click();
  assert.equal(w.VT.state.sa.mathe.items["mathe-sa1-kap1"].datum, "2026-11-19");
  assert.equal(w.VT.state.sa.mathe.items["mathe-sa1-kap1"].erledigt["1.1:heft"], "2026-11-14");
  assert.equal(w.VT.state.stats["v001|en"].r, 4);

  w.VT.go("#/f/mathe/sa/mathe-sa1-kap1");
  w.document.querySelector("[data-sa-datum]").click();
  const input3 = w.document.getElementById("saDateInput");
  input3.value = input3.type === "date" ? "2027-12-01" : "01.12.2027";
  input3.dispatchEvent(new w.Event("input", {bubbles: true}));
  assert.equal(w.document.getElementById("saSpeichern").disabled, true);
  assert.match(w.document.getElementById("saWarn").textContent, /366/);
});

test("Probe-Schulaufgabe startet aus vorhandenen Aufgabentypen und zählt als Übung", () => {
  const w = load();
  w.VT.setNow(() => new Date(2026, 10, 14, 12, 0, 0).getTime());
  const kat = w.VT.SA_KATALOG[0];
  const allow = {
    "1.1": ["ordnen"],
    "1.2": ["stellen", "schreiben", "pow"],
    "1.3": ["teilbar", "prim"],
    "1.4": ["runden", "ueberschlag", "umrechnen"],
    "1.5": ["koord", "punkt"],
    "1.6": ["betrag", "ordnen"]
  };
  const qs = w.VT.saProbeFragen(kat, 20, mulberry32(1), {});
  assert.equal(qs.length, 20);
  const c = {};
  for (const q of qs) {
    assert.ok(allow[q.saThema].includes(q.kind), q.saThema + " " + q.kind);
    c[q.saThema] = (c[q.saThema] || 0) + 1;
  }
  for (const id of Object.keys(allow)) assert.ok(c[id] >= 3, id + " " + c[id]);
  w.VT.go("#/f/mathe/sa/" + kat.id + "/probe");
  assert.equal(w.document.getElementById("mQuiz").classList.contains("hidden"), false);
  assert.equal(w.document.getElementById("mProg").textContent, "Aufgabe 1 von 20");
  const q = w.VT.mathe.current();
  assert.ok(q && q.text);
  w.VT.mathe.grade(q.input === "mc" ? q.answer : q.answerText);
  const tag = w.VT.state.mathe.tage[w.VT.dayKey()];
  assert.ok(tag && tag.r + tag.f >= 1);
  assert.ok(w.VT.state.sa.mathe.items[kat.id].zuletzt[q.saThema].length >= 1);
  const payload = {app: "vokabel-trainer", state: w.VT.state};
  const again = load();
  again.VT.importJSON(JSON.stringify(payload));
  assert.equal(again.VT.state.sa.mathe.items[kat.id].zuletzt[q.saThema].length >= 1, true);
  assert.equal(again.VT.state.version, 1);
});
