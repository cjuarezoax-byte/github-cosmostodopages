(function () {
  const $ = (sel) => document.querySelector(sel);
  const state = { cfg: { baseUrl: "", fnKey: "", userId: "" }, cache: [] };
  const STORAGE_KEY = "cosmosTodoCfg.v1";

  function loadCfg() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { state.cfg = { ...state.cfg, ...JSON.parse(raw) }; } catch {}
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

  function endpoint(path, extraParams={}) {
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
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: taskText, userId: state.cfg.userId })
    });
    if (!res.ok) throw new Error("No se pudo crear la tarea (HTTP " + res.status + ").");
    return res.json();
  }

  async function apiUpdateTask(id, patch) {
    const url = endpoint("/api/tasks-update"); // POST en lugar de PUT
    const body = { id, userId: state.cfg.userId };

    if ("title" in patch) body.task = patch.title;    // tu backend usa "task"
    if ("isDone" in patch) body.done = !!patch.isDone; // tu backend usa "done"

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("No se pudo actualizar la tarea (HTTP " + res.status + ").");
    return res.json();
  }

  async function apiDeleteTask(id) {
    const url = endpoint("/api/tasks-delete"); // POST en lugar de DELETE
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, userId: state.cfg.userId })
    });
    if (!res.ok) throw new Error("No se pudo eliminar la tarea (HTTP " + res.status + ").");
    return res.json ? res.json() : {};
  }
  
  function renderRows(rows) {
    const tbody = $("#tasksBody");
    tbody.innerHTML = "";
    const frag = document.createDocumentFragment();

    rows.forEach(t => {
      const tr = document.createElement("tr");

      const tdDone = document.createElement("td");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!t.done;
      cb.addEventListener("change", async () => {
        try { await apiUpdateTask(t.id, { isDone: cb.checked }); t.done = cb.checked; }
        catch(e){ showAlert(e.message); }
      });
      tdDone.appendChild(cb);

      const tdTitle = document.createElement("td");
      const titleInput = document.createElement("input");
      titleInput.value = t.task || "";
      titleInput.addEventListener("change", async () => {
        try { await apiUpdateTask(t.id, { title: titleInput.value }); t.task = titleInput.value; }
        catch(e){ showAlert(e.message); }
      });
      tdTitle.appendChild(titleInput);

      const tdId = document.createElement("td");
      tdId.textContent = t.id;

      const tdCreated = document.createElement("td");
      const dt = t.createdAt ? new Date(t.createdAt) : null;
      tdCreated.textContent = dt ? dt.toLocaleString() : "—";

      const tdActions = document.createElement("td");
      tdActions.className = "actions";
      const delBtn = document.createElement("button");
      delBtn.className = "danger";
      delBtn.textContent = "Eliminar";
      delBtn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar esta tarea?")) return;
        try { await apiDeleteTask(t.id); state.cache = state.cache.filter(x=>x.id!==t.id); applyFilter(); }
        catch(e){ showAlert(e.message); }
      });
      tdActions.appendChild(delBtn);

      tr.append(tdDone, tdTitle, tdId, tdCreated, tdActions);
      frag.appendChild(tr);
    });

    tbody.appendChild(frag);
  }

  function applyFilter() {
    const q = ($("#searchBox").value || "").toLowerCase().trim();
    if (!q) return renderRows(state.cache);
    const rows = state.cache.filter(t =>
      (t.task || "").toLowerCase().includes(q) ||
      (t.id || "").toLowerCase().includes(q)
    );
    renderRows(rows);
  }

  async function reload() {
    clearAlert();
    $("#loading").hidden = false;
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
      $("#loading").hidden = true;
    }
  }

  async function testCors() {
    clearAlert();
    try {
      const url = endpoint("/api/tasks-list");
      const preflight = await fetch(url, {
        method: "OPTIONS",
        headers: {
          "Origin": location.origin,
          "Access-Control-Request-Method": "GET"
        }
      });
      $("#cfgMsg").textContent = `Preflight: HTTP ${preflight.status}. Ahora probando GET…`;
      const res = await fetch(url, { method: "GET" });
      $("#cfgMsg").textContent = `GET: HTTP ${res.status}`;
      setTimeout(() => $("#cfgMsg").textContent = "", 3500);
    } catch (e) {
      showAlert("CORS/Conectividad falló: " + e.message);
    }
  }

  $("#saveCfg").addEventListener("click", saveCfg);
  $("#testCors").addEventListener("click", testCors);
  $("#reloadBtn").addEventListener("click", reload);
  $("#searchBox").addEventListener("input", applyFilter);
  $("#addBtn").addEventListener("click", async () => {
    clearAlert();
    const title = ($("#newTitle").value || "").trim();
    if (!title) return;
    $("#addBtn").disabled = true;
    try {
      const created = await apiCreateTask(title);
      const item = created.item || created;
      state.cache.unshift(item);
      $("#newTitle").value = "";
      applyFilter();
    } catch(e){ showAlert(e.message); }
    finally { $("#addBtn").disabled = false; }
  });

  loadCfg();
  if (state.cfg.baseUrl) reload();
})();
