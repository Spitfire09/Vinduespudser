const STORAGE_KEY = "vinduespudser-data-v1";
const SYNC_QUEUE_KEY = "vinduespudser-sync-queue-v1";
const installBtn = document.getElementById("installBtn");
const notifyBtn = document.getElementById("notifyBtn");
const syncStatus = document.getElementById("syncStatus");

let deferredPrompt;

const defaultState = {
  profile: { name: "", email: "" },
  customers: [],
  tasks: [],
  invoices: [],
  nextInvoiceNumber: 1,
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

function renderCustomers() {
  const list = byId("customerList");
  list.innerHTML = "";
  for (const c of state.customers) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${c.name}</strong><div class="small">${c.address} · ${c.phone || "-"} · ${c.email || "-"}</div>`;
    list.appendChild(li);
  }

  const selectors = [byId("taskCustomer"), byId("invoiceCustomer")];
  for (const select of selectors) {
    select.innerHTML = `<option value="">Vælg kunde</option>`;
    for (const c of state.customers) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    }
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
    li.innerHTML = `
      <strong>${t.title}</strong>
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

    row.append(statusSelect, del);
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

function generateInvoicePdf(invoice, customer) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const margin = 20;
  const pageWidth = 210;
  let y = margin;

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("FAKTURA", margin, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (state.profile.name) {
    doc.text(state.profile.name, pageWidth - margin, y, { align: "right" });
    y += 5;
  }
  if (state.profile.email) {
    doc.text(state.profile.email, pageWidth - margin, y, { align: "right" });
  }

  y = margin + 20;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Til:", margin, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  doc.text(customer.name, margin, y);
  y += 5;
  if (customer.address) {
    doc.text(customer.address, margin, y);
    y += 5;
  }
  if (customer.email) {
    doc.text(customer.email, margin, y);
    y += 5;
  }

  y += 5;
  doc.setFontSize(10);
  doc.text(`Fakturanummer: ${invoice.number}`, margin, y);
  doc.text(`Fakturadato: ${invoice.date}`, pageWidth - margin, y, { align: "right" });
  y += 5;
  doc.text(`Forfaldsdato: ${invoice.dueDate}`, pageWidth - margin, y, { align: "right" });

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.text("Beskrivelse", margin, y);
  doc.text("Beløb", pageWidth - margin, y, { align: "right" });
  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  const descLines = doc.splitTextToSize(invoice.description, 140);
  doc.text(descLines, margin, y);
  doc.text(`${invoice.amount.toFixed(2)} kr.`, pageWidth - margin, y, { align: "right" });
  y += descLines.length * 5 + 6;

  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  const vat = invoice.amount * 0.25;
  const total = invoice.amount + vat;

  doc.text("Subtotal:", 150, y);
  doc.text(`${invoice.amount.toFixed(2)} kr.`, pageWidth - margin, y, { align: "right" });
  y += 6;
  doc.text("Moms (25%):", 150, y);
  doc.text(`${vat.toFixed(2)} kr.`, pageWidth - margin, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("I alt:", 150, y);
  doc.text(`${total.toFixed(2)} kr.`, pageWidth - margin, y, { align: "right" });

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Betalingsbetingelser: 30 dage netto", margin, y);

  return doc;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function renderInvoices() {
  const list = byId("invoiceList");
  list.innerHTML = "";
  for (const inv of [...state.invoices].reverse()) {
    const customer = state.customers.find((c) => c.id === inv.customerId);
    const customerName = customer?.name || "Ukendt kunde";
    const vat = inv.amount * 0.25;
    const total = inv.amount + vat;
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${inv.number}</strong>
      <div class="small">${customerName} · ${inv.date} · I alt: ${total.toFixed(2)} kr.</div>
      <div>${inv.description}</div>
    `;

    const row = document.createElement("div");
    row.className = "header-actions";

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.textContent = "Download PDF";
    downloadBtn.addEventListener("click", () => {
      if (!customer) { alert("Kunden blev ikke fundet."); return; }
      const doc = generateInvoicePdf(inv, customer);
      doc.save(`${inv.number}.pdf`);
    });

    const emailBtn = document.createElement("button");
    emailBtn.type = "button";
    emailBtn.textContent = "Send email";
    emailBtn.addEventListener("click", () => {
      if (!customer) { alert("Kunden blev ikke fundet."); return; }
      sendInvoiceByEmail(inv, customer);
    });

    row.append(downloadBtn, emailBtn);
    li.appendChild(row);
    list.appendChild(li);
  }
}

function sendInvoiceByEmail(invoice, customer) {
  if (!customer.email) {
    alert("Kunden har ingen email-adresse tilknyttet.");
    return;
  }
  const vat = invoice.amount * 0.25;
  const total = invoice.amount + vat;
  const doc = generateInvoicePdf(invoice, customer);
  doc.save(`${invoice.number}.pdf`);

  const subject = encodeURIComponent(`Faktura ${invoice.number}`);
  const body = encodeURIComponent(
    `Kære ${customer.name},\n\nVedhæft venligst den downloadede PDF-fil (${invoice.number}.pdf).\n\nFakturanummer: ${invoice.number}\nDato: ${invoice.date}\nForfalder: ${invoice.dueDate}\n\nBeskrivelse: ${invoice.description}\n\nBeløb ekskl. moms: ${invoice.amount.toFixed(2)} kr.\nMoms (25%): ${vat.toFixed(2)} kr.\nI alt: ${total.toFixed(2)} kr.\n\nMed venlig hilsen\n${state.profile.name || ""}`
  );
  window.open(`mailto:${customer.email}?subject=${subject}&body=${body}`, "_self");
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
    syncStatus.textContent = "Ingen Sheet URL sat.";
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

async function autoSync() {
  if (!navigator.onLine) return;
  const queue = getQueue();
  if (!queue.length) return;
  try {
    const ok = await sendToSheet({
      profile: state.profile,
      customers: state.customers,
      tasks: state.tasks,
      queue,
      syncedAt: new Date().toISOString(),
    });
    if (ok) {
      clearQueue();
      syncStatus.textContent = `Synkroniseret (${new Date().toLocaleTimeString()})`;
    }
  } catch {
    syncStatus.textContent = "Sync fejlede, kø beholdes.";
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

function renderAll() {
  renderStats();
  renderCustomers();
  renderTasks();
  renderCalendar();
  renderInvoices();
  byId("name").value = state.profile.name || "";
  byId("email").value = state.profile.email || "";
  byId("sheetUrl").value = state.settings.sheetUrl || "";
  byId("sheetToken").value = state.settings.sheetToken || "";
}

byId("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  state.profile = {
    name: byId("name").value.trim(),
    email: byId("email").value.trim(),
  };
  saveState();
  queueSync("profile_update", state.profile);
  renderAll();
  autoSync();
});

byId("customerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const c = {
    id: uid(),
    name: byId("customerName").value.trim(),
    address: byId("customerAddress").value.trim(),
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
  };
  state.tasks.push(task);
  saveState();
  queueSync("task_create", task);
  e.target.reset();
  renderAll();
  autoSync();
});

["taskSearch", "taskFilterStatus", "taskSort"].forEach((id) => {
  byId(id).addEventListener("input", renderTasks);
  byId(id).addEventListener("change", renderTasks);
});

byId("invoiceForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!window.jspdf) {
    alert("PDF-biblioteket er ikke indlæst. Kontroller din internetforbindelse og prøv igen.");
    return;
  }
  const customerId = byId("invoiceCustomer").value;
  const customer = state.customers.find((c) => c.id === customerId);
  if (!customer) { alert("Vælg venligst en kunde."); return; }

  const dateValue = byId("invoiceDate").value;
  const year = new Date(dateValue).getUTCFullYear();
  const num = String(state.nextInvoiceNumber).padStart(3, "0");
  const invoice = {
    id: uid(),
    number: `${year}-${num}`,
    customerId,
    description: byId("invoiceDescription").value.trim(),
    amount: parseFloat(byId("invoiceAmount").value),
    date: dateValue,
    dueDate: addDays(dateValue, 30),
  };

  state.invoices.push(invoice);
  state.nextInvoiceNumber += 1;
  saveState();
  queueSync("invoice_create", { ...invoice });

  e.target.reset();
  renderAll();
  autoSync();

  sendInvoiceByEmail(invoice, customer);
});

byId("exportCsvBtn").addEventListener("click", exportCsv);

byId("saveSyncSettings").addEventListener("click", () => {
  state.settings.sheetUrl = byId("sheetUrl").value.trim();
  state.settings.sheetToken = byId("sheetToken").value.trim();
  saveState();
  queueSync("settings_update", { ...state.settings, sheetToken: "***" });
  syncStatus.textContent = "Sync-indstillinger gemt.";
});

byId("syncNow").addEventListener("click", async () => {
  queueSync("manual_sync", { at: new Date().toISOString() });
  await autoSync();
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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

(function checkJsPdf() {
  const submitBtn = byId("invoiceForm").querySelector("button[type=submit]");
  if (!window.jspdf) {
    submitBtn.disabled = true;
    submitBtn.title = "PDF-biblioteket er ikke indlæst. Kræver internetforbindelse.";
    submitBtn.textContent = "PDF ikke tilgængelig";
  }
})();

renderAll();
autoSync();
setTimeout(scheduleReminders, 2000);
