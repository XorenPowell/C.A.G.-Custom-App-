/* Hash router + the small amount of interactivity the mockup needs. */
const state = { tab:"calls", view:"all", sort:"follow", q:"", zone:"", stage:"",
                role:"", src:"", sel:new Set(), modal:false };

const NAV = [["#/","Home"],["#/jobs","Jobs"],["#/partnerships","Partnerships"],
  ["#/contacts","Contacts"],["#/safc","SAFC"],["#/roster","Roster"],
  ["#/reports","Reports"],["#/settings","Settings"]];

function route(){
  const h = location.hash || "#/";
  const m = h.match(/^#\/partnership\/(.+)$/);
  if(m) return {name:"partnership", id:m[1]};
  return {name:(h.replace("#/","")||"home")};
}

function render(){
  const r = route();
  let html;
  switch(r.name){
    case "home":         html = screenHome(state); break;
    case "jobs":         html = screenJobs(); break;
    case "partnerships": html = screenPartnerships(state); break;
    case "partnership":  html = screenPartnership(r.id); break;
    case "safc":         html = screenSafc(); break;
    case "contacts":     html = screenContacts(state); break;
    case "roster":       html = screenRoster(); break;
    case "reports":      html = screenReports(); break;
    case "settings":     html = screenSettings(); break;
    default:             html = screenHome(state);
  }

  const active = r.name==="partnership" ? "#/partnerships" : (location.hash||"#/");
  document.getElementById("app").innerHTML = `
    <div class="top"><div class="top-in">
      <span class="brand">C.A.G.</span>
      <nav class="nav grow">${NAV.map(([h,l])=>
        `<a href="${h}" class="${active===h?"on":""}">${l}</a>`).join("")}</nav>
      <span class="badge b-safc">MOCKUP</span>
    </div></div>
    <div class="page">${html}</div>
    ${state.modal ? emailModal(state.sel.size || 12) : ""}`;

  wire();
}

function wire(){
  document.querySelectorAll("[data-tab]").forEach(b=>
    b.onclick = () => { state.tab = b.dataset.tab; render(); });
  document.querySelectorAll("[data-view]").forEach(b=>
    b.onclick = () => { state.view = b.dataset.view; render(); });
  document.querySelectorAll("[data-role]").forEach(b=>
    b.onclick = () => { state.role = b.dataset.role; render(); });

  const bind = (id, key, ev) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener(ev, () => {
      state[key] = el.value;
      const pos = el.selectionStart;
      render();
      const again = document.getElementById(id);
      if(again && ev==="input"){ again.focus(); try{ again.setSelectionRange(pos,pos); }catch(e){} }
    });
  };
  bind("pq","q","input"); bind("pzone","zone","change");
  bind("pstage","stage","change"); bind("psort","sort","change");
  bind("cq","q","input"); bind("czone","zone","change"); bind("csrc","src","change");

  document.querySelectorAll(".csel").forEach(cb=>
    cb.onchange = () => {
      cb.checked ? state.sel.add(cb.dataset.id) : state.sel.delete(cb.dataset.id);
      const n = document.getElementById("seln");
      if(n) n.textContent = state.sel.size;
    });

  const all = document.getElementById("selall");
  if(all) all.onclick = () => {
    const boxes = [...document.querySelectorAll(".csel")];
    const turnOn = boxes.some(b=>!b.checked);
    boxes.forEach(b=>{ b.checked = turnOn; turnOn ? state.sel.add(b.dataset.id) : state.sel.delete(b.dataset.id); });
    const n = document.getElementById("seln");
    if(n) n.textContent = state.sel.size;
  };

  const em = document.getElementById("emailsel");
  if(em) em.onclick = () => { state.modal = true; render(); };
  const cm = document.getElementById("closem");
  if(cm) cm.onclick = () => { state.modal = false; render(); };
}

addEventListener("hashchange", () => { state.modal=false; render(); });
render();
