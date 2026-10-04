/* ─────────── מצעים ─────────── */
// שכבה שנייה, ובמכוון נפרדת. הצבעה היא מעשה שתועד; מצע הוא
// הצהרה שטרם נבחנה. הן לא מחוברות לציון אחד, ובכל מקום שבו
// מופיע מספר כתוב על מה הוא נשען.

// התאמה בין התשובות שלך לעמדות רשימה. מחזיר null אם אין על מה
// להשוות — זה שונה מ-0%, ומוצג אחרת.
function platScore(lname){
  if(!PLAT) return null;
  const st=((PLAT.lists||{})[lname]||{}).stances||{};
  let agree=0,dis=0,part=0,none=0;
  for(const [slug,my] of Object.entries(PSTANCE)){
    if(!my) continue;
    const s=st[slug];
    if(!s||!s.stance){ none++; continue; }
    if(s.stance==="partial"){ part++; continue; }
    (s.stance===my) ? agree++ : dis++;
  }
  const n=agree+dis;
  return n?{p:Math.round(agree/n*100),agree,dis,part,none,n}
          :{p:null,agree,dis,part,none,n};
}

const answered=()=>Object.values(PSTANCE).filter(Boolean).length;

function renderPlat(o){
  if(!PLAT) return o.innerHTML=`<div class="msg">platform.json לא נטען.</div>`;
  const order=PLAT.order||[];
  const names=CAND?CAND.lists:Object.keys(PLAT.lists||{});
  const scored=names.map(l=>({l,s:platScore(l)}))
    .filter(x=>x.s&&x.s.n>0)
    .sort((a,b)=>S.sort==="a"?b.s.p-a.s.p||b.s.n-a.s.n:b.s.n-a.s.n||b.s.p-a.s.p);
  $("#count").textContent=`${order.length} סוגיות · ענית על ${answered()}`;

  const head=`<div class="legend" style="padding-bottom:12px">
    <div style="color:var(--ink);font-size:15px;margin-bottom:6px">
      מה הן אומרות שיעשו — לא מה שעשו.</div>
    כל עמדה כאן לקוחה ממצע או מהצהרה מתועדת של הרשימה, עם ציטוט
    ושם המקור. המקור הוא ${esc(PLAT.source||"")}, לא הכנסת.
    <div style="margin-top:6px">זה המקום היחיד באתר שבו נספרים גם מי
      שמעולם לא כיהן: עמדה היא של הרשימה כולה, ולכן חלה גם על פנים
      חדשות.</div></div>`;

  const rank=scored.length?`<div class="sec" style="padding-top:0">
    <h3>לפי מה שהן מצהירות · ${answered()} תשובות</h3>
    ${scored.map(({l,s})=>{
      const m=(CAND&&CAND.list_meta||{})[l]||{};
      return `<div class="item" style="padding-inline:0">
        <div class="score"><span style="flex:1;font-size:15px">${esc(l)}
          ${m.letter?`<span class="pill" style="margin-inline-start:6px">${
            esc(m.letter)}</span>`:""}</span>
          <span class="n" style="color:${col(s.p)}">${s.p}%</span></div>
        <div class="bar" style="height:8px"><i class="f" style="width:${s.p}%"></i>
          <i class="a" style="flex:1"></i></div>
        <div style="font-size:11.5px;color:var(--dim);margin-top:6px">
          ${s.agree} כמוך · ${s.dis} הפוך${
          s.part?` · ${s.part} עמדה חלקית`:""}${
          s.none?` · ${s.none} בלי עמדה מתועדת`:""}</div></div>`}).join("")}
    </div>`
   :`<div class="msg">עני על השאלות למטה ואדרג את הרשימות לפיהן.</div>`;

  const body=order.map(slug=>{
    const q0=(PLAT.issues||{})[slug]||{};
    const my=PSTANCE[slug];
    const open=S.pop===slug;
    const rows=open?names.map(l=>({l,s:(((PLAT.lists||{})[l]||{}).stances||{})[slug]}))
      .filter(x=>x.s&&(x.s.stance||x.s.quote)):[];
    const grp=k=>rows.filter(x=>x.s.stance===k);
    const sect=(k,t,c)=>{const a=grp(k); return a.length?`
      <div style="margin-top:12px"><div style="font-size:11.5px;color:var(--${c})
        ">${t} · ${a.length}</div>
      ${a.map(x=>`<div style="border-bottom:1px solid var(--rule-2);padding:8px 0">
        <div style="font-size:13.5px">${esc(x.l)}</div>
        ${x.s.quote?`<div class="txt" style="font-size:12.5px;margin-top:4px">
          «${esc(x.s.quote)}»</div>`:
          `<div style="font-size:12px;color:var(--none);margin-top:4px">
           לא צוטט נוסח.</div>`}
        ${x.s.src?`<div style="font-size:11px;color:var(--none);margin-top:4px">
          ${esc(x.s.src)}</div>`:""}</div>`).join("")}</div>`:"";};
    return `<div class="sec" style="padding-inline:0">
      <div style="font-size:14.5px;line-height:1.45">${esc(q0.question||q0.short||slug)}</div>
      <div class="stance">
        <button class="f ${my==="for"?"on":""}" data-ps="${slug}" data-pv="for">אני בעד</button>
        <button class="a ${my==="against"?"on":""}" data-ps="${slug}" data-pv="against">אני נגד</button>
      </div>
      <button class="item" style="padding:9px 0 0;border:0;font-size:12px;
        color:var(--flag)" data-ex="${open?"":slug}">${
        open?"הסתר את העמדות":"מה כל רשימה אומרת"}</button>
      ${open?sect("for","בעד","for")+sect("against","נגד","against")
            +sect("partial","עמדה חלקית או מסויגת","abstain"):""}
    </div>`;}).join("");

  o.innerHTML=head+rank+`<div class="sec" style="padding-inline:0"><h3>הסוגיות</h3>
    <div class="note">בחרי עמדה בכל סוגיה שחשובה לך. סוגיה שלא ענית
    עליה פשוט לא נספרת.</div></div>`+body
   +`<div class="sec"><div class="note">העמדות רוכזו ב-${esc(PLAT.source||"")}
      מתוך מצעים והצהרות מתועדות. ${
      scored.length<names.length
      ?`ל-${names.length-scored.length} רשימות אין עמדות מתועדות והן אינן מדורגות.`
      :""} הצהרה אינה מעשה, ואין כאן בדיקה אם היא קוימה.</div></div>`;
}

// העמדות המוצהרות שנוגעות לנושאים של הצעת חוק. הקשר, לא תחזית:
// מצע מדבר על כיוון, והצבעה תלויה בנוסח — ולכן אין כאן "איך הם
// יצביעו", רק "מה הם אמרו על התחום".
function platForTopics(topicNames){
  if(!PLAT||!topicNames.length) return "";
  const set=new Set(topicNames);
  const hits=(PLAT.order||[]).filter(s=>
    ((PLAT.issues||{})[s]||{}).topics?.some(t=>set.has(t)));
  if(!hits.length) return "";
  const names=CAND?CAND.lists:Object.keys(PLAT.lists||{});
  return hits.map(slug=>{
    const q0=(PLAT.issues||{})[slug]||{};
    const rows=names.map(l=>({l,s:(((PLAT.lists||{})[l]||{}).stances||{})[slug]}))
      .filter(x=>x.s&&x.s.stance);
    if(!rows.length) return "";
    const lab={for:"בעד",against:"נגד",partial:"חלקית"};
    const cls={for:"for",against:"against",partial:"abstain"};
    return `<div style="border-bottom:1px solid var(--rule-2);padding-bottom:10px;
      margin-bottom:10px">
      <div style="font-size:13.5px;line-height:1.45">${esc(q0.question||q0.short)}</div>
      <div style="margin-top:7px;display:flex;flex-wrap:wrap;gap:5px">
        ${rows.map(x=>`<span class="pill" title="${esc(x.s.quote||"")}"
          style="color:var(--${cls[x.s.stance]})">${esc(x.l)} · ${
          lab[x.s.stance]}</span>`).join("")}</div></div>`;}).join("");
}

function renderSnap(o){
  if(!CAND) return o.innerHTML=`<div class="msg">candidates.json לא נטען.</div>`;
  let src=CAND.rows;
  if(S.faction){
    const ids=new Set(q(`SELECT DISTINCT person_id p FROM mk WHERE faction=?`,
      [S.faction]).map(x=>x.p));
    src=src.filter(r=>ids.has(r.person_id));
    if(!src.length) return o.innerHTML=`<div class="msg">
      אף מועמד לא כיהן בסיעת <b>${esc(S.faction)}</b>.</div>`;
  }
  const withRec=src.filter(r=>r.person_id);
  const pids=[...new Set(withRec.map(r=>r.person_id))];
  if(!pids.length) return o.innerHTML=`<div class="msg">אין מועמדים עם רקורד.</div>`;
  const ph=pids.map(()=>"?").join(",");
  const rec={}; pids.forEach(p=>rec[p]={f:0,a:0,tot:0,bills:0,passed:0,chair:0,cmt:0,kn:[]});
  q(`SELECT m.person_id p, m.knesset k,
       SUM(CASE WHEN r.result=1 THEN 1 ELSE 0 END) f,
       SUM(CASE WHEN r.result=2 THEN 1 ELSE 0 END) a, COUNT(r.vote_id) tot
     FROM mk m LEFT JOIN vote_result r ON r.mk_id=m.mk_id
     WHERE m.person_id IN (${ph}) GROUP BY m.mk_id`,pids)
   .forEach(x=>{const d=rec[x.p]; if(!d)return;
     d.f+=x.f||0; d.a+=x.a||0; d.tot+=x.tot||0; if(x.k)d.kn.push(x.k);});
  q(`SELECT bi.PersonID p, COUNT(*) n, SUM(b.StatusID=118) ps
     FROM kns_billinitiator bi JOIN kns_bill b ON b.Id=bi.BillID
     WHERE bi.PersonID IN (${ph}) GROUP BY 1`,pids)
   .forEach(x=>{if(rec[x.p]){rec[x.p].bills=x.n; rec[x.p].passed=x.ps||0;}});
  q(`SELECT m.person_id p, SUM(c.role='יו"ר') ch, COUNT(*) n
     FROM mk_committee c JOIN mk m ON m.mk_id=c.mk_id
     WHERE m.person_id IN (${ph}) GROUP BY 1`,pids)
   .forEach(x=>{if(rec[x.p]){rec[x.p].chair=x.ch||0; rec[x.p].cmt=x.n||0;}});

  const byList={};
  src.filter(r=>r.name).forEach(r=>(byList[r.list] ??= []).push(r));
  const lists=Object.entries(byList).map(([l,arr])=>{
    const rs=arr.filter(r=>r.person_id).map(r=>rec[r.person_id]).filter(Boolean);
    return {l,arr,n:arr.length,exp:rs.length,
      bills:rs.reduce((s,x)=>s+x.bills,0),
      passed:rs.reduce((s,x)=>s+x.passed,0),
      chair:rs.reduce((s,x)=>s+x.chair,0),
      votes:rs.reduce((s,x)=>s+x.tot,0)};
  }).sort((a,b)=>S.sort==="n"?b.n-a.n:b.exp-a.exp);

  $("#count").textContent=`${lists.length} רשימות · ${withRec.length} מתוכם עם רקורד`;
  o.innerHTML=`<div class="legend" style="padding-bottom:12px">
     מה שהאנשים שרצים היום עשו בכנסת. הרשימות כפי שהוגשו לוועדת הבחירות
     המרכזית ואושרו ב-${fmt(CAND.approved)}. הבחירות
     ב-${fmt(CAND.election)}.</div>`
   +lists.map(L=>`<div class="sec"><h3>${esc(L.l)}</h3>
     ${listHead(L.l)}
     <div class="grid" style="margin-bottom:12px">
       <div class="cell"><div class="v n">${L.n}</div><div class="k">מועמדים</div></div>
       <div class="cell"><div class="v n">${L.exp}</div><div class="k">כיהנו בעבר</div></div>
       <div class="cell"><div class="v n">${L.bills.toLocaleString()}</div><div class="k">הצעות חוק שיזמו</div></div>
       <div class="cell"><div class="v n">${L.chair}</div><div class="k">כהונות כיו״ר ועדה</div></div>
     </div>
     ${L.arr.map(r=>{
       const d=r.person_id?rec[r.person_id]:null;
       return `<button class="item withav" style="padding-inline:0;border-bottom:1px solid var(--rule-2)"
         data-c2="${encodeURIComponent(r.name)}">
         ${face(r)}<div>
         <div class="t">${r.pos?`<span class="n" style="color:var(--dim)">${r.pos}.</span> `:""}${esc(r.name)}</div>
         <div class="s">${d?
           `<span class="pill co">כנסת ${[...new Set(d.kn)].sort((x,y)=>y-x).slice(0,3).join(", ")}</span>
            <span>${d.tot.toLocaleString()} הצבעות</span>
            ${d.bills?`<span>· ${d.bills} הצעות חוק</span>`:""}
            ${d.passed?`<span>(${d.passed} עברו)</span>`:""}
            ${d.chair?`<span>· יו״ר ${d.chair} ועדות</span>`:""}`
           :r.verified==="wikipedia"?`<span class="pill">ללא רקורד בכנסת · יש ערך בוויקיפדיה</span>`
           :`<span class="pill">ללא רקורד וללא מקור</span>`}</div></div>
       </button>`}).join("")}
   </div>`).join("");
}

