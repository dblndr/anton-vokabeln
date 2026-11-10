"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {load} = require("./load-app");

const window = load();
const VT = window.VT;
const same = (a,b)=>assert.equal(JSON.stringify(a), JSON.stringify(b));

test("Registry enthält Englisch und Mathe, ohne Diktat", ()=>{
  same(VT.FAECHER.map(f=>f.id), ["englisch","mathe"]);
  const en = VT.FAECHER[0];
  const ma = VT.FAECHER[1];
  same(en.bereiche.map(b=>b.id), ["vokabeln","grammatik"]);
  same(en.bereiche[0].modi, ["lernen","schwer","auswahl"]);
  assert.equal(en.fachweit.includes("gemischt"), true);
  assert.equal(JSON.stringify(en).includes("diktat"), false);
  assert.equal(ma.bereiche.length, 7);
  same(ma.bereiche.find(b=>b.id==="geometrie").modi, ["antippen","zeichnen","fehler","regeln"]);
  same([...ma.fachweit], ["gemischt","blitz"]);
  assert.equal(VT.mathe.LEARN.includes("geo-zeichnen"), false);
  assert.equal(VT.mathe.GENERATORS["geo-zeichnen"], undefined);
  assert.equal(typeof VT.mathe.makeZeichnenQ, "function");
});

test("Adapter lesen dieselben Werte wie die alten Funktionen", ()=>{
  VT.setNow(()=>new Date(2026, 10, 8, 12, 0, 0).getTime());
  VT.state.tage = {"2026-11-08":{r:4,f:1,g:0,k:1,t:10}, "2026-11-07":{r:2,f:0,g:0,k:1,t:10}};
  VT.state.grammatik.tage = {"2026-11-06":{r:1,f:0}};
  VT.state.mathe.tage = {"2026-11-08":{r:3,f:1}, "2026-11-05":{r:1,f:0}};
  const en = VT.adapter("englisch");
  const ma = VT.adapter("mathe");
  same(en.heute(), {r:4, f:1});
  assert.equal(en.aktivAm("2026-11-06"), true);
  assert.equal(en.aktivAm("2026-11-04"), false);
  assert.equal(en.fachSerie().n, VT.dayStreak().n);
  assert.equal(en.fachSerie().today, VT.dayStreak().today);
  assert.equal(en.fachSerie().best, VT.bestDayStreak());
  same(ma.heute(), {r:3, f:1});
  assert.equal(ma.fachSerie().n, VT.mDayStreak().n);
  assert.equal(ma.fachSerie().best, VT.mathe.mDayBest(VT.state.mathe));
  assert.equal(en.abzeichen().length, 15);
  assert.equal(ma.abzeichen().length, 9);
  assert.equal(en.bereiche().length, 2);
  assert.equal(ma.bereiche().length, 7);
});

test("Mathe-Tage werden nur berechnet und nicht gespeichert", ()=>{
  VT.setNow(()=>new Date(2026, 10, 8, 12, 0, 0).getTime());
  VT.state.mathe.tage = {"2026-11-08":{r:1,f:0}, "2026-11-07":{r:2,f:0}, "2026-11-06":{r:1,f:1}};
  const before = JSON.stringify(VT.state);
  const s = VT.mDayStreak();
  assert.equal(s.n, 3);
  assert.equal(s.today, true);
  assert.equal(JSON.stringify(VT.state), before);
  assert.equal(VT.state.mathe.serie, undefined);
  assert.equal(VT.state.mathe.matheTage, undefined);
});

test("Ein neues Fach zählt nur in der gemeinsamen Serie", ()=>{
  VT.setNow(()=>new Date(2026, 10, 9, 12, 0, 0).getTime());
  VT.state.tage = {};
  VT.state.grammatik.tage = {};
  VT.state.mathe.tage = {};
  VT.state.physik = {stats:{}, tage:{"2026-11-09":{r:2,f:0}, "2026-11-08":{r:1,f:0}}, settings:{}, abzeichen:{}};
  VT.FAECHER.push({id:"physik", name:"Physik", icon:"🔬", farbe:"#888", bereiche:[], fachweit:[], adapter:{}});
  try {
    assert.equal(VT.dayStreak().n, 0);
    assert.equal(VT.bestDayStreak(), 0);
    assert.equal(VT.sharedDayStreak().n, 2);
    assert.equal(VT.sharedDayStreak().today, true);
    assert.equal(VT.sharedBestDayStreak(), 2);
    assert.deepEqual(VT.state.tage, {});
  } finally {
    VT.FAECHER.pop();
    delete VT.state.physik;
  }
});
