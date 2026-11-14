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
  stats: {"v001|en": {r: 4, f: 1, s: 2, n: 5, last: 3}},
  settings: {dir: "mix", seiten: null},
  turn: 2, queue: [], best: 3, streak: 1, history: [],
  tage: {"2026-11-14": {r: 3, f: 0, g: 0, k: 2, t: 30}},
  start: {d: "2026-11-13", k: 1, n: 3},
  abzeichen: {},
  grammatik: {stats: {}, tage: {}, thema: "mix"},
  mathe: {
    stats: {zahlen: {r: 6, f: 1, n: 7}},
    tage: {"2026-11-14": {r: 3, f: 1}},
    wdh: {}, wdhQ: {},
    settings: {blitzSek: 8, fach: "mathe"},
    abzeichen: {}, richtig: {zahlen: 6},
    punkte: 30, streak: 1, best: 2, bestStars: 1, runden: 1
  },
  ui: {fach: "mathe", bereich: "zahlen", modus: "runde"},
  sa: {mathe: {aktiv: "mathe-sa1-kap1", items: {"mathe-sa1-kap1": {
    datum: "2026-11-17", archiviert: false, gestartet: "2026-11-14",
    selbst: {"1.5": 0}, erledigt: {}, zuletzt: {}, probe: []
  }}}}
};

function serve(){
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const file = req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0];
      const fp = path.join(root, path.normalize(file));
      if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404); res.end("no"); return;
      }
      res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
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
  });

  await page.evaluate(() => {
    const q = VT.mathe.makeZahlenQ(2, Math.random, "mitte");
    q.saThema = "1.5";
    q.saThemaName = "Negative Zahlen";
    VT.saZeigeFragen([q]);
  });
  await page.waitForSelector("#mPrompt");
  await page.screenshot({path: path.join(outDir, "11-zahlengerade-390.png"), fullPage: true});

  await page.evaluate(() => {
    const q = VT.mathe.makeZeichnenQ(3, Math.random, "quadrant");
    q.saThema = "1.5";
    q.saThemaName = "Negative Zahlen";
    VT.saZeigeFragen([q]);
  });
  await page.waitForSelector("#mPrompt");
  await page.screenshot({path: path.join(outDir, "12-quadrant-390.png"), fullPage: true});

  await page.evaluate(() => VT.go("#/f/mathe/sa/mathe-sa1-kap1"));
  await page.waitForSelector(".satag.neu");
  await page.screenshot({path: path.join(outDir, "13-sa-seite-390.png"), fullPage: true});

  await page.evaluate(() => VT.go("#/f/mathe/sa/mathe-sa1-kap1/probe"));
  await page.waitForFunction(() => {
    const t = document.getElementById("mPrompt");
    return t && t.textContent && t.textContent.length > 3;
  });
  await page.screenshot({path: path.join(outDir, "14-probe-390.png"), fullPage: true});

  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log("overflow", over);
  await browser.close();
  server.close();
})().catch(err => { console.error(err); process.exit(1); });
