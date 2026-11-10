"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const {execFileSync} = require("child_process");
const {loadHtml} = require("./load-app");

const repo = path.join(__dirname, "..");
const v05html = execFileSync("git", ["show", "9abafc7:index.html"], {cwd: repo, encoding:"utf8", maxBuffer: 20*1024*1024});
const v06html = require("fs").readFileSync(path.join(repo, "index.html"), "utf8");
const NOW = new Date(2026, 10, 8, 12, 0, 0).getTime();

function pad(n){ return String(n).padStart(2,"0"); }
function nextDay(k){
  const [y,m,d] = k.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate()+1);
  return dt.getFullYear()+"-"+pad(dt.getMonth()+1)+"-"+pad(dt.getDate());
}
function daysFrom(start, end){
  const out=[];
  for(let d=start; d<=end; d=nextDay(d)) out.push(d);
  return out;
}
function realisticV04(){
  const tage={};
  for(const d of daysFrom("2026-10-19", "2026-11-07")){
    tage[d] = {r: d.endsWith("5") ? 6 : 4, f: d.endsWith("3") ? 2 : 1, g: 1, k: 12, t: 90};
  }
  const stats={};
  for(let i=1;i<=12;i++){
    const id="v"+String(i).padStart(3,"0");
    stats[id+"|en"] = {r:5, f:1, s:3, n:6, last:i};
    stats[id+"|de"] = {r:2, f:4, s:0, n:5, last:i};
  }
  stats["v020|en"] = {r:1, f:0, s:1, n:1, last:2};
  return {
    version:1, stats, settings:{dir:"mix", seiten:[1,2,3]}, turn:40,
    queue:[{k:"v001|de", due:3}], best:12, streak:4,
    history:["v001|en","v002|de","v003|en","v004|de"],
    tage, start:{d:"2026-10-19", k:0, n:0},
    abzeichen:{k10:"2026-10-25", d3:"2026-10-21", d7:"2026-10-25", d14:"2026-11-01", n100:"2026-11-02", f10:"2026-10-28"},
    grammatik:{
      stats:{"g2-01":{r:4,f:1,s:2,n:5}, "g2-02":{r:3,f:0,s:2,n:3}, "g3-01":{r:1,f:2,s:0,n:3}},
      tage:{"2026-11-05":{r:3,f:1}, "2026-11-06":{r:2,f:0}, "2026-11-07":{r:4,f:1}},
      thema:"G4"
    }
  };
}
function realisticV05(){
  const s = realisticV04();
  s.mathe = {
    stats:{zahlen:{r:6,f:2,n:8}, addsub:{r:4,f:1,n:5}, blitz:{r:3,f:1,n:4}},
    tage:{"2026-11-04":{r:2,f:1}, "2026-11-06":{r:3,f:0}, "2026-11-07":{r:1,f:1}},
    wdh:{"z:1":1},
    wdhQ:{},
    settings:{blitzSek:8, fach:"mathe", liebling:"behalten"},
    abzeichen:{mr1:"2026-11-04", mr10:"2026-11-07"},
    richtig:{zahlen:6, addsub:4},
    punkte:90, streak:2, best:4, bestStars:2, runden:3,
    extraMathe:true
  };
  return s;
}
function frozen(state){
  const s = JSON.parse(JSON.stringify(state));
  delete s.ui;
  return s;
}
function sumN(stats){
  let n=0;
  for(const k in stats){
    const row=stats[k];
    if(row && typeof row==="object" && !Array.isArray(row)) n += Number(row.n)>0 ? Number(row.n) : 0;
  }
  return n;
}
function canon(w){
  w.VT.setNow(()=>NOW);
  w.VT.renderStats();
  w.VT.newCard();
  const d=w.document;
  const text=id=>{ const n=d.getElementById(id); return n?n.textContent:null; };
  const st=frozen(w.VT.state);
  return JSON.stringify({
    dayStreak:w.VT.dayStreak(),
    bestDayStreak:w.VT.bestDayStreak(),
    sharedDayStreak:w.VT.sharedDayStreak(),
    sharedBestDayStreak:w.VT.sharedBestDayStreak(),
    countGelernt:w.VT.countGelernt(),
    sumN:sumN(st.stats),
    abzeichen:st.abzeichen,
    matheAbzeichen:st.mathe && st.mathe.abzeichen,
    mathePunkte:st.mathe && st.mathe.punkte,
    matheTage:st.mathe && st.mathe.tage,
    matheStats:st.mathe && st.mathe.stats,
    pills:[text("dayPill"), text("sharedPill"), text("streakPill"), text("sessionPill"), text("bestPill")],
    goal:text("goalText"),
    hero:text("dayStreak"),
    badgeCount:text("badgeCount"),
    state:st
  });
}

test("Snapshot v0.4-Spielstand ist zwischen v0.5 und v0.6 byte-gleich", ()=>{
  const fixture = realisticV04();
  const a = canon(loadHtml(v05html, {storage:fixture}));
  const b = canon(loadHtml(v06html, {storage:fixture}));
  assert.equal(a, b);
  const parsed = JSON.parse(a);
  assert.equal(parsed.dayStreak.n, 20);
  assert.equal(parsed.dayStreak.today, false);
  assert.equal(parsed.goal.includes("20"), true);
  assert.equal(parsed.badgeCount.includes("von 15"), true);
});

test("Snapshot v0.5-Spielstand ist zwischen v0.5 und v0.6 byte-gleich", ()=>{
  const fixture = realisticV05();
  const a = canon(loadHtml(v05html, {storage:fixture}));
  const b = canon(loadHtml(v06html, {storage:fixture}));
  assert.equal(a, b);
  const parsed = JSON.parse(b);
  assert.equal(parsed.sharedDayStreak.n, parsed.dayStreak.n);
  assert.equal(parsed.state.mathe.tage["2026-11-04"].r, 2);
  assert.equal(parsed.mathePunkte, 90);
  assert.equal(parsed.state.mathe.settings.liebling, "behalten");
  assert.equal(parsed.state.mathe.settings.fach, "mathe");
});

test("Export und Import v0.5 ↔ v0.6 und Rollback auf 9abafc7", ()=>{
  const fixture = realisticV05();
  const v6 = loadHtml(v06html, {storage:fixture});
  v6.VT.setNow(()=>NOW);
  const q = v6.VT.mathe.makeZeichnenQ(1, ()=>0.2);
  v6.VT.mathe.setRound({mode:"geo-zeichnen", i:0, results:[], ok:0, q, input:"", answered:false});
  assert.equal(v6.VT.mathe.grade(q.input==="mc"?q.answer:q.answerText), true);
  assert.equal(v6.VT.state.ui.fach, null);
  v6.VT.state.ui = {fach:"mathe", bereich:"geometrie", modus:"zeichnen", merke:"bleibt"};
  const wrapped = JSON.stringify({app:"vokabel-trainer", exportiert:"2026-11-08T12:00:00.000Z", state:v6.VT.state});
  assert.equal(JSON.parse(wrapped).app, "vokabel-trainer");
  assert.equal(JSON.parse(wrapped).state.version, 1);

  const old = loadHtml(v05html);
  assert.doesNotThrow(()=>old.VT.importJSON(wrapped));
  old.VT.setNow(()=>NOW);
  assert.equal(old.VT.state.version, 1);
  assert.equal(old.VT.state.stats["v001|en"].s, 3);
  assert.equal(old.VT.state.grammatik.thema, "G4");
  assert.equal(old.VT.state.abzeichen.d14, "2026-11-01");
  assert.equal(old.VT.state.mathe.punkte >= 100, true);
  assert.equal(old.VT.state.mathe.stats["geo-zeichnen"].r, 1);
  assert.equal(old.VT.state.mathe.settings.fach, "mathe");
  assert.equal(old.VT.state.mathe.settings.liebling, "behalten");
  assert.equal(old.VT.state.ui.modus, "zeichnen");
  assert.equal(old.VT.state.ui.merke, "bleibt");
  assert.equal(old.VT.dayStreak().n, 20);
  assert.equal(old.VT.dayStreak().today, false);
  assert.doesNotThrow(()=>old.VT.renderStats());
  assert.equal(old.VT.STORE_KEY, "anton-vokabeln-v1");

  const stored = v6.localStorage.getItem("anton-vokabeln-v1");
  const rolled = loadHtml(v05html, {storage:stored});
  rolled.VT.setNow(()=>NOW);
  assert.doesNotThrow(()=>rolled.VT.renderStats());
  assert.equal(rolled.VT.state.stats["v010|en"].r, 5);
  assert.equal(rolled.VT.state.mathe.abzeichen.mr10, "2026-11-07");
  assert.equal(rolled.VT.bestDayStreak(), v6.VT.bestDayStreak());

  const v5fresh = loadHtml(v05html, {storage:fixture});
  v5fresh.VT.setNow(()=>NOW);
  const oldExport = JSON.stringify({app:"vokabel-trainer", exportiert:"2026-11-08T12:00:00.000Z", state:v5fresh.VT.state});
  assert.equal(JSON.parse(oldExport).state.ui, undefined);
  const back = loadHtml(v06html);
  assert.doesNotThrow(()=>back.VT.importJSON(oldExport));
  back.VT.setNow(()=>NOW);
  const left = JSON.parse(canon(v5fresh));
  const right = JSON.parse(canon(back));
  assert.deepEqual(right.dayStreak, left.dayStreak);
  assert.deepEqual(right.sharedDayStreak, left.sharedDayStreak);
  assert.deepEqual(right.abzeichen, left.abzeichen);
  assert.deepEqual(right.matheAbzeichen, left.matheAbzeichen);
  assert.equal(right.mathePunkte, left.mathePunkte);
  assert.deepEqual(right.pills, left.pills);
  assert.equal(back.VT.state.ui.fach, null);
  assert.equal(back.VT.state.version, 1);
});
