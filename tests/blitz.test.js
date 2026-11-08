"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {load} = require("./load-app");

const window = load();
const VT = window.VT;
const M = VT.mathe;

function freshRound(q){
  M.setRound({mode:"blitz", i:0, results:[], ok:0, q, input:"", answered:false});
}

test("Timeout zählt als nicht gelöst", ()=>{
  const q = M.makeBlitzQ(1, ()=>0.2);
  freshRound(q);
  const beforePunkte = VT.state.mathe.punkte;
  const beforeWdh = JSON.stringify(VT.state.mathe.wdh);
  const beforeRichtig = JSON.stringify(VT.state.mathe.richtig);
  VT.setNow(()=>0);
  M.startBlitzClock();
  VT.setNow(()=> 60_000);
  M.paintBlitz();
  const round = M.round;
  assert.equal(round.answered, true);
  assert.equal(round.results[0], "timeout");
  assert.equal(VT.state.mathe.punkte, beforePunkte);
  assert.equal(JSON.stringify(VT.state.mathe.wdh), beforeWdh);
  assert.equal(JSON.stringify(VT.state.mathe.richtig), beforeRichtig);
  assert.equal(window.document.getElementById("mFb").textContent.includes("Nicht gelöst"), true);
});

test("Rechtzeitig richtig gibt Punkte und keinen Fehler", ()=>{
  const q = M.makeZahlenQ(1, ()=>0.1);
  q.area = "blitz";
  q.rule = "zahlen";
  freshRound(q);
  VT.setNow(()=>1000);
  M.startBlitzClock();
  VT.setNow(()=>2500);
  const punkte = VT.state.mathe.punkte;
  const ok = M.grade(q.answerText);
  assert.equal(ok, true);
  assert.equal(M.round.results[0], true);
  assert.equal(VT.state.mathe.punkte, punkte+10);
  assert.equal(VT.state.mathe.wdh[q.key], undefined);
  assert.ok(VT.state.mathe.richtig.blitz>=1);
});

test("Alter Blitz-Timer feuert nach blitzGen nicht mehr", ()=>{
  const q = M.makeBlitzQ(1, ()=>0.4);
  freshRound(q);
  VT.setNow(()=>0);
  const gen = M.startBlitzClock();
  assert.equal(typeof gen, "number");
  M.stopBlitz();
  VT.setNow(()=> 60_000);
  assert.equal(M.blitzTick(gen), false);
  assert.equal(M.round.answered, false);
  assert.equal(M.round.results[0], undefined);
  assert.ok(M.blitzGen !== gen);
  const gen2 = M.startBlitzClock();
  VT.setNow(()=>500);
  assert.equal(M.blitzTick(gen), false);
  assert.equal(M.round.answered, false);
  assert.equal(M.blitzTick(gen2), true);
  assert.equal(M.round.answered, false);
  VT.setNow(()=> 80_000);
  assert.equal(M.blitzTick(gen2), true);
  assert.equal(M.round.results[0], "timeout");
  const marker = M.round.results[0];
  assert.equal(M.blitzTick(gen), false);
  assert.equal(M.round.results[0], marker);
});

test("Falsch im Blitz landet in der Wiederholung, Timeout nicht", ()=>{
  const q = M.makeBlitzQ(2, ()=>0.3);
  freshRound(q);
  VT.setNow(()=>0);
  M.startBlitzClock();
  const ok = M.grade(q.answerText==="0" ? "1" : "0");
  assert.equal(ok, false);
  assert.equal(VT.state.mathe.wdh[q.key], 2);
  assert.ok(VT.state.mathe.wdhQ[q.key]);
  const q2 = M.makeBlitzQ(2, ()=>0.7);
  freshRound(q2);
  VT.setNow(()=>0);
  M.startBlitzClock();
  VT.setNow(()=> 30_000);
  M.paintBlitz();
  assert.equal(VT.state.mathe.wdh[q2.key], undefined);
});

test("Sterne: 9 von 10 sind 3, Timeout senkt nicht als Fehler die Liste", ()=>{
  assert.equal(M.starsFor(9, 10), 3);
  assert.equal(M.starsFor(7, 10), 2);
  assert.equal(M.starsFor(4, 10), 1);
  assert.equal(M.starsFor(3, 10), 0);
  assert.equal(M.ROUND_LEN, 10);
  assert.deepEqual([...M.BLITZ_CHOICES], [6,8,10]);
  assert.equal(M.BLITZ_DEFAULT_SEK, 8);
});
