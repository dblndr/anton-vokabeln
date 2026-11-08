"use strict";
const fs = require("fs");
const path = require("path");
const {JSDOM} = require("jsdom");

const htmlPath = path.join(__dirname, "..", "index.html");

function load(){
  const html = fs.readFileSync(htmlPath, "utf8");
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
            {lang:"en-US", name:"Samantha", localService:true},
            {lang:"en-GB", name:"Bad News", localService:true},
            {lang:"en-GB", name:"Daniel", localService:true},
            {lang:"de-AT", name:"Petra", localService:true},
            {lang:"de-DE", name:"Anna", localService:true}
          ];
        },
        addEventListener(){}
      };
      window.scrollTo = function(){};
      window.SpeechSynthesisUtterance = class {
        constructor(t){ this.text=t; this.rate=1; this.lang=""; this.pitch=1; this.volume=1; this.voice=null; }
      };
    }
  });
  if(!dom.window.VT) throw new Error("VT missing – Seite ist beim Start abgebrochen");
  return dom.window;
}

module.exports = {load, htmlPath};
