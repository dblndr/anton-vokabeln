"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {load} = require("./load-app");

const window = load();
const VT = window.VT;
const doc = window.document;

test("Version, Titel und fünf Englisch-Tabs", ()=>{
  assert.equal(VT.APP_VERSION, "0.5");
  assert.equal(doc.title, "Lerntrainer – v0.5");
  assert.equal(doc.getElementById("appTitle").textContent, "Lerntrainer – v0.5");
  assert.equal(doc.getElementById("appSub").textContent, "Englisch · Mathe");
  const tabs = [...doc.querySelectorAll("#mainNav .tab")].map(b=>b.dataset.view);
  assert.deepEqual(tabs, ["lernen","auswahl","grammatik","alles","statistik"]);
  assert.equal(doc.getElementById("v-lernen")!=null, true);
  assert.equal(doc.getElementById("answer")!=null, true);
});

test("Vokabel prüfen: richtig, fast, falsch", ()=>{
  const v = VT.G ? null : null;
  VT.state.settings.dir = "en";
  VT.state.settings.seiten = [1];
  const card = VT.pickNext(()=>0);
  assert.ok(card && card.v && card.k);
  const sample = card.v;
  const good = VT.check(sample, "en", sample.de);
  assert.equal(good.res, "richtig");
  const bad = VT.check(sample, "en", "Bananequatsch");
  assert.equal(bad.res, "falsch");
  const greenwich = {id:"t", en:"I'm from Greenwich.", de:"Ich bin aus Greenwich."};
  assert.equal(VT.check(greenwich, "en", "Ich bin aus Greenwich.").res, "richtig");
  assert.equal(VT.check(greenwich, "en", "Ich bin aus Grenwich.").res, "fast");
  assert.equal(VT.norm("  Der Hund! ", "de").includes("hund"), true);
});

test("Grammatik-Runde und Gemischt quer", ()=>{
  VT.G.start("G2");
  const task = VT.G.task;
  assert.ok(task && task.a);
  assert.equal(VT.G.answer(task.a), true);
  assert.equal(VT.G.round.ok, 1);
  const areas = VT.quer.areas();
  const vok = areas.filter(a=>a.kind==="vok");
  const gram = areas.filter(a=>a.kind==="gram");
  assert.equal(vok.length, 17);
  assert.equal(gram.length, 6);
  const spread = VT.quer.spread(areas, ()=>0.3);
  assert.equal(spread.length, areas.length);
  VT.quer.go(()=>0.2);
  assert.ok(VT.quer.item);
});

test("Statistik rendert und Abzeichen bleiben die englischen", ()=>{
  VT.renderStats();
  assert.ok(doc.getElementById("badges").children.length >= 15);
  assert.ok(doc.getElementById("statTable").textContent.length > 0);
  assert.ok(doc.getElementById("gStatTable").textContent.includes("G2"));
});

test("Englisch-Audio bleibt en-GB und langsam, Mathe liest Deutsch", ()=>{
  const voices = window.speechSynthesis.getVoices();
  const en = VT.pickEnVoice(voices);
  assert.equal(en.name, "en-GB Voice");
  assert.ok(/^en-GB/i.test(en.lang));
  const de = VT.mathe.pickDeVoice(voices);
  assert.equal(de.lang, "de-DE");
  VT.say("Hello there.", false);
  let u = window.speechSynthesis.last;
  assert.equal(u.rate, 0.9);
  assert.ok(/^en-GB/i.test(u.lang));
  assert.ok(u.text.includes("Hello"));
  VT.say("Hello there.", true);
  u = window.speechSynthesis.last;
  assert.equal(u.rate, 0.6);
  assert.ok(/^en-GB/i.test(u.lang));
  const enBefore = VT.enVoice && VT.enVoice.name;
  VT.mathe.sayDe("Drei plus vier");
  u = window.speechSynthesis.last;
  assert.ok(/^de/i.test(u.lang));
  assert.equal(u.rate, 0.95);
  assert.equal(VT.enVoice && VT.enVoice.name, enBefore);
  VT.state.settings.dir = "en";
  VT.state.settings.seiten = null;
  VT.newCard();
  const prompt = doc.getElementById("prompt").textContent;
  assert.ok(prompt && prompt.length>0);
  const speak = doc.getElementById("speakPrompt");
  const slow = doc.getElementById("speakPromptSlow");
  assert.equal(speak.classList.contains("hidden"), false);
  assert.equal(slow.classList.contains("hidden"), false);
  assert.ok(speak.textContent.includes("Anhören"));
  assert.ok(slow.textContent.includes("Langsam"));
});

test("Lernen-Ansicht hat die alten Knöpfe", ()=>{
  assert.ok(doc.getElementById("revealBtn").textContent.includes("Lösung"));
  assert.ok(doc.getElementById("knewBtn"));
  assert.ok(doc.getElementById("didntBtn"));
  assert.ok(doc.getElementById("overrideBtn"));
  assert.ok(doc.getElementById("openQuer"));
});
