"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {execFileSync} = require("child_process");
const {load} = require("./load-app");
const {forms, classify, apply, deAlt} = require("../scripts/heft-merge");

const repo = path.join(__dirname, "..");
const heft = JSON.parse(fs.readFileSync(path.join(repo, "heftseiten.json"), "utf8"));
const vocab = JSON.parse(fs.readFileSync(path.join(repo, "vokabeln.json"), "utf8"));
const base = JSON.parse(execFileSync("git", ["show", "11892d9:vokabeln.json"], {cwd: repo, encoding:"utf8", maxBuffer: 20*1024*1024}));

const SEITE1 = [
  ["make models", "Modelle machen"],
  ["rule", "Regel"],
  ["planner", "Handbuch, Kalender"],
  ["lunch", "Mittagessen"],
  ["cafeteria", "Cafeteria"],
  ["money", "Geld"],
  ["machine", "Automat, Maschine, Apparat, Gerät"],
  ["to pay (for)", "bezahlen"],
  ["finger", "Finger"],
  ["Art", "Kunstunterricht"],
  ["to buy", "kaufen"],
  ["sweets", "Süßigkeiten, Bonbons"],
  ["shop", "Geschäft, Laden"]
];

function alleEintraege(){
  const out = [];
  for(const seite of heft.seiten) for(const ein of seite.eintraege) out.push({seite, ein});
  return out;
}
function byEn(en){
  return vocab.filter(v => v.en === en);
}

test("87 gelesen, 80 neu, 7 Duplikate, 3 Korrekturen", ()=>{
  const eintraege = alleEintraege();
  assert.equal(eintraege.length, 87);
  assert.equal(heft.seiten.length, 6);
  assert.deepEqual(heft.seiten.map(s => s.block), ["seite-1","seite-2","seite-3","seite-4","seite-5","seite-6"]);
  const korr = eintraege.filter(x => x.ein.korrektur).map(x => x.ein.korrektur);
  assert.deepEqual(korr, [
    "Modele → Modelle",
    "Marik → Musik",
    "Inlinefahren gehen → Inliner fahren gehen"
  ]);
  const plan = eintraege.find(x => x.ein.en === "planner");
  assert.equal(plan.ein.de, "Handbuch, Kalender");
  assert.equal(plan.ein.anmerkung, "so im Heft, bewusst übernommen");
  assert.equal(plan.ein.korrektur, undefined);

  const {added, duplicates} = classify(heft, base);
  assert.equal(added.length, 80);
  assert.equal(duplicates.length, 7);
  assert.equal(duplicates.filter(d => d.art === "bestand").length, 6);
  assert.equal(duplicates.filter(d => d.art === "intern").length, 1);
  assert.equal(duplicates.some(d => d.abweichend), false);
});

test("Heftseite 1 steht vollständig unter Heft, Seite 18", ()=>{
  const block = heft.seiten[0];
  assert.equal(block.seite, 18);
  assert.equal(block.thema, "Heftseite 1");
  assert.deepEqual(block.eintraege.map(e => [e.en, e.de]), SEITE1);
  for(const [en, de] of SEITE1){
    const rows = byEn(en);
    assert.equal(rows.length, 1, en);
    assert.equal(rows[0].de, de);
    assert.equal(rows[0].abschnitt, "Heft");
    assert.equal(rows[0].seite, 18);
    assert.equal(rows[0].thema, "Heftseite 1");
  }
  assert.equal(byEn("make models")[0].id, "v227");
  assert.equal(byEn("shop")[0].id, "v239");
});

test("Duplikate werden nicht eingefügt und Übersetzungen nicht überschrieben", ()=>{
  const erwartet = [
    ["cellar", "v213", "Keller"],
    ["terrace", "v214", "Terrasse"],
    ["balcony", "v215", "Balkon"],
    ["garage", "v216", "Garage"],
    ["shed", "v217", "Schuppen"],
    ["garden", "v157", "Garten"]
  ];
  for(const [en, id, de] of erwartet){
    const rows = vocab.filter(v => forms(v.en).includes(en));
    assert.equal(rows.length, 1, en);
    assert.equal(rows[0].id, id);
    assert.equal(rows[0].de, de);
    assert.equal(rows[0].abschnitt === "Heft", false);
  }
  const swim = vocab.filter(v => forms(v.en).includes("go swimming"));
  assert.equal(swim.length, 1);
  assert.equal(swim[0].en, "to go swimming");
  assert.equal(swim[0].de, "schwimmen gehen");
  assert.equal(swim[0].id, "v269");
  assert.equal(byEn("go swimming").length, 0);

  const live = classify({
    abschnitt:"Heft",
    seiten:[{block:"x", nr:1, seite:99, thema:"x", eintraege:[
      {en:"LIVE", de:"leben"},
      {en:"to go swimming", de:"schwimmen gehen"},
      {en:"Go Swimming", de:"baden gehen"}
    ]}]
  }, base);
  assert.equal(live.added.length, 1);
  assert.equal(live.added[0].en, "to go swimming");
  assert.equal(live.duplicates.length, 2);
  assert.equal(live.duplicates[0].art, "bestand");
  assert.equal(live.duplicates[0].vorhandeneEn, "to live");
  assert.equal(live.duplicates[0].vorhandeneDe, "wohnen/leben");
  assert.equal(live.duplicates[0].abweichend, true);
  assert.equal(live.duplicates[1].art, "intern");
  assert.equal(live.duplicates[1].vorhandeneEn, "to go swimming");
  assert.equal(live.duplicates[1].abweichend, true);
  const nachher = apply(base, {abschnitt:"Heft", seiten:[{block:"x", nr:1, seite:99, thema:"x", eintraege:[{en:"cellar", de:"Dachboden"}]}]});
  assert.equal(nachher.added.length, 0);
  assert.equal(nachher.vocab.find(v => v.id === "v213").de, "Keller");
});

test("Bestand v001–v226 und die neuen IDs bleiben stabil", ()=>{
  assert.equal(base.length, 226);
  for(const alt of base){
    const neu = vocab.find(v => v.id === alt.id);
    assert.deepEqual(neu, alt);
  }
  const heftKarten = vocab.filter(v => v.abschnitt === "Heft");
  assert.equal(heftKarten.length, 80);
  const ids = heftKarten.map(v => v.id);
  const erwartet = [];
  for(let n = 227; n <= 306; n++) erwartet.push("v" + String(n).padStart(3, "0"));
  assert.deepEqual(ids, erwartet);
  const mitId = alleEintraege().filter(x => x.ein.id);
  assert.equal(mitId.length, 80);
  assert.equal(alleEintraege().filter(x => !x.ein.id).length, 7);
});

test("Korrekturen stehen im Kartentext, Handbuch und Kalender bleiben", ()=>{
  assert.equal(byEn("make models")[0].de, "Modelle machen");
  assert.equal(byEn("music")[0].de, "Musik");
  assert.equal(byEn("go (inline) skating")[0].de, "Inliner fahren gehen");
  assert.equal(JSON.stringify(vocab).includes("Modele machen"), false);
  assert.equal(JSON.stringify(vocab).includes("Marik"), false);
  assert.equal(JSON.stringify(vocab).includes("Inlinefahren"), false);
  const plan = byEn("planner")[0];
  assert.equal(plan.de, "Handbuch, Kalender");
  assert.deepEqual(plan.de_alt, ["Handbuch", "Kalender"]);
  assert.deepEqual(deAlt("beste/-r/-s"), ["beste", "bester", "bestes"]);
  assert.deepEqual(deAlt("mit Tieren/Autos spielen"), ["mit Tieren/Autos spielen"]);
});

test("Die App nimmt die neuen Karten an und lässt den Speicher-Key", ()=>{
  const w = load();
  assert.equal(w.VT.APP_VERSION, "0.7");
  assert.equal(w.VT.STORE_KEY, "anton-vokabeln-v1");
  assert.equal(w.document.title, "Lerntrainer – v0.7");
  const karte = vocab.find(v => v.en === "planner");
  assert.equal(w.VT.check(karte, "en", "Handbuch").res, "richtig");
  assert.equal(w.VT.check(karte, "en", "Kalender").res, "richtig");
  assert.equal(w.VT.check(karte, "en", "Handbuch, Kalender").res, "richtig");
  const modelle = vocab.find(v => v.en === "make models");
  assert.equal(w.VT.check(modelle, "en", "Modelle machen").res, "richtig");
  const tiere = vocab.find(v => v.en === "play with animals/cars");
  assert.equal(w.VT.check(tiere, "en", "mit Tieren/Autos spielen").res, "richtig");
  assert.equal(w.VT.check(tiere, "en", "mit Tieren").res, "falsch");
  const best = vocab.find(v => v.en === "best");
  assert.equal(w.VT.check(best, "en", "bester").res, "richtig");
  w.VT.state.settings.seiten = [18];
  w.VT.state.settings.dir = "en";
  w.VT.state.queue = [];
  w.VT.state.history = [];
  const card = w.VT.pickNext(() => 0);
  assert.equal(card.v.en, "make models");
  assert.equal(card.k, "v227|en");
  const namen = JSON.stringify(heft) + JSON.stringify(vocab.filter(v => v.abschnitt === "Heft"));
  assert.equal(/\bAnton\b|\bGreta\b|\bChristian\b|\bKatharina\b|\bDablander\b/.test(namen), false);
});
