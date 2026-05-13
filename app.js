const STORAGE_KEY = "vinduespudser-data-v1";
const SYNC_QUEUE_KEY = "vinduespudser-sync-queue-v1";
const DEFAULT_COMPANY_NAME = "Vinduespudser";
const EMAIL_OPEN_DELAY_MS = 100; // Delay to prevent email opening from interrupting PDF download
const installBtn = document.getElementById("installBtn");
const notifyBtn = document.getElementById("notifyBtn");
const updateBtn = document.getElementById("updateBtn");
const syncStatus = document.getElementById("syncStatus");

let deferredPrompt;

const defaultState = {
  company: { 
    name: "", 
    address: "", 
    cvr: "", 
    email: "", 
    phone: "", 
    mobilePay: "", 
    bankAccount: "" 
  },
  customers: [],
  tasks: [],
  invoices: [],
  invoiceCounter: 1,
  settings: { sheetUrl: "", sheetToken: "" },
};

const state = loadState();

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function queueSync(action, payload) {
  const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || "[]");
  queue.push({ id: uid(), ts: new Date().toISOString(), action, payload });
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

function clearQueue() {
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

function getQueue() {
  return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || "[]");
}

function byId(id) {
  return document.getElementById(id);
}

const INTERVAL_LABELS = { weekly: "Ugentlig", monthly: "Månedlig", quarterly: "Kvartalsvis" };

function createNextRecurringTask(task) {
  if (!task.interval) return;
  const base = new Date(task.date);
  if (task.interval === "weekly") {
    base.setDate(base.getDate() + 7);
  } else if (task.interval === "monthly") {
    base.setMonth(base.getMonth() + 1);
  } else if (task.interval === "quarterly") {
    base.setMonth(base.getMonth() + 3);
  } else {
    return;
  }
  const nextDate = base.toISOString().slice(0, 10);
  const exists = state.tasks.some(
    (t) => t.customerId === task.customerId && t.title === task.title && t.date === nextDate
  );
  if (exists) return;
  const newTask = {
    id: uid(),
    customerId: task.customerId,
    title: task.title,
    date: nextDate,
    status: "new",
    note: task.note || "",
    attachment: "",
    interval: task.interval,
  };
  state.tasks.push(newTask);
  saveState();
  queueSync("task_create", newTask);
}

function createInvoiceFromTask(task) {
  const invoiceCustomer = byId("invoiceCustomer");
  invoiceCustomer.value = task.customerId;
  const desc = task.note ? `${task.title}\n${task.note}` : task.title;
  byId("invoiceText").value = desc;
  byId("invoiceDate").value = task.date;
  byId("invoiceSection").scrollIntoView({ behavior: "smooth" });
}

function renderRouteView() {
  const routeDiv = byId("routeView");
  if (!routeDiv) return;
  const today = new Date().toISOString().slice(0, 10);
  const pending = [...state.tasks]
    .filter((t) => t.status !== "done" && t.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.customerId.localeCompare(b.customerId));

  const byDate = {};
  for (const t of pending) {
    (byDate[t.date] = byDate[t.date] || []).push(t);
  }

  const keys = Object.keys(byDate);
  if (!keys.length) {
    routeDiv.innerHTML = "<span class='small'>Ingen kommende opgaver.</span>";
    return;
  }
  routeDiv.innerHTML = keys
    .map((date) => {
      const items = byDate[date]
        .map((t) => {
          const c = state.customers.find((x) => x.id === t.customerId);
          const address = (c?.street && c?.postalCode && c?.city) ? `${c.street}, ${c.postalCode} ${c.city}` : (c?.address || "");
          return `<div class="small">• <strong>${c?.name || "Ukendt"}</strong> – ${address} (${t.title})</div>`;
        })
        .join("");
      return `<div class="route-day"><div class="route-date">${date}</div>${items}</div>`;
    })
    .join("");
}

function renderStats() {
  const done = state.tasks.filter((t) => t.status === "done").length;
  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = state.tasks.filter((t) => t.date === today).length;
  byId("stats").innerHTML = `
    <div class="stat"><strong>${state.customers.length}</strong><div class="small">Kunder</div></div>
    <div class="stat"><strong>${state.tasks.length}</strong><div class="small">Opgaver</div></div>
    <div class="stat"><strong>${todayTasks}</strong><div class="small">I dag</div></div>
    <div class="stat"><strong>${done}</strong><div class="small">Færdige</div></div>
  `;
}

function renderTodayTasks() {
  const list = byId("todayTaskList");
  if (!list) return;
  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = state.tasks.filter((t) => t.date === today);
  
  if (todayTasks.length === 0) {
    list.innerHTML = "<li class='small'>Ingen opgaver for i dag.</li>";
    return;
  }

  list.innerHTML = "";
  for (const t of todayTasks) {
    const customer = state.customers.find((c) => c.id === t.customerId)?.name || "Ukendt kunde";
    const li = document.createElement("li");
    const statusBadge = t.status === "done" ? "✓" : t.status === "in_progress" ? "→" : "•";
    li.innerHTML = `
      <strong>${statusBadge} ${t.title}</strong>
      <div class="small">${customer} · ${t.status}</div>
      ${t.note ? `<div class="small">${t.note}</div>` : ""}
    `;
    list.appendChild(li);
  }
}

function renderMonthStats() {
  const monthStatsEl = byId("monthStats");
  if (!monthStatsEl) return;
  
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
  
  const monthInvoices = state.invoices.filter(inv => inv.date.startsWith(currentMonth));
  const monthRevenue = monthInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const monthTasks = state.tasks.filter(t => t.date.startsWith(currentMonth) && t.status === "done").length;
  
  monthStatsEl.innerHTML = `
    <div class="stat"><strong>${monthInvoices.length}</strong><div class="small">Fakturaer denne måned</div></div>
    <div class="stat"><strong>${formatAmount(monthRevenue)} kr.</strong><div class="small">Omsætning</div></div>
    <div class="stat"><strong>${monthTasks}</strong><div class="small">Færdige opgaver</div></div>
    <div class="stat"><strong>${state.invoices.length}</strong><div class="small">Fakturaer i alt</div></div>
  `;
}

function renderCustomers() {
  const list = byId("customerList");
  list.innerHTML = "";
  for (const c of state.customers) {
    const li = document.createElement("li");
    const address = (c.street && c.postalCode && c.city) ? `${c.street}, ${c.postalCode} ${c.city}` : (c.address || "");
    li.innerHTML = `<strong>${c.name}</strong><div class="small">${address} · ${c.phone || "-"} · ${c.email || "-"}</div>`;
    list.appendChild(li);
  }

  const taskSelect = byId("taskCustomer");
  taskSelect.innerHTML = `<option value="">Vælg kunde</option>`;
  const invoiceSelect = byId("invoiceCustomer");
  invoiceSelect.innerHTML = `<option value="">Vælg kunde</option>`;
  for (const c of state.customers) {
    const makeOpt = () => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      return opt;
    };
    taskSelect.appendChild(makeOpt());
    invoiceSelect.appendChild(makeOpt());
  }
}

function renderCalendar() {
  const grouped = state.tasks.reduce((acc, task) => {
    acc[task.date] = (acc[task.date] || 0) + 1;
    return acc;
  }, {});
  const rows = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => `<div>${date}: ${count} opgave(r)</div>`)
    .join("");
  byId("calendar").innerHTML = rows || "<span class='small'>Ingen planlagte opgaver endnu.</span>";
}

function filteredTasks() {
  const q = byId("taskSearch").value.trim().toLowerCase();
  const status = byId("taskFilterStatus").value;
  const sort = byId("taskSort").value;

  let rows = state.tasks.filter((t) => {
    const hit = t.title.toLowerCase().includes(q) || (t.note || "").toLowerCase().includes(q);
    const statusOk = status === "all" || t.status === status;
    return hit && statusOk;
  });

  rows.sort((a, b) => (sort === "dateAsc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  return rows;
}

function renderTasks() {
  const list = byId("taskList");
  list.innerHTML = "";
  const rows = filteredTasks();

  for (const t of rows) {
    const customer = state.customers.find((c) => c.id === t.customerId)?.name || "Ukendt kunde";
    const li = document.createElement("li");
    const intervalBadge = t.interval ? `<span class="badge">${INTERVAL_LABELS[t.interval] || t.interval}</span>` : "";
    li.innerHTML = `
      <strong>${t.title}</strong> ${intervalBadge}
      <div class="small">${customer} · ${t.date} · ${t.status}</div>
      <div>${t.note || ""}</div>
      ${t.attachment ? `<img src="${t.attachment}" alt="Vedhæftet" style="max-width:120px; margin-top:6px; border-radius:6px;" />` : ""}
    `;

    const row = document.createElement("div");
    row.className = "header-actions";

    const statusSelect = document.createElement("select");
    ["new", "in_progress", "done"].forEach((s) => {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      if (s === t.status) o.selected = true;
      statusSelect.appendChild(o);
    });
    statusSelect.addEventListener("change", () => {
      t.status = statusSelect.value;
      saveState();
      queueSync("task_status", { id: t.id, status: t.status });
      if (t.status === "done" && t.interval) {
        createNextRecurringTask(t);
      }
      renderAll();
      autoSync();
    });

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Slet";
    del.addEventListener("click", () => {
      state.tasks = state.tasks.filter((x) => x.id !== t.id);
      saveState();
      queueSync("task_delete", { id: t.id });
      renderAll();
      autoSync();
    });

    if (t.status === "done") {
      const invoiceBtn = document.createElement("button");
      invoiceBtn.type = "button";
      invoiceBtn.textContent = "Lav faktura";
      invoiceBtn.style.background = "#16a34a";
      invoiceBtn.addEventListener("click", () => createInvoiceFromTask(t));
      row.append(statusSelect, invoiceBtn, del);
    } else {
      row.append(statusSelect, del);
    }
    li.appendChild(row);
    list.appendChild(li);
  }
}

function csvEscape(value) {
  const s = String(value ?? "");
  return `"${s.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const headers = ["id", "title", "date", "status", "customer", "note"];
  const lines = [headers.join(",")];
  for (const t of state.tasks) {
    const customer = state.customers.find((c) => c.id === t.customerId)?.name || "";
    lines.push([
      csvEscape(t.id),
      csvEscape(t.title),
      csvEscape(t.date),
      csvEscape(t.status),
      csvEscape(customer),
      csvEscape(t.note),
    ].join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `opgaver-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => {
      const details = reader.error?.message || "ukendt fejl";
      reject(new Error(`Kunne ikke læse fil: ${details}`));
    };
    reader.readAsDataURL(file);
  });
}

async function sendToSheet(payload) {
  if (!state.settings.sheetUrl) {
    if (syncStatus) syncStatus.textContent = "Ingen Sheet URL sat.";
    return false;
  }
  const res = await fetch(state.settings.sheetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: state.settings.sheetToken || undefined,
      payload,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return true;
}

async function loadFromSheet() {
  if (!state.settings.sheetUrl) {
    return null;
  }
  
  try {
    const res = await fetch(state.settings.sheetUrl, {
      method: "GET",
      headers: { 
        "Content-Type": "application/json",
        ...(state.settings.sheetToken && { "Authorization": `Bearer ${state.settings.sheetToken}` })
      },
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Fejl ved indlæsning fra Google Sheets:", err);
    return null;
  }
}

async function syncFromSheet() {
  if (!navigator.onLine) return false;
  if (!state.settings.sheetUrl) return false;
  
  try {
    const data = await loadFromSheet();
    if (!data) return false;
    
    // Merge data from Google Sheets
    if (data.company) {
      state.company = { ...defaultState.company, ...data.company };
    }
    if (Array.isArray(data.customers)) {
      state.customers = data.customers;
    }
    if (Array.isArray(data.tasks)) {
      state.tasks = data.tasks;
    }
    if (Array.isArray(data.invoices)) {
      state.invoices = data.invoices;
    }
    if (typeof data.invoiceCounter === "number") {
      state.invoiceCounter = data.invoiceCounter;
    }
    
    saveState();
    return true;
  } catch (err) {
    console.error("Fejl ved synkronisering fra Google Sheets:", err);
    return false;
  }
}

async function fullSync() {
  if (!navigator.onLine) return;
  if (!state.settings.sheetUrl) return;
  
  try {
    // First, try to load data from Google Sheets
    const loaded = await syncFromSheet();
    
    // Then send current state to ensure everything is backed up
    const ok = await sendToSheet({
      company: state.company,
      customers: state.customers,
      tasks: state.tasks,
      invoices: state.invoices,
      invoiceCounter: state.invoiceCounter,
      queue: getQueue(),
      syncedAt: new Date().toISOString(),
    });
    
    if (ok) {
      clearQueue();
      if (syncStatus) {
        syncStatus.textContent = `✓ Fuld synkronisering gennemført (${new Date().toLocaleTimeString()})`;
      }
      renderAll();
    }
  } catch (err) {
    if (syncStatus) syncStatus.textContent = `✗ Sync fejlede: ${err.message}`;
  }
}

async function autoSync() {
  if (!navigator.onLine) return;
  const queue = getQueue();
  if (!queue.length) return;
  try {
    const ok = await sendToSheet({
      company: state.company,
      customers: state.customers,
      tasks: state.tasks,
      invoices: state.invoices,
      queue,
      syncedAt: new Date().toISOString(),
    });
    if (ok) {
      clearQueue();
      if (syncStatus) syncStatus.textContent = `✓ Synkroniseret (${new Date().toLocaleTimeString()})`;
    }
  } catch {
    if (syncStatus) syncStatus.textContent = "✗ Sync fejlede, kø beholdes.";
  }
}

function scheduleReminders() {
  if (Notification.permission !== "granted") return;
  const now = new Date().toISOString().slice(0, 10);
  const due = state.tasks.filter((t) => t.date === now && t.status !== "done");
  if (due.length > 0) {
    new Notification("Vinduespudser", { body: `Du har ${due.length} opgaver i dag.` });
  }
}

function formatAmount(amount) {
  return Number(amount).toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateInvoicePdf(customer, invoiceNumber, description, amount, date) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const LINE_HEIGHT = 7;
  const LEFT = 20;
  const RIGHT = 188;

  doc.setFontSize(24);
  doc.setFont(undefined, "bold");
  doc.text("FAKTURA", 105, 25, { align: "center" });

  // Company info (from right)
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  let companyY = 20;
  if (state.company.name) {
    doc.setFont(undefined, "bold");
    doc.text(state.company.name, RIGHT, companyY, { align: "right" });
    companyY += 5;
    doc.setFont(undefined, "normal");
  }
  if (state.company.address) {
    doc.text(state.company.address, RIGHT, companyY, { align: "right" });
    companyY += 5;
  }
  if (state.company.cvr) {
    doc.text(`CVR: ${state.company.cvr}`, RIGHT, companyY, { align: "right" });
    companyY += 5;
  }
  if (state.company.phone) {
    doc.text(`Tlf: ${state.company.phone}`, RIGHT, companyY, { align: "right" });
    companyY += 5;
  }
  if (state.company.email) {
    doc.text(state.company.email, RIGHT, companyY, { align: "right" });
  }

  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text(`Fakturanummer: ${invoiceNumber}`, LEFT, 45);
  doc.text(`Dato: ${date}`, LEFT, 52);

  doc.setFont(undefined, "bold");
  doc.text("Kunde:", LEFT, 65);
  doc.setFont(undefined, "normal");

  let y = 72;
  doc.text(customer.name, LEFT, y); y += LINE_HEIGHT;
  
  // Handle both old and new address formats
  if (customer.street && customer.postalCode && customer.city) {
    doc.text(customer.street, LEFT, y); y += LINE_HEIGHT;
    doc.text(`${customer.postalCode} ${customer.city}`, LEFT, y); y += LINE_HEIGHT;
  } else if (customer.address) {
    doc.text(customer.address, LEFT, y); y += LINE_HEIGHT;
  }
  
  if (customer.phone) { doc.text(`Tlf: ${customer.phone}`, LEFT, y); y += LINE_HEIGHT; }
  if (customer.email) { doc.text(`Email: ${customer.email}`, LEFT, y); y += LINE_HEIGHT; }

  const tableTop = y + 10;
  doc.setFillColor(230, 237, 248);
  doc.rect(LEFT, tableTop - 7, 170, 9, "F");
  doc.setFont(undefined, "bold");
  doc.text("Beskrivelse", LEFT + 2, tableTop);
  doc.text("Beløb", RIGHT, tableTop, { align: "right" });

  doc.setFont(undefined, "normal");
  const lines = doc.splitTextToSize(description, 140);
  const descY = tableTop + LINE_HEIGHT + 3;
  doc.text(lines, LEFT + 2, descY);
  doc.text(`${formatAmount(amount)} kr.`, RIGHT, descY, { align: "right" });

  const totalY = descY + lines.length * LINE_HEIGHT + 11;
  doc.setDrawColor(180, 180, 180);
  doc.line(LEFT, totalY - 6, 190, totalY - 6);
  doc.setFont(undefined, "bold");
  doc.setFontSize(12);
  doc.text("Total:", 130, totalY);
  doc.text(`${formatAmount(amount)} kr.`, RIGHT, totalY, { align: "right" });

  // Payment info at bottom
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  let payY = totalY + 20;
  if (state.company.bankAccount) {
    doc.text(`Kontonummer: ${state.company.bankAccount}`, LEFT, payY);
    payY += 5;
  }
  if (state.company.mobilePay) {
    doc.text(`MobilePay: ${state.company.mobilePay}`, LEFT, payY);
  }

  return doc;
}

function downloadInvoicePdf(doc, invoiceNumber) {
  doc.save(`faktura-${invoiceNumber}.pdf`);
}

function openInvoiceEmail(customer, invoiceNumber, amount, date) {
  if (!customer.email) {
    alert(`Kunde ${customer.name} har ingen email registreret.`);
    return false;
  }
  
  const companyName = state.company.name || DEFAULT_COMPANY_NAME;
  const subject = encodeURIComponent(`Faktura ${invoiceNumber} – ${date}`);
  const body = encodeURIComponent(
    `Kære ${customer.name},\n\nVedhæftet finder du faktura ${invoiceNumber} af ${date} for ${formatAmount(amount)} kr.\n\nMed venlig hilsen\n${companyName}`
  );
  const mailto = `mailto:${customer.email}?subject=${subject}&body=${body}`;
  
  // Use setTimeout to prevent interrupting downloads
  // Try window.open first, with link fallback for better compatibility
  setTimeout(() => {
    try {
      // window.open may return null if blocked by popup blocker
      const result = window.open(mailto);
      if (!result) {
        // Popup blocked, use fallback
        const link = document.createElement("a");
        link.href = mailto;
        link.click();
      }
    } catch (err) {
      // Exception thrown, use fallback
      try {
        const link = document.createElement("a");
        link.href = mailto;
        link.click();
      } catch (fallbackErr) {
        console.error("Failed to open email client:", err, fallbackErr);
        alert("Kunne ikke åbne email-klient. Kopiér venligst kunde email manuelt: " + customer.email);
      }
    }
  }, EMAIL_OPEN_DELAY_MS);
  
  return true;
}

function renderInvoices() {
  const list = byId("invoiceList");
  list.innerHTML = "";
  const sorted = [...state.invoices].sort((a, b) => b.date.localeCompare(a.date));
  for (const inv of sorted) {
    const customer = state.customers.find((c) => c.id === inv.customerId);
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>Faktura #${inv.invoiceNumber}</strong>
      <div class="small">${customer?.name || "Ukendt"} · ${inv.date} · ${formatAmount(inv.amount)} kr.</div>
      <div class="small">${inv.description}</div>
    `;
    const row = document.createElement("div");
    row.className = "header-actions";

    const pdfBtn = document.createElement("button");
    pdfBtn.type = "button";
    pdfBtn.textContent = "Download PDF";
    pdfBtn.addEventListener("click", () => {
      if (!customer) return;
      const doc = generateInvoicePdf(customer, inv.invoiceNumber, inv.description, inv.amount, inv.date);
      downloadInvoicePdf(doc, inv.invoiceNumber);
    });

    const emailBtn = document.createElement("button");
    emailBtn.type = "button";
    emailBtn.textContent = "Send email";
    emailBtn.addEventListener("click", () => {
      if (!customer) return;
      openInvoiceEmail(customer, inv.invoiceNumber, inv.amount, inv.date);
    });

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Slet";
    del.addEventListener("click", () => {
      state.invoices = state.invoices.filter((x) => x.id !== inv.id);
      saveState();
      renderInvoices();
    });

    row.append(pdfBtn, emailBtn, del);
    li.appendChild(row);
    list.appendChild(li);
  }
}

function renderAllCustomersList() {
  const container = byId("allCustomersList");
  if (!container) return;
  
  if (state.customers.length === 0) {
    container.innerHTML = "<p class='small'>Ingen kunder endnu.</p>";
    return;
  }
  
  container.innerHTML = "";
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th style="text-align: left; padding: 8px; border-bottom: 2px solid #ddd;">Navn</th>
      <th style="text-align: left; padding: 8px; border-bottom: 2px solid #ddd;">Adresse</th>
      <th style="text-align: left; padding: 8px; border-bottom: 2px solid #ddd;">Telefon</th>
      <th style="text-align: left; padding: 8px; border-bottom: 2px solid #ddd;">Email</th>
    </tr>
  `;
  table.appendChild(thead);
  
  const tbody = document.createElement("tbody");
  for (const c of state.customers) {
    const tr = document.createElement("tr");
    const address = (c.street && c.postalCode && c.city) ? `${c.street}, ${c.postalCode} ${c.city}` : (c.address || "-");
    tr.innerHTML = `
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${c.name}</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${address}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${c.phone || "-"}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${c.email || "-"}</td>
    `;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderVersionHistory() {
  const container = byId("versionHistory");
  if (!container) return;
  
  // Version entries are now managed directly here, not stored in state
  const versionEntries = [
    { version: "v1.5.0", date: "2026-05-13", description: "Tilføjet 'Opdater' knap til at tvinge cache refresh og hente ny version på Android" },
    { version: "v1.4.0", date: "2026-05-13", description: "Tilføjet bidirektionel Google Sheets synkronisering (hent + gem data)" },
    { version: "v1.3.0", date: "2026-05-13", description: "Tilføjet Kunder-fane, opdelt kundeadresse i vej/postnr/by, og versionshistorik" },
    { version: "v1.2.0", date: "2026-05-12", description: "Forbedret fakturafunktionalitet og email-integration" },
    { version: "v1.1.0", date: "2026-05-10", description: "Tilføjet support for Google Sheets synkronisering" },
    { version: "v1.0.0", date: "2026-05-08", description: "Initial version med Dashboard, Fakturaer og Opsætning" }
  ];
  
  container.innerHTML = "";
  const list = document.createElement("ul");
  list.style.listStyle = "none";
  list.style.padding = "0";
  
  const entries = versionEntries.slice(0, 5);
  for (const entry of entries) {
    const li = document.createElement("li");
    li.style.marginBottom = "12px";
    li.style.paddingBottom = "12px";
    li.style.borderBottom = "1px solid #eee";
    li.innerHTML = `
      <div><strong>${entry.version}</strong> <span class="small" style="color: #666;">${entry.date}</span></div>
      <div class="small">${entry.description}</div>
    `;
    list.appendChild(li);
  }
  container.appendChild(list);
}

function renderAll() {
  renderStats();
  renderTodayTasks();
  renderMonthStats();
  renderCustomers();
  renderAllCustomersList();
  renderVersionHistory();
  renderTasks();
  renderCalendar();
  renderRouteView();
  renderInvoices();
  
  // Company info
  byId("companyName").value = state.company.name || "";
  byId("companyAddress").value = state.company.address || "";
  byId("companyCvr").value = state.company.cvr || "";
  byId("companyEmail").value = state.company.email || "";
  byId("companyPhone").value = state.company.phone || "";
  byId("companyMobilePay").value = state.company.mobilePay || "";
  byId("companyBankAccount").value = state.company.bankAccount || "";
  
  // Sync settings
  byId("sheetUrl").value = state.settings.sheetUrl || "";
  byId("sheetToken").value = state.settings.sheetToken || "";
  
  if (!byId("invoiceDate").value) {
    byId("invoiceDate").value = new Date().toISOString().slice(0, 10);
  }
}

// Tab navigation
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    
    // Update buttons
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    // Update content
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    const targetContent = document.querySelector(`.tab-content[data-tab="${tab}"]`);
    if (targetContent) {
      targetContent.classList.add("active");
    }
  });
});

// Company form
byId("companyForm").addEventListener("submit", (e) => {
  e.preventDefault();
  state.company = {
    name: byId("companyName").value.trim(),
    address: byId("companyAddress").value.trim(),
    cvr: byId("companyCvr").value.trim(),
    email: byId("companyEmail").value.trim(),
    phone: byId("companyPhone").value.trim(),
    mobilePay: byId("companyMobilePay").value.trim(),
    bankAccount: byId("companyBankAccount").value.trim(),
  };
  saveState();
  queueSync("company_update", state.company);
  alert("Firma information gemt!");
  autoSync();
});

byId("customerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const c = {
    id: uid(),
    name: byId("customerName").value.trim(),
    street: byId("customerStreet").value.trim(),
    postalCode: byId("customerPostalCode").value.trim(),
    city: byId("customerCity").value.trim(),
    phone: byId("customerPhone").value.trim(),
    email: byId("customerEmail").value.trim(),
  };
  state.customers.push(c);
  saveState();
  queueSync("customer_create", c);
  e.target.reset();
  renderAll();
  autoSync();
});

byId("taskForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = byId("taskAttachment").files[0];
  const task = {
    id: uid(),
    customerId: byId("taskCustomer").value,
    title: byId("taskTitle").value.trim(),
    date: byId("taskDate").value,
    status: byId("taskStatus").value,
    note: byId("taskNote").value.trim(),
    attachment: file ? await fileToDataUrl(file) : "",
    interval: byId("taskInterval").value,
  };
  state.tasks.push(task);
  saveState();
  queueSync("task_create", task);
  e.target.reset();
  renderAll();
  autoSync();
});

byId("invoiceForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const customerId = byId("invoiceCustomer").value;
  const customer = state.customers.find((c) => c.id === customerId);
  if (!customer) return;

  const invoiceNumber = String(state.invoiceCounter).padStart(4, "0");
  state.invoiceCounter += 1;

  const inv = {
    id: uid(),
    invoiceNumber,
    customerId,
    description: byId("invoiceText").value.trim(),
    amount: parseFloat(byId("invoiceAmount").value),
    date: byId("invoiceDate").value,
  };
  state.invoices.push(inv);
  saveState();

  // Generate and download PDF first
  const doc = generateInvoicePdf(customer, invoiceNumber, inv.description, inv.amount, inv.date);
  downloadInvoicePdf(doc, invoiceNumber);
  
  // Open email client after a short delay to allow download to start
  openInvoiceEmail(customer, invoiceNumber, inv.amount, inv.date);

  e.target.reset();
  byId("invoiceDate").value = new Date().toISOString().slice(0, 10);
  renderInvoices();
});

["taskSearch", "taskFilterStatus", "taskSort"].forEach((id) => {
  byId(id).addEventListener("input", renderTasks);
  byId(id).addEventListener("change", renderTasks);
});

byId("exportCsvBtn").addEventListener("click", exportCsv);

byId("toggleRouteBtn").addEventListener("click", () => {
  const routeSection = byId("routeSection");
  const hidden = routeSection.hidden;
  routeSection.hidden = !hidden;
  byId("toggleRouteBtn").textContent = hidden ? "Skjul ruteliste" : "Vis ruteliste";
});

// Sync form
byId("syncForm").addEventListener("submit", (e) => {
  e.preventDefault();
  state.settings.sheetUrl = byId("sheetUrl").value.trim();
  state.settings.sheetToken = byId("sheetToken").value.trim();
  saveState();
  queueSync("settings_update", { ...state.settings, sheetToken: "***" });
  syncStatus.textContent = "✓ Sync-indstillinger gemt.";
  autoSync();
});

byId("testSyncBtn").addEventListener("click", async () => {
  if (!state.settings.sheetUrl) {
    syncStatus.textContent = "⚠ Angiv venligst en Apps Script URL først.";
    return;
  }
  
  syncStatus.textContent = "⏳ Tester forbindelse...";
  
  try {
    const testPayload = {
      test: true,
      timestamp: new Date().toISOString(),
      company: state.company,
    };
    
    const res = await fetch(state.settings.sheetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: state.settings.sheetToken || undefined,
        payload: testPayload,
      }),
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    syncStatus.textContent = "✓ Forbindelse OK! Google Sheets er konfigureret korrekt.";
  } catch (err) {
    syncStatus.textContent = `✗ Fejl: ${err.message}`;
  }
});

byId("loadFromSheetBtn").addEventListener("click", async () => {
  if (!state.settings.sheetUrl) {
    syncStatus.textContent = "⚠ Angiv venligst en Apps Script URL først.";
    return;
  }
  
  syncStatus.textContent = "⏳ Henter data fra Google Sheets...";
  
  try {
    const loaded = await syncFromSheet();
    if (loaded) {
      syncStatus.textContent = `✓ Data hentet fra Google Sheets (${new Date().toLocaleTimeString()})`;
      renderAll();
    } else {
      syncStatus.textContent = "⚠ Kunne ikke hente data fra Google Sheets.";
    }
  } catch (err) {
    syncStatus.textContent = `✗ Fejl: ${err.message}`;
  }
});

byId("fullSyncBtn").addEventListener("click", async () => {
  if (!state.settings.sheetUrl) {
    syncStatus.textContent = "⚠ Angiv venligst en Apps Script URL først.";
    return;
  }
  
  syncStatus.textContent = "⏳ Udfører fuld synkronisering...";
  
  try {
    await fullSync();
  } catch (err) {
    syncStatus.textContent = `✗ Fejl: ${err.message}`;
  }
});

notifyBtn.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("Notifikationer understøttes ikke i denne browser.");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    scheduleReminders();
  }
});

window.addEventListener("online", autoSync);

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

updateBtn.addEventListener("click", async () => {
  updateBtn.textContent = "🔄 Tjekker...";
  updateBtn.disabled = true;
  
  // Set timeout to prevent button from being stuck
  const timeout = setTimeout(() => {
    updateBtn.textContent = "🔄 Opdater";
    updateBtn.disabled = false;
    alert("Opdatering tog for lang tid. Prøv igen.");
  }, 15000); // 15 second timeout
  
  try {
    if ("serviceWorker" in navigator) {
      // Get the current service worker registration
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        // Force check for updates
        await registration.update();
        
        // If there's a waiting service worker, activate it immediately
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          
          // Wait for the new service worker to take control (once only)
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            clearTimeout(timeout);
            window.location.reload();
          }, { once: true });
        } else {
          // No update available, just clear cache and reload
          if ("caches" in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
          }
          clearTimeout(timeout);
          window.location.reload();
        }
      } else {
        // No service worker registered, just reload
        clearTimeout(timeout);
        window.location.reload();
      }
    } else {
      // No service worker support, just reload
      clearTimeout(timeout);
      window.location.reload();
    }
  } catch (error) {
    console.error("Update check failed:", error);
    clearTimeout(timeout);
    updateBtn.textContent = "🔄 Opdater";
    updateBtn.disabled = false;
    alert("Kunne ikke tjekke for opdateringer. Prøv at genindlæse siden manuelt.");
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

// Initialize the app
renderAll();

// Try to load data from Google Sheets on startup if configured
if (state.settings.sheetUrl && navigator.onLine) {
  syncFromSheet().then(loaded => {
    if (loaded) {
      renderAll();
      if (syncStatus) syncStatus.textContent = "✓ Data indlæst fra Google Sheets ved opstart.";
    }
  });
}

autoSync();
setTimeout(scheduleReminders, 2000);
