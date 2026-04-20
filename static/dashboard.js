const state = {
  metaClients: [],
  googleClients: [],
  templates: { channels: {}, variables: {} },
  eventsByClient: new Map(),
  eventStream: null,
};

const DASHBOARD_BASE =
  (document.querySelector('meta[name="dashboard-base"]')?.getAttribute("content") || "").replace(/\/+$/, "");
const apiUrl = (path) => `${DASHBOARD_BASE}${path}`;
const flowSteps = ["RECEBIDO", "PAYLOAD_OK", "ROTA_RESOLVIDA", "MENSAGEM_FORMATADA", "WHATSAPP_ENVIADO_OK", "CONCLUIDO_OK"];

function fmtTime(iso) {
  if (!iso) return "--:--:--";
  return new Date(iso).toLocaleTimeString("pt-BR");
}

function setConnection(status, label) {
  document.getElementById("connectionDot").className = `dot ${status}`;
  document.getElementById("connectionLabel").textContent = label;
}

function statusPillClass(label) {
  if (label === "Ativo completo") return "pill-ok";
  if (label === "Ativo parcial" || label === "Pausado") return "pill-warn";
  return "pill-err";
}

function checkPill(name, ok) {
  const span = document.createElement("span");
  span.className = `check-pill ${ok ? "ok" : "error"}`;
  span.textContent = `${ok ? "OK" : "ERRO"} · ${name}`;
  return span;
}

function stageClass(status) {
  const allowed = new Set(["info", "ok", "warning", "error"]);
  return allowed.has(status) ? `st-${status}` : "st-info";
}

function eventItem(ev) {
  const li = document.createElement("li");
  li.className = `event-item ${stageClass(ev.status)}`;
  li.innerHTML = `<div class="event-head"><span class="event-stage">${ev.stage || "EVENTO"}</span><span class="event-time">${fmtTime(ev.timestamp)}</span></div><div class="event-detail">${ev.detail || ""}</div>`;
  return li;
}

function normalizeClientEvents(clientName) {
  const list = state.eventsByClient.get(clientName) || [];
  return [...list].sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || "")).slice(-18);
}

function injectFlowPlaceholders(listElement, events) {
  const done = new Set(events.map((e) => e.stage));
  for (const step of flowSteps) {
    if (done.has(step)) continue;
    const li = document.createElement("li");
    li.className = "event-item st-info";
    li.innerHTML = `<div class="event-head"><span class="event-stage">${step}</span><span class="event-time">pendente</span></div><div class="event-detail">Aguardando execução dessa etapa.</div>`;
    listElement.appendChild(li);
    if (listElement.children.length >= 8) break;
  }
}

function buildStats(containerId, clients, statusKey = "status_label") {
  const active = clients.filter((c) => c.enabled).length;
  const full = clients.filter((c) => c.checks?.[statusKey] === "Ativo completo").length;
  const partial = clients.filter((c) => c.checks?.[statusKey] === "Ativo parcial").length;
  const bad = clients.filter((c) => c.checks?.[statusKey] === "Inconsistente").length;
  const row = document.getElementById(containerId);
  row.innerHTML = "";
  [
    ["Clientes totais", clients.length],
    ["Automações ligadas", active],
    ["Ativo completo", full + partial],
    ["Inconsistentes", bad],
  ].forEach(([label, value]) => {
    const div = document.createElement("div");
    div.className = "stat";
    div.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
    row.appendChild(div);
  });
}

function renderMetaClients() {
  const grid = document.getElementById("clientsGrid");
  const tpl = document.getElementById("clientCardTemplate");
  grid.innerHTML = "";

  state.metaClients.forEach((client) => {
    const node = tpl.content.cloneNode(true);
    const card = node.querySelector(".client-card");
    card.dataset.clientId = String(client.id);
    card.querySelector(".client-name").textContent = client.client_name || "(sem nome)";
    const statusLabel = client.checks?.status_label || "Inconsistente";
    const pill = card.querySelector(".status-pill");
    pill.className = `status-pill ${statusPillClass(statusLabel)}`;
    pill.textContent = statusLabel;
    card.querySelector(".f-ad_account_id").textContent = client.ad_account_id || "-";
    card.querySelector(".f-group_id").textContent = client.group_id || "-";
    card.querySelector(".f-meta_page_id").textContent = client.meta_page_id || "(vazio)";
    card.querySelector(".f-lead_group_id").textContent = client.lead_group_id || "(fallback group_id)";
    card.querySelector(".f-lead_template").textContent = client.lead_template || "default";
    card.querySelector(".f-enabled").textContent = client.enabled ? "true" : "false";

    const checks = card.querySelector(".checks");
    checks.appendChild(checkPill("ad_account_id", !!client.checks?.ad_account_ok));
    checks.appendChild(checkPill("group_id", !!client.checks?.group_id_ok));
    checks.appendChild(checkPill("meta_page_id", !!client.checks?.meta_page_id_ok));
    checks.appendChild(checkPill("lead_group_id", !!client.checks?.lead_group_id_ok));

    const list = card.querySelector(".event-list");
    const events = normalizeClientEvents(client.client_name);
    events.reverse().forEach((ev) => list.appendChild(eventItem(ev)));
    injectFlowPlaceholders(list, events);

    const editForm = card.querySelector(".edit-form");
    const editFeedback = card.querySelector(".edit-feedback");
    editForm.elements.client_name.value = client.client_name || "";
    editForm.elements.ad_account_id.value = client.ad_account_id || "";
    editForm.elements.group_id.value = client.group_id || "";
    editForm.elements.meta_page_id.value = client.meta_page_id || "";
    editForm.elements.lead_group_id.value = client.lead_group_id || "";
    editForm.elements.lead_phone_number.value = client.lead_phone_number || "";
    editForm.elements.lead_template.value = client.lead_template || "default";
    editForm.elements.enabled.checked = !!client.enabled;

    card.querySelector('[data-action="toggle-edit"]').addEventListener("click", () => {
      editForm.classList.toggle("hidden");
      editFeedback.textContent = "";
    });
    card.querySelector('[data-action="cancel-edit"]').addEventListener("click", () => {
      editForm.classList.add("hidden");
      editFeedback.textContent = "";
    });
    editForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      editFeedback.textContent = "Salvando alterações...";
      const fd = new FormData(editForm);
      const payload = Object.fromEntries(fd.entries());
      payload.enabled = !!fd.get("enabled");
      const resp = await fetch(apiUrl(`/api/clients/${client.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await resp.json();
      if (!resp.ok || !body.ok) {
        editFeedback.textContent = `Erro ao salvar: ${body.error || "desconhecido"}`;
        return;
      }
      editFeedback.textContent = "Cliente atualizado com sucesso.";
      editForm.classList.add("hidden");
      await fetchMetaClients();
    });

    card.querySelectorAll(".actions button[data-scenario]").forEach((btn) => {
      btn.addEventListener("click", () => simulateHarness(client.id, btn.dataset.scenario));
    });

    grid.appendChild(node);
  });
}

function renderGoogleClients() {
  const grid = document.getElementById("googleClientsGrid");
  const tpl = document.getElementById("googleClientCardTemplate");
  grid.innerHTML = "";
  state.googleClients.forEach((client) => {
    const node = tpl.content.cloneNode(true);
    const card = node.querySelector(".client-card");
    card.querySelector(".client-name").textContent = client.client_name || "(sem nome)";
    const statusLabel = client.checks?.status_label || "Inconsistente";
    const pill = card.querySelector(".status-pill");
    pill.className = `status-pill ${statusPillClass(statusLabel)}`;
    pill.textContent = statusLabel;
    card.querySelector(".g-google_customer_id").textContent = client.google_customer_id || "-";
    card.querySelector(".g-group_id").textContent = client.group_id || "-";
    card.querySelector(".g-google_template").textContent = client.google_template || "default";
    card.querySelector(".g-enabled").textContent = client.enabled ? "true" : "false";
    card.querySelector(".g-primary_conversions").textContent = (client.primary_conversions || []).join(", ") || "(vazio)";
    card.querySelector(".g-notes").textContent = client.notes || "(sem notas)";
    const checks = card.querySelector(".checks");
    checks.appendChild(checkPill("customer_id", !!client.checks?.customer_id_ok));
    checks.appendChild(checkPill("group_id", !!client.checks?.group_id_ok));

    const editForm = card.querySelector(".edit-form");
    const feedback = card.querySelector(".edit-feedback");
    editForm.elements.client_name.value = client.client_name || "";
    editForm.elements.google_customer_id.value = client.google_customer_id || "";
    editForm.elements.group_id.value = client.group_id || "";
    editForm.elements.google_template.value = client.google_template || "default";
    editForm.elements.primary_conversions.value = (client.primary_conversions || []).join(", ");
    editForm.elements.notes.value = client.notes || "";
    editForm.elements.enabled.checked = !!client.enabled;

    card.querySelector('[data-action="toggle-edit-google"]').addEventListener("click", () => {
      editForm.classList.toggle("hidden");
      feedback.textContent = "";
    });
    card.querySelector('[data-action="cancel-edit-google"]').addEventListener("click", () => {
      editForm.classList.add("hidden");
      feedback.textContent = "";
    });
    editForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      feedback.textContent = "Salvando alterações...";
      const fd = new FormData(editForm);
      const payload = Object.fromEntries(fd.entries());
      payload.enabled = !!fd.get("enabled");
      const resp = await fetch(apiUrl(`/api/google-clients/${client.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await resp.json();
      if (!resp.ok || !body.ok) {
        feedback.textContent = `Erro ao salvar: ${body.error || "desconhecido"}`;
        return;
      }
      feedback.textContent = "Cliente Google atualizado com sucesso.";
      editForm.classList.add("hidden");
      await fetchGoogleClients();
    });

    grid.appendChild(node);
  });
}

function renderTemplateVariables(channel) {
  const vars = state.templates.variables?.[channel] || {};
  const box = document.getElementById("tplVars");
  box.innerHTML = "";
  Object.entries(vars).forEach(([key, label]) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "var-pill";
    pill.textContent = `{{${key}}}`;
    pill.title = label;
    pill.addEventListener("click", () => {
      const textarea = document.querySelector('#templateForm textarea[name="content"]');
      const insertion = `{{${key}}}`;
      const start = textarea.selectionStart || textarea.value.length;
      const end = textarea.selectionEnd || textarea.value.length;
      textarea.value = `${textarea.value.slice(0, start)}${insertion}${textarea.value.slice(end)}`;
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
    });
    box.appendChild(pill);
  });
}

function renderTemplatesCatalog() {
  const root = document.getElementById("templatesCatalog");
  root.innerHTML = "";
  const channels = state.templates.channels || {};
  Object.entries(channels).forEach(([channel, bucket]) => {
    const section = document.createElement("section");
    section.className = "tpl-channel-box";
    section.innerHTML = `<h3>${channel}</h3>`;
    const list = document.createElement("div");
    list.className = "tpl-items";
    Object.entries(bucket || {}).forEach(([templateId, data]) => {
      const card = document.createElement("article");
      card.className = "tpl-item";
      card.innerHTML = `<h4>${templateId}</h4><p>${data.name || ""}</p><pre>${data.content || ""}</pre>`;
      card.addEventListener("click", () => {
        const form = document.getElementById("templateForm");
        form.elements.channel.value = channel;
        form.elements.template_id.value = templateId;
        form.elements.name.value = data.name || templateId;
        form.elements.description.value = data.description || "";
        form.elements.content.value = data.content || "";
        renderTemplateVariables(channel);
      });
      list.appendChild(card);
    });
    section.appendChild(list);
    root.appendChild(section);
  });
}

async function fetchMetaClients() {
  const r = await fetch(apiUrl("/api/clients"));
  if (!r.ok) throw new Error("Falha ao carregar clientes Meta");
  const data = await r.json();
  state.metaClients = data.clients || [];
  state.eventsByClient.clear();
  for (const c of state.metaClients) state.eventsByClient.set(c.client_name, c.events || []);
  buildStats("statsRow", state.metaClients);
  renderMetaClients();
}

async function fetchGoogleClients() {
  const r = await fetch(apiUrl("/api/google-clients"));
  if (!r.ok) throw new Error("Falha ao carregar clientes Google");
  const data = await r.json();
  state.googleClients = data.clients || [];
  buildStats("googleStatsRow", state.googleClients);
  renderGoogleClients();
}

async function fetchTemplates() {
  const r = await fetch(apiUrl("/api/message-templates"));
  if (!r.ok) throw new Error("Falha ao carregar templates");
  const data = await r.json();
  state.templates = data;
  renderTemplateVariables(document.getElementById("tplChannel").value);
  renderTemplatesCatalog();
}

async function submitNewMetaClient(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const feedback = document.getElementById("formFeedback");
  feedback.textContent = "Enviando...";
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  payload.enabled = !!fd.get("enabled");
  const r = await fetch(apiUrl("/api/clients"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await r.json();
  if (!r.ok || !body.ok) {
    feedback.textContent = `Erro: ${body.error || "nao foi possível salvar"}`;
    return;
  }
  feedback.textContent = "Cliente Meta adicionado com sucesso.";
  form.reset();
  form.querySelector('input[name="enabled"]').checked = true;
  await fetchMetaClients();
}

async function submitNewGoogleClient(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const feedback = document.getElementById("googleFormFeedback");
  feedback.textContent = "Enviando...";
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  payload.enabled = !!fd.get("enabled");
  const r = await fetch(apiUrl("/api/google-clients"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await r.json();
  if (!r.ok || !body.ok) {
    feedback.textContent = `Erro: ${body.error || "nao foi possível salvar"}`;
    return;
  }
  feedback.textContent = "Cliente Google adicionado com sucesso.";
  form.reset();
  form.querySelector('input[name="enabled"]').checked = true;
  await fetchGoogleClients();
}

async function saveTemplate(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const feedback = document.getElementById("templateFeedback");
  feedback.textContent = "Salvando template...";
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  const channel = payload.channel;
  const templateId = payload.template_id;
  const r = await fetch(apiUrl(`/api/message-templates/${encodeURIComponent(channel)}/${encodeURIComponent(templateId)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await r.json();
  if (!r.ok || !body.ok) {
    feedback.textContent = `Erro: ${body.error || "falha ao salvar template"}`;
    return;
  }
  feedback.textContent = "Template salvo com sucesso.";
  await fetchTemplates();
}

async function generateTemplatePreview() {
  const form = document.getElementById("templateForm");
  const payload = Object.fromEntries(new FormData(form).entries());
  const sampleContext = {
    client_name: "Cliente Exemplo",
    nome: "Maria da Silva",
    email: "maria@email.com",
    whatsapp: "https://wa.me/5511999999999",
    form_name: "Formulário Principal",
    respostas: "*interesse:* Plano Premium\n*cidade:* São Paulo",
    customer_id: "253-906-3374",
    period_start_br: "01/04/2026",
    period_end_br: "07/04/2026",
    conversions_block: "- Formulário: 12\n- WhatsApp: 8",
    campaigns_block: "1) *Campanha Busca*\n👁️ Impressoes: 12.300\n🖱️ Cliques: 550",
  };
  const r = await fetch(apiUrl("/api/message-templates/preview"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: payload.content || "", context: sampleContext }),
  });
  const body = await r.json();
  document.getElementById("tplPreview").textContent = body.preview || "";
}

async function simulateHarness(clientId, scenario) {
  const r = await fetch(apiUrl("/api/harness/simulate-webhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, scenario }),
  });
  const body = await r.json();
  if (!r.ok || !body.ok) alert(`Falha no harness: ${body.error || "desconhecido"}`);
}

function applyIncomingEvent(ev) {
  const clientName = (ev.client_name || "").trim();
  if (!clientName) return;
  const list = state.eventsByClient.get(clientName) || [];
  list.push(ev);
  state.eventsByClient.set(clientName, list.slice(-22));
  renderMetaClients();
}

function connectStream() {
  if (state.eventStream) state.eventStream.close();
  const es = new EventSource(apiUrl("/api/events/stream"));
  state.eventStream = es;
  es.addEventListener("open", () => setConnection("live", "Stream ao vivo"));
  es.addEventListener("error", () => setConnection("offline", "Stream desconectado"));
  es.addEventListener("bootstrap", (msg) => {
    try {
      const data = JSON.parse(msg.data);
      for (const ev of data.events || []) applyIncomingEvent(ev);
    } catch (err) {
      console.error(err);
    }
  });
  es.addEventListener("event", (msg) => {
    try {
      applyIncomingEvent(JSON.parse(msg.data));
    } catch (err) {
      console.error(err);
    }
  });
}

function bindTabs() {
  const buttons = Array.from(document.querySelectorAll(".tab-btn"));
  const panels = {
    meta: document.getElementById("tab-meta"),
    google: document.getElementById("tab-google"),
    templates: document.getElementById("tab-templates"),
  };
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      Object.values(panels).forEach((p) => p.classList.remove("is-active"));
      panels[btn.dataset.tab]?.classList.add("is-active");
    });
  });
}

function bindUI() {
  bindTabs();
  document.getElementById("newClientForm").addEventListener("submit", submitNewMetaClient);
  document.getElementById("newGoogleClientForm").addEventListener("submit", submitNewGoogleClient);
  document.getElementById("templateForm").addEventListener("submit", saveTemplate);
  document.getElementById("refreshBtn").addEventListener("click", fetchMetaClients);
  document.getElementById("refreshGoogleBtn").addEventListener("click", fetchGoogleClients);
  document.getElementById("refreshTemplatesBtn").addEventListener("click", fetchTemplates);
  document.getElementById("previewBtn").addEventListener("click", generateTemplatePreview);
  document.getElementById("tplChannel").addEventListener("change", (ev) => renderTemplateVariables(ev.target.value));
}

async function boot() {
  bindUI();
  await Promise.all([fetchMetaClients(), fetchGoogleClients(), fetchTemplates()]);
  connectStream();
}

boot().catch((err) => {
  console.error(err);
  setConnection("offline", "Falha ao iniciar");
});
