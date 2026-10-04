const CACHE=new Map();
const sig=()=>[S.tab,S.faction,S.topic,S.d0,S.d1,S.sort,S.bview,S.pop,
  BASKET.length,Object.keys(STANCE).length,
  Object.entries(PSTANCE).map(x=>x.join(":")).join(",")].join("|");
function render(){
  const o=$("#out");
  const key=sig(), hit=CACHE.get(key);
  if(hit){ o.innerHTML=hit.html; $("#count").textContent=hit.count;
    $("#sort").innerHTML=hit.sort; $("#sort").value=hit.sv; bindOut(); return; }
  $("#sort").innerHTML={
    answer:`<option value="n">מיון: מספר הצבעות</option>
            <option value="f">מיון: אחוז בעד</option>`,
    votes:`<option value="d">מיון: מהחדש לישן</option>
           <option value="g">מיון: הכי צמוד</option>`,
    people:`<option value="n">מיון: שם</option>
            <option value="v">מיון: הצבעות</option>`,
    cand:`<option value="p">מיון: לפי רשימה</option>
          <option value="k">מיון: בעלי רקורד תחילה</option>`,
    basket:`<option value="a">מיון: אחוזי התאמה</option>
            <option value="m">מיון: מספר הצבעות רלוונטיות</option>`,
    plat:`<option value="a">מיון: אחוזי התאמה</option>
          <option value="m">מיון: לפי מספר העמדות המתועדות</option>`,
    snap:`<option value="r">מיון: לפי מספר מכהנים</option>
          <option value="n">מיון: לפי גודל הרשימה</option>`}[S.tab];
  // מיון תקף לטאב הנוכחי בלבד; אחרת נופל לברירת המחדל שלו
  const opts=[...$("#sort").options].map(o=>o.value);
  if(!opts.includes(S.sort)) S.sort=opts[0];
  $("#sort").value=S.sort;
  // אם רינדור נכשל, להגיד את זה במקום להשאיר את התוכן הקודם על המסך
  try{
    ({answer:renderAnswer,votes:renderVotes,basket:renderBasket,
      plat:renderPlat,people:renderPeople,cand:renderCand,
      snap:renderSnap})[S.tab](o);
    bindOut();
    CACHE.set(key,{html:o.innerHTML,count:$("#count").textContent,
      sort:$("#sort").innerHTML,sv:$("#sort").value});
    if(CACHE.size>40) CACHE.delete(CACHE.keys().next().value);
  }catch(err){
    console.error(err);
    o.innerHTML=`<div class="msg">התצוגה נכשלה.<br>
      <span style="color:var(--against);font-size:12px">${err.message}</span></div>`;
    $("#count").textContent="שגיאה";
  }
}

function renderAnswer(o){
  const rows=q(`SELECT m.faction f, m.bloc bl,
      SUM(r.result=1) yes, SUM(r.result=2) no,
      SUM(r.result=3) abs, SUM(r.result NOT IN (1,2,3)) oth
    FROM vote_result r JOIN vote_x v ON v.vote_id=r.vote_id
    JOIN mk m ON m.mk_id=r.mk_id
    WHERE 1=1 ${dateFilter()} ${topicFilter()}
      ${S.faction?`AND m.faction='${S.faction.replace(/'/g,"''")}'`:""}
    GROUP BY m.faction HAVING yes+no+abs>0`);
  const nv=one(`SELECT COUNT(*) FROM vote_x v WHERE 1=1 ${dateFilter()} ${topicFilter()}`);
  $("#count").textContent=`${nv.toLocaleString()} הצבעות בטווח`;
  $("#hint").textContent=S.topic
    ? `הנושא נקבע לפי מילות מפתח בכותרת הרשמית של ההצבעה.`
    : `בחרי נושא כדי לצמצם, או גררי את ציר הזמן.`;
  if(!rows.length) return o.innerHTML=
    `<div class="msg">אין הצבעות שעונות על הסינון.<br>נסי טווח רחב יותר או נושא אחר.</div>`;
  rows.sort((a,b)=>S.sort==="f"
    ? b.yes/(b.yes+b.no||1)-a.yes/(a.yes+a.no||1)
    : (b.yes+b.no+b.abs)-(a.yes+a.no+a.abs));
  o.innerHTML=`<div class="legend">
    <span><b style="background:var(--for)"></b>בעד</span>
    <span><b style="background:var(--against)"></b>נגד</span>
    <span><b style="background:var(--abstain)"></b>נמנע</span>
    <span><b style="background:var(--none)"></b>אחר</span></div>`
   +rows.map(r=>{
    const t=r.yes+r.no+r.abs+r.oth, p=x=>x/t*100;
    return `<div class="fac">
      <div class="top"><span class="nm">${esc(r.f)}</span>
        <span class="pill ${r.bl==="coalition"?"co":"op"}">${
          r.bl==="coalition"?"קואליציה":"אופוזיציה"}</span></div>
      <div class="split">
        ${r.yes?`<i class="f" style="width:${p(r.yes)}%"><span>${r.yes}</span></i>`:""}
        ${r.no?`<i class="a" style="width:${p(r.no)}%"><span>${r.no}</span></i>`:""}
        ${r.abs?`<i class="b" style="width:${p(r.abs)}%"></i>`:""}
        ${r.oth?`<i class="o" style="width:${p(r.oth)}%"></i>`:""}
      </div>
      <div class="tot" style="margin-top:7px">${t.toLocaleString()} הצבעות ·
        ${Math.round(r.yes/(r.yes+r.no||1)*100)}% בעד מתוך המכריעות</div>
    </div>`}).join("");
}

function renderVotes(o){
  const ord=S.sort==="g"
    ? "ABS(v.n_for-v.n_against) ASC, v.date DESC" : "v.date DESC";
  const rows=q(`SELECT v.vote_id id, v.title t, v.date d, v.knesset k,
      v.n_for f, v.n_against a, v.no_confidence nc,
      (SELECT b.summary FROM vote_bill b WHERE b.vote_id=v.vote_id) sm
    FROM vote_x v WHERE v.title IS NOT NULL ${dateFilter()} ${topicFilter()}
    ${S.faction?`AND v.vote_id IN (SELECT r.vote_id FROM vote_result r
       JOIN mk m ON m.mk_id=r.mk_id WHERE m.faction='${S.faction.replace(/'/g,"''")}')`:""}
    ORDER BY ${ord} LIMIT 300`);
  $("#count").textContent=`${rows.length} הצבעות מוצגות`;
  if(!rows.length) return o.innerHTML=`<div class="msg">אין הצבעות בטווח.</div>`;
  o.innerHTML=rows.map(r=>`<div class="item" style="display:flex;gap:10px">
    <button class="add ${inBasket(r.id)?"on":""}" data-add="${r.id}"
      title="הוספה לסל">${inBasket(r.id)?"✓":"+"}</button>
    <button style="flex:1;text-align:start" data-v="${r.id}">
    <div class="t">${esc(r.t)}</div>
    ${r.sm?`<div style="font-size:12.5px;color:var(--dim);line-height:1.5;
      margin-top:5px;display:-webkit-box;-webkit-line-clamp:2;
      -webkit-box-orient:vertical;overflow:hidden">${r.sm}</div>`:""}
    <div class="s"><span>${fmt(r.d)}</span><span>·</span><span>כנסת ${r.k}</span>
      ${r.nc?'<span class="pill">אי־אמון</span>':""}
      <span class="pill f">${r.f} בעד</span><span class="pill a">${r.a} נגד</span></div>
    <div class="bar"><i class="f" style="width:${r.f/(r.f+r.a||1)*100}%"></i>
      <i class="a" style="flex:1"></i></div>
    </button></div>`).join("");
}

function renderPeople(o){
  // שורה לאדם, לא לאדם-בקדנציה. אחרת אבי דיכטר מופיע ארבע פעמים.
  const rows=q(`WITH cnt AS (
      SELECT r.mk_id, COUNT(*) nv FROM vote_result r
      JOIN vote_x v ON v.vote_id=r.vote_id
      WHERE 1=1 ${dateFilter()} ${topicFilter()} GROUP BY r.mk_id)
    SELECT m.person_id pid, m.name nm,
      MAX(m.knesset) lastk, COUNT(*) nk,
      GROUP_CONCAT(DISTINCT m.knesset) ks,
      SUM(COALESCE(c.nv,0)) nv,
      MAX(m.mk_id) anymk,
      (SELECT x.faction FROM mk x WHERE x.person_id=m.person_id
        ORDER BY x.knesset DESC LIMIT 1) f,
      (SELECT x.bloc FROM mk x WHERE x.person_id=m.person_id
        ORDER BY x.knesset DESC LIMIT 1) bl,
      (SELECT x.mk_id FROM mk x WHERE x.person_id=m.person_id
        ORDER BY x.knesset DESC LIMIT 1) mk,
      MAX(m.is_faction_chair) ch
    FROM mk m LEFT JOIN cnt c ON c.mk_id=m.mk_id
    WHERE m.knesset IN (SELECT DISTINCT knesset FROM vote_x)
      ${S.faction?`AND m.person_id IN (SELECT person_id FROM mk
         WHERE faction='${S.faction.replace(/'/g,"''")}')`:""}
    GROUP BY m.person_id
    ORDER BY ${S.sort==="v"?"nv DESC":"m.name"} LIMIT 400`);
  $("#count").textContent=`${rows.length} ח״כים`;
  if(!rows.length) return o.innerHTML=`<div class="msg">אין ח״כים שעונים לסינון.</div>`;
  o.innerHTML=rows.map(r=>{
    const ks=(r.ks||"").split(",").map(Number).sort((a,b)=>b-a);
    return `<button class="item withav" data-p="${r.pid}" data-m="${r.mk}">
    ${avatar(r.pid,r.nm)}<div>
    <div class="t">${esc(r.nm)}</div>
    <div class="s"><span>${esc(r.f)}</span>
      <span class="pill ${r.bl==="coalition"?"co":"op"}">${
        r.bl==="coalition"?"קואליציה":"אופוזיציה"}</span>
      <span>כנסת ${ks.join(", ")}</span>
      ${r.ch?'<span class="pill">יו״ר סיעה</span>':""}
      <span>· ${r.nv.toLocaleString()} הצבעות בטווח</span></div></div>
  </button>`}).join("");
}

function renderCand(o){
  if(!CAND) return o.innerHTML=`<div class="msg">candidates.json לא נטען.</div>`;
  let rows=CAND.rows.filter(r=>r.name);
  // הסינון העליון הוא סיעה בכנסת; על מועמדים הוא מתפרש כ"מי שכיהן בה"
  if(S.faction){
    const ids=new Set(q(`SELECT DISTINCT person_id p FROM mk WHERE faction=?`,
      [S.faction]).map(x=>x.p));
    rows=rows.filter(r=>ids.has(r.person_id));
    if(!rows.length) return o.innerHTML=`<div class="msg">
      אף מועמד ברשימות לא כיהן בסיעת <b>${esc(S.faction)}</b>.<br>
      אפשר לנקות את הסינון למעלה.</div>`;
  }
  if(S.sort==="k") rows=[...rows].sort((a,b)=>
    (b.verified==="knesset")-(a.verified==="knesset"));
  const byList={};
  rows.forEach(r=>(byList[r.list]??=[]).push(r));
  $("#count").textContent=`${rows.length} מועמדים · ${Object.keys(byList).length} רשימות`;
  o.innerHTML=`<div class="legend" style="padding-bottom:10px">${CAND.note||""}</div>`
   +Object.entries(byList).map(([l,arr])=>
    `<div class="sec"><h3>${esc(l)}</h3>${listHead(l)}${arr.map(r=>`
      <button class="item withav" style="padding-inline:0;border:0"
        data-c="${encodeURIComponent(r.name)}">
        ${face(r)}<div>
        <div class="t">${r.pos?`<span class="n" style="color:var(--dim)">${r.pos}.</span> `:""}${esc(r.name)}</div>
        <div class="s">${
          r.verified==="knesset"?'<span class="pill co">רקורד בכנסת</span>':
          r.profile&&r.profile.desc?'<span class="pill">פרופיל</span>':
          r.verified==="wikipedia"?'<span class="pill">ויקיפדיה</span>':
          '<span class="pill">ללא מקור</span>'}
          ${r.knessets?`<span>כנסת ${r.knessets.slice(0,4).join(", ")}</span>`:""}
          ${r.profile&&r.profile.roles&&r.profile.roles.length
            ?`<span>${esc(r.profile.roles.slice(0,3).join(" · "))}</span>`
            :r.wiki&&r.wiki.cats&&r.wiki.cats.length
            ?`<span>${esc(r.wiki.cats.slice(0,2).join(" · "))}</span>`:""}</div></div>
      </button>`).join("")}</div>`).join("");
}

const col=p=>p>=70?"var(--for)":p>=50?"var(--abstain)":"var(--against)";
