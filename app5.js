/* ─────────── גיליונות ─────────── */
const openSheet=h=>{$("#sheetin").innerHTML=h; $("#sheet").classList.add("open");
  $("#sheet").scrollTop=0; document.body.style.overflow="hidden";
  $("#sheetin .x").onclick=closeSheet;
  const va=$("#vadd"); if(va) va.onclick=()=>{toggleBasket(+va.dataset.id||CURVOTE);
    closeSheet();};};
let CURVOTE=null;
const closeSheet=()=>{$("#sheet").classList.remove("open");
  document.body.style.overflow="";};

function openVote(id){
  CURVOTE=id;
  const v=q(`SELECT * FROM vote_x WHERE vote_id=?`,[id])[0];
  const fv=q(`SELECT m.faction f, m.bloc bl, SUM(r.result=1) yes,
      SUM(r.result=2) no, SUM(r.result=3) ab
    FROM vote_result r JOIN mk m ON m.mk_id=r.mk_id
    WHERE r.vote_id=? GROUP BY m.faction ORDER BY yes+no DESC`,[id]);
  const who=r=>q(`SELECT m.name nm, m.faction f FROM vote_result r
    JOIN mk m ON m.mk_id=r.mk_id WHERE r.vote_id=? AND r.result=? ORDER BY m.faction`,
    [id,r]);
  const tops=q(`SELECT t.name n, m.keyword k FROM topic_match m
    JOIN topic t ON t.id=m.topic_id WHERE m.kind='vote' AND m.ref_id=?`,[id]);
  const bill=(q(`SELECT b.*, s.name st FROM vote_bill b
    LEFT JOIN status s ON s.id=b.status WHERE b.vote_id=?`,[id])||[])[0];
  // מוצג תמיד, גם כשריק. השמטה לא מבדילה בין "אף אחד" לבין "חסר נתון".
  const list=(t,arr,cls)=>`<div class="sec"><h3>${t} · ${arr.length}</h3>
    ${arr.length?`<div class="txt">${arr.map(x=>
      `<span style="color:var(--${cls})">${x.nm}</span>
       <span style="color:var(--dim);font-size:12px">${esc(x.f)}</span>`).join(" · ")}</div>`
     :`<div style="color:var(--dim);font-size:13px">אף אחד לא הצביע ${t}.</div>`}
    </div>`;
  openSheet(`<div class="hd"><button class="x">✕</button><b>הצבעה</b>
   <button class="add ${inBasket(id)?"on":""}" id="vadd">${inBasket(id)?"✓":"+"}</button></div>
   <div class="sec"><div style="font:400 19px/1.5 'Frank Ruhl Libre',serif">${
     v.title||"(ללא כותרת)"}</div>
     <div class="s" style="margin-top:10px;font-size:12px;color:var(--dim)">
       ${fmt(v.date)} · כנסת ${v.knesset}${v.no_confidence?" · הצעת אי־אמון":""}</div>
     ${bill?`<div class="sec" style="padding-inline:0;border:0;padding-bottom:0">
       <h3>על מה ההצבעה</h3>
       <div style="font-size:14px;line-height:1.5">${bill.bill_name}</div>
       <div style="font-size:11.5px;color:var(--dim);margin-top:5px">
         ${bill.kind||""}${bill.st?` · ${bill.st}`:""}</div>
       ${bill.summary?`<div class="txt" style="margin-top:11px">${bill.summary}</div>`
         :`<div class="note" style="margin-top:9px">לחוק הזה אין תקציר רשמי במאגר.
            שם ההצעה למעלה הוא מה שקיים.</div>`}
     </div>`:`<div class="note" style="margin-top:10px">ההצבעה אינה מקושרת
        להצעת חוק — ייתכן שהיא נוגעת לסדר היום או לנוהל.</div>`}
     ${tops.length?`<div style="margin-top:14px">${tops.map(t=>
       `<span class="pill" style="margin-inline-end:5px">${t.n}${
         t.k?` <span style="color:var(--none)">«${t.k}»</span>`:""}</span>`).join("")}</div>`:""}
   </div>
   ${(()=>{const h=platForTopics(tops.map(t=>t.n));
     return h?`<div class="sec"><h3>מה הרשימות אומרות בתחום הזה</h3>
       <div class="note" style="margin-bottom:12px">עמדות מוצהרות בסוגיות
       שנוגעות לנושאי ההצבעה הזו — לא תחזית להצבעה עליה. מצע מדבר על
       כיוון, והצבעה תלויה בנוסח. לחיצה ארוכה על תווית מראה את הציטוט.</div>
       ${h}</div>`:"";})()}
   <div class="sec"><h3>לפי סיעה</h3>${fv.map(r=>{
     const t=r.yes+r.no+r.ab||1;
     return `<div style="margin-bottom:11px">
       <div style="display:flex;font-size:13px"><span style="flex:1">${esc(r.f)}</span>
         <span class="n" style="color:var(--dim);font-size:11.5px">${r.yes} בעד · ${r.no} נגד${
           r.ab?` · ${r.ab} נמנע`:""}</span></div>
       <div class="split" style="height:14px;margin-top:5px">
         ${r.yes?`<i class="f" style="width:${r.yes/t*100}%"></i>`:""}
         ${r.no?`<i class="a" style="width:${r.no/t*100}%"></i>`:""}
         ${r.ab?`<i class="b" style="width:${r.ab/t*100}%"></i>`:""}</div></div>`;
     }).join("")}</div>
   ${list("בעד",who(1),"for")}${list("נגד",who(2),"against")}
   ${list("נמנעו",who(3),"abstain")}
   <div class="sec"><div class="note">מקור: KNS_PlenumVote ו-VoteResults.
     כל שורה כאן היא רשומה רשמית של הכנסת.</div></div>`);
}

async function openPerson(pid,mkid){
  const m=q(`SELECT * FROM mk WHERE mk_id=?`,[mkid])[0];
  const roles=q(`SELECT title,org,start,finish,kind FROM mk_role WHERE mk_id=?
    ORDER BY start DESC`,[mkid]);
  const cms=q(`SELECT committee,role,start,finish FROM mk_committee WHERE mk_id=?
    ORDER BY role='יו"ר' DESC`,[mkid]);
  const v=q(`SELECT SUM(r.result=1) f,SUM(r.result=2) a,SUM(r.result=3) b,
      COUNT(*) t FROM vote_result r JOIN vote_x vv ON vv.vote_id=r.vote_id
      WHERE r.mk_id=? ${dateFilter().replace(/v\./g,"vv.")}`,[mkid])[0]||{};
  const bills=one(`SELECT COUNT(*) FROM kns_billinitiator WHERE PersonID=?`,[pid])||0;
  const tps=q(`SELECT t.name n,k.v_for f,k.v_against a,k.bills b
    FROM mk_topic k JOIN topic t ON t.id=k.topic_id
    WHERE k.mk_id=? ORDER BY k.v_for+k.v_against DESC LIMIT 8`,[mkid]);
  let hist=null;
  try{hist=await (await fetch(`history/${pid}.json`)).json();}catch(e){}
  const cand=CAND&&CAND.rows.find(r=>r.person_id===pid);
  openSheet(`<div class="hd"><button class="x">✕</button><b>${m.name}</b></div>
   <div class="hero">${avatar(pid,m.name,"big")}
     <div><h2>${esc(m.name)}</h2>
       <div class="sub">${m.faction} · כנסת ${m.knesset}<br>${
         m.bloc==="coalition"?"קואליציה":"אופוזיציה"}${
         m.is_faction_chair?" · יו״ר סיעה":""}${
         cand?`<br><span style="color:var(--sky)">מתמודד/ת ברשימת ${cand.list}${
           cand.pos?`, מקום ${cand.pos}`:""}</span>`:""}</div>
       <div class="lnks">${m.url?`<a href="${m.url}" target="_blank">דף באתר הכנסת</a>`:""}
         ${m.odata?`<a href="${m.odata}" target="_blank">הרשומה הגולמית</a>`:""}
         ${(PHOTOS[pid]||{}).url?`<a href="${esc(PHOTOS[pid].url)}" target="_blank">ויקיפדיה</a>`:""}</div>
     </div></div>
   ${(PHOTOS[pid]||{}).sum?`<div class="sec"><h3>רקע</h3>
     <div class="txt">${esc(PHOTOS[pid].sum)}</div>
     <div class="note">מקור: ויקיפדיה. שאר הנתונים בעמוד זה מהכנסת.</div></div>`:""}
   <div class="sec"><h3>הצבעות בטווח שנבחר</h3><div class="grid">
     <div class="cell"><div class="v n">${(v.f||0).toLocaleString()}</div><div class="k">בעד</div></div>
     <div class="cell"><div class="v n">${(v.a||0).toLocaleString()}</div><div class="k">נגד</div></div>
     <div class="cell"><div class="v n">${(v.b||0).toLocaleString()}</div><div class="k">נמנע</div></div>
     <div class="cell"><div class="v n">${bills.toLocaleString()}</div><div class="k">הצעות חוק שיזם/ה</div></div>
   </div><div class="note">${fmt(S.d0)} – ${fmt(S.d1)}</div></div>
   ${tps.length?`<div class="sec"><h3>לפי נושא</h3>${tps.map(t=>`
     <div style="margin-bottom:10px">
       <div style="display:flex;font-size:13.5px"><span style="flex:1">${t.n}</span>
         <span class="n" style="color:var(--dim);font-size:12px">${t.f} בעד · ${t.a} נגד${
           t.b?` · ${t.b} יזם`:""}</span></div>
       <div class="bar"><i class="f" style="width:${t.f/(t.f+t.a||1)*100}%"></i>
         <i class="a" style="flex:1"></i></div></div>`).join("")}</div>`:""}
   ${cms.length?`<div class="sec"><h3>ועדות</h3>${cms.map(c=>
     `<div class="item" style="padding-inline:0;border-bottom:1px solid var(--rule-2)">
       <div class="t">${c.committee||"—"}</div>
       <div class="s"><span class="pill${c.role==='יו"ר'?" co":""}">${c.role}</span>
         <span>${fmt(c.start)}${c.finish?" – "+fmt(c.finish):""}</span></div></div>`
     ).join("")}</div>`:""}
   ${roles.length?`<div class="sec"><h3>תפקידים</h3><div class="tl">${
     roles.slice(0,20).map(r=>`<div><div class="w">${r.title}</div>
       <div class="d">${r.org} · ${fmt(r.start)}${r.finish?" – "+fmt(r.finish):""}</div>
     </div>`).join("")}</div></div>`:""}
   ${hist&&hist.knessets.length>1?`<div class="sec"><h3>מסלול מלא</h3><div class="tl">${
     hist.knessets.map(k=>`<div><div class="w">${k.faction}</div>
       <div class="d">כנסת ${k.k}${k.from?" · "+fmt(k.from):""}</div></div>`).join("")
     }</div><div class="note">מתוך history/${pid}.json — כל הקדנציות, גם מחוץ לטווח.</div></div>`:""}
   <div class="sec"><div class="note">כל השדות נגזרים מרשומות רשמיות של הכנסת.
     אין כאן דירוג, ציון או פרשנות — ספירה ותאריכים בלבד.</div></div>`);
}

function openCand(name){
  const r=CAND.rows.find(x=>x.name===name);
  if(!r) return;
  if(r.person_id) return openPerson(r.person_id,
    one("SELECT mk_id FROM mk WHERE person_id=? ORDER BY knesset DESC LIMIT 1",
        [r.person_id]));
  const pr=r.profile||{}, w=r.wiki||{};
  const img=pr.img||w.img, url=pr.src||w.url;
  const desc=pr.desc||w.summary;
  // מאיפה הגיע התיאור. origin גובר, כי הוא נכתב ידנית ואינו
  // נשען על מקור מקוון — ואסור שייראה כאילו כן.
  const conf=pr.origin||{high:"אומת מול מקור רשמי",medium:"מקור עיתונאי",
              low:"התאמה לא ודאית"}[pr.confidence];
  openSheet(`<div class="hd"><button class="x">✕</button><b>${esc(r.name)}</b></div>
   <div class="hero">${img?`<img class="av big" src="${esc(img)}" alt="">`
     :`<span class="av big">${esc(initials(r.name))}</span>`}
     <div><h2>${esc(r.name)}</h2>
       <div class="sub">${esc(r.list)}${r.pos?` · מקום ${r.pos}`:""}${
         (CAND.list_meta&&CAND.list_meta[r.list]||{}).letter
         ?` · אות ${esc(CAND.list_meta[r.list].letter)}`:""}${
         r.official&&r.official!==r.name
         ?`<br>בהגשה: ${esc(r.official)}`:""}
         ${pr.born?`<br>נולד/ה ${esc(pr.born)}`:w.born?`<br>נולד/ה ${esc(w.born)}`:""}</div>
       <div class="lnks">${url?`<a href="${esc(url)}" target="_blank">המקור</a>`:""}</div>
     </div></div>
   ${desc?`<div class="sec"><h3>מי זה</h3><div class="txt">${esc(desc)}</div>
     ${conf?`<div class="note">${conf}</div>`:""}</div>`:""}
   ${pr.roles&&pr.roles.length?`<div class="sec"><h3>תפקידים ועיסוקים</h3>
     <div>${pr.roles.map(x=>`<span class="pill"
       style="margin:0 0 6px 6px;display:inline-block">${esc(x)}</span>`).join("")}</div>
     </div>`:w.cats&&w.cats.length?`<div class="sec"><h3>שיוכים</h3>
     <div>${w.cats.map(x=>`<span class="pill"
       style="margin:0 0 6px 6px;display:inline-block">${esc(x)}</span>`).join("")}</div>
     </div>`:""}
   ${!desc?`<div class="msg">לא נמצא מידע מאומת על אדם זה.<br>
      ייתכן שאלה פנים חדשות לגמרי.</div>`:""}
   ${(()=>{const L=((PLAT||{}).lists||{})[r.list]||{};
     const pk=(L.planks||[]).slice(0,8);
     if(!pk.length) return "";
     return `<div class="sec"><h3>מה הרשימה שלו אומרת</h3>
       <div class="tl">${pk.map(x=>
         `<div><div class="w" style="font-weight:400;font-size:13px">${esc(x)}</div>
          </div>`).join("")}</div>
       <div class="note" style="margin-top:10px">קווי מצע של הרשימה, לא של
         האדם. אין לו רקורד הצבעות שאפשר להעמיד מולם. בלשונית
         <b>מצעים</b> אפשר לראות את עמדות כל הרשימות סוגיה־סוגיה.</div>
       </div>`;})()}
   <div class="sec"><div class="note">אין לאדם זה רקורד פרלמנטרי במאגר —
     לא כיהן בכנסת ה-22 עד ה-25. השיוך לרשימה ולמקום בה הוא רשמי, מוועדת
     הבחירות המרכזית; התיאור שמעליו ממקורות חיצוניים ולא מהכנסת.
     ${r.ruled_out?`<br>שם דומה במאגר (${esc(r.ruled_out)}) נבדק ונדחה:
       ${esc(r.ruled||"")}.`:""}</div></div>`);
}

boot();
