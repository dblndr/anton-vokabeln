"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {load, loadHtml, htmlPath} = require("./load-app");
const fs = require("fs");

const html = fs.readFileSync(htmlPath, "utf8");

function hidden(doc, id){
  const n = doc.getElementById(id);
  assert.ok(n, id);
  return n.classList.contains("hidden");
}

test("Beim Öffnen immer die Startseite, zuletzt gewähltes Fach bleibt gespeichert", ()=>{
  const storage = {
    version:1, stats:{}, settings:{dir:"mix", seiten:null}, turn:0, queue:[], best:3, streak:1, history:[],
    tage:{}, start:{d:"2026-11-01", k:0, n:0}, abzeichen:{},
    grammatik:{stats:{}, tage:{}, thema:"mix"},
    mathe:{stats:{}, tage:{}, wdh:{}, wdhQ:{}, settings:{blitzSek:10, fach:"mathe"}, abzeichen:{}, richtig:{}, punkte:12, streak:0, best:0, bestStars:0, runden:1}
  };
  const w = loadHtml(html, {storage});
  assert.equal(w.location.hash, "#/start");
  assert.equal(hidden(w.document, "v-start"), false);
  assert.equal(hidden(w.document, "page-fach"), true);
  assert.equal(w.VT.state.mathe.settings.fach, "mathe");
  assert.equal(w.VT.state.mathe.settings.blitzSek, 10);
  assert.equal(w.document.getElementById("mainNav").classList.contains("hidden"), true);
  assert.deepEqual([...w.document.querySelectorAll("#mainNav .tab")].map(b=>b.dataset.view), ["lernen","auswahl","grammatik","alles","statistik"]);
  const dock = [...w.document.querySelectorAll("#dock a")].map(a=>a.textContent.replace(/\s+/g," ").trim());
  assert.deepEqual(dock, ["🏠Start","📊Statistik","🏅Abzeichen","☰Mehr"]);
});

test("Fach öffnen schreibt settings.fach und Weiter startet den Modus", ()=>{
  const w = load();
  const doc = w.document;
  w.VT.mathe.chooseFach("englisch");
  assert.equal(w.VT.state.mathe.settings.fach, "englisch");
  assert.equal(w.location.hash, "#/f/englisch");
  assert.equal(hidden(doc, "page-fach"), false);
  assert.ok(doc.getElementById("page-fach").textContent.includes("Englisch"));
  w.VT.go("#/f/englisch/vokabeln/lernen");
  assert.equal(hidden(doc, "v-lernen"), false);
  assert.equal(w.VT.state.ui.fach, "englisch");
  assert.equal(w.VT.state.ui.bereich, "vokabeln");
  assert.equal(w.VT.state.ui.modus, "lernen");
  assert.equal(w.VT.state.settings.nurSchwer, false);
  assert.ok(doc.getElementById("prompt").textContent.length>0);
  w.VT.go("#/f/englisch/vokabeln/auswahl");
  assert.equal(hidden(doc, "v-auswahl"), false);
  w.VT.go("#/f/englisch/grammatik/runde");
  assert.equal(hidden(doc, "v-grammatik"), false);
  w.VT.go("#/f/englisch/gemischt/gemischt");
  assert.equal(hidden(doc, "v-alles"), false);
  assert.ok(w.VT.quer.item);
});

test("Mathe-Modi und Geometrie-Zeichnen sind erreichbar", ()=>{
  const w = load();
  const doc = w.document;
  w.VT.go("#/f/mathe/zahlen/runde");
  assert.equal(w.VT.state.mathe.settings.fach, "mathe");
  assert.equal(hidden(doc, "v-mathe"), false);
  assert.equal(hidden(doc, "mQuiz"), false);
  assert.equal(w.VT.mathe.round.mode, "zahlen");
  w.VT.go("#/f/mathe/geometrie/antippen");
  assert.equal(w.VT.mathe.round.mode, "geometrie");
  w.VT.go("#/f/mathe/geometrie/zeichnen");
  assert.equal(w.VT.mathe.round.mode, "geo-zeichnen");
  assert.equal(hidden(doc, "mDraw"), false);
  assert.ok(doc.getElementById("mDraw").innerHTML.includes("<svg"));
  assert.equal(w.VT.state.ui.modus, "zeichnen");
  w.VT.go("#/f/mathe/blitz/blitz");
  assert.equal(w.VT.mathe.round.mode, "blitz");
  w.VT.mathe.bootFach();
  assert.equal(w.location.hash, "#/f/mathe");
});

test("Export, Import und Zurücksetzen liegen unter Mehr und behalten ihre IDs", ()=>{
  const w = load();
  const doc = w.document;
  w.VT.go("#/mehr");
  assert.equal(hidden(doc, "page-mehr"), false);
  const mehr = doc.getElementById("page-mehr");
  for(const id of ["exportBtn","importBtn","resetBtn","importFile","ioMsg"]){
    const el = doc.getElementById(id);
    assert.ok(el, id);
    assert.equal(mehr.contains(el), true);
  }
  assert.ok(doc.getElementById("exportBtn").textContent.includes("Exportieren"));
  assert.ok(doc.getElementById("importBtn").textContent.includes("Importieren"));
  assert.ok(doc.getElementById("resetBtn").textContent.includes("Zurücksetzen"));
  const visible = doc.body.cloneNode(true);
  visible.querySelectorAll("script,style").forEach(n=>n.remove());
  assert.equal(/Diktat/.test(visible.textContent), false);
  assert.equal(/\bAnton\b|\bGreta\b/.test(visible.textContent), false);
  assert.equal(doc.title, "Lerntrainer – v0.7");
});
