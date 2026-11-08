"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {load} = require("./load-app");
const {reference, parseDe, norm, digitsOf} = require("./reference");

const window = load();
const M = window.VT.mathe;

function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const EXPECT = {
  zahlen: ["stellen","runden","betrag","ordnen","schreiben"],
  addsub: {1:["add","sub","ueberschlag","eq-add","eq-xma","eq-amx"], 2:["add","sub","ueberschlag","eq-add","eq-xma","eq-amx","geschickt"], 3:["add","sub","ueberschlag","eq-add","eq-xma","eq-amx","geschickt"]},
  muldiv: {1:["mul","div","quadrat","teilbar","eq-mul","eq-div","eq-adiv"], 2:["mul","div","quadrat","teilbar","pow","prim","eq-mul","eq-div","eq-adiv"], 3:["mul","div","quadrat","teilbar","pow","prim","eq-mul","eq-div","eq-adiv"]},
  terme: {1:["punkt"], 2:["punkt","klammer"], 3:["punkt","klammer","distributiv","sache"]},
  groessen: {1:["umrechnen"], 2:["umrechnen","zeit","dreisatz","geld"], 3:["umrechnen","zeit","dreisatz","geld","massstab"]},
  flaechen: {1:["umfang","flaeche","einheit"], 2:["umfang","flaeche","einheit","quader"], 3:["umfang","flaeche","einheit","quader"]},
  geometrie: {1:["viereck","winkel"], 2:["viereck","winkel"], 3:["viereck","winkel","lage"]},
  blitz: {1:["add","sub","mul","quadrat","umrechnen"], 2:["add","sub","mul","div","quadrat","umrechnen"], 3:["add","sub","mul","div","quadrat","umrechnen"]},
  mix: null
};

function expectKinds(name, level){
  const row = EXPECT[name];
  if(!row) return null;
  return Array.isArray(row) ? row : row[level];
}

function checkQuestion(q, name){
  assert.ok(q && q.spec && q.spec.op, "Aufgabe ohne spec");
  assert.ok(q.text && !/NaN|Infinity/.test(q.text), "Text kaputt: "+q.text);
  assert.ok(q.steps && q.steps.length>=1 && q.steps.length<=3, "Lösungsweg 1–3 Schritte");
  for(const s of q.steps) assert.equal(typeof s, "string");
  assert.ok(!/NaN|Infinity/.test(q.steps.join(" ")));
  const ref = reference(q.spec);
  if(q.input==="mc" || ref.mc!=null){
    assert.equal(q.input, "mc");
    assert.ok(Array.isArray(q.options) && q.options.length>=2);
    assert.equal(new Set(q.options).size, q.options.length, "doppelte Optionen "+q.text);
    assert.equal(q.options.filter(o=>o===q.answer).length, 1, "nicht genau eine richtige Option");
    assert.equal(q.answer, ref.mc, q.text+" → "+q.answer+" statt "+ref.mc);
    if(ref.needle) assert.ok(q.text.includes(ref.needle), "Text passt nicht zur Regel: "+q.text);
    if(q.spec.op==="angle") assert.ok(q.text.includes(String(q.spec.deg)));
    return;
  }
  assert.equal(q.input, "num");
  assert.equal(Number.isSafeInteger(q.num), true, "num nicht ganzzahlig/sicher");
  assert.equal(Number.isInteger(q.scale), true);
  assert.ok(!/NaN|Infinity/.test(String(q.answerText)));
  assert.match(q.answerText, /^(−|-)?\d+(,\d+)?$/, "nicht tippbar: "+q.answerText);
  const typed = parseDe(q.answerText);
  const want = norm(ref.num, ref.scale);
  const got = norm(q.num, q.scale);
  assert.equal(got.num, want.num, q.text+" App "+got.num+"/"+got.scale+" Referenz "+want.num+"/"+want.scale);
  assert.equal(got.scale, want.scale);
  assert.equal(typed.num, want.num, "answerText "+q.answerText);
  assert.equal(typed.scale, want.scale);
  assert.ok(digitsOf(want.num, want.scale)<=9, "mehr als 9 Stellen: "+q.answerText);
  if(q.spec.op==="div" || (q.spec.op==="eq" && /[*/]/.test(q.spec.form)) || (q.spec.op==="term")){
    assert.equal(typeof ref.num, "number");
  }
}

const GENS = ["zahlen","addsub","muldiv","terme","groessen","flaechen","geometrie","blitz","mix"];

for(const name of GENS){
  for(const level of [1,2,3]){
    test(name+" Stufe "+level+" · 500 Aufgaben", ()=>{
      const rnd = mulberry32(5000 + level*97 + name.length*13);
      const seen = new Set();
      const fn = M.GENERATORS[name];
      for(let i=0;i<500;i++){
        let q;
        try { q = fn(level, rnd); }
        catch(err){ assert.fail(name+" L"+level+" #"+i+" wirft: "+err.message); }
        try { checkQuestion(q, name); }
        catch(err){ assert.fail(name+" L"+level+" #"+i+" "+(q&&q.kind)+" „"+(q&&q.text)+"“: "+err.message); }
        seen.add(q.kind);
      }
      const need = expectKinds(name, level);
      if(need){
        for(const k of need) assert.ok(seen.has(k), name+" Stufe "+level+" hat die Art „"+k+"“ nicht erzeugt ("+[...seen].join(",")+")");
      }
    });
  }
}

test("Ziffernvergleich 3,5 = 3,50 und 0,1 = 0,10", ()=>{
  assert.equal(M.sameNumber("3,5", "3,50"), true);
  assert.equal(M.sameNumber("0,1", "0,10"), true);
  assert.equal(M.sameNumber("−2", "-2"), true);
  assert.equal(M.sameNumber("7,00", "7"), true);
  assert.equal(M.sameNumber("1,2", "1,20"), true);
  assert.equal(M.sameNumber("1,2", "1,3"), false);
  const a = parseDe("0,30"), b = parseDe("0,3");
  assert.equal(a.num, b.num);
  assert.equal(a.scale, b.scale);
});

test("Ziffernblock: Minus, Komma, höchstens 9 Ziffern", ()=>{
  assert.equal(M.padApply("", "−"), "−");
  assert.equal(M.padApply("−", "5"), "−5");
  assert.equal(M.padApply("−5", ","), "−5,");
  assert.equal(M.padApply("−5,", "5"), "−5,5");
  assert.equal(M.padApply("−5,5", ","), "−5,5");
  assert.equal(M.padApply("−5,5", "−"), "−5,5");
  assert.equal(M.padApply("", ","), "0,");
  let s="";
  for(let i=0;i<9;i++) s=M.padApply(s, "1");
  assert.equal(s, "111111111");
  assert.equal(M.padApply(s, "2"), s);
  assert.equal(M.padApply(s, "del"), "11111111");
});
