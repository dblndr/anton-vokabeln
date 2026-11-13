"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const path = require("path");
const {chromium} = require("playwright");

const root = path.join(__dirname, "..");
const outDir = "/opt/cursor/artifacts";
fs.mkdirSync(outDir, {recursive:true});

function serve(){
  const types = {".html":"text/html; charset=utf-8", ".json":"application/json", ".webmanifest":"application/manifest+json", ".png":"image/png", ".csv":"text/csv"};
  return new Promise(resolve=>{
    const server = http.createServer((req, res)=>{
      const url = decodeURIComponent(req.url.split("?")[0]);
      const file = path.join(root, url==="/"?"index.html":url);
      if(!file.startsWith(root)){ res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf)=>{
        if(err){ res.writeHead(404); return res.end("no"); }
        res.writeHead(200, {"content-type": types[path.extname(file)]||"application/octet-stream"});
        res.end(buf);
      });
    });
    server.listen(0, "127.0.0.1", ()=>resolve(server));
  });
}

async function prepare(page){
  await page.addInitScript(()=>{
    const pad=n=>String(n).padStart(2,"0");
    const key=dt=>dt.getFullYear()+"-"+pad(dt.getMonth()+1)+"-"+pad(dt.getDate());
    const add=n=>{ const d=new Date(); d.setDate(d.getDate()+n); return key(d); };
    const stats={};
    for(let i=1;i<=12;i++){
      const id="v"+String(i).padStart(3,"0");
      stats[id+"|en"]={r:5,f:1,s:3,n:6,last:i};
      stats[id+"|de"]={r:1,f:2,s:0,n:3,last:i};
    }
    const tage={};
    for(let i=0;i<=8;i++) tage[add(-i)]={r:i===0?14:4, f:i===0?2:1, g:1, k:12, t:60};
    const mt={};
    for(let i=0;i<=3;i++) mt[add(-i)]={r:i===0?8:3, f:i===0?2:1};
    mt[add(-9)]={r:2,f:0}; mt[add(-10)]={r:2,f:1}; mt[add(-11)]={r:1,f:0};
    const state={
      version:1,
      stats,
      settings:{dir:"mix", seiten:[1,2,3,4,5]},
      turn:20, queue:[], best:12, streak:4,
      history:["v001|en"],
      tage,
      start:{d:add(-11), k:0, n:0},
      abzeichen:{k10:add(-8), d3:add(-6), d7:add(-4), d14:add(-2), n100:add(-3), f10:add(-5)},
      grammatik:{stats:{"g2-01":{r:4,f:1,s:2,n:5}}, tage:{}, thema:"G2"},
      mathe:{
        stats:{zahlen:{r:8,f:2,n:10}, addsub:{r:20,f:3,n:23}, muldiv:{r:9,f:1,n:10}, geometrie:{r:4,f:2,n:6}},
        tage:mt,
        wdh:{"geo-a":1, "geo-b":1, "geo-c":1},
        wdhQ:{
          "geo-a":{area:"geometrie", text:"Wie heißt das Viereck mit vier rechten Winkeln?"},
          "geo-b":{area:"geometrie", text:"Wie heißt ein Winkel unter 90 Grad?"},
          "geo-c":{area:"geometrie", text:"Wie liegen zwei Geraden, die sich nie schneiden?"}
        },
        settings:{blitzSek:8, fach:"mathe"},
        abzeichen:{mr1:add(-4), mr10:add(-2), mstar:add(-1), md3:add(-1)},
        richtig:{zahlen:8, addsub:20, muldiv:9, geometrie:4},
        punkte:340, streak:2, best:6, bestStars:3, runden:8
      },
      ui:{fach:"mathe", bereich:"geometrie", modus:"zeichnen"}
    };
    localStorage.setItem("anton-vokabeln-v1", JSON.stringify(state));
  });
}

async function fit(page){
  const h = await page.evaluate(()=>Math.max(document.documentElement.scrollHeight, 700));
  const w = page.viewportSize().width;
  await page.setViewportSize({width:w, height:Math.min(h+4, 2400)});
}

async function shoot(page, name){
  await fit(page);
  const file = path.join(outDir, name+".png");
  await page.screenshot({path:file, fullPage:false});
  const st = fs.statSync(file);
  if(st.size<8000) throw new Error(name+" ist zu klein ("+st.size+")");
  return file;
}

async function checkLayout(page, label){
  const report = await page.evaluate(()=>{
    const doc=document.documentElement;
    const vw=doc.clientWidth;
    const bad=[];
    const nodes=document.body.querySelectorAll("body *");
    for(const el of nodes){
      if(el.closest("script,style,#mainNav")) continue;
      const cs=getComputedStyle(el);
      if(cs.display==="none" || cs.visibility==="hidden") continue;
      const r=el.getBoundingClientRect();
      if(r.width<2 || r.height<2) continue;
      if(r.right>vw+1.5 || r.left<-1.5){
        let p=el.parentElement, clipped=false;
        while(p){
          const pcs=getComputedStyle(p);
          if((pcs.overflowX==="auto" || pcs.overflowX==="scroll" || pcs.overflowX==="hidden") && p!==document.body){
            clipped=true; break;
          }
          p=p.parentElement;
        }
        if(!clipped){
          bad.push((el.id||el.className||el.tagName)+" "+Math.round(r.left)+".."+Math.round(r.right));
        }
      }
    }
    const dock=document.getElementById("dock").getBoundingClientRect();
    const header=document.querySelector("header").getBoundingClientRect();
    let dockOverlap=false;
    if(vw>=900){
      if(header.left < dock.right-1) dockOverlap=true;
    } else if(header.bottom > dock.top+1 && header.top < dock.bottom) dockOverlap=true;
    const pills=[];
    document.querySelectorAll(".pill,.chip,.openbtn,.modebtn").forEach(el=>{
      if(el.scrollWidth>el.clientWidth+3 && getComputedStyle(el).display!=="none"){
        pills.push((el.className||el.tagName)+" "+el.textContent.slice(0,40));
      }
    });
    return {
      scroll: doc.scrollWidth,
      client: doc.clientWidth,
      bad: bad.slice(0, 8),
      dockOverlap,
      pills: pills.slice(0, 8)
    };
  });
  assert.equal(report.scroll<=report.client+1, true, label+" horizontal "+report.scroll+">"+report.client);
  assert.deepEqual(report.bad, [], label+" ragt hinaus: "+report.bad.join(" | "));
  assert.equal(report.dockOverlap, false, label+" Leiste überdeckt die Kopfzeile");
  assert.deepEqual(report.pills, [], label+" Text läuft über: "+report.pills.join(" | "));
}

test("Headless 390 und 1024: kein Überlauf, keine Konsolenfehler", {timeout:180000}, async ()=>{
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({headless:true});
  const errors=[];
  try {
    for(const width of [390, 1024]){
      const page = await browser.newPage({viewport:{width, height:800}, deviceScaleFactor:1});
      page.on("pageerror", err=>errors.push(width+" "+err.message));
      page.on("console", msg=>{
        if(msg.type()==="error") errors.push(width+" "+msg.text());
      });
      await prepare(page);
      await page.goto("http://127.0.0.1:"+port+"/#/start", {waitUntil:"domcontentloaded"});
      await page.waitForSelector("#v-start .fcard");
      await checkLayout(page, "start "+width);
      await shoot(page, "start-"+width);

      await page.locator("[data-open=englisch]").click();
      await page.locator("[data-bereich-toggle=vokabeln]").click();
      await page.waitForSelector(".modebtn");
      await checkLayout(page, "englisch "+width);
      await shoot(page, "fach-englisch-"+width);

      await page.locator("#dock a[data-nav=start]").click();
      await page.locator("#v-start [data-open=mathe]").click();
      await page.waitForSelector("#page-fach .modebtn.fresh");
      await checkLayout(page, "mathe "+width);
      await shoot(page, "fach-mathe-"+width);

      await page.locator("[data-modus=zeichnen]").click();
      await page.waitForSelector("#mDraw svg");
      await checkLayout(page, "zeichnen "+width);
      await shoot(page, "fach-mathe-zeichnen-"+width);

      await page.locator("#dock a[data-nav=statistik]").click();
      await page.waitForSelector("#statsGesamt");
      await checkLayout(page, "statistik "+width);
      await shoot(page, "statistik-"+width);

      await page.locator("#dock a[data-nav=abzeichen]").click();
      await page.waitForSelector("#abz-englisch");
      await checkLayout(page, "abzeichen "+width);
      await shoot(page, "abzeichen-"+width);

      await page.locator("#dock a[data-nav=mehr]").click();
      await page.waitForSelector("#exportBtn");
      await checkLayout(page, "mehr "+width);
      await shoot(page, "mehr-daten-"+width);
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
  const serious = errors.filter(e=>!/favicon|manifest/i.test(e));
  assert.deepEqual(serious, [], serious.join("\n"));
});
