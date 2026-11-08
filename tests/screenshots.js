"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const {chromium} = require("playwright");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "preview");
fs.mkdirSync(outDir, {recursive:true});

function serve(port){
  const types = {".html":"text/html; charset=utf-8", ".json":"application/json", ".css":"text/css", ".js":"text/javascript", ".png":"image/png", ".csv":"text/csv"};
  return http.createServer((req, res)=>{
    const url = decodeURIComponent(req.url.split("?")[0]);
    const file = path.join(root, url==="/" ? "index.html" : url);
    if(!file.startsWith(root)){ res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf)=>{
      if(err){ res.writeHead(404); return res.end("no"); }
      res.writeHead(200, {"content-type": types[path.extname(file)]||"application/octet-stream"});
      res.end(buf);
    });
  }).listen(port);
}

async function shot(page, name){
  const file = path.join(outDir, name);
  await page.screenshot({path:file, fullPage:true});
  const st = fs.statSync(file);
  if(st.size<5000) throw new Error(name+" ist verdächtig klein ("+st.size+")");
  console.log(name, st.size);
}

async function flow(browser, width, height){
  const tag = String(width);
  const page = await browser.newPage({viewport:{width, height}, deviceScaleFactor:1});
  await page.addInitScript(()=>{
    const pad=n=>String(n).padStart(2,"0");
    const key=dt=>dt.getFullYear()+"-"+pad(dt.getMonth()+1)+"-"+pad(dt.getDate());
    const today=new Date();
    const y=new Date(today); y.setDate(today.getDate()-1);
    const state={
      version:1,
      stats:{"v009|en":{r:3,f:1,s:2,n:4,last:2}},
      settings:{dir:"en", seiten:null, nurSchwer:false},
      turn:4, queue:[], best:3, streak:2,
      history:["v009|en"],
      tage:{[key(y)]:{r:4,f:1,g:1,k:1,t:40}},
      start:{d:key(y), k:1, n:4},
      abzeichen:{},
      grammatik:{stats:{}, tage:{}, thema:"mix"},
      mathe:{
        stats:{
          zahlen:{r:12,f:2,n:14},
          addsub:{r:9,f:3,n:12},
          muldiv:{r:6,f:1,n:7},
          blitz:{r:8,f:2,n:10}
        },
        tage:{[key(y)]:{r:6,f:1}, [key(today)]:{r:4,f:1}},
        wdh:{},
        wdhQ:{},
        settings:{blitzSek:8, fach:null},
        abzeichen:{mr1:key(y), mr10:key(today)},
        richtig:{zahlen:12, addsub:9, muldiv:6, blitz:8},
        punkte:140, streak:4, best:6, bestStars:2, runden:3
      }
    };
    localStorage.setItem("anton-vokabeln-v1", JSON.stringify(state));
  });
  await page.goto("http://127.0.0.1:8765/index.html", {waitUntil:"load"});
  await page.getByRole("heading", {name:"Antons Lerntrainer – v0.5"}).waitFor();
  await page.getByRole("button", {name:/Englisch/}).waitFor();
  await page.getByRole("button", {name:/Mathe/}).waitFor();
  await shot(page, "01-start-"+tag+".png");

  await page.getByRole("button", {name:/^🔢 Mathe/}).click();
  await page.getByRole("button", {name:/Punkt vor Strich/}).waitFor();
  await page.getByRole("button", {name:/Blitz/}).waitFor();
  await shot(page, "02-mathe-kacheln-"+tag+".png");

  await page.getByRole("button", {name:/Punkt vor Strich/}).click();
  await page.locator("#mPad").waitFor();
  await page.locator('[data-key="−"]').click();
  await page.locator('[data-key="1"]').click();
  await page.locator('[data-key=","]').click();
  await page.locator('[data-key="5"]').click();
  const display = await page.locator("#mDisplay").innerText();
  if(!display.includes("−") || !display.includes(",")) throw new Error("Ziffernblock zeigt − und , nicht: "+display);
  if(!(await page.locator('[data-key="−"]').isVisible())) throw new Error("Minus-Taste fehlt");
  if(!(await page.locator('[data-key=","]').isVisible())) throw new Error("Komma-Taste fehlt");
  await shot(page, "03-aufgabe-ziffernblock-"+tag+".png");

  for(let i=0;i<6;i++) await page.locator('[data-key="del"]').click();
  const ans = await page.evaluate(()=>window.VT.mathe.current().answerText);
  const guess = ans==="9" ? "8" : "9";
  await page.locator('[data-key="'+guess+'"]').click();
  await page.locator('[data-key="ok"]').click();
  await page.locator(".steps").waitFor();
  await page.locator("#mRuleBtn").click();
  await page.locator("#mRule").waitFor({state:"visible"});
  const steps = await page.locator(".steps").innerText();
  const rule = await page.locator("#mRule").innerText();
  if(!steps.includes("→") && steps.length<2) throw new Error("Lösungsweg fehlt: "+steps);
  if(!rule.includes("Punkt vor Strich") && !rule.includes("Klammer")) throw new Error("Regel fehlt: "+rule);
  await shot(page, "04-fehler-regel-"+tag+".png");

  await page.locator("#mStop").click();
  await page.getByRole("button", {name:/^⚡ Blitz/}).click();
  await page.locator("#mBlitzBar").waitFor({state:"visible"});
  const num = (await page.locator("#mBlitzNum").innerText()).trim();
  if(!/^[1-9]/.test(num)) throw new Error("Timer läuft nicht: "+num);
  await shot(page, "05-blitz-"+tag+".png");

  await page.locator("#mStop").click();
  await page.getByRole("button", {name:/Statistik/}).click();
  await page.locator("#mBadges").waitFor();
  await page.locator("#mStatTable").waitFor();
  await shot(page, "06-mathe-statistik-"+tag+".png");

  await page.locator("#switchFach").click();
  await page.getByRole("button", {name:/^🇬🇧 Englisch/}).click();
  await page.locator("#v-lernen").waitFor({state:"visible"});
  await page.locator("#prompt").waitFor();
  const tabs = await page.locator("#mainNav .tab").count();
  if(tabs!==5) throw new Error("Englisch-Tabs: "+tabs);
  const prompt = await page.locator("#prompt").innerText();
  if(!prompt.trim()) throw new Error("keine Vokabel");
  await shot(page, "07-englisch-lernen-"+tag+".png");
  await page.close();
}

(async()=>{
  const server = serve(8765);
  const browser = await chromium.launch({headless:true});
  try{
    await flow(browser, 390, 844);
    await flow(browser, 1024, 768);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(err=>{ console.error(err); process.exit(1); });
