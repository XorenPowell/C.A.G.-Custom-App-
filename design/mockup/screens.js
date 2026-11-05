/* Screen renderers. Each returns an HTML string; app.js owns routing. */
const esc = (s) => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money = (n) => (n<0?"-":"")+"$"+Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const toneOf = (s) => s==="overdue"?"b-red":s==="today"?"b-amber":s==="none"?"":"";
const clsOf  = (s) => s==="overdue"?"od":s==="today"?"due":"ok";

/* ===================== HOME — the work queue ========================== */
function screenHome(state){
  const callsOver = partnerships.filter(p=>followState(p)==="overdue");
  const callsToday= partnerships.filter(p=>followState(p)==="today");
  const calls = [...callsOver, ...callsToday];
  const jobCalls = jobs.filter(j=>j.follow_up && days(TODAY,j.follow_up)<=0);
  const restocks = safcAll().filter(p=>["overdue","today"].includes(safcDueState(p)))
    .sort((a,b)=>a.safc_due.localeCompare(b.safc_due));
  const todayJobs = jobs.filter(j=>j.arrival===TODAY);
  const noAction = partnerships.filter(p=>!p.follow_up_at);
  const tab = state.tab || "calls";

  const queueItem = (when,whenCls,title,sub,actions,href) => `
    <div class="q">
      <div class="q-when ${whenCls}">${when}</div>
      <div class="q-body">
        <div class="trunc"><a href="${href}" style="font-weight:600">${title}</a></div>
        <div class="muted trunc" style="font-size:12.5px">${sub}</div>
      </div>
      <div class="q-act">${actions}</div>
    </div>`;

  const callBtns = `<button class="btn sm">Call</button><button class="btn sm">Log</button>`;
  const restockBtns = `<button class="btn sm">Restocked</button>`;

  let body = "";
  if(tab==="calls"){
    body = [
      ...calls.map(p=>queueItem(relDue(p.follow_up_at), clsOf(followState(p)),
        esc(p.name), `${esc(p.follow_up_note||"Follow-up")} &middot; ${esc(p.zone)} &middot; last contact ${fmt(p.last_contact)}`,
        callBtns, `#/partnership/${p.id}`)),
      ...jobCalls.map(j=>queueItem(relDue(j.follow_up), clsOf(days(TODAY,j.follow_up)<0?"overdue":"today"),
        `${esc(j.customer)} <span class="badge b-blue">JOB</span>`,
        `${esc(j.service)} &middot; ${esc(j.job_id)} &middot; ${esc(j.phone)}`, callBtns, `#/jobs`)),
    ].join("") || `<div class="pad muted">Nothing due. Nice.</div>`;
  } else if(tab==="restock"){
    body = restocks.map(p=>queueItem(relDue(p.safc_due), clsOf(safcDueState(p)),
      esc(p.name), `${esc(p.safc.location)} &middot; ~${p.safc.cards_left} cards left &middot; every ${p.safc.interval_days}d`,
      restockBtns, `#/partnership/${p.id}`)).join("") || `<div class="pad muted">No restocks due.</div>`;
  } else if(tab==="jobs"){
    body = todayJobs.map(j=>queueItem(j.arrival_time,"ok",
      `${esc(j.customer)} &middot; ${esc(j.service)}`,
      `${esc(j.job_id)} &middot; ${esc(j.workers)} &middot; ${money(j.invoice)}`,
      `<button class="btn sm">Text</button>`, `#/jobs`)).join("") || `<div class="pad muted">No jobs today.</div>`;
  } else {
    body = noAction.map(p=>queueItem("—","od", esc(p.name),
      `${esc(p.stage)} &middot; ${esc(p.zone)} &middot; last contact ${fmt(p.last_contact)}`,
      `<button class="btn sm pri">Schedule</button>`, `#/partnership/${p.id}`)).join("");
  }

  const tabPill=(k,label,n,tone)=>`<button class="pill ${tab===k?"on":""}" data-tab="${k}">${label} <span class="n ${tone||""}">${n}</span></button>`;

  return `
  <div class="row wrap mb" style="justify-content:space-between">
    <div>
      <h1 style="font-size:21px">${fmtLong(TODAY)}</h1>
      <div class="muted" style="font-size:13px">Everything that needs you today, in one list.</div>
    </div>
    <div class="row">
      <a class="btn" href="#/safc">SAFC campaign</a>
      <a class="btn pri" href="#/jobs">+ New job</a>
    </div>
  </div>

  <div class="grid g4 mb">
    ${tile("Calls due", calls.length+jobCalls.length, callsOver.length? `${callsOver.length} overdue`:"on track", callsOver.length?"od":"ok")}
    ${tile("Restocks due", restocks.length, "SAFC placements", restocks.length?"due":"ok")}
    ${tile("Jobs today", todayJobs.length, "booked arrivals","ok")}
    ${tile("No next action", noAction.length, "partnerships adrift", noAction.length?"od":"ok")}
  </div>

  <div class="card">
    <div class="sect"><span>Work queue</span></div>
    <div class="pad" style="padding-bottom:0">
      <div class="row wrap mb-s" id="qtabs">
        ${tabPill("calls","Calls",calls.length+jobCalls.length, callsOver.length?"od":"")}
        ${tabPill("restock","Restocks",restocks.length)}
        ${tabPill("jobs","Jobs today",todayJobs.length)}
        ${tabPill("none","No next action",noAction.length, noAction.length?"od":"")}
      </div>
    </div>
    <div>${body}</div>
  </div>

  <div class="note mt"><b>What changed:</b> Home was two lists (Booked Today, Calls Today) that only knew about
  jobs. Partnerships had callbacks but nowhere to surface them. This merges both into one queue, adds the SAFC
  restock run, and adds a <b>No next action</b> tab &mdash; the records quietly leaking out of your pipeline.</div>`;
}
function tile(label,val,sub,cls){
  return `<div class="card pad">
    <div class="muted" style="font:700 10px var(--sans);letter-spacing:.8px;text-transform:uppercase">${label}</div>
    <div class="mono ${cls==="od"?"od":cls==="due"?"due":""}" style="font-size:27px;font-weight:800;line-height:1.2">${val}</div>
    <div class="faint" style="font-size:12px">${sub}</div>
  </div>`;
}

/* ===================== PARTNERSHIPS LIST ============================== */
function screenPartnerships(state){
  const view = state.view||"all";
  const sort = state.sort||"follow";
  let rows = partnerships.slice();

  if(view==="due")    rows = rows.filter(p=>["overdue","today"].includes(followState(p)));
  if(view==="over")   rows = rows.filter(p=>followState(p)==="overdue");
  if(view==="none")   rows = rows.filter(p=>!p.follow_up_at);
  if(view==="never")  rows = rows.filter(p=>!p.last_contact);
  if(view==="safc")   rows = rows.filter(p=>p.safc);
  if(state.zone)  rows = rows.filter(p=>p.zone===state.zone);
  if(state.stage) rows = rows.filter(p=>p.stage===state.stage);
  if(state.q){ const n=state.q.toLowerCase();
    rows = rows.filter(p=>p.name.toLowerCase().includes(n)||p.biz_type.toLowerCase().includes(n)); }

  const S={ follow:(a,b)=>(a.follow_up_at||"9999").localeCompare(b.follow_up_at||"9999"),
            last:(a,b)=>(b.last_contact||"").localeCompare(a.last_contact||""),
            lastOld:(a,b)=>(a.last_contact||"0000").localeCompare(b.last_contact||"0000"),
            name:(a,b)=>a.name.localeCompare(b.name),
            ref:(a,b)=>b.referrals-a.referrals };
  rows.sort(S[sort]||S.follow);

  const v=(k,l,n)=>`<button class="pill ${view===k?"on":""}" data-view="${k}">${l} <span class="n">${n}</span></button>`;
  const opt=(val,cur,label)=>`<option value="${val}" ${cur===val?"selected":""}>${label}</option>`;

  return `
  <div class="row wrap mb" style="justify-content:space-between">
    <h1 style="font-size:21px">Partnerships</h1>
    <div class="row"><a class="btn" href="#/contacts">Contacts</a><a class="btn" href="#/safc">SAFC</a>
    <button class="btn pri">+ New</button></div>
  </div>

  <div class="row wrap mb-s" id="pviews">
    ${v("all","All",partnerships.length)}
    ${v("due","Due now",partnerships.filter(p=>["overdue","today"].includes(followState(p))).length)}
    ${v("over","Overdue",partnerships.filter(p=>followState(p)==="overdue").length)}
    ${v("none","No next action",partnerships.filter(p=>!p.follow_up_at).length)}
    ${v("never","Never contacted",partnerships.filter(p=>!p.last_contact).length)}
    ${v("safc","SAFC",safcAll().length)}
  </div>

  <div class="card pad mb">
    <div class="grid g4">
      <div><label class="lab">Search</label><input id="pq" value="${esc(state.q||"")}" placeholder="Business or type"></div>
      <div><label class="lab">Zone</label><select id="pzone">
        <option value="">All zones</option>${ZONES.map(z=>opt(z,state.zone,z)).join("")}</select></div>
      <div><label class="lab">Stage</label><select id="pstage">
        <option value="">All stages</option>${STAGES.map(s=>opt(s,state.stage,s)).join("")}</select></div>
      <div><label class="lab">Sort by</label><select id="psort">
        ${opt("follow",sort,"Next follow-up")}${opt("last",sort,"Last contact (newest)")}
        ${opt("lastOld",sort,"Last contact (oldest)")}${opt("name",sort,"Business name")}
        ${opt("ref",sort,"Referrals")}</select></div>
    </div>
  </div>

  <div class="muted mb-s" style="font-size:13px">${rows.length} of ${partnerships.length}</div>

  <div class="card"><div class="scroll"><table>
    <thead><tr><th>Business</th><th>Stage</th><th>Zone</th><th>Last contact</th>
    <th>Next follow-up</th><th>SAFC</th><th>Refs</th><th>Revenue</th></tr></thead>
    <tbody>${rows.map(p=>{
      const fs=followState(p), ss=p.safc?safcDueState(p):"none";
      const cCount=contacts.filter(c=>c.partnership_id===p.id).length;
      return `<tr>
        <td><a href="#/partnership/${p.id}" style="color:var(--accent);font-weight:600">${esc(p.name)}</a>
          <div class="faint" style="font-size:11.5px">${esc(p.biz_type)} &middot; ${cCount} contact${cCount===1?"":"s"}</div></td>
        <td><span class="badge ${p.stage==="Mature"?"b-green":p.stage==="Developing"?"b-blue":""}">${p.stage}</span></td>
        <td class="muted">${esc(p.zone)}</td>
        <td class="mono ${!p.last_contact?"od":""}">${p.last_contact?fmt(p.last_contact):"never"}</td>
        <td>${p.follow_up_at
            ? `<span class="badge ${toneOf(fs)}">${relDue(p.follow_up_at)}</span><div class="faint" style="font-size:11px">${fmt(p.follow_up_at)}</div>`
            : `<span class="badge b-red">not set</span>`}</td>
        <td>${p.safc?`<span class="badge ${ss==="overdue"?"b-red":ss==="today"?"b-amber":"b-safc"}">${relDue(p.safc_due)}</span>`
            :`<span class="faint">—</span>`}</td>
        <td class="mono">${p.referrals||"—"}</td>
        <td class="mono">${p.revenue?money(p.revenue):"—"}</td>
      </tr>`;}).join("")}</tbody>
  </table></div></div>

  <div class="note mt"><b>Removed:</b> the zone-maturity meter and the zone lock that came with it &mdash; Zone is now
  an ordinary filter alongside everything else. <b>Added:</b> saved views, sort by last contact (both directions), and
  <b>not set</b> rendered in red so a partnership with no scheduled next step is impossible to miss.</div>`;
}

/* ===================== PARTNERSHIP DETAIL ============================= */
function screenPartnership(id){
  const p = partnerships.find(x=>x.id===id); if(!p) return `<div class="pad">Not found</div>`;
  const cs = contacts.filter(c=>c.partnership_id===p.id);
  const lg = (logs[p.id]||[]).sort((a,b)=>b.date.localeCompare(a.date));
  const fs = followState(p), ss = p.safc?safcDueState(p):"none";

  return `
  <div class="row wrap mb-s"><a class="btn sm" href="#/partnerships">‹ Partnerships</a></div>
  <div class="row wrap mb" style="justify-content:space-between;align-items:flex-start">
    <div><h1 style="font-size:22px">${esc(p.name)}</h1>
      <div class="muted" style="font-size:13px">${esc(p.biz_type)} &middot; ${esc(p.address)} &middot; ${esc(p.zone)}</div>
      <div class="mt" style="margin-top:7px">
        <span class="badge ${p.stage==="Mature"?"b-green":p.stage==="Developing"?"b-blue":""}">${p.stage}</span>
        <span class="badge">${esc(p.tier)}</span>
        ${p.safc?`<span class="badge b-safc">SAFC</span>`:""}
      </div></div>
    <div class="row"><button class="btn">Edit</button><button class="btn pri">Log contact</button></div>
  </div>

  <div class="grid g2 mb">
    <div class="card new">
      <div class="sect"><span>Next action</span><span class="badge ${toneOf(fs)}">${relDue(p.follow_up_at)}</span></div>
      <div class="pad">
        <div class="grid g2">
          <div><label class="lab">Call back on</label><input type="date" value="${p.follow_up_at||""}"></div>
          <div><label class="lab">At</label><input type="time" value="09:00"></div>
        </div>
        <div class="field"><label class="lab">What for</label>
          <input value="${esc(p.follow_up_note||"")}" placeholder="Ask about Q1 referral push"></div>
        <div class="row wrap">
          <button class="btn sm">Tomorrow</button><button class="btn sm">+3 days</button>
          <button class="btn sm">+1 week</button><button class="btn sm">+1 month</button>
        </div>
        <div class="note" style="margin-bottom:0"><b>Log &amp; schedule next</b> closes the current call and sets the
        following one in a single step, so a partnership can never end a conversation with nothing booked.</div>
      </div>
    </div>

    <div class="card ${p.safc?"new":""}">
      <div class="sect"><span>Stack At Front placement</span>
        ${p.safc?`<span class="badge ${ss==="overdue"?"b-red":ss==="today"?"b-amber":"b-safc"}">restock ${relDue(p.safc_due)}</span>`:""}</div>
      <div class="pad">
        ${p.safc?`
        <div class="grid g2">
          <div><label class="lab">Where it sits</label><input value="${esc(p.safc.location)}"></div>
          <div><label class="lab">Placed on</label><input type="date" value="${p.safc.placed_on}"></div>
          <div><label class="lab">Restock every (days)</label><input type="number" value="${p.safc.interval_days}"></div>
          <div><label class="lab">Cards left (est.)</label><input type="number" value="${p.safc.cards_left}"></div>
        </div>
        <div class="row wrap"><button class="btn sm pri">Restocked today</button>
          <button class="btn sm">Photo</button><button class="btn sm danger">Remove placement</button></div>
        <div class="faint mt" style="font-size:12px">Last restocked ${fmt(p.safc.last_restock)}
          &middot; ${days(p.safc.placed_on,TODAY)} days in place</div>`
        :`<div class="muted mb">No stack placed here yet.</div>
          <button class="btn pri">+ Add SAFC placement</button>`}
      </div>
    </div>
  </div>

  <div class="card mb">
    <div class="sect"><span>Contacts (${cs.length})</span><button class="btn sm">+ Add contact</button></div>
    <div class="scroll"><table>
      <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Source</th><th></th></tr></thead>
      <tbody>${cs.map(c=>`<tr>
        <td style="font-weight:600">${esc(c.name)}</td>
        <td><span class="badge">${esc(c.role)}</span></td>
        <td class="muted" style="font-size:12.5px">${esc(c.email)}</td>
        <td class="mono" style="font-size:12.5px">${esc(c.phone)}</td>
        <td class="faint" style="font-size:12px">${esc(c.source)}</td>
        <td><button class="btn sm">Call</button></td></tr>`).join("")}</tbody>
    </table></div>
  </div>

  <div class="grid g2">
    <div class="card new">
      <div class="sect"><span>Activity log</span><button class="btn sm">+ Entry</button></div>
      <div class="pad">${lg.map(l=>`
        <div class="log"><div class="dot ${l.kind}"></div>
          <div class="grow"><div class="row" style="justify-content:space-between">
            <b style="font-size:13px">${l.outcome}</b><span class="faint mono" style="font-size:12px">${fmt(l.date)}</span></div>
            <div class="faint" style="font-size:11.5px;text-transform:capitalize">${l.kind}</div>
            ${l.note?`<div class="muted" style="font-size:12.5px;margin-top:3px">${esc(l.note)}</div>`:""}
          </div></div>`).join("")}
      </div>
    </div>
    <div class="card">
      <div class="sect"><span>Referrals</span></div>
      <div class="pad">
        <div class="grid g2 mb">
          <div><div class="faint" style="font-size:11px">JOBS REFERRED</div><div class="mono" style="font-size:24px;font-weight:800">${p.referrals}</div></div>
          <div><div class="faint" style="font-size:11px">REVENUE</div><div class="mono" style="font-size:24px;font-weight:800">${p.revenue?money(p.revenue):"—"}</div></div>
        </div>
        <div class="faint" style="font-size:12px">Last contact ${fmt(p.last_contact)} &middot;
          ${p.last_contact?days(p.last_contact,TODAY)+" days ago":"never contacted"}</div>
      </div>
    </div>
  </div>

  <div class="note mt"><b>New here:</b> an <b>activity log</b> (today you only store one overwritable
  <code>last_contact</code> date, so history is lost), <b>many contacts with roles</b> instead of a fixed
  primary/secondary pair, and the <b>SAFC placement</b> block with its own restock clock.</div>`;
}

/* ===================== SAFC CAMPAIGN ================================== */
function screenSafc(){
  const list = safcAll();
  const n = list.length, pct = Math.round(n/SAFC_TARGET*100);
  const over = list.filter(p=>safcDueState(p)==="overdue");
  const dueT = list.filter(p=>safcDueState(p)==="today");
  const byZone = ZONES.map(z=>({z,n:list.filter(p=>p.zone===z).length}));
  const byType = [...new Set(list.map(p=>p.biz_type))].map(t=>({t,n:list.filter(p=>p.biz_type===t).length}))
    .sort((a,b)=>b.n-a.n);
  const maxZ = Math.max(...byZone.map(x=>x.n),1), maxT = Math.max(...byType.map(x=>x.n),1);

  return `
  <div class="row wrap mb" style="justify-content:space-between">
    <div><h1 style="font-size:21px">Stack At Front Campaign</h1>
      <div class="muted" style="font-size:13px">Cards placed at the counter, kept stocked.</div></div>
    <button class="btn pri">+ Add placement</button>
  </div>

  <div class="goal mb">
    <div class="row wrap" style="justify-content:space-between;align-items:flex-end">
      <div><div class="muted" style="font:700 10px var(--sans);letter-spacing:1px;text-transform:uppercase">Placements live</div>
        <div class="big mono">${n}<span style="font-size:22px;color:var(--muted)"> / ${SAFC_TARGET}</span></div></div>
      <div style="text-align:right">
        <div class="badge ${pct>=75?"b-green":pct>=40?"b-amber":"b-red"}">${pct}% of target</div>
        <div class="muted mono mt" style="font-size:13px">${SAFC_TARGET-n} to go</div></div>
    </div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="row wrap" style="gap:18px;font-size:12.5px" class="muted">
      <span class="muted">${over.length} overdue restock${over.length===1?"":"s"}</span>
      <span class="muted">${dueT.length} due today</span>
      <span class="muted">avg ${Math.round(list.reduce((s,p)=>s+p.safc.interval_days,0)/n)}d cadence</span>
    </div>
  </div>

  <div class="grid g2 mb">
    <div class="card"><div class="sect">By zone</div><div class="pad">
      ${byZone.map(x=>`<div class="mb-s"><div class="row" style="justify-content:space-between;font-size:13px">
        <span>${x.z}</span><span class="mono muted">${x.n}</span></div>
        <div class="lbar"><i style="width:${x.n/maxZ*100}%"></i></div></div>`).join("")}
    </div></div>
    <div class="card"><div class="sect">By business type</div><div class="pad">
      ${byType.map(x=>`<div class="mb-s"><div class="row" style="justify-content:space-between;font-size:13px">
        <span>${x.t}</span><span class="mono muted">${x.n}</span></div>
        <div class="lbar"><i style="width:${x.n/maxT*100}%"></i></div></div>`).join("")}
    </div></div>
  </div>

  <div class="card">
    <div class="sect"><span>Restock run &mdash; ordered by how overdue</span>
      <span class="badge ${over.length?"b-red":""}">${over.length+dueT.length} due</span></div>
    <div class="scroll"><table>
      <thead><tr><th>Business</th><th>Zone</th><th>Location</th><th>Cards left</th>
      <th>Cadence</th><th>Last restock</th><th>Due</th><th></th></tr></thead>
      <tbody>${list.sort((a,b)=>a.safc_due.localeCompare(b.safc_due)).map(p=>{
        const s=safcDueState(p);
        return `<tr>
          <td><a href="#/partnership/${p.id}" style="color:var(--accent);font-weight:600">${esc(p.name)}</a></td>
          <td class="muted">${esc(p.zone)}</td><td class="muted">${esc(p.safc.location)}</td>
          <td class="mono ${p.safc.cards_left<10?"od":""}">${p.safc.cards_left}</td>
          <td class="mono muted">${p.safc.interval_days}d</td>
          <td class="mono muted">${fmt(p.safc.last_restock)}</td>
          <td><span class="badge ${s==="overdue"?"b-red":s==="today"?"b-amber":""}">${relDue(p.safc_due)}</span></td>
          <td><button class="btn sm">Restocked</button></td></tr>`;}).join("")}</tbody>
    </table></div>
  </div>

  <div class="note mt"><b>Why a cadence and not just a flag:</b> field-marketing practice is to check distribution
  points every 1&ndash;2 weeks, adjusted for foot traffic. A boolean tells you a stack exists; a cadence tells you
  which ones are empty right now &mdash; which is the number that actually costs you leads.</div>`;
}

/* ===================== CONTACTS + BATCH EMAIL ========================= */
function screenContacts(state){
  let rows = contacts.slice();
  if(state.role) rows = rows.filter(c=>c.role===state.role);
  if(state.zone) rows = rows.filter(c=>c.zone===state.zone);
  if(state.src)  rows = rows.filter(c=>c.source===state.src);
  if(state.q){ const n=state.q.toLowerCase();
    rows = rows.filter(c=>(c.name+c.email+c.partnership).toLowerCase().includes(n)); }

  const sel = state.sel||new Set();
  const opt=(v,cur,l)=>`<option value="${v}" ${cur===v?"selected":""}>${l}</option>`;
  const roleCounts = ROLES.map(r=>({r,n:contacts.filter(c=>c.role===r).length})).filter(x=>x.n);

  return `
  <div class="row wrap mb" style="justify-content:space-between">
    <div><h1 style="font-size:21px">Contacts</h1>
      <div class="muted" style="font-size:13px">${contacts.length} people across ${partnerships.length} partnerships</div></div>
    <div class="row"><button class="btn">Scan card</button><button class="btn pri">+ Add contact</button></div>
  </div>

  <div class="row wrap mb-s" id="croles">
    <button class="pill ${!state.role?"on":""}" data-role="">All <span class="n">${contacts.length}</span></button>
    ${roleCounts.map(x=>`<button class="pill ${state.role===x.r?"on":""}" data-role="${esc(x.r)}">${esc(x.r)} <span class="n">${x.n}</span></button>`).join("")}
  </div>

  <div class="card pad mb"><div class="grid g4">
    <div><label class="lab">Search</label><input id="cq" value="${esc(state.q||"")}" placeholder="Name, email, business"></div>
    <div><label class="lab">Zone</label><select id="czone"><option value="">All zones</option>
      ${ZONES.map(z=>opt(z,state.zone,z)).join("")}</select></div>
    <div><label class="lab">Source</label><select id="csrc"><option value="">Any source</option>
      ${opt("Business card",state.src,"Business card")}${opt("Entered manually",state.src,"Entered manually")}</select></div>
    <div><label class="lab">&nbsp;</label><button class="btn" id="selall" style="width:100%">Select all ${rows.length}</button></div>
  </div></div>

  <div class="card">
    <div class="scroll"><table>
      <thead><tr><th style="width:34px"></th><th>Name</th><th>Role</th><th>Business</th>
      <th>Email</th><th>Zone</th><th>Last emailed</th></tr></thead>
      <tbody>${rows.map(c=>`<tr>
        <td><input type="checkbox" class="chk csel" data-id="${c.id}" ${sel.has(c.id)?"checked":""}></td>
        <td style="font-weight:600">${esc(c.name)}
          ${c.source==="Business card"?`<span class="badge" style="margin-left:4px">card</span>`:""}</td>
        <td><span class="badge">${esc(c.role)}</span></td>
        <td class="muted"><a href="#/partnership/${c.partnership_id}" style="color:var(--accent)">${esc(c.partnership)}</a></td>
        <td class="muted" style="font-size:12.5px">${esc(c.email)}</td>
        <td class="muted">${esc(c.zone)}</td>
        <td class="mono faint">${c.emailed?fmt(c.emailed):"—"}</td></tr>`).join("")}</tbody>
    </table></div>
    <div class="selbar"><span class="muted" style="font-size:13px"><b id="seln">${sel.size}</b> selected</span>
      <div class="grow"></div>
      <button class="btn sm">Export CSV</button>
      <button class="btn sm pri" id="emailsel">Email selected</button></div>
  </div>

  <div class="note mt"><b>This is the piece your app has no home for today.</b> A partnership stores exactly two
  contacts with no role, so a stack of 50 cards across Property Managers, Realtors and Storage Managers cannot be
  segmented at all. Contacts become their own record, tagged by role, and a group is just a saved filter.</div>`;
}

function emailModal(n){
  return `<div class="modal" id="modal"><div class="card">
    <div class="sect"><span>Email ${n} contacts</span><button class="btn sm" id="closem">Close</button></div>
    <div class="pad">
      <div class="field"><label class="lab">From</label>
        <input value="xoren@callaguychicago.com" disabled></div>
      <div class="field"><label class="lab">Subject</label>
        <input value="Quick intro — Call A Guy Chicago"></div>
      <div class="field"><label class="lab">Body</label>
        <textarea rows="7">Hi {{first_name}},

I run Call A Guy Chicago — we handle moving, cleaning, junk removal and handyman work for {{business_name}} and buildings like it.

If a tenant ever needs a hand, we can usually be there same day.

— Xoren</textarea></div>
      <div class="row wrap mb-s">
        ${["{{first_name}}","{{last_name}}","{{business_name}}","{{role}}","{{zone}}"].map(t=>`<span class="tag">${t}</span>`).join("")}
      </div>
      <div class="note"><b>Compliance, not optional.</b> Every commercial email needs a working unsubscribe link, a
      real reply-to and a physical mailing address. Penalties run to roughly $53k <i>per email</i>. The footer is
      added automatically and cannot be switched off.</div>
      <div class="row" style="justify-content:flex-end"><button class="btn">Save draft</button>
        <button class="btn pri">Send ${n}</button></div>
    </div></div></div>`;
}

/* ===================== JOBS / ROSTER / REPORTS / SETTINGS ============= */
function screenJobs(){
  return `
  <div class="row wrap mb" style="justify-content:space-between">
    <h1 style="font-size:21px">Jobs</h1><button class="btn pri">+ New job</button></div>
  <div class="card"><div class="scroll"><table>
    <thead><tr><th>Job</th><th>Customer</th><th>Arrival</th><th>Follow-up</th><th>Service</th>
    <th>Source</th><th>Workers</th><th>Status</th><th>Invoice</th><th>Comm</th></tr></thead>
    <tbody>${jobs.map(j=>`<tr>
      <td><a href="#/jobs" style="color:var(--accent);font-weight:600" class="mono">${j.job_id}</a>
        <div class="faint" style="font-size:11px">Created ${fmt(j.created)}</div></td>
      <td>${esc(j.customer)}<div class="faint mono" style="font-size:11px">${esc(j.phone)}</div></td>
      <td class="mono">${fmt(j.arrival)}<div class="faint" style="font-size:11px">${j.arrival?j.arrival_time:""}</div></td>
      <td>${j.follow_up?`<span class="badge ${days(TODAY,j.follow_up)<0?"b-red":days(TODAY,j.follow_up)===0?"b-amber":""}">${relDue(j.follow_up)}</span>
        <div class="faint" style="font-size:11px">${fmt(j.follow_up)}</div>`:`<span class="faint">—</span>`}</td>
      <td class="muted">${esc(j.service)}</td><td class="muted">${esc(j.source)}</td>
      <td class="muted" style="font-size:12px">${esc(j.workers)}</td>
      <td><span class="badge ${j.status==="Completed"?"b-green":j.status==="Booked"?"b-amber":""}">${j.status}</span></td>
      <td class="mono">${money(j.invoice)}</td>
      <td class="mono" style="color:${j.commission<0?"var(--danger)":"var(--good)"}">${money(j.commission)}</td>
    </tr>`).join("")}</tbody></table></div></div>
  <div class="note mt">Columns match the change already on the <code>claude/jobs-columns-follow-up</code> branch:
  Invoiced dropped, Customer first, Follow-up third.</div>`;
}

function screenRoster(){
  return `<h1 class="mb" style="font-size:21px">Roster</h1>
  <div class="card"><div class="scroll"><table>
    <thead><tr><th>Entity</th><th>Type</th><th>Zone</th><th>Status</th><th>Jobs</th><th>Earned</th><th>Availability</th></tr></thead>
    <tbody>${roster.map(r=>`<tr><td style="font-weight:600">${esc(r.name)}</td>
      <td class="muted">${r.type}</td><td class="muted">${r.zone}</td>
      <td><span class="badge ${r.status==="Active"?"b-green":""}">${r.status}</span></td>
      <td class="mono">${r.jobs}</td><td class="mono">${money(r.earned)}</td>
      <td>${r.avail>6?`<span class="badge b-red">${r.avail}d stale</span>`:`<span class="badge b-green">fresh</span>`}</td>
    </tr>`).join("")}</tbody></table></div></div>
  <div class="note mt">Unchanged in this round &mdash; included so you can click the whole app.</div>`;
}

function screenReports(){
  const safcN=safcAll().length;
  return `<h1 class="mb" style="font-size:21px">Reports</h1>
  <div class="grid g4 mb">
    ${tile("Jobs completed",6,"this month","ok")}${tile("Revenue",0,money(4820),"ok")}
    ${tile("SAFC placements",safcN,`of ${SAFC_TARGET}`,"ok")}${tile("Partnerships",partnerships.length,"total","ok")}
  </div>
  <div class="card"><div class="sect">Partnership health</div><div class="pad">
    ${[["Mature",partnerships.filter(p=>p.stage==="Mature").length],
       ["Developing",partnerships.filter(p=>p.stage==="Developing").length],
       ["Visited",partnerships.filter(p=>p.stage==="Visited").length],
       ["No next action",partnerships.filter(p=>!p.follow_up_at).length],
       ["Never contacted",partnerships.filter(p=>!p.last_contact).length]]
      .map(([l,n])=>`<div class="mb-s"><div class="row" style="justify-content:space-between;font-size:13px">
        <span>${l}</span><span class="mono muted">${n}</span></div>
        <div class="lbar"><i style="width:${n/partnerships.length*100}%"></i></div></div>`).join("")}
  </div></div>
  <div class="note mt">The zone-maturity meter is gone from Partnerships; stage counts live here instead,
  where a report belongs.</div>`;
}

function screenSettings(){
  const items=["Service Categories","Inquiry Sources","Zones","Vehicle Types","Partnership Stages",
    "Partnership Tiers","Contact Roles","Campaigns","Equipment Presets","Values &amp; Goals",
    "Message Templates","Email Templates","Work Face to Face","Google Calendar","Appearance"];
  return `<h1 class="mb" style="font-size:21px">Settings</h1>
  <div class="card">${items.map((s,i)=>`<a class="q" href="#/settings" style="text-decoration:none">
    <div class="grow"><b style="font-size:14px">${s}</b>
    ${["Contact Roles","Campaigns","Email Templates"].includes(s)?`<span class="badge b-safc" style="margin-left:6px">new</span>`:""}</div>
    <span class="faint">›</span></a>`).join("")}</div>
  <div class="note mt"><b>Three new lists:</b> Contact Roles feeds the contact segmenting, Campaigns makes SAFC the
  first of potentially several plays rather than a hardcoded flag, and Email Templates mirrors the SMS templates
  you already have.</div>`;
}
