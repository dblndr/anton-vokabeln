"use strict";
// Eigene Referenz, unabhängig von den Funktionen der App.
// Größen: Basiseinheiten mm, mg, s, Cent, mm².

const LEN = {mm:1, cm:10, dm:100, m:1000, km:1000000};
const MASS = {mg:1, g:1000, kg:1000000, t:1000000000};
const TIME = {s:1, min:60, h:3600};
const MONEY = {ct:1, euro:100};
const AREA = {"mm²":1, "cm²":100, "dm²":10000, "m²":1000000, a:100000000, ha:10000000000, "km²":1000000000000};
const TABLES = {len:LEN, mass:MASS, time:TIME, money:MONEY, area:AREA};

const QUAD = {
  quadrat: {name:"Quadrat", needle:"4 gleich lange Seiten und 4 rechte Winkel"},
  rechteck: {name:"Rechteck", needle:"4 rechte Winkel, gegenüberliegende Seiten sind gleich lang"},
  raute: {name:"Raute", needle:"4 gleich lange Seiten, nicht unbedingt rechte Winkel"},
  parallelogramm: {name:"Parallelogramm", needle:"Gegenüberliegende Seiten sind parallel"},
  drache: {name:"Drachenviereck", needle:"zwei Paar gleich lange Nachbarseiten"},
  trapez: {name:"Trapez", needle:"genau ein Paar parallele Seiten"}
};
const LAGE = {
  parallel: {name:"parallel", needle:"schneiden sich nie"},
  senkrecht: {name:"senkrecht", needle:"rechten Winkel"},
  lot: {name:"Lot", needle:"kürzeste Verbindung"},
  tangente: {name:"Tangente", needle:"berührt einen Kreis"}
};

function norm(num, scale){
  let n = BigInt(num);
  let s = Number(scale);
  const neg = n < 0n;
  if(neg) n = -n;
  while(s>0 && n % 10n === 0n){ n /= 10n; s--; }
  return {num: neg ? -n : n, scale: s};
}
function asNum(parts){
  return {num: Number(parts.num), scale: parts.scale};
}

function roundHalfUp(n, place){
  const N = BigInt(n), P = BigInt(place);
  if(P<=0n || N<0n) throw new Error("round");
  const q = N / P, r = N % P;
  return (r*2n >= P) ? (q+1n)*P : q*P;
}
function digitAt(n, place){
  return (BigInt(n) / BigInt(place)) % 10n;
}
function convert(value, scale, fromMul, toMul){
  const num0 = BigInt(value) * BigInt(fromMul);
  const den = (10n ** BigInt(scale)) * BigInt(toMul);
  for(let s=0;s<=6;s++){
    const n = num0 * (10n ** BigInt(s));
    if(n % den === 0n) return norm(n / den, s);
  }
  throw new Error("Umrechnung nicht exakt");
}
function evalExpr(e){
  if(!e || e.t==="n") return BigInt(e.v);
  const a = evalExpr(e.a), b = evalExpr(e.b);
  if(e.t==="+") return a+b;
  if(e.t==="-") return a-b;
  if(e.t==="*") return a*b;
  if(e.t==="/"){
    if(b===0n || a % b !== 0n) throw new Error("Division nicht ganzzahlig");
    return a / b;
  }
  throw new Error("Term");
}
function factorString(n){
  let x = BigInt(n);
  if(x<2n) throw new Error("prim");
  const f = [];
  for(let p=2n; p*p<=x; p++){
    while(x % p === 0n){ f.push(p.toString()); x /= p; }
  }
  if(x>1n) f.push(x.toString());
  return f.join("·");
}
function angleName(deg){
  if(deg===90) return "rechter Winkel";
  if(deg===180) return "gestreckter Winkel";
  if(deg===360) return "Vollwinkel";
  if(deg>0 && deg<90) return "spitzer Winkel";
  if(deg>90 && deg<180) return "stumpfer Winkel";
  if(deg>180 && deg<360) return "überstumpfer Winkel";
  throw new Error("winkel "+deg);
}
function solveEq(spec){
  const a = BigInt(spec.a), b = BigInt(spec.b);
  if(spec.form==="a+x=b") return b-a;
  if(spec.form==="x-a=b") return b+a;
  if(spec.form==="a-x=b") return a-b;
  if(spec.form==="a*x=b"){ if(a===0n || b%a!==0n) throw new Error("a*x"); return b/a; }
  if(spec.form==="x/a=b"){ if(a===0n) throw new Error("x/a"); return a*b; }
  if(spec.form==="a/x=b"){ if(b===0n || a%b!==0n) throw new Error("a/x"); return a/b; }
  throw new Error("eq "+spec.form);
}

function reference(spec){
  if(!spec || !spec.op) throw new Error("kein spec");
  switch(spec.op){
    case "digit": return asNum(norm(digitAt(spec.n, spec.place), 0));
    case "round": return asNum(norm(roundHalfUp(spec.n, spec.place), 0));
    case "abs": return asNum(norm(BigInt(spec.n)<0n ? -BigInt(spec.n) : BigInt(spec.n), 0));
    case "extreme": {
      let x = BigInt(spec.nums[0]);
      for(const v of spec.nums){
        const b = BigInt(v);
        if(spec.which==="min" ? b<x : b>x) x=b;
      }
      return asNum(norm(x, 0));
    }
    case "write": return asNum(norm(BigInt(spec.mio)*1000000n + BigInt(spec.tsd)*1000n + BigInt(spec.rest), 0));
    case "add": return asNum(norm(BigInt(spec.a)+BigInt(spec.b), 0));
    case "sub": return asNum(norm(BigInt(spec.a)-BigInt(spec.b), 0));
    case "add3": return asNum(norm(BigInt(spec.a)+BigInt(spec.b)+BigInt(spec.c), 0));
    case "estimate": {
      const ra = roundHalfUp(spec.a, spec.place), rb = roundHalfUp(spec.b, spec.place);
      const v = spec.how==="add" ? ra+rb : ra-rb;
      return asNum(norm(v, 0));
    }
    case "eq": return asNum(norm(solveEq(spec), 0));
    case "mul": return asNum(norm(BigInt(spec.a)*BigInt(spec.b), 0));
    case "div": {
      const a=BigInt(spec.a), b=BigInt(spec.b);
      if(b===0n || a%b!==0n) throw new Error("Division nicht ganzzahlig");
      return asNum(norm(a/b, 0));
    }
    case "pow": {
      let r=1n, base=BigInt(spec.base);
      for(let i=0;i<spec.exp;i++) r*=base;
      return asNum(norm(r, 0));
    }
    case "square": return asNum(norm(BigInt(spec.n)*BigInt(spec.n), 0));
    case "divisible": return {mc: (BigInt(spec.n)%BigInt(spec.by)===0n) ? "ja" : "nein"};
    case "factor": return {mc: factorString(spec.n)};
    case "term": return asNum(norm(evalExpr(spec.expr), 0));
    case "convert": {
      const tab = TABLES[spec.family];
      if(!tab || tab[spec.from]==null || tab[spec.to]==null) throw new Error("einheit");
      return asNum(convert(spec.value, spec.scale, tab[spec.from], tab[spec.to]));
    }
    case "area": {
      if(AREA[spec.from]==null || AREA[spec.to]==null) throw new Error("flaeche");
      return asNum(convert(spec.value, spec.scale, AREA[spec.from], AREA[spec.to]));
    }
    case "time-hm": {
      const mins = BigInt(spec.h)*60n + BigInt(spec.min);
      return asNum(norm(spec.ask==="s" ? mins*60n : mins, 0));
    }
    case "cents-sum": {
      let s=0n; for(const c of spec.cents) s+=BigInt(c);
      return asNum(norm(s, 2));
    }
    case "dreisatz": {
      const n1=BigInt(spec.n1), c=BigInt(spec.cents), n2=BigInt(spec.n2);
      if(n1===0n || (c*n2)%n1!==0n) throw new Error("Dreisatz nicht ganzzahlig");
      return asNum(norm((c*n2)/n1, 2));
    }
    case "massstab": {
      const real = BigInt(spec.cm)*BigInt(spec.ratio);
      if(spec.ask==="km"){ if(real%100000n!==0n) throw new Error("km"); return asNum(norm(real/100000n, 0)); }
      if(spec.ask==="m"){ if(real%100n!==0n) throw new Error("m"); return asNum(norm(real/100n, 0)); }
      if(spec.ask==="cm") return asNum(norm(real, 0));
      throw new Error("maßstab");
    }
    case "rect": {
      const w=BigInt(spec.w), h=BigInt(spec.h);
      return asNum(norm(spec.what==="A" ? w*h : 2n*(w+h), 0));
    }
    case "squ": {
      const a=BigInt(spec.a);
      return asNum(norm(spec.what==="A" ? a*a : 4n*a, 0));
    }
    case "cuboid": {
      const a=BigInt(spec.a), b=BigInt(spec.b), c=BigInt(spec.c);
      return asNum(norm(2n*(a*b+a*c+b*c), 0));
    }
    case "angle": return {mc: angleName(spec.deg)};
    case "quad": {
      const row = QUAD[spec.code];
      if(!row) throw new Error("quad");
      return {mc: row.name, needle: row.needle};
    }
    case "lage": {
      const row = LAGE[spec.code];
      if(!row) throw new Error("lage");
      return {mc: row.name, needle: row.needle};
    }
    default: throw new Error("unbekanntes op "+spec.op);
  }
}

function parseDe(str){
  let t = String(str).trim().replace(/\s/g,"").replace(/−/g,"-");
  if(!/^-?\d+(,\d+)?$/.test(t)) throw new Error("Eingabeformat: "+str);
  const neg = t[0]==="-";
  if(neg) t=t.slice(1);
  let w = t.split(",")[0];
  let f = t.split(",")[1]||"";
  f = f.replace(/0+$/,"");
  if(w.length>1) w=w.replace(/^0+/,"");
  if(w==="") w="0";
  const sig = ((w==="0"?"":w)+f).length || 1;
  if(sig>9) throw new Error("zu viele Stellen: "+str);
  return norm(BigInt(w+f)*(neg?-1n:1n), f.length);
}

function digitsOf(num, scale){
  const p = norm(num, scale);
  const n = p.num<0n ? -p.num : p.num;
  return String(n).length;
}

module.exports = {reference, parseDe, norm, digitsOf, QUAD, LAGE};
