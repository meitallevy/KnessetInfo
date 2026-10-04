function renderBasket(o){
  $("#count").textContent=`${BASKET.length} חוקים בסל`;
  if(!BASKET.length) return o.innerHTML=`<div class="msg">
    הסל ריק.<br><br>עברי ללשונית <b>הצבעות</b>, מצאי את החוקים שחשובים לך
    — אפשר לסנן לפי נושא ולגרור את ציר הזמן — והוסיפי אותם בכפתור <b>+</b>.
    <br><br>אחר כך סמני מה העמדה שלך בכל אחד, ותראי מי הצביע כמוך.</div>`;
  const ph=BASKET.map(()=>"?").join(",");
  const votes=q(`SELECT v.vote_id id, v.title t, v.date d,
      (SELECT b.summary FROM vote_bill b WHERE b.vote_id=v.vote_id) sm
    FROM vote_x v WHERE v.vote_id IN (${ph})`,BASKET);
  const rows=q(`SELECT r.mk_id, r.vote_id, r.result, m.name, m.faction, m.bloc,
      m.person_id FROM vote_result r JOIN mk m ON m.mk_id=r.mk_id
    WHERE r.vote_id IN (${ph})`,BASKET);
  const marked=BASKET.filter(id=>STANCE[id]);

  const byMk={};
  rows.forEach(r=>{
    (byMk[r.mk_id] ??= {nm:r.name,f:r.faction,bl:r.bloc,pid:r.person_id,v:{}})
      .v[r.vote_id]=r.result;});
  const list=Object.entries(byMk).map(([mk,d])=>{
    let agree=0,dis=0;
    marked.forEach(id=>{const g=d.v[id];
      if(g===1||g===2){ (g===STANCE[id]) ? agree++ : dis++; }});
    return {mk:+mk,...d,agree,dis,seen:marked.filter(id=>d.v[id]).length};
  }).filter(x=>x.seen>0);

  const pct=x=>Math.round(x.agree/(x.agree+x.dis||1)*100);
  const cmp=S.sort==="a"
    ? (a,b)=>pct(b)-pct(a)||b.seen-a.seen
    : (a,b)=>b.seen-a.seen||pct(b)-pct(a);
  const views=`<div class="views">${
    [["mk","ח״כים"],["fac","סיעות בזמן ההצבעה"],["list","רשימות מתמודדות"]]
      .map(([v,l])=>`<button class="${S.bview===v?"on":""}" data-bv="${v}">${l}</button>`)
      .join("")}</div>`;
  const strip=x=>`<div class="mini">${BASKET.map(id=>{
      const g=x.v[id];
      return `<i class="${g===1?"f":g===2?"a":g===3?"b":""}"></i>`;}).join("")}</div>`;

  let body="";
  if(S.bview==="mk"){
    body=[...list].sort(cmp).slice(0,120).map(x=>{const p=pct(x);
      return `<button class="item withav" style="padding-inline:0;
        border-bottom:1px solid var(--rule-2)" data-p2="${x.pid}" data-m2="${x.mk}">
        <div class="score">${avatar(x.pid,x.nm)}
          <span style="flex:1;font-size:14.5px">${esc(x.nm)}
            <span style="color:var(--dim);font-size:12px">${esc(x.f)}</span></span>
          <span class="n" style="color:${col(p)}">${p}%</span></div>${strip(x)}
        <div style="font-size:11.5px;color:var(--dim);margin-top:5px">
          ${x.agree} כמוך · ${x.dis} הפוך · הצביע ב-${x.seen} מתוך ${BASKET.length}</div>
      </button>`}).join("");
  } else if(S.bview==="fac"){
    // הסיעה שבה כיהן באותה קדנציה, לא הרשימה שהוא רץ בה היום
    const g={};
    list.forEach(x=>{const d=g[x.f] ??= {f:x.f,bl:x.bl,agree:0,dis:0,n:0};
      d.agree+=x.agree; d.dis+=x.dis; d.n++;});
    body=Object.values(g).sort(cmp).map(d=>{const p=pct(d);
      return `<div class="item" style="padding-inline:0">
        <div class="score"><span style="flex:1;font-size:15px">${esc(d.f)}
          <span class="pill ${d.bl==="coalition"?"co":"op"}"
            style="margin-inline-start:6px">${
            d.bl==="coalition"?"קואליציה":"אופוזיציה"}</span></span>
          <span class="n" style="color:${col(p)}">${p}%</span></div>
        <div class="bar" style="height:8px"><i class="f" style="width:${p}%"></i>
          <i class="a" style="flex:1"></i></div>
        <div style="font-size:11.5px;color:var(--dim);margin-top:6px">
          ${d.n} ח״כים · ${d.agree} הצבעות כמוך · ${d.dis} הפוך</div></div>`}).join("");
  } else {
    if(!CAND){ body=`<div class="msg">candidates.json לא נטען.</div>`; }
    else{
      const best={};
      list.forEach(x=>{const c=best[x.pid];
        if(!c||x.seen>c.seen) best[x.pid]=x;});
      const g={};
      CAND.rows.forEach(r=>{
        const x=r.person_id&&best[r.person_id];
        if(!x) return;
        const d=g[r.list] ??= {l:r.list,members:[]};
        d.members.push({nm:r.name,pid:r.person_id,mk:x.mk,p:pct(x),
                        seen:x.seen,pos:r.pos});});
      const lists=Object.values(g);
      lists.forEach(d=>{
        d.members.sort((a,b)=>b.p-a.p||b.seen-a.seen);
        // ניקוד נטו: כל מועמד תורם בין 1- ל-1+ סביב 50%.
        // כך שלושה ב-100% מנצחים שניים ב-100%, אבל חמישה ב-0%
        // מוחקים אותם. השוואה איבר-איבר מלמעלה עשתה את ההפך —
        // היא תגמלה על תוספת מועמדים גרועים.
        d.net=d.members.reduce((s,m)=>s+(m.p-50)/50,0);
        d.hi=d.members.filter(m=>m.p>=80).length;
        d.lo=d.members.filter(m=>m.p<=20).length;
        d.avg=Math.round(d.members.reduce((s,m)=>s+m.p,0)/d.members.length);
      });
      lists.sort((a,b)=>b.net-a.net||b.hi-a.hi||a.lo-b.lo);
      const show=d=>d.members.length<=12 ? d.members
        : [...d.members.slice(0,8),{gap:d.members.length-11},
           ...d.members.slice(-3)];
      body=lists.length?lists.map(d=>`<div class="sec" style="padding-inline:0">
        <h3>${esc(d.l)}</h3>
        <div class="split" style="height:9px;margin:-4px 0 8px">
          ${d.members.map(m=>`<i class="${m.p>=80?"f":m.p<=20?"a":"b"}"
            style="flex:1"></i>`).join("")}</div>
        <div style="display:flex;font-size:11.5px;color:var(--dim);margin-bottom:10px">
          <span style="flex:1">${d.members.length} עם רקורד ·
            <span style="color:var(--for)">${d.hi} מעל 80%</span> ·
            <span style="color:var(--against)">${d.lo} מתחת ל-20%</span></span>
          <span class="n">נטו ${d.net>0?"+":""}${d.net.toFixed(1)}</span></div>
        ${(()=>{const s=platScore(d.l);
          return s&&s.n?`<div style="font-size:11.5px;color:var(--dim);
            margin:-4px 0 10px">לפי המצע:
            <span class="n" style="color:${col(s.p)}">${s.p}%</span>
            <span style="color:var(--none)"> · ${s.n} סוגיות · הצהרה, לא הצבעה</span>
            </div>`:"";})()}
        ${show(d).map(m=>m.gap?`<div style="font-size:11.5px;color:var(--none);
          padding:6px 0;border-bottom:1px solid var(--rule-2)">
          ועוד ${m.gap} מועמדים באמצע</div>`
          :`<button class="item withav"
          style="padding:8px 0;border-bottom:1px solid var(--rule-2)"
          data-p2="${m.pid}" data-m2="${m.mk}">${avatar(m.pid,m.nm)}<div>
          <div style="display:flex;font-size:14px"><span style="flex:1">${
            m.pos?`<span class="n" style="color:var(--dim)">${m.pos}.</span> `:""}${
            esc(m.nm)}</span>
            <span class="n" style="color:${col(m.p)}">${m.p}%</span></div>
          <div style="font-size:11px;color:var(--dim);margin-top:3px">
            הצביע ב-${m.seen} מתוך ${BASKET.length}</div></div></button>`).join("")}
      </div>`).join("")
       :`<div class="msg">אף מועמד ברשימות לא הצביע על החוקים שבסל.</div>`;
      // רשימות שאיש בהן לא כיהן אינן חסרות דעה — הן פשוט לא
      // הצביעו מעולם. אם ענית על שאלות המצע, הן נמדדות שם.
      const rest=(CAND.lists||[]).filter(l=>!g[l])
        .map(l=>({l,s:platScore(l)})).filter(x=>x.s&&x.s.n)
        .sort((a,b)=>b.s.p-a.s.p);
      if(rest.length) body+=`<div class="sec" style="padding-inline:0">
        <h3>בלי רקורד בכנסת · לפי המצע בלבד</h3>
        <div class="note" style="margin-bottom:10px">לרשימות האלה אין
        אף מועמד שהצביע על החוקים שבסל. המספר הוא התאמה למה שהן
        מצהירות, ולא למה שעשו — ואי אפשר להשוות בין השניים.</div>
        ${rest.map(({l,s})=>`<div class="item" style="padding-inline:0">
          <div class="score"><span style="flex:1;font-size:14px">${esc(l)}</span>
            <span class="n" style="color:${col(s.p)}">${s.p}%</span></div>
          <div style="font-size:11px;color:var(--dim);margin-top:4px">
            ${s.agree} כמוך · ${s.dis} הפוך · מתוך ${s.n} סוגיות</div>
          </div>`).join("")}</div>`;
      else if(!answered()) body+=`<div class="sec"><div class="note">
        רשימות שאיש בהן לא כיהן אינן מופיעות כאן — אין להן הצבעות.
        בלשונית <b>מצעים</b> אפשר לענות על סוגיות ולדרג גם אותן.</div></div>`;
    }
  }

  o.innerHTML=`<div class="sec"><h3>החוקים שבחרת</h3>${votes.map(v=>`
     <div style="border-bottom:1px solid var(--rule-2);padding-bottom:12px;
       margin-bottom:12px">
       <div style="display:flex;gap:10px">
         <button class="add on" data-rm="${v.id}">✓</button>
         <div style="flex:1">
           <div style="font-size:14px;line-height:1.4">${v.t}</div>
           ${v.sm?`<div style="font-size:12px;color:var(--dim);margin-top:4px;
             display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
             overflow:hidden">${v.sm}</div>`:""}
           <div class="stance">
             <button class="f ${STANCE[v.id]===1?"on":""}" data-st="${v.id}" data-p="1">אני בעד</button>
             <button class="a ${STANCE[v.id]===2?"on":""}" data-st="${v.id}" data-p="2">אני נגד</button>
           </div>
         </div></div></div>`).join("")}</div>
   ${marked.length?views+`<div class="sec" style="padding-top:0">
     <h3>מי הצביע כמוך · ${marked.length} מתוך ${BASKET.length} סומנו</h3>
     ${body}</div>`
    :`<div class="msg">סמני <b>אני בעד</b> או <b>אני נגד</b> בכל חוק,
        ואחשב מי הצביע כמוך.</div>`}`;
}

