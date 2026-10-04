const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
// שמות כמו ש"ס וחד"ש-תע"ל שוברים תגיות HTML אם לא בורחים מהם
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const bmsg=t=>$("#bmsg").textContent=t, bbar=p=>$("#bbar i").style.width=p+"%";
let DB=null, CAND=null, PEOPLE=null, PHOTOS={}, PLAT=null;
// תמונה לפי מזהה אדם, ואם אין — ראשי תיבות
const initials=n=>String(n||"").split(" ").filter(Boolean)
  .map(w=>w[0]).join("").slice(0,2);
function avatar(pid,name,cls){
  const p=PHOTOS[pid]||{}, src=p.img||null;
  return src
    ? `<img class="av ${cls||""}" src="${esc(src)}" alt="" loading="lazy"
        onerror="this.replaceWith(Object.assign(document.createElement('span'),
          {className:'av ${cls||""}',textContent:'${esc(initials(name))}'}))">`
    : `<span class="av ${cls||""}">${esc(initials(name))}</span>`;
}
// פנים של מועמד: תמונת פרופיל, תמונת ויקיפדיה, תמונת הכנסת
// לפי מזהה, ואם שום אחת לא נטענת — ראשי תיבות. בלי ה-onerror
// כתובת שבורה משאירה ריבוע שבור במקום האות.
function face(r){
  const u=(r.profile&&r.profile.img)||(r.wiki&&r.wiki.img);
  if(!u) return avatar(r.person_id,r.name);
  return `<img class="av" src="${esc(u)}" alt="" loading="lazy"
    onerror="this.replaceWith(Object.assign(document.createElement('span'),
      {className:'av',textContent:'${esc(initials(r.name))}'}))">`;
}
// אות הפתק ומי בראש הרשימה — שתי עובדות רשמיות מוועדת הבחירות
function listHead(l){
  const m=(CAND&&CAND.list_meta||{})[l];
  if(!m) return "";
  const bits=[];
  if(m.letter) bits.push(`אות: <b>${esc(m.letter)}</b>`);
  if(m.leader) bits.push(`בראשות ${esc(m.leader)}`);
  if(m.n) bits.push(`${m.n} מועמדים ברשימה`);
  return `<div class="note" style="margin:-4px 0 10px">${bits.join(" · ")}
    ${m.full&&m.full!==l?`<br>${esc(m.full)}`:""}</div>`;
}
const S={tab:"answer",faction:null,topic:null,d0:null,d1:null,sort:"n",
         bview:"mk",pop:null};
const SORTS={answer:"n",votes:"d",basket:"a",plat:"a",people:"n",cand:"p",
             snap:"r"};
// הסל נשמר בין ביקורים. stance = העמדה שהמשתמש/ת סימנ/ה לכל הצבעה.
let BASKET=[], STANCE={};
// PSTANCE = התשובות שלך לשאלות המצע. נפרד מ-STANCE בכוונה:
// האחד נמדד מול הצבעות שהיו, השני מול הצהרות שטרם נבחנו.
let PSTANCE={};
try{BASKET=JSON.parse(localStorage.knBasket||"[]");
    STANCE=JSON.parse(localStorage.knStance||"{}");
    PSTANCE=JSON.parse(localStorage.knPlat||"{}");}catch(e){}
function savePlat(){
  try{localStorage.knPlat=JSON.stringify(PSTANCE);}catch(e){}
}
function clearCache(){CACHE.clear();}
function saveBasket(){
  try{localStorage.knBasket=JSON.stringify(BASKET);
      localStorage.knStance=JSON.stringify(STANCE);}catch(e){}
  const b=$("#bcount"); b.textContent=BASKET.length; b.hidden=!BASKET.length;
}
const inBasket=id=>BASKET.includes(id);
function toggleBasket(id){
  const i=BASKET.indexOf(id);
  if(i<0) BASKET.push(id); else {BASKET.splice(i,1); delete STANCE[id];}
  saveBasket(); render();
}

/* ─────────── טעינה ─────────── */
// נתוני המועמדים יושבים ב-cand/: כותרת אחת וכמה חלקים של שורות.
// הפיצול אינו גחמה — הקובץ השלם הוא 362KB ולא ניתן היה להעלות
// אותו בחתיכה אחת דרך הערוץ שבו נדחף המאגר. כל חלק הוא JSON
// תקין בפני עצמו, ולכן שגיאה בחלק אחד נופלת ברעש ולא בשקט.
// השורות ארוזות: מפתחות מקוצרים, שם הרשימה כמספר, ומה שנגזר
// אינו נשמר — שם התצוגה כשהוא זהה לשם ההגשה, שם המאגר שזהה
// לו תמיד, וכתובת ויקיפדיה שנגזרת מהכותרת. unpack מחזיר את
// אותם אובייקטים בדיוק, וזהות זו נבדקת מול המקור בכלי הבנייה.
// אם התיקייה חסרה, נופלים לקובץ הישן כדי שהאתר ימשיך לעבוד.
const CPRE=["https://bhirot26.online/party",
  "https://he.wikipedia.org/wiki/",
  "https://upload.wikimedia.org/wikipedia/commons/",
  "https://fs.knesset.gov.il/globaldocs/MK/",
  "https://main.knesset.gov.il/"];
const CVER=["none","knesset","wikipedia"], CCONF=["","high","medium","low"];
const CORIG=["תיאור ממצפן הבחירה (bhirot26.online) — אינו מקור רשמי",
             "תיאור תפקידים ציבוריים — אינו מקור רשמי"];
const uq=s=>(typeof s==="string"&&s[0]==="~"&&s[1]>="0"&&s[1]<="9")
  ?CPRE[+s[1]]+s.slice(2):s;
const wurl=t=>"https://he.wikipedia.org/wiki/"+
  encodeURIComponent(t.replace(/ /g,"_"));

function unpack(o,lists){
  const r={list:lists[o.l],pos:o.p,official:o.o};
  r.name="n" in o?o.n:o.o;
  r.verified=CVER[o.v||0];
  if("i" in o){r.person_id=o.i; r.knesset_name=r.name;
    r.knessets=o.s; r.last_faction=o.f;}
  if("r" in o) r.ruled=o.r;
  if("x" in o) r.ruled_out=o.x;
  if("d" in o) r.dup_of=o.d;
  if("W0" in o) r.wiki_no=o.W0;
  if(o.P){const q=o.P,p={};
    if("d" in q) p.desc=q.d;
    if("s" in q) p.src=uq(q.s);
    if("c" in q) p.confidence=CCONF[q.c];
    if("R" in q) p.roles=q.R;
    if("b" in q) p.born=q.b;
    if("g" in q) p.origin=CORIG[q.g-1];
    if("m" in q) p.img=uq(q.m);
    r.profile=p;}
  if(o.W){const q=o.W,w={};
    if("t" in q) w.title=q.t;
    if("s" in q) w.summary=q.s;
    if("b" in q) w.born=q.b;
    if("m" in q) w.img=uq(q.m);
    if("v" in q) w.via=q.v;
    if("u" in q) w.url=uq(q.u); else if("t" in q) w.url=wurl(q.t);
    r.wiki=w;}
  return r;
}

async function loadCand(){
  try{
    const m=await fetch("cand/meta.json");
    if(!m.ok) throw new Error("meta "+m.status);
    const meta=await m.json();
    const parts=await Promise.all(
      Array.from({length:meta.parts},(_,i)=>
        fetch(`cand/d${i}.json`).then(r=>{
          if(!r.ok) throw new Error(`cand/d${i}.json ${r.status}`);
          return r.json();})));
    const rows=parts.flat().map(o=>unpack(o,meta.lists));
    if(rows.length<meta.n_rows) throw new Error("חסרות שורות");
    return {...meta,rows};
  }catch(e){
    console.warn("cand/ לא נטען:",e.message);
    try{return await (await fetch("candidates.json")).json();}catch(_){return null;}
  }
}

// המצעים יושבים ב-platform.json (כותרת: המקור, הסוגיות וסדרן)
// ובחלקי plat/ — עמדות 38 הרשימות. כל עמדה ארוזה כמערך
// [קוד, ציטוט, מקור], והתווית נגזרת מהקוד חוץ מעמדה חלקית
// שמנוסחת בכמה אופנים ולכן נשמרת במקום הרביעי.
const PST=[null,"for","against","partial"], PLB={1:"בעד",2:"נגד"};

function unpackPlat(o){
  const v={planks:o.P||[],stances:{}};
  for(const k in (o.S||{})){
    const r=o.S[k];
    // ||null ולא undefined: לתשע סוגיות אין עמדה מתועדת בכלל,
    // ובקובץ המקורי התווית שלהן null.
    v.stances[k]={stance:PST[r[0]],
                  label:(r.length>3?r[3]:PLB[r[0]])||null,
                  quote:r[1],src:r[2]};}
  return v;
}

async function loadPlat(){
  try{
    const h=await fetch("platform.json");
    if(!h.ok) throw new Error("platform "+h.status);
    const head=await h.json();
    if(head.lists) return head;          // הקובץ המלא, בלי חלקים
    const parts=await Promise.all(
      Array.from({length:head.parts},(_,i)=>
        fetch(`plat/${i}.json`).then(r=>{
          if(!r.ok) throw new Error(`plat/${i}.json ${r.status}`);
          return r.json();})));
    const lists={};
    for(const p of parts) for(const n in p) lists[n]=unpackPlat(p[n]);
    if(Object.keys(lists).length<head.n_lists)
      throw new Error("חסרות רשימות");
    return {...head,lists};
  }catch(e){
    console.warn("plat/ לא נטען:",e.message);
    return null;
  }
}

async function boot(){
  try{
    bmsg("טוען מנוע…");
    const SQL=await initSqlJs({locateFile:f=>
      "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/"+f});
    bmsg("מוריד את בסיס הנתונים (78MB)…");
    const r=await fetch("knesset_web.db");
    if(!r.ok) throw new Error("knesset_web.db לא נמצא ("+r.status+")");
    const len=+r.headers.get("content-length")||78e6, chunks=[]; let got=0;
    const rd=r.body.getReader();
    for(;;){const {done,value}=await rd.read(); if(done)break;
      chunks.push(value); got+=value.length;
      bbar(Math.min(99,got/len*100));
      bmsg(`מוריד… ${(got/1e6).toFixed(0)} מתוך ${(len/1e6).toFixed(0)} MB`);}
    const buf=new Uint8Array(got); let o=0;
    for(const c of chunks){buf.set(c,o); o+=c.length;}
    bmsg("פותח…"); bbar(100);
    DB=new SQL.Database(buf);
    CAND=await loadCand();
    try{PEOPLE=await (await fetch("people_index.json")).json();}catch(e){}
    try{PHOTOS=await (await fetch("photos.json")).json();}catch(e){PHOTOS={};}
    PLAT=await loadPlat();
    init();
    $("#boot").style.display="none";
  }catch(e){
    bmsg("הטעינה נכשלה: "+e.message+
      "<br><br>ודאי ש-knesset_web.db יושב לצד index.html ושהדף מוגש משרת ולא מהקובץ.");
    $("#bmsg").innerHTML=$("#bmsg").textContent;
  }
}

const q=(sql,p=[])=>{const r=DB.exec(sql,p); if(!r.length)return[];
  return r[0].values.map(v=>Object.fromEntries(r[0].columns.map((c,i)=>[c,v[i]])));};
const one=(sql,p=[])=>{const r=q(sql,p); return r.length?Object.values(r[0])[0]:null;};

/* ─────────── אתחול ─────────── */
let FACS=[], TOPS=[], KN=[], DMIN, DMAX;
function init(){
  DMIN=one("SELECT MIN(date) FROM vote_x WHERE date!=''");
  DMAX=one("SELECT MAX(date) FROM vote_x WHERE date!=''");
  S.d0=DMIN; S.d1=DMAX;
  KN=q("SELECT knesset k, MIN(date) a, MAX(date) b FROM vote_x WHERE date!='' GROUP BY 1 ORDER BY 1");
  FACS=q(`SELECT m.faction f, COUNT(DISTINCT m.mk_id) n, m.knesset k FROM mk m
          WHERE m.knesset IN (SELECT DISTINCT knesset FROM vote_x)
          GROUP BY m.faction, m.knesset ORDER BY n DESC`);
  TOPS=q(`SELECT t.name f, COUNT(*) n FROM topic_match m JOIN topic t ON t.id=m.topic_id
          WHERE m.kind='vote' GROUP BY 1 ORDER BY n DESC`);
  // שני מקורות, שני תאריכים: ההצבעות מהכנסת, הרשימות מוועדת
  // הבחירות. תאריך אחד היה מטשטש את זה.
  const built=(one("SELECT v FROM meta WHERE k='built'")||"").slice(0,10);
  $("#src").innerHTML=`נתוני כנסת · OData<br>עד ${fmt(built)}`
    +(CAND&&CAND.approved
      ?`<br>רשימות · ועדת הבחירות ${fmt(CAND.approved)}`:"");
  setupTime(); setupPickers(); setupNav(); render();
}

/* ─────────── ציר זמן ─────────── */
const days=d=>Math.round(new Date(d)/864e5);
const iso=n=>new Date(n*864e5).toISOString().slice(0,10);
function setupTime(){
  const a=days(DMIN), b=days(DMAX);
  const r0=$("#r0"), r1=$("#r1");
  [r0,r1].forEach(r=>{r.min=a; r.max=b; r.step=1;});
  r0.value=a; r1.value=b;
  const upd=()=>{
    let x=+r0.value, y=+r1.value;
    if(x>y){[x,y]=[y,x];}
    S.d0=iso(x); S.d1=iso(y);
    $("#d0").textContent=fmt(S.d0); $("#d1").textContent=fmt(S.d1);
    const L=(x-a)/(b-a)*100, R=(y-a)/(b-a)*100;
    $("#sel").style.insetInlineStart=L+"%"; $("#sel").style.width=(R-L)+"%";
    $("#knbar").innerHTML=KN.map(k=>
      `<i class="${k.b>=S.d0&&k.a<=S.d1?"on":""}" title="כנסת ${k.k}"></i>`).join("");
  };
  [r0,r1].forEach(r=>{r.addEventListener("input",upd);
    r.addEventListener("change",()=>{upd(); render();});});
  upd();
}
const fmt=d=>d?d.split("-").reverse().join("."):"";

/* ─────────── בוררים ─────────── */
let pickCb=null;
function openPick(title,items,cb){
  pickCb=cb; $("#psearch").value=""; $("#psearch").placeholder=title;
  const draw=f=>{
    const s=(f||"").trim();
    $("#plist").innerHTML=items.filter(i=>!s||i.label.includes(s))
      .slice(0,400).map((i,n)=>
      `<button data-v="${esc(i.value??"")}">${esc(i.label)}${i.note?
        ` <small>${esc(i.note)}</small>`:""}</button>`).join("");
    $$("#plist button").forEach(b=>b.onclick=()=>{
      pickCb(b.dataset.v||null); closePick();});
  };
  draw(""); $("#psearch").oninput=e=>draw(e.target.value);
  $("#pick").classList.add("open"); $("#psearch").focus();
}
const closePick=()=>$("#pick").classList.remove("open");
function setupPickers(){
  $("#pclose").onclick=closePick;
  $("#s-fac").onclick=()=>{
    const seen=new Set(), it=[{label:"כל הסיעות",value:""}];
    FACS.forEach(f=>{if(!seen.has(f.f)){seen.add(f.f);
      it.push({label:f.f,value:f.f,note:`כנסת ${f.k}`});}});
    openPick("סיעה",it,v=>{S.faction=v; $("#s-fac").textContent=v||"כל הסיעות"; render();});
  };
  $("#s-top").onclick=()=>{
    const it=[{label:"כל הנושאים",value:""}].concat(
      TOPS.map(t=>({label:t.f,value:t.f,note:t.n.toLocaleString()+" הצבעות"})));
    openPick("נושא",it,v=>{S.topic=v; $("#s-top").textContent=v||"כל הנושאים"; render();});
  };
}
function setupNav(){
  $$("nav button").forEach(b=>b.onclick=()=>{
    $$("nav button").forEach(x=>x.setAttribute("aria-selected","false"));
    b.setAttribute("aria-selected","true"); S.tab=b.dataset.t;
    S.sort=SORTS[S.tab]||"n"; render();});
  $("#sort").onchange=e=>{S.sort=SORTS[S.tab]=e.target.value; render();};
  addEventListener("keydown",e=>{if(e.key==="Escape"){closeSheet(); closePick();}});
}

/* ─────────── שאילתות ─────────── */
const topicFilter=()=>S.topic
  ? `AND v.vote_id IN (SELECT ref_id FROM topic_match WHERE kind='vote'
       AND topic_id=(SELECT id FROM topic WHERE name='${S.topic.replace(/'/g,"''")}'))`
  : "";
const dateFilter=()=>`AND v.date BETWEEN '${S.d0}' AND '${S.d1}'`;

/* ─────────── תצוגה ─────────── */
// קישור אחד לכל סוגי הלחיצה. נדרש גם אחרי שחזור מהמטמון,
// שאחרת מאזיני הלחיצה אובדים.
function bindOut(){
  const o=$("#out");
  o.onclick=e=>{
    const t=e.target.closest("[data-add],[data-rm],[data-st],[data-v],[data-p],[data-c],[data-c2],[data-p2],[data-bv],[data-ps],[data-ex]");
    if(!t) return;
    if(t.dataset.bv!==undefined){S.bview=t.dataset.bv; return render();}
    if(t.dataset.ex!==undefined){S.pop=t.dataset.ex||null; return render();}
    if(t.dataset.ps!==undefined){
      const k=t.dataset.ps, v=t.dataset.pv;
      PSTANCE[k]===v ? delete PSTANCE[k] : PSTANCE[k]=v;
      savePlat(); clearCache(); return render();
    }
    if(t.dataset.add!==undefined){e.stopPropagation();return toggleBasket(+t.dataset.add);}
    if(t.dataset.rm!==undefined) return toggleBasket(+t.dataset.rm);
    if(t.dataset.st!==undefined){
      const id=+t.dataset.st, p=+t.dataset.p;
      STANCE[id]===p ? delete STANCE[id] : STANCE[id]=p;
      saveBasket(); clearCache(); return render();
    }
    if(t.dataset.v!==undefined) return openVote(+t.dataset.v);
    if(t.dataset.p2!==undefined) return openPerson(+t.dataset.p2,+t.dataset.m2);
    if(t.dataset.p!==undefined) return openPerson(+t.dataset.p,+t.dataset.m);
    if(t.dataset.c!==undefined) return openCand(decodeURIComponent(t.dataset.c));
    if(t.dataset.c2!==undefined) return openCand(decodeURIComponent(t.dataset.c2));
  };
}

