"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const {execFileSync} = require("child_process");
const {loadHtml} = require("./load-app");

const repo = path.join(__dirname, "..");
const v04html = execFileSync("git", ["show", "72e7107:index.html"], {cwd: repo, encoding: "utf8", maxBuffer: 20*1024*1024});
const v05html = require("fs").readFileSync(path.join(repo, "index.html"), "utf8");
const NOW = new Date(2026, 10, 8, 12, 0, 0).getTime();

function pad(n){ return String(n).padStart(2,"0"); }
function nextDay(k){
  const [y,m,d] = k.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate()+1);
  return dt.getFullYear()+"-"+pad(dt.getMonth()+1)+"-"+pad(dt.getDate());
}
function daysFrom(start, end){
  const out = [];
  for(let d=start; d<=end; d=nextDay(d)) out.push(d);
  return out;
}

function realisticV04(){
  const tage = {};
  for(const d of daysFrom("2026-10-19", "2026-11-07")){
    tage[d] = {r: d.endsWith("5") ? 6 : 4, f: d.endsWith("3") ? 2 : 1, g: 1, k: 12, t: 90};
  }
  const stats = {};
  for(let i=1;i<=12;i++){
    const id = "v"+String(i).padStart(3,"0");
    stats[id+"|en"] = {r:5, f:1, s:3, n:6, last:i};
    stats[id+"|de"] = {r:2, f:4, s:0, n:5, last:i};
  }
  stats["v020|en"] = {r:1, f:0, s:1, n:1, last:2};
  return {
    version: 1,
    stats,
    settings: {dir:"mix", seiten:[1,2,3]},
    turn: 40,
    queue: [{k:"v001|de", due:3}],
    best: 12,
    streak: 4,
    history: ["v001|en","v002|de","v003|en","v004|de"],
    tage,
    start: {d:"2026-10-19", k:0, n:0},
    abzeichen: {
      k10: "2026-10-25",
      d3: "2026-10-21",
      d7: "2026-10-25",
      d14: "2026-11-01",
      n100: "2026-11-02",
      f10: "2026-10-28"
    },
    grammatik: {
      stats: {
        "g2-01": {r:4, f:1, s:2, n:5},
        "g2-02": {r:3, f:0, s:2, n:3},
        "g3-01": {r:1, f:2, s:0, n:3}
      },
      tage: {
        "2026-11-05": {r:3, f:1},
        "2026-11-06": {r:2, f:0},
        "2026-11-07": {r:4, f:1}
      },
      thema: "G4"
    }
  };
}

function snap(w){
  w.VT.setNow(()=>NOW);
  w.VT.renderStats();
  w.VT.newCard();
  const d = w.document;
  const text = id => { const n=d.getElementById(id); return n ? n.textContent : null; };
  const html = id => { const n=d.getElementById(id); return n ? n.innerHTML : null; };
  const cls = id => { const n=d.getElementById(id); return n ? n.className : null; };
  return {
    version: w.VT.state.version,
    key: w.VT.STORE_KEY,
    dayStreak: JSON.parse(JSON.stringify(w.VT.dayStreak())),
    bestDay: w.VT.bestDayStreak(),
    dayPill: text("dayPill"),
    streakPill: text("streakPill"),
    sessionPill: text("sessionPill"),
    bestPill: text("bestPill"),
    hero: text("dayStreak"),
    heroMsg: text("dayStreakMsg"),
    heroBest: text("dayBest"),
    goal: text("goalText"),
    goalBar: d.getElementById("goalBar").style.width,
    gelernt: text("kGelernt"),
    antworten: text("kAntworten"),
    quote: text("kQuote"),
    mastery: text("masteryText"),
    masteryBar: d.getElementById("masteryBar").style.width,
    flame: cls("flame"),
    badgeCount: text("badgeCount"),
    badges: text("badges"),
    days: html("chartDays"),
    line: html("chartLine"),
    weeks: html("chartWeeks"),
    cmp: text("cmp"),
    cmpMsg: text("cmpMsg"),
    grammar: text("gStatTable"),
    grammarNote: text("gStatNote"),
    hard: text("hardList"),
    cntG: text("cntGelernt"),
    cntS: text("cntSchwer"),
    cntN: text("cntNeu"),
    table: text("statTable"),
    tage: JSON.parse(JSON.stringify(w.VT.state.tage)),
    stats: JSON.parse(JSON.stringify(w.VT.state.stats)),
    abzeichen: JSON.parse(JSON.stringify(w.VT.state.abzeichen)),
    grammatik: JSON.parse(JSON.stringify(w.VT.state.grammatik)),
    best: w.VT.state.best,
    streak: w.VT.state.streak,
    settings: JSON.parse(JSON.stringify(w.VT.state.settings))
  };
}

// Der Katalog ist seit v0.4 gewachsen (80 Heft-Karten, beide Richtungen).
// Fortschritt, Serien und die alten Zeilen bleiben gleich. Nur die
// Anzeige, die die gesamte Liste zählt, und die neuen Tabellenzeilen wachsen.
function progress(s){
  const c = Object.assign({}, s);
  delete c.badges;
  delete c.cntN;
  delete c.table;
  return c;
}
function normalizeBadges(s){
  return s
    .replace("Halbzeit: 306 Karten", "Halbzeit: 226 Karten")
    .replace("noch 294", "noch 214")
    .replace("Alle 612 Karten", "Alle 452 Karten")
    .replace("noch 600", "noch 440");
}
function oneInsertion(oldText, newText){
  let i = 0;
  const n = Math.min(oldText.length, newText.length);
  while(i < n && oldText[i] === newText[i]) i++;
  const rest = oldText.slice(i);
  assert.equal(newText.slice(newText.length - rest.length), rest);
  return newText.slice(i, newText.length - rest.length);
}
function assertCatalogGrew(actual, v04){
  assert.deepEqual(progress(actual), progress(v04));
  assert.equal(Number(actual.cntN) - Number(v04.cntN), 160);
  assert.equal(normalizeBadges(actual.badges), v04.badges);
  const inserted = oneInsertion(v04.table, actual.table);
  assert.equal(inserted.includes("make models"), true);
  assert.equal(inserted.includes("Modelle machen"), true);
  assert.equal(inserted.includes("I'm from Greenwich"), false);
}

test("v0.4 liest einen v0.5-Stand, Englisch-Statistik bleibt gleich, auch nach Mathe", ()=>{
  const fixture = realisticV04();
  const before = snap(loadHtml(v04html, {storage: fixture}));
  const v5 = loadHtml(v05html, {storage: fixture});
  const after = snap(v5);
  assertCatalogGrew(after, before);
  assert.equal(before.goal.includes("20"), true);
  assert.equal(before.badgeCount.includes("von 15"), true);
  assert.equal(before.dayStreak.n, 20);
  assert.equal(before.dayStreak.today, false);
  assert.equal(before.heroMsg.includes("Heute noch nicht geübt"), true);
  assert.deepEqual(Object.keys(before.abzeichen).sort(), ["d14","d3","d7","f10","k10","n100"]);

  const tageBefore = JSON.stringify(v5.VT.state.tage);
  const q = v5.VT.mathe.makeAddSubQ(1, ()=>0.2);
  v5.VT.mathe.setRound({mode:"addsub", i:0, results:[], ok:0, q, input:"", answered:false});
  assert.equal(v5.VT.mathe.grade(q.answerText), true);
  const afterMath = snap(v5);
  assert.deepEqual(afterMath, after);
  assert.equal(JSON.stringify(v5.VT.state.tage), tageBefore);
  assert.equal(v5.VT.sharedDayStreak().n, 21);
  assert.equal(v5.VT.sharedDayStreak().today, true);
  assert.equal(v5.VT.dayStreak().n, 20);
  assert.ok(v5.VT.state.mathe.tage["2026-11-08"].r >= 1);

  const wrapped = JSON.stringify({app:"vokabel-trainer", exportiert:"2026-11-08T12:00:00.000Z", state: v5.VT.state});
  const rolled = loadHtml(v04html);
  assert.doesNotThrow(()=> rolled.VT.importJSON(wrapped));
  assert.deepEqual(snap(rolled), before);
  assert.equal(rolled.VT.dayStreak().today, false);

  const again = loadHtml(v05html);
  again.VT.importJSON(wrapped);
  const back = snap(again);
  assert.deepEqual(back, after);
  assert.equal(again.VT.state.mathe.stats.addsub.r >= 1, true);

  const v04only = loadHtml(v04html, {storage: fixture});
  const oldExport = JSON.stringify({app:"vokabel-trainer", state: v04only.VT.state});
  assert.equal(JSON.parse(oldExport).state.mathe, undefined);
  const imported = loadHtml(v05html);
  imported.VT.importJSON(oldExport);
  assert.deepEqual(snap(imported), after);
  assert.ok(imported.VT.state.mathe && imported.VT.state.mathe.stats);
});

test("Rollback: v0.4 startet mit v0.5-Speicherstand ohne Fehler", ()=>{
  const fixture = realisticV04();
  fixture.mathe = {stats:{zahlen:{r:4,f:1,n:5}}, tage:{"2026-11-08":{r:3,f:0}}, wdh:{}, settings:{blitzSek:8, fach:"mathe"}, abzeichen:{}, richtig:{zahlen:4}, punkte:40, streak:3, best:3, bestStars:0, runden:1};
  const w = loadHtml(v04html, {storage: fixture});
  w.VT.setNow(()=>NOW);
  assert.doesNotThrow(()=> w.VT.renderStats());
  assert.equal(w.VT.state.version, 1);
  assert.equal(w.VT.state.stats["v001|en"].s, 3);
  assert.equal(w.VT.state.grammatik.thema, "G4");
  assert.equal(w.VT.dayStreak().n, 20);
  assert.equal(w.VT.dayStreak().today, false);
  assert.equal(w.VT.STORE_KEY, "anton-vokabeln-v1");
});

test("Reset löscht Englisch und Mathe, Backup eines Altstands bleibt", ()=>{
  const w = loadHtml(v05html, {storage: realisticV04()});
  w.VT.state.mathe.punkte = 15;
  w.VT.state.mathe.stats.zahlen = {r:2,f:0,n:2};
  w.document.getElementById("resetBtn").click();
  assert.equal(JSON.stringify(w.VT.state.stats), "{}");
  assert.equal(JSON.stringify(w.VT.state.tage), "{}");
  assert.equal(JSON.stringify(w.VT.state.abzeichen), "{}");
  assert.equal(w.VT.state.grammatik.thema, "mix");
  assert.equal(JSON.stringify(w.VT.state.grammatik.stats), "{}");
  assert.equal(JSON.stringify(w.VT.state.mathe.stats), "{}");
  assert.equal(w.VT.state.mathe.punkte, 0);
  assert.equal(w.document.getElementById("ioMsg").textContent.includes("Englisch und Mathe"), true);

  const alt = {version:1, stats:{"v001|en":{r:2,f:0,s:1,n:2,last:1}}, settings:{dir:"mix", seiten:null}};
  const raw = JSON.stringify(alt);
  const legacy = loadHtml(v05html, {storage: raw});
  const backup = legacy.localStorage.getItem("anton-vokabeln-v1-sicherung-vor-statistik");
  assert.equal(backup, raw);
  assert.equal(legacy.VT.state.stats["v001|en"].r, 2);
  assert.ok(legacy.VT.state.mathe);
});
