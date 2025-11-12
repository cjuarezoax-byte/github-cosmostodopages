(function () {
  const $ = (sel) => document.querySelector(sel);
  const state = { cfg: { baseUrl: "", fnKey: "", userId: "" }, cache: [] };
  const STORAGE_KEY = "cosmosTodoCfg.v1";

  function loadCfg() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { try { state.cfg = { ...state.cfg, ...JSON.parse(raw) }; } catch {}
    } else if (window.CosmosTodoConfig) {
      const { BASE_URL, FN_KEY, DEFAULT_USER_ID } = window.CosmosTodoConfig;
      state.cfg = { baseUrl: BASE_URL||"", fnKey: FN_KEY||"", userId: DEFAULT_USER_ID||"" };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cfg));
    }
    $("#baseUrl").value = state.cfg.baseUrl;
    $("#fnKey").value = state.cfg.fnKey;
    $("#userId").value = state.cfg.userId;
  }
  function saveCfg() {
    state.cfg.baseUrl = $("#baseUrl").value.trim().replace(/\/+$/, "");
    state.cfg.fnKey = $("#fnKey").value.trim();
    state.cfg.userId = $("#userId").value.trim();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cfg));
    $("#cfgMsg").textContent = "Configuración guardada ✔";
    setTimeout(() => $("#cfgMsg").textContent = "", 2000);
  }
  function showAlert(msg){ const el=$("#alert"); el.textContent=msg; el.hidden=false; }
  function clearAlert(){ $("#alert").hidden=true; }

  function endpoint(path, extraParams = {}) {
    const base = state.cfg.baseUrl || "";
    if (!base) throw new Error("Configura Base URL primero.");
    const url = new URL(base + path);
    if (state.cfg.fnKey) url.searchParams.set("code", state.cfg.fnKey);
    if (state.cfg.userId) url.searchParams.set("userId", state.cfg.userId);
    for (const [k,v] of Object.entries(extraParams)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k,v);
    }
    return url.toString();
  }

  async function apiGetTasks() {
    const url = endpoint("/api/tasks-list");
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error("No se pudieron cargar las tareas (HTTP " + res.status + ").");
    return res.json();
  }

  async function apiCreateTask(taskText) {
    const url = endpoint("/api/tasks-create");
    const headers = { "Content-Type":"application/json" };
    if (state.cfg.fnKey) headers["x-functions-key"] = state.cfg.fnKey;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ task: taskText, userId: state.cfg.userId })
    });
    if (!res.ok) throw new Error("No se pudo crear la tarea (HTTP " + res.status + ").");
    return res.json();
  }

  async function apiUpdateTask(id, patch) {
    const base = state.cfg.baseUrl.replace(/\/+$/, "");
    const code = state.cfg.fnKey;
    const userId = state.cfg.userId;
    const mkHeaders = () => {
        const h = { "Content-Type": "application/json" };
        if (code) h["x-functions-key"] = code;
        return h;
    };
    const makeBodies = () => {
        const b1 = {};
        if ("title" in patch) b1.task = patch.title;
        if ("isDone" in patch) b1.done = !!patch.isDone;
        if (userId) b1.userId = userId;
        const b2 = JSON.parse(JSON.stringify(b1));
        if ("isDone" in patch && b2.hasOwnProperty("done")) b2.done = String(!!patch.isDone);
        return [b1, b2];
    };

    const tries = [];
    // 1) PUT ?id=
    {
        const url1 = new URL(endpoint("/api/tasks-update", { id }));
        for (const body of makeBodies()) {
            tries.push(() => fetch(url1.toString(), { method: "PUT", headers: mkHeaders(), body: JSON.stringify(body) }));
        }
    }
    // 2) POST /<id>
    {
        const url2 = new URL(base + "/api/tasks-update/" + encodeURIComponent(id));
        if (code) url2.searchParams.set("code", code);
        if (userId) url2.searchParams.set("userId", userId);
        for (const body of makeBodies()) {
            tries.push(() => fetch(url2.toString(), { method: "POST", headers: mkHeaders(), body: JSON.stringify(body) }));
        }
    }
    // 3) POST body con id
    {
        const url3 = new URL(endpoint("/api/tasks-update"));
        for (const body of makeBodies()) {
            const b = Object.assign({ id }, body);
            tries.push(() => fetch(url3.toString(), { method: "POST", headers: mkHeaders(), body: JSON.stringify(b) }));
        }
    }

    let lastStatus = 0, lastText = "";
    for (const run of tries) {
        try {
            const res = await run();
            console.log("DEBUG: Request URL:", res.url);
            console.log("DEBUG: Status:", res.status);
            const text = await res.text();
            console.log("DEBUG: Response Body:", text);

            lastStatus = res.status;
            if (res.ok || res.status === 204) {
                try { return JSON.parse(text); } catch { return {}; }
            }
            lastText = text;
            if (![404, 405].includes(res.status)) break;
        } catch (e) {
            console.error("DEBUG: Fetch error:", e);
            lastText = String(e);
        }
    }
    throw new Error("No se pudo actualizar la tarea (HTTP " + lastStatus + "). " + (lastText || ""));
}
    // 2) POST /<id>
    { const url2 = new URL(base + "/api/tasks-update/" + encodeURIComponent(id));
      if (code) url2.searchParams.set("code", code); if (userId) url2.searchParams.set("userId", userId);
      for (const body of makeBodies()) tries.push(() => fetch(url2.toString(), { method:"POST", headers: mkHeaders(), body: JSON.stringify(body) })); }
    // 3) POST body con id
    { const url3 = new URL(endpoint("/api/tasks-update"));
      for (const body of makeBodies()) { const b = Object.assign({ id }, body);
        tries.push(() => fetch(url3.toString(), { method:"POST", headers: mkHeaders(), body: JSON.stringify(b) })); }
    }
    let lastStatus = 0, lastText = "";
    for (const run of tries) {
      try { const res = await run(); lastStatus = res.status;
        if (res.ok || res.status === 204) { try { return await res.json(); } catch { return {}; } }
        lastText = await res.text().catch(()=> ""); if (![404,405].includes(res.status)) break;
      } catch (e) { lastText = String(e); }
    }
    throw new Error("No se pudo actualizar la tarea (HTTP " + lastStatus + "). " + (lastText || ""));
  }

  async function apiDeleteTask(id) {
    const base = state.cfg.baseUrl.replace(/\/+$/, "");
    const code = state.cfg.fnKey;
    const userId = state.cfg.userId;
    const mkHeaders = () => { const h = {}; if (code) h["x-functions-key"] = code; return h; };

    // 1) DELETE ?id=
    { const url = endpoint("/api/tasks-delete", { id });
      const res = await fetch(url, { method:"DELETE", headers: mkHeaders() });
      if (res.ok || res.status === 204) return true;
      if (![404,405].includes(res.status)) throw new Error("No se pudo eliminar la tarea (HTTP " + res.status + ")."); }
    // 2) DELETE /<id>
    { const url2 = new URL(base + "/api/tasks-delete/" + encodeURIComponent(id));
      if (code) url2.searchParams.set("code", code); if (userId) url2.searchParams.set("userId", userId);
      const res2 = await fetch(url2.toString(), { method:"DELETE", headers: mkHeaders() });
      if (res2.ok || res2.status === 204) return true;
      if (![404,405].includes(res2.status)) throw new Error("No se pudo eliminar la tarea (HTTP " + res2.status + ")."); }
    // 3) POST body
    { const url3 = endpoint("/api/tasks-delete");
      const headers = { "Content-Type":"application/json", ...mkHeaders() };
      const res3 = await fetch(url3, { method:"POST", headers, body: JSON.stringify({ id, userId }) });
      if (res3.ok || res3.status === 204) return true;
      throw new Error("No se pudo eliminar la tarea (HTTP " + res3.status + ")."); }
  }

  function renderRows(rows){
    const tbody=$("#tasksBody"); tbody.innerHTML="";
    const frag=document.createDocumentFragment();
    rows.forEach(t=>{
      const tr=document.createElement("tr");

      const tdDone=document.createElement("td");
      const cb=document.createElement("input"); cb.type="checkbox"; cb.checked=!!t.done;
      cb.addEventListener("change", async()=>{
        try { await apiUpdateTask(t.id,{ isDone: cb.checked }); t.done = cb.checked; }
        catch(e){ showAlert(e.message); cb.checked = !cb.checked; }
      });
      tdDone.appendChild(cb);

      const tdTitle=document.createElement("td");
      const titleInput=document.createElement("input"); titleInput.value=t.task || "";
      titleInput.addEventListener("change", async()=>{
        try { await apiUpdateTask(t.id,{ title: titleInput.value }); t.task = titleInput.value; }
        catch(e){ showAlert(e.message); }
      });
      tdTitle.appendChild(titleInput);

      const tdId=document.createElement("td"); tdId.textContent=t.id;
      const tdCreated=document.createElement("td"); const dt=t.createdAt?new Date(t.createdAt):null; tdCreated.textContent=dt?dt.toLocaleString():"—";

      const tdActions=document.createElement("td"); tdActions.className="actions";
      const delBtn=document.createElement("button"); delBtn.className="danger"; delBtn.textContent="Eliminar";
      delBtn.addEventListener("click", async()=>{
        if(!confirm("¿Eliminar esta tarea?")) return;
        try { await apiDeleteTask(t.id); state.cache = state.cache.filter(x=>x.id!==t.id); applyFilter(); }
        catch(e){ showAlert(e.message); }
      });
      tdActions.appendChild(delBtn);

      tr.append(tdDone, tdTitle, tdId, tdCreated, tdActions);
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }

  function applyFilter(){
    const q = ($("#searchBox").value||"").toLowerCase().trim();
    if(!q) return renderRows(state.cache);
    renderRows(state.cache.filter(t => (t.task||"").toLowerCase().includes(q) || (t.id||"").toLowerCase().includes(q)));
  }

  async function reload(){
    clearAlert(); $("#loading").hidden=false;
    try {
      const data = await apiGetTasks();
      const items = Array.isArray(data) ? data : (data.items || []);
      state.cache = items.sort((a,b)=>{
        const ta=a.createdAt?Date.parse(a.createdAt):0;
        const tb=b.createdAt?Date.parse(b.createdAt):0;
        return tb - ta;
      });
      applyFilter();
    } catch(e){ showAlert(e.message); } finally { $("#loading").hidden=true; }
  }

  async function testCors(){
    clearAlert();
    try{
      const url=endpoint("/api/tasks-list");
      const preflight=await fetch(url,{ method:"OPTIONS", headers:{ "Origin":location.origin, "Access-Control-Request-Method":"GET" } });
      $("#cfgMsg").textContent=`Preflight: HTTP ${preflight.status}. Ahora probando GET…`;
      const res=await fetch(url,{ method:"GET" });
      $("#cfgMsg").textContent=`GET: HTTP ${res.status}`;
      setTimeout(()=>$("#cfgMsg").textContent="",3500);
    }catch(e){ showAlert("CORS/Conectividad falló: "+e.message); }
  }

  $("#saveCfg").addEventListener("click", saveCfg);
  $("#testCors").addEventListener("click", testCors);
  $("#reloadBtn").addEventListener("click", reload);
  $("#searchBox").addEventListener("input", applyFilter);
  $("#addBtn").addEventListener("click", async()=>{
    clearAlert();
    const title=($("#newTitle").value||"").trim(); if(!title) return;
    $("#addBtn").disabled=true;
    try{
      const created = await apiCreateTask(title);
      const item = created.item || created;
      state.cache.unshift(item);
      $("#newTitle").value="";
      applyFilter();
    } catch(e){ showAlert(e.message); } finally { $("#addBtn").disabled=false; }
  });

  loadCfg();
  if (state.cfg.baseUrl) reload();
})();