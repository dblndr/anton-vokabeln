"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {load} = require("./load-app");

const window = load();
const VT = window.VT;

function v04(){
  return {
    version:1,
    stats:{
      "v001|en":{r:4,f:1,s:2,n:5,last:3},
      "v001|de":{r:2,f:2,s:0,n:4,last:1},
      "v010|en":{r:6,f:0,s:3,n:6,last:8}
    },
    settings:{dir:"de", seiten:[1,2,8]},
    turn:4,
    queue:[{k:"v001|de", due:1}],
    best:6,
    streak:4,
    history:["v001|en"],
    tage:{
      "2026-11-01":{r:5,f:1,g:2,k:3,t:80},
      "2026-11-02":{r:3,f:0,g:1,k:4,t:40}
    },
    start:{d:"2026-11-01", k:3, n:9},
    abzeichen:{k10:"2026-10-01"},
    grammatik:{
      stats:{"g2-01":{r:2,f:1,s:1,n:3}, "g3-02":{r:1,f:0,s:1,n:1}},
      tage:{"2026-11-02":{r:4,f:1}},
      thema:"G3"
    },
    extraFeld:{notiz:"bitte behalten", n:7}
  };
}

function withoutMathe(s){
  const c = JSON.parse(JSON.stringify(s));
  delete c.mathe;
  return c;
}

test("v0.4-Stand bleibt gleich, state.mathe wird nur ergänzt", ()=>{
  const raw = v04();
  const before = JSON.parse(JSON.stringify(raw));
  const s = VT.migrate(raw);
  assert.deepEqual(withoutMathe(s), before);
  assert.equal(s.version, 1);
  assert.equal(s.streak, 4);
  assert.equal(s.best, 6);
  assert.equal(s.settings.dir, "de");
  assert.deepEqual(s.settings.seiten, [1,2,8]);
  assert.equal(s.abzeichen.k10, "2026-10-01");
  assert.equal(s.grammatik.thema, "G3");
  assert.equal(s.grammatik.stats["g2-01"].f, 1);
  assert.equal(s.tage["2026-11-01"].r, 5);
  assert.equal(s.extraFeld.notiz, "bitte behalten");
  assert.ok(s.mathe && s.mathe.stats && s.mathe.tage && s.mathe.wdh && s.mathe.settings);
  assert.equal(JSON.stringify(s.mathe.stats), "{}");
  assert.equal(JSON.stringify(s.mathe.tage), "{}");
  assert.equal(JSON.stringify(s.mathe.wdh), "{}");
  assert.equal(s.mathe.settings.blitzSek, 8);
  assert.equal(s.mathe.settings.fach, null);
  assert.equal(VT.STORE_KEY, "anton-vokabeln-v1");
});

test("vorhandenes state.mathe wird nicht ersetzt", ()=>{
  const raw = v04();
  raw.mathe = {stats:{zahlen:{r:3,f:1,n:4}}, tage:{"2026-11-08":{r:2,f:0}}, wdh:{"sq:4":1}, settings:{blitzSek:6, fach:"mathe", liebling:1}, abzeichen:{mr1:"2026-11-08"}, richtig:{zahlen:3}, punkte:30, streak:2, best:5, bestStars:3, runden:2, extra:9};
  const s = VT.migrate(raw);
  assert.equal(s.mathe.punkte, 30);
  assert.equal(s.mathe.settings.blitzSek, 6);
  assert.equal(s.mathe.settings.fach, "mathe");
  assert.equal(s.mathe.settings.liebling, 1);
  assert.equal(s.mathe.wdh["sq:4"], 1);
  assert.equal(s.mathe.extra, 9);
  assert.equal(s.stats["v001|en"].r, 4);
});

test("Export → Import Rundreise mit und ohne Mathe", ()=>{
  const plain = v04();
  VT.importJSON(JSON.stringify({app:"vokabel-trainer", state:plain}));
  assert.equal(VT.state.version, 1);
  assert.equal(VT.state.stats["v010|en"].s, 3);
  assert.equal(VT.state.grammatik.thema, "G3");
  assert.equal(VT.state.settings.dir, "de");
  assert.equal(VT.state.abzeichen.k10, "2026-10-01");
  assert.ok(VT.state.mathe && VT.state.mathe.stats);
  assert.equal(JSON.stringify(VT.state.mathe.wdh), "{}");

  VT.state.mathe.punkte = 40;
  VT.state.mathe.settings.fach = "englisch";
  VT.state.mathe.settings.blitzSek = 10;
  VT.state.mathe.stats.blitz = {r:2,f:0,n:2};
  VT.state.mathe.wdh["k"] = 2;
  const dumped = JSON.parse(JSON.stringify({app:"vokabel-trainer", state:VT.state}));
  dumped.state.streak = 4;
  VT.importJSON(JSON.stringify(dumped));
  assert.equal(VT.state.mathe.punkte, 40);
  assert.equal(VT.state.mathe.settings.fach, "englisch");
  assert.equal(VT.state.mathe.settings.blitzSek, 10);
  assert.equal(VT.state.mathe.stats.blitz.r, 2);
  assert.equal(VT.state.mathe.wdh.k, 2);
  assert.equal(VT.state.stats["v001|en"].r, 4);
  assert.equal(VT.state.grammatik.stats["g3-02"].r, 1);
  assert.equal(VT.state.version, 1);
});

test("Mathe zählt nur in der gemeinsamen Serie, nicht in der Englisch-Serie", ()=>{
  VT.setNow(()=> new Date(2026, 10, 8, 15, 0, 0).getTime());
  VT.state.tage = {};
  VT.state.grammatik.tage = {};
  VT.state.mathe.tage = {"2026-11-08":{r:2,f:0}, "2026-11-07":{r:1,f:1}};
  const en = VT.dayStreak();
  assert.equal(en.n, 0);
  assert.equal(en.today, false);
  const sh = VT.sharedDayStreak();
  assert.equal(sh.n, 2);
  assert.equal(sh.today, true);
  assert.equal(VT.bestDayStreak(VT.state.tage, VT.state.grammatik.tage), 0);
  assert.equal(VT.bestDayStreak(), 0);
  assert.equal(VT.sharedBestDayStreak(), 2);
  assert.deepEqual(VT.state.tage, {});
});
