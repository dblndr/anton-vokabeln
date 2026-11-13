"use strict";
// Heftseiten aus heftseiten.json in vokabeln.json, vokabeln.csv und die
// eingebettete Liste in index.html übernehmen. Ein Block in "seiten" ist
// eine Heftseite. Neue Seite: Block anhängen, dann `node scripts/heft-merge.js`.
// Vorhandene Karten (Abschnitt nicht "Heft") werden nicht verändert.
// Dieselbe englische Schreibweise, auch mit oder ohne "to" und ohne Großschreibung,
// wird nicht ein zweites Mal angelegt.

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const HEFT_ABSCHNITT = "Heft";

function forms(s){
  let t = String(s).normalize("NFC").toLowerCase().replace(/[’‘´`]/g, "'");
  t = t.replace(/[.,!?]+$/g, "").replace(/\s+/g, " ").trim();
  const out = new Set();
  if(t) out.add(t);
  if(t.startsWith("to ")){
    const rest = t.slice(3).trim();
    if(rest) out.add(rest);
  }else if(t && t !== "to"){
    out.add("to " + t);
  }
  return [...out];
}

function splitComma(s){
  const parts = [];
  let cur = "", depth = 0;
  for(const ch of String(s)){
    if(ch === "(") depth++;
    else if(ch === ")") depth = Math.max(0, depth - 1);
    if(ch === "," && depth === 0){ parts.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if(cur.trim()) parts.push(cur.trim());
  return parts;
}

// Akzeptierte deutsche Antworten, ohne den angezeigten Text zu ändern.
// Komma trennt Bedeutungen. " / " bleibt dem Prüfer überlassen (zwei Sätze).
// Schrägstrich ohne Leerzeichen ist ein Wort, kein Alternativpaar.
// "beste/-r/-s" folgt der vorhandenen Form "eigene/-r/-s".
function deAlt(de){
  const gender = String(de).match(/^(.*?)\/-r\/-s$/);
  if(gender){
    const stem = gender[1];
    return [stem, stem + "r", stem + "s"];
  }
  const commas = splitComma(de);
  if(commas.length > 1) return commas;
  if(String(de).includes("/") && !String(de).includes(" / ")) return [de];
  return null;
}

function indexVocab(vocab){
  const map = new Map();
  function add(en, rec){
    for(const f of forms(en)){
      if(!map.has(f)) map.set(f, []);
      const list = map.get(f);
      if(!list.includes(rec)) list.push(rec);
    }
  }
  for(const v of vocab){
    add(v.en, v);
    for(const alt of v.en_alt || []) add(alt, v);
  }
  return map;
}

function classify(heft, existing){
  const base = existing.filter(v => v.abschnitt !== (heft.abschnitt || HEFT_ABSCHNITT));
  const map = indexVocab(base);
  const added = [];
  const duplicates = [];
  for(const seite of heft.seiten){
    for(const ein of seite.eintraege){
      const hits = [];
      const seen = new Set();
      for(const f of forms(ein.en)){
        for(const v of map.get(f) || []){
          if(seen.has(v)) continue;
          seen.add(v);
          hits.push(v);
        }
      }
      if(hits.length){
        const bestand = hits.filter(h => !h._heftNeu);
        const gegen = (bestand[0] || hits[0]);
        duplicates.push({
          heftseite: seite.nr,
          en: ein.en,
          de: ein.de,
          art: bestand.length ? "bestand" : "intern",
          vorhandeneId: gegen.id || null,
          vorhandeneEn: gegen.en,
          vorhandeneDe: gegen.de,
          vorhandeneSeite: gegen._heftNeu ? gegen.heftseite : gegen.seite,
          vorhandeneThema: gegen._heftNeu ? gegen.thema : gegen.thema,
          abweichend: gegen.de !== ein.de
        });
        continue;
      }
      const rec = {
        id: ein.id || null,
        en: ein.en,
        de: ein.de,
        heftseite: seite.nr,
        seite: seite.seite,
        thema: seite.thema,
        korrektur: ein.korrektur || null,
        _heftNeu: true
      };
      added.push(rec);
      for(const f of forms(rec.en)){
        if(!map.has(f)) map.set(f, []);
        map.get(f).push(rec);
      }
    }
  }
  return {added, duplicates};
}

function apply(baseVocab, heft){
  const abschnitt = heft.abschnitt || HEFT_ABSCHNITT;
  const base = baseVocab.filter(v => v.abschnitt !== abschnitt);
  const takenSeiten = new Set(base.map(v => v.seite));
  for(const seite of heft.seiten){
    if(takenSeiten.has(seite.seite)){
      throw new Error("Seite " + seite.seite + " ist schon belegt (" + seite.block + ")");
    }
  }
  const {added, duplicates} = classify(heft, base);
  let n = 0;
  for(const v of base){
    const idn = Number(String(v.id).replace(/\D/g, ""));
    if(idn > n) n = idn;
  }
  const used = new Set(base.map(v => v.id));
  const rows = [];
  for(const rec of added){
    let id = rec.id;
    if(id && used.has(id)) throw new Error("ID schon vergeben: " + id + " (" + rec.en + ")");
    if(!id){
      do { n++; id = "v" + String(n).padStart(3, "0"); } while(used.has(id));
    }else{
      const idn = Number(String(id).replace(/\D/g, ""));
      if(idn > n) n = idn;
    }
    used.add(id);
    const row = {
      id, en: rec.en, de: rec.de,
      abschnitt, seite: rec.seite, thema: rec.thema,
      status: "ok"
    };
    const alt = deAlt(rec.de);
    if(alt) row.de_alt = alt;
    rows.push(row);
    rec.id = id;
  }
  return {vocab: base.concat(rows), added: rows, duplicates};
}

function embedEntry(v){
  const o = {id:v.id, en:v.en, de:v.de, abschnitt:v.abschnitt, seite:v.seite, thema:v.thema};
  if(v.en_alt) o.en_alt = v.en_alt;
  if(v.de_alt) o.de_alt = v.de_alt;
  if(v.zahl) o.zahl = v.zahl;
  return o;
}

function spaced(v){
  return JSON.stringify(v).replace(/":/g, '": ').replace(/,"/g, ', "');
}

function csvField(s){
  s = String(s);
  if(/[;"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function parseCsvLine(line){
  const rows = [];
  let field = "", row = [], inQ = false;
  for(let i = 0; i < line.length; i++){
    const c = line[i];
    if(inQ){
      if(c === '"'){
        if(line[i + 1] === '"'){ field += '"'; i++; continue; }
        inQ = false; continue;
      }
      field += c; continue;
    }
    if(c === '"'){ inQ = true; continue; }
    if(c === ";"){ row.push(field); field = ""; continue; }
    field += c;
  }
  row.push(field);
  rows.push(row);
  return rows[0];
}

function writeBackIds(heft, added){
  const idMap = new Map(added.map(r => [r.seite + "\0" + r.en, r.id]));
  for(const seite of heft.seiten){
    for(const ein of seite.eintraege){
      const id = idMap.get(seite.seite + "\0" + ein.en);
      if(id) ein.id = id;
      else delete ein.id;
    }
  }
}

function cutAfterObject(arrayText, n){
  let depth = 0, inStr = false, esc = false, seen = 0;
  for(let i = 0; i < arrayText.length; i++){
    const c = arrayText[i];
    if(inStr){
      if(esc){ esc = false; continue; }
      if(c === "\\"){ esc = true; continue; }
      if(c === '"') inStr = false;
      continue;
    }
    if(c === '"'){ inStr = true; continue; }
    if(c === "{" || c === "["){ depth++; continue; }
    if(c === "}" || c === "]"){
      depth--;
      if(c === "}" && depth === 1){
        seen++;
        if(seen === n) return arrayText.slice(0, i + 1);
      }
    }
  }
  throw new Error("Objekt " + n + " nicht gefunden (gesehen " + seen + ")");
}

function patchHtml(html, vocab){
  const marker = "const VOKABELN = ";
  const start = html.indexOf(marker);
  const end = html.indexOf(";\nconst GRAMMATIK", start);
  if(start < 0 || end < 0) throw new Error("VOKABELN in index.html nicht gefunden");
  const slice = html.slice(start + marker.length, end);
  const current = JSON.parse(slice);
  const baseCount = vocab.filter(v => v.abschnitt !== HEFT_ABSCHNITT).length;
  if(current.length < baseCount) throw new Error("eingebettete Liste ist kürzer als vokabeln.json");
  for(let i = 0; i < baseCount; i++){
    const a = current[i];
    const b = vocab[i];
    if(a.id !== b.id || a.en !== b.en || a.de !== b.de){
      throw new Error("Bestand weicht ab bei " + b.id);
    }
  }
  const fresh = vocab.slice(baseCount).map(embedEntry).map(spaced);
  const prefix = cutAfterObject(slice, baseCount);
  const next = fresh.length ? prefix + ", " + fresh.join(", ") + "]" : prefix + "]";
  return html.slice(0, start + marker.length) + next + html.slice(end);
}

function main(){
  const heftPath = path.join(root, "heftseiten.json");
  const jsonPath = path.join(root, "vokabeln.json");
  const csvPath = path.join(root, "vokabeln.csv");
  const htmlPath = path.join(root, "index.html");
  const heft = JSON.parse(fs.readFileSync(heftPath, "utf8"));
  const vocab = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const result = apply(vocab, heft);
  writeBackIds(heft, result.added);
  fs.writeFileSync(heftPath, JSON.stringify(heft, null, 2) + "\n");
  fs.writeFileSync(jsonPath, JSON.stringify(result.vocab, null, 1));

  const csvRaw = fs.readFileSync(csvPath, "utf8");
  const nl = csvRaw.includes("\r\n") ? "\r\n" : "\n";
  const lines = csvRaw.split(/\r?\n/).filter((line, i, arr) => !(i === arr.length - 1 && line === ""));
  const kept = [lines[0]];
  for(const line of lines.slice(1)){
    const cols = parseCsvLine(line);
    if(cols[3] === HEFT_ABSCHNITT) continue;
    kept.push(line);
  }
  for(const row of result.added){
    kept.push([row.id, row.en, row.de, row.abschnitt, row.seite, row.thema, row.status].map(csvField).join(";"));
  }
  fs.writeFileSync(csvPath, kept.join(nl) + nl);

  const html = fs.readFileSync(htmlPath, "utf8");
  fs.writeFileSync(htmlPath, patchHtml(html, result.vocab));

  const bestand = result.duplicates.filter(d => d.art === "bestand").length;
  const intern = result.duplicates.filter(d => d.art === "intern").length;
  console.log("neu", result.added.length, "duplikate", result.duplicates.length, "(bestand", bestand, "intern", intern + ")");
}

module.exports = {forms, deAlt, classify, apply, embedEntry, HEFT_ABSCHNITT};

if(require.main === module) main();
