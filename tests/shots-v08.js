"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const {chromium} = require("playwright");

const root = path.join(__dirname, "..");
const outDir = "/opt/cursor/artifacts";
fs.mkdirSync(outDir, {recursive: true});

const seed = {
  version: 1,
  stats: {"v001|en": {r: 4, f: 1, s: 2, n: 5, last: 3}, "v010|en": {r: 3, f: 0, s: 3, n: 3, last: 2}},
  settings: {dir: "mix", seiten: null},
  turn: 4, queue: [], best: 4, streak: 2, history: [],
  tage: {"2026-11-13": {r: 6, f: 1, g: 1, k: 4, t: 80}, "2026-11-14": {r: 4, f: 0, g: 0, k: 4, t: 40}},
  start: {d: "2026-11-13", k: 2, n: 8},
  abzeichen: {},
  grammatik: {stats: {}, tage: {"2026-11-13": {r: 3, f: 0}}, thema: "mix"},
  mathe: {
    stats: {zahlen: {r: 8, f: 2, n: 10}},
    tage: {"2026-11-14": {r: 4, f: 1}},
    wdh: {}, wdhQ: {},
    settings: {blitzSek: 8, fach: "mathe"},
    abzeichen: {}, richtig: {zahlen: 8},
    punkte: 40, streak: 2, best: 3, bestStars: 1, runden: 2
  },
  ui: {fach: "mathe", bereich: "zahlen", modus: "runde"},
  sa: {mathe: {aktiv: "mathe-sa1-kap1", items: {"mathe-sa1-kap1": {
    datum: "2026-11-17", archiviert: false, gestartet: "2026-11-14",
    selbst: {"1.5": 0, "1.3": 2},
    erledigt: {"1.1:heft": "2026-11-14", "1.2:heft": "2026-11-14", "1.3:heft": "2026-11-14"},
    zuletzt: {"1.3": [1, 1, 1, 0, 1, 1, 1]},
    probe: []
  }}}}
};

function serve(){
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = req.url.split("?")[0];
      const file = url === "/" ? "/index.html" : url;
      const fp = path.join(root, path.normalize(file));
      if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404); res.end("no"); return;
      }
      const ext = path.extname(fp);
      const type = ext === ".html" ? "text/html; charset=utf-8" : ext === ".webmanifest" ? "application/manifest+json" : "text/plain";
      res.writeHead(200, {"Content-Type": type});
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function overflow(page){
  return page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth
  }));
}

(async () => {
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({
    executablePath: "/opt/google/chrome/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 1});
  await page.addInitScript(state => {
    localStorage.setItem("anton-vokabeln-v1", JSON.stringify(state));
  }, seed);
  await page.goto("http://127.0.0.1:" + port + "/index.html", {waitUntil: "domcontentloaded"});
  await page.evaluate(() => {
    VT.setNow(() => new Date(2026, 10, 14, 12, 0, 0).getTime());
    const dock = document.getElementById("dock");
    document.body.appendChild(dock);
    dock.style.position = "relative";
    dock.style.width = "100%";
    dock.style.height = "auto";
    dock.style.inset = "auto";
    document.body.style.paddingBottom = "16px";
    document.body.style.paddingLeft = "12px";
    VT.go("#/start");
  });
  await page.waitForSelector(".sastrip");
  const startOver = await overflow(page);
  await page.screenshot({path: path.join(outDir, "01-start-390.png"), fullPage: true});

  await page.evaluate(() => VT.go("#/f/mathe/sa/mathe-sa1-kap1"));
  await page.waitForSelector(".saday");
  const saOver = await overflow(page);
  await page.screenshot({path: path.join(outDir, "02-sa-mathe-390.png"), fullPage: true});

  await page.click("[data-sa-datum]");
  await page.waitForSelector("#saPreview");
  const dlgOver = await overflow(page);
  await page.screenshot({path: path.join(outDir, "05-datum-390.png")});
  await page.click("#saAbbrechen");

  await page.click("[data-sa-probe]");
  await page.waitForSelector("#mPrompt");
  await page.waitForFunction(() => {
    const t = document.getElementById("mPrompt");
    return t && t.textContent && t.textContent.length > 3;
  });
  const probeOver = await overflow(page);
  await page.screenshot({path: path.join(outDir, "03-probe-390.png"), fullPage: true});

  console.log(JSON.stringify({startOver, saOver, dlgOver, probeOver}, null, 2));
  await browser.close();
  server.close();
})().catch(err => { console.error(err); process.exit(1); });
