(function () {
  // ==============================
  // ⚙️ CONFIG DE RUTEO (cámbialo si tu backend usa otra forma)
  // Modos soportados:
  //  - "put_query"    -> PUT   /api/tasks-update?id=<id>            (update)
  //  - "post_path"    -> POST  /api/tasks-update/<id>               (update)
  //  - "post_body"    -> POST  /api/tasks-update {id, ...}          (update)  ← por defecto
  //
  //  - "delete_query" -> DELETE /api/tasks-delete?id=<id>           (delete)
  //  - "delete_path"  -> DELETE /api/tasks-delete/<id>              (delete)
  //  - "post_body"    -> POST   /api/tasks-delete {id}              (delete)  ← por defecto
  const ROUTING = {
    update: "post_path",
    delete: "delete_query"
  };
  // ==============================

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
    document.getElementById("baseUrl").value = state.cfg.baseUrl;
    document.getElementById("fnKey").value = state.cfg.fnKey;
    document.getElementById("userId").value = state.cfg.userId;
  }

  function saveCfg() {
    state.cfg.baseUrl = document.getElementById("baseUrl").value.trim().replace(/\/+$/, "");
    state.cfg.fnKey = document.getElementById("fnKey").value.trim();
    state.cfg.userId = document.getElementById("userId").value.trim();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cfg));
    document.getElementById("cfgMsg").textContent = "Configuración guardada ✔";
    setTimeout(() => document.getElementById("cfgMsg").textContent = "", 2000);
  }

  function showAlert(msg){ const el=document.getElementById("alert"); el.textContent=msg; el.hidden=false; }
  function clearAlert(){ document.getElementById("alert").hidden=true; }

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

  // ---------------- API (contrato exacto: task/done/createdAt) ---------------
  async function apiGetTasks() {
    const url = endpoint("/api/tasks-list");
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error("No se pudieron cargar las tareas (HTTP " + res.status + ").");
    return res.json(); // arreglo con {id,userId,task,done,createdAt,...}
  }

  async function apiCreateTask(taskText) {
    const url = endpoint("/api/tasks-create");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: taskText, userId: state.cfg.userId })
    });
    if (!res.ok) throw new Error("No se pudo crear la tarea (HTTP " + res.status + ").");
    return res.json(); // { item: {...} } o {...}
  }

  // UPDATE: selecciona forma según ROUTING.update
  async function apiUpdateTask(id, patch) {
    const mode = ROUTING.update;
    const base = state.cfg.baseUrl.replace(/\/+$/, "");

    if (mode === "put_query") {
      const url = endpoint("/api/tasks-update", { id });
      const body = { userId: state.cfg.userId };
      if ("title" in patch) body.task = patch.title;
      if ("isDone" in patch) body.done = !!patch.isDone;
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("No se pudo actualizar la tarea (HTTP " + res.status + ").");
      return res.json();
    }

    if (mode === "post_path") {
      const url2 = new URL(base + "/api/tasks-update/" + encodeURIComponent(id));
      if (state.cfg.fnKey) url2.searchParams.set("code", state.cfg.fnKey);
      if (state.cfg.userId) url2.searchParams.set("userId", state.cfg.userId);
      const body = {};
      if ("title" in patch) body.task = patch.title;
      if ("isDone" in patch) body.done = !!patch.isDone;
      const res2 = await fetch(url2.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res2.ok) throw new Error("No se pudo actualizar la tarea (HTTP " + res2.status + ").");
      return res2.json();
    }

    // default: "post_body"
    {
      const url3 = endpoint("/api/tasks-update");
      const body = { id, userId: state.cfg.userId };
      if ("title" in patch) body.task = patch.title;
      if ("isDone" in patch) body.done = !!patch.isDone;
      const res3 = await fetch(url3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res3.ok) throw new Error("No se pudo actualizar la tarea (HTTP " + res3.status + ").");
      return res3.json();
    }
  }

  // DELETE: selecciona forma según ROUTING.delete
  async function apiDeleteTask(id) {
    const mode = ROUTING.delete;
    const base = state.cfg.baseUrl.replace(/\/+$/, "");

    if (mode === "delete_query") {
      const url = endpoint("/api/tasks-delete", { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("No se pudo eliminar la tarea (HTTP " + res.status + ").");
      return true;
    }

    if (mode === "delete_path") {
      const url2 = new URL(base + "/api/tasks-delete/" + encodeURIComponent(id));
      if (state.cfg.fnKey) url2.searchParams.set("code", state.cfg.fnKey);
      if (state.cfg.userId) url2.searchParams.set("userId", state.cfg.userId);
      const res2 = await fetch(url2.toString(), { method: "DELETE" });
      if (!res2.ok && res2.status !== 204) throw new Error("No se pudo eliminar la tarea (HTTP " + res2.status + ").");
      return true;
    }

    // default: "post_body"
    {
      const url3 = endpoint("/api/tasks-delete");
      const res3 = await fetch(url3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, userId: state.cfg.userId })
      });
      if (!res3.ok && res3.status !== 204) throw new Error("No se pudo eliminar la tarea (HTTP " + res3.status + ").");
      return true;
    }
  }

  // ---------------- UI -------------------------------------------------------
  function renderRows(rows) {
    const tbody = document.getElementById("tasksBody");
    tbody.innerHTML = "";
    const frag = document.createDocumentFragment();

    rows.forEach(t => {
      const tr = document.createElement("tr");

      // Hecha (usa t.done)
      const tdDone = document.createElement("td");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!t.done;
      cb.addEventListener("change", async () => {
        try { await apiUpdateTask(t.id, { isDone: cb.checked }); t.done = cb.checked; }
        catch (e) { showAlert(e.message); }
      });
      tdDone.appendChild(cb);

      // Título (usa t.task)
      const tdTitle = document.createElement("td");
      const titleInput = document.createElement("input");
      titleInput.value = t.task || "";
      titleInput.addEventListener("change", async () => {
        try { await apiUpdateTask(t.id, { title: titleInput.value }); t.task = titleInput.value; }
        catch (e) { showAlert(e.message); }
      });
      tdTitle.appendChild(titleInput);

      // ID
      const tdId = document.createElement("td"); tdId.textContent = t.id;

      // Fecha (usa createdAt)
      const tdCreated = document.createElement("td");
      const dt = t.createdAt ? new Date(t.createdAt) : null;
      tdCreated.textContent = dt ? dt.toLocaleString() : "—";

      // Acciones
      const tdActions = document.createElement("td"); tdActions.className = "actions";
      const delBtn = document.createElement("button"); delBtn.className = "danger"; delBtn.textContent = "Eliminar";
      delBtn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar esta tarea?")) return;
        try { await apiDeleteTask(t.id); state.cache = state.cache.filter(x => x.id !== t.id); applyFilter(); }
        catch (e) { showAlert(e.message); }
      });
      tdActions.appendChild(delBtn);

      tr.append(tdDone, tdTitle, tdId, tdCreated, tdActions);
      frag.appendChild(tr);
    });

    tbody.appendChild(frag);
  }

  function applyFilter() {
    const q = (document.getElementById("searchBox").value || "").toLowerCase().trim();
    if (!q) return renderRows(state.cache);
    const rows = state.cache.filter(t =>
      (t.task || "").toLowerCase().includes(q) ||
      (t.id || "").toLowerCase().includes(q)
    );
    renderRows(rows);
  }

  async function reload() {
    clearAlert();
    document.getElementById("loading").hidden = false;
    try {
      const data = await apiGetTasks();
      const items = Array.isArray(data) ? data : (data.items || []);
      state.cache = items.sort((a,b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });
      applyFilter();
    } catch (e) {
      showAlert(e.message);
    } finally {
      document.getElementById("loading").hidden = true;
    }
  }

  async function testCors() {
    clearAlert();
    try {
      const url = endpoint("/api/tasks-list");
      const preflight = await fetch(url, {
        method: "OPTIONS",
        headers: { "Origin": location.origin, "Access-Control-Request-Method": "GET" }
      });
      document.getElementById("cfgMsg").textContent = `Preflight: HTTP ${preflight.status}. Ahora probando GET…`;
      const res = await fetch(url, { method: "GET" });
      document.getElementById("cfgMsg").textContent = `GET: HTTP ${res.status}`;
      setTimeout(() => document.getElementById("cfgMsg").textContent = "", 3500);
    } catch (e) { showAlert("CORS/Conectividad falló: " + e.message); }
  }

  document.getElementById("saveCfg").addEventListener("click", saveCfg);
  document.getElementById("testCors").addEventListener("click", testCors);
  document.getElementById("reloadBtn").addEventListener("click", reload);
  document.getElementById("searchBox").addEventListener("input", applyFilter);
  document.getElementById("addBtn").addEventListener("click", async () => {
    clearAlert();
    const title = (document.getElementById("newTitle").value || "").trim();
    if (!title) return;
    document.getElementById("addBtn").disabled = true;
    try {
      const created = await apiCreateTask(title);
      const item = created.item || created;
      state.cache.unshift(item);
      document.getElementById("newTitle").value = "";
      applyFilter();
    } catch (e) { showAlert(e.message); }
    finally { document.getElementById("addBtn").disabled = false; }
  });

  loadCfg();
  if (state.cfg.baseUrl) reload();
})();