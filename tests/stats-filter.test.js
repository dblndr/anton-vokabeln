"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {load} = require("./load-app");

const window = load();
const VT = window.VT;
const doc = window.document;

test("Statistik-Filter Gesamt, Englisch und Mathe", ()=>{
  VT.setNow(()=>new Date(2026, 10, 8, 12, 0, 0).getTime());
  VT.state.tage["2026-11-08"] = {r:14, f:2, g:0, k:3, t:40};
  VT.state.mathe.tage["2026-11-08"] = {r:8, f:2};
  VT.go("#/statistik");
  const gesamt = doc.getElementById("statsGesamt").textContent;
  assert.equal(doc.getElementById("statsGesamt").classList.contains("hidden"), false);
  assert.ok(gesamt.includes("14"));
  assert.ok(gesamt.includes("8"));
  assert.ok(gesamt.includes("20"));
  assert.ok(gesamt.includes("Tagesziel gilt nur für Englisch"));
  const table = doc.getElementById("statsGesamt").innerHTML;
  assert.ok(table.includes(">8<"));
  assert.ok(table.includes(">–<") || table.includes(">−<") || table.includes("–"));
  VT.go("#/statistik/englisch");
  assert.equal(doc.getElementById("v-statistik").classList.contains("hidden"), false);
  assert.ok(doc.getElementById("goalText").textContent.includes("20"));
  assert.ok(doc.getElementById("gStatTable").textContent.includes("G2"));
  VT.go("#/statistik/mathe");
  assert.equal(doc.getElementById("mStats").classList.contains("hidden"), false);
  assert.ok(doc.getElementById("mStatTable").textContent.includes("Zahlen"));
  assert.ok(doc.getElementById("mBadges").children.length >= 9);
});

test("Fach-Link öffnet den passenden Filter", ()=>{
  VT.go("#/f/englisch");
  const jump = window.document.querySelector('#page-fach [data-go="#/statistik/englisch"]');
  assert.ok(jump);
  jump.click();
  assert.equal(window.location.hash, "#/statistik/englisch");
  VT.go("#/f/mathe");
  window.document.querySelector('#page-fach [data-go="#/abzeichen/mathe"]').click();
  assert.equal(window.location.hash, "#/abzeichen/mathe");
  assert.ok(window.document.getElementById("abz-mathe"));
  assert.ok(window.document.getElementById("abz-englisch"));
});
