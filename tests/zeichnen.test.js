"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {load} = require("./load-app");

const window = load();
const VT = window.VT;
const M = VT.mathe;

function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function smallAngle(a, b){
  let d = Math.abs(a-b) % 360;
  if(d>180) d = 360-d;
  return d;
}
function figurName(pts){
  if(pts.length===3){
    const dot=(p,q,r)=>{ const ax=q[0]-p[0], ay=q[1]-p[1], bx=r[0]-p[0], by=r[1]-p[1]; return ax*bx+ay*by; };
    const right = dot(pts[0],pts[1],pts[2])===0 || dot(pts[1],pts[0],pts[2])===0 || dot(pts[2],pts[0],pts[1])===0;
    return right ? "rechtwinkliges Dreieck" : null;
  }
  const xs=[...new Set(pts.map(p=>p[0]))].sort((a,b)=>a-b);
  const ys=[...new Set(pts.map(p=>p[1]))].sort((a,b)=>a-b);
  if(xs.length!==2 || ys.length!==2) return null;
  const has=(x,y)=>pts.some(p=>p[0]===x && p[1]===y);
  if(![[xs[0],ys[0]],[xs[1],ys[0]],[xs[1],ys[1]],[xs[0],ys[1]]].every(p=>has(p[0],p[1]))) return null;
  return xs[1]-xs[0]===ys[1]-ys[0] ? "Quadrat" : "Rechteck";
}
function label(x,y){
  const f=n=>(n<0?"−":"")+Math.abs(n);
  return "("+f(x)+"|"+f(y)+")";
}
function expectAnswer(spec){
  if(spec.op==="figur") return figurName(spec.pts);
  if(spec.op==="winkel") return smallAngle(spec.from, spec.to);
  if(spec.op==="koord") return spec.axis==="x" ? spec.x : spec.y;
  return label(spec.x, spec.y);
}
function xy(spec, x, y){
  return {
    x: Math.round(spec.pad + (x-spec.min)*spec.cell),
    y: Math.round(spec.pad + (spec.max-y)*spec.cell)
  };
}

test("Zeichnen-Generator: 200 Aufgaben je Stufe gegen die Referenz", ()=>{
  for(const level of [1,2,3]){
    const rnd = mulberry32(9000+level*17);
    const seen = new Set();
    for(let i=0;i<200;i++){
      const q = M.makeZeichnenQ(level, rnd);
      assert.equal(q.area, "geo-zeichnen");
      assert.ok(q.svg.includes("<svg"));
      assert.ok(q.steps.length>=1 && q.steps.length<=3);
      seen.add(q.kind);
      const want = expectAnswer(q.spec);
      if(q.input==="mc"){
        assert.equal(q.answer, want, q.kind+" "+JSON.stringify(q.spec));
        assert.equal(q.options.filter(o=>o===q.answer).length, 1);
        assert.ok(q.options.length>=2);
      } else {
        assert.equal(q.num, want);
        assert.equal(q.scale, 0);
        assert.equal(M.sameNumber(q.answerText, {num:q.num, scale:0}), true);
      }
      const spec=q.spec;
      if(spec.op==="punkt" || spec.op==="koord"){
        const p=xy(spec, spec.x, spec.y);
        assert.ok(q.svg.includes('cx="'+p.x+'"'), "Punktpixel");
        assert.ok(q.svg.includes('cy="'+p.y+'"'));
      }
      if(spec.op==="figur"){
        const p=xy(spec, spec.pts[0][0], spec.pts[0][1]);
        assert.ok(q.svg.includes(p.x+","+p.y));
      }
      if(spec.op==="winkel"){
        const a=xy(spec, spec.endA[0], spec.endA[1]);
        const b=xy(spec, spec.endB[0], spec.endB[1]);
        assert.ok(q.svg.includes('x2="'+a.x+'"'));
        assert.ok(q.svg.includes('y2="'+b.y+'"'));
      }
    }
    if(level===1){
      assert.ok(seen.has("figur"));
      assert.ok(seen.has("punkt"));
    }
    if(level>=2) assert.ok(seen.has("winkel"));
    if(level===3) assert.ok(seen.has("koord"));
  }
});

test("Richtig und falsch landen in geo-zeichnen und in mathe.tage, nicht in der Englisch-Serie", ()=>{
  VT.setNow(()=>new Date(2026, 10, 8, 15, 0, 0).getTime());
  const tageBefore = JSON.stringify(VT.state.tage);
  const geoBefore = VT.state.mathe.stats.geometrie ? VT.state.mathe.stats.geometrie.r : 0;
  const enBefore = VT.dayStreak().n;
  const q = M.makeZeichnenQ(1, ()=>0.1);
  M.setRound({mode:"geo-zeichnen", i:0, results:[], ok:0, q, input:"", answered:false});
  const ok = M.grade(q.input==="mc" ? q.answer : q.answerText);
  assert.equal(ok, true);
  assert.equal(VT.state.mathe.stats["geo-zeichnen"].r, 1);
  assert.equal(VT.state.mathe.tage["2026-11-08"].r >= 1, true);
  assert.equal(VT.state.mathe.stats.geometrie ? VT.state.mathe.stats.geometrie.r : 0, geoBefore);
  assert.equal(JSON.stringify(VT.state.tage), tageBefore);
  assert.equal(VT.dayStreak().n, enBefore);
  assert.equal(VT.sharedDayStreak().today, true);
  const wrong = M.makeZeichnenQ(2, ()=>0.9);
  M.setRound({mode:"geo-zeichnen", i:0, results:[], ok:0, q:wrong, input:"", answered:false});
  const bad = M.grade(wrong.input==="mc" ? (wrong.options.find(o=>o!==wrong.answer)||"nein") : "0");
  if(wrong.input==="num" && M.sameNumber("0", {num:wrong.num, scale:0})){
    assert.equal(bad, true);
  } else {
    assert.equal(bad, false);
    assert.equal(VT.state.mathe.stats["geo-zeichnen"].f >= 1, true);
    assert.equal(VT.state.mathe.wdh[wrong.key] >= 1, true);
  }
  assert.equal(JSON.stringify(VT.mathe.LEARN), JSON.stringify(["zahlen","addsub","muldiv","terme","groessen","flaechen","geometrie"]));
});
