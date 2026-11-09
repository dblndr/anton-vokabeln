"use strict";
const fs = require("fs");
const path = require("path");
const {JSDOM} = require("jsdom");

const htmlPath = path.join(__dirname, "..", "index.html");

function loadHtml(html, opts){
  opts = opts || {};
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "http://localhost/index.html",
    beforeParse(window){
      window.speechSynthesis = {
        speaking: false,
        pending: false,
        paused: false,
        cancel(){},
        resume(){},
        speak(u){ this.last = u; if(typeof u.onstart==="function") u.onstart(); },
        getVoices(){
          return [
            {lang:"en-US", name:"en-US Voice", localService:true},
            {lang:"en-GB", name:"Bad News", localService:true},
            {lang:"en-GB", name:"en-GB Voice", localService:true},
            {lang:"de-AT", name:"de-AT Voice", localService:true},
            {lang:"de-DE", name:"de-DE Voice", localService:true}
          ];
        },
        addEventListener(){}
      };
      window.scrollTo = function(){};
      window.confirm = function(){ return true; };
      window.SpeechSynthesisUtterance = class {
        constructor(t){ this.text=t; this.rate=1; this.lang=""; this.pitch=1; this.volume=1; this.voice=null; }
      };
      if(opts.storage!=null){
        const raw = typeof opts.storage==="string" ? opts.storage : JSON.stringify(opts.storage);
        window.localStorage.setItem("anton-vokabeln-v1", raw);
      }
    }
  });
  if(!dom.window.VT) throw new Error("VT missing – Seite ist beim Start abgebrochen");
  return dom.window;
}
function load(){
  return loadHtml(fs.readFileSync(htmlPath, "utf8"));
}

module.exports = {load, loadHtml, htmlPath};
