// app.js — UI wiring. Reads state via storage.js, calculates via logic.js,
// and renders the three views. This is the only file that touches the DOM.

import {
  parseAmountToCents,
  formatCents,
  monthKey,
  monthLabel,
  todayStr,
  clampFutureDate,
  normalizeData,
  categoryName,
  summarizeMonth,
  historyMonths,
} from "./logic.js";
import { loadData, saveData } from "./storage.js";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let data = loadData(localStorage);
let selectedCategoryId = firstActiveCategoryId();
let editingExpenseId = null; // null = the sheet is adding, not editing

function firstActiveCategoryId() {
  const active = data.categories.find((c) => !c.archived);
  return active ? active.id : data.categories[0]?.id ?? "";
}

function persist() {
  saveData(localStorage, data);
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const $ = (selector) => document.querySelector(selector);

// User text (notes, category names) must never be treated as HTML.
function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// "2026-08-14" -> "Aug 14"
function shortDay(dateStr) {
  const [, month, day] = dateStr.split("-");
  return `${MONTH_SHORT[Number(month) - 1]} ${Number(day)}`;
}

let toastTimer = null;
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

// ---------------------------------------------------------------------------
// Rendering — Home
// ---------------------------------------------------------------------------

function renderHome() {
  const currentKey = monthKey(todayStr());
  const summary = summarizeMonth(data, currentKey);

  $("#month-title").textContent = monthLabel(currentKey);
  renderHero(summary);
  renderCategories(summary);
  renderExpenses(summary);
}

function renderHero(summary) {
  const { spentCents, budgetCents, remainingCents } = summary;
  const hero = $("#hero");

  if (budgetCents === 0) {
    // No budget yet: show what's spent and point at Settings.
    hero.innerHTML = `
      <span class="label">Spent this month</span>
      <div class="hero-amount money neutral">${formatCents(spentCents)}</div>
      <div class="hero-sub">
        <button class="link-btn" data-go="settings">Set your monthly budget &rarr;</button>
      </div>
      <div class="rule hidden"><i></i></div>`;
    return;
  }

  const spentShare = Math.min(1, spentCents / budgetCents);

  if (remainingCents < 0) {
    hero.innerHTML = `
      <span class="label">Over budget</span>
      <div class="hero-amount money over">${formatCents(-remainingCents)}</div>
      <div class="hero-sub money">spent ${formatCents(spentCents)} of ${formatCents(budgetCents)}</div>
      <div class="rule over"><i style="--fill: 100%"></i></div>`;
    return;
  }

  hero.innerHTML = `
    <span class="label">Left to spend</span>
    <div class="hero-amount money">${formatCents(remainingCents)}</div>
    <div class="hero-sub money">of ${formatCents(budgetCents)} monthly budget</div>
    <div class="rule"><i style="--fill: ${(spentShare * 100).toFixed(1)}%"></i></div>`;
}

function renderCategories(summary) {
  const section = $("#categories-section");

  if (summary.byCategory.length === 0) {
    section.innerHTML = "";
    return;
  }

  // Ledger lines fill as a share of the budget; with no budget set,
  // they fall back to each category's share of the month's spending.
  const rows = summary.byCategory
    .map((cat) => {
      const share =
        summary.budgetCents > 0
          ? cat.shareOfBudget
          : summary.spentCents > 0
            ? cat.spentCents / summary.spentCents
            : 0;
      return `
        <div class="ledger-row ok">
          <div class="line1">
            <span class="name">${escapeHtml(cat.name)}</span>
            <span class="figures money"><strong>${formatCents(cat.spentCents)}</strong></span>
          </div>
          <div class="rule"><i style="--fill: ${(share * 100).toFixed(1)}%"></i></div>
        </div>`;
    })
    .join("");

  section.innerHTML = `<span class="label">Where it went</span>${rows}`;
}

function renderExpenses(summary) {
  const section = $("#expenses-section");

  if (summary.expenses.length === 0) {
    section.innerHTML = `
      <span class="label">This month</span>
      <p class="empty">No expenses yet — tap the brass button below to add your first.</p>`;
    return;
  }

  const rows = summary.expenses
    .map((e) => {
      const primary = e.note ? escapeHtml(e.note) : escapeHtml(categoryName(data, e.categoryId));
      const secondary = e.note ? `<span class="cat">${escapeHtml(categoryName(data, e.categoryId))}</span>` : "";
      return `
        <button class="expense" data-expense-id="${escapeHtml(e.id)}">
          <span class="day">${shortDay(e.date)}</span>
          <span class="what"><span class="note">${primary}</span>${secondary}</span>
          <span class="amt money">${formatCents(e.amountCents)}</span>
        </button>`;
    })
    .join("");

  section.innerHTML = `<span class="label">This month</span>${rows}`;
}

// ---------------------------------------------------------------------------
// Rendering — History
// ---------------------------------------------------------------------------

function renderHistory() {
  const currentKey = monthKey(todayStr());
  const months = historyMonths(data, currentKey);
  const list = $("#history-list");

  if (months.length === 0) {
    list.innerHTML = `<p class="empty">No past months yet. History fills in on its own as new months begin.</p>`;
    return;
  }

  list.innerHTML = months
    .map((m) => {
      const minis = m.byCategory
        .map(
          (cat) => `
          <span class="mini">
            <span class="name">${escapeHtml(cat.name)}</span>
            <span class="rule"><i style="--fill: ${(cat.share * 100).toFixed(1)}%"></i></span>
            <span class="amt money">${formatCents(cat.spentCents)}</span>
          </span>`
        )
        .join("");
      return `
        <button class="month" data-month="${m.key}">
          <span class="line1">
            <span class="name">${m.label}</span>
            <span class="total money">${formatCents(m.totalCents)}</span>
            <span class="chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
          </span>
          <span class="breakdown">${minis}</span>
        </button>`;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Rendering — Settings
// ---------------------------------------------------------------------------

let renamingCategoryId = null; // id of the category being renamed, "new" while adding
let showArchived = false;

function renderSettings() {
  const active = data.categories.filter((c) => !c.archived);
  const archived = data.categories.filter((c) => c.archived);

  const categoryRows = active
    .map((c) => {
      if (renamingCategoryId === c.id) {
        return `
          <div class="setting-row">
            <input class="note-input" id="rename-input" value="${escapeHtml(c.name)}" maxlength="30" aria-label="Category name">
          </div>`;
      }
      return `
        <div class="setting-row">
          <button class="name link-plain" data-rename-id="${escapeHtml(c.id)}" title="Rename">${escapeHtml(c.name)}</button>
          <button class="icon-btn" data-archive-id="${escapeHtml(c.id)}" aria-label="Archive ${escapeHtml(c.name)}">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v9a2 2 0 002 2h10a2 2 0 002-2V9M10 13h4"/></svg>
          </button>
        </div>`;
    })
    .join("");

  const newRow =
    renamingCategoryId === "new"
      ? `<div class="setting-row"><input class="note-input" id="rename-input" placeholder="Category name" maxlength="30" aria-label="New category name"></div>`
      : "";

  const archivedBlock =
    archived.length === 0
      ? ""
      : `
      <button class="ghost-btn" id="archived-toggle">${showArchived ? "Hide" : "Show"} archived (${archived.length})</button>
      ${
        showArchived
          ? archived
              .map(
                (c) => `
                <div class="setting-row archived-row">
                  <span class="name">${escapeHtml(c.name)}</span>
                  <button class="restore-btn" data-restore-id="${escapeHtml(c.id)}">Restore</button>
                </div>`
              )
              .join("")
          : ""
      }`;

  $("#settings-body").innerHTML = `
    <section class="section" style="margin-top: 6px;">
      <span class="label">Monthly budget</span>
      <div class="setting-row">
        <span class="name">Every month</span>
        <input class="target-input money" id="budget-input" inputmode="decimal"
               value="${data.monthlyBudgetCents > 0 ? (data.monthlyBudgetCents / 100).toFixed(2) : ""}"
               placeholder="0.00" aria-label="Monthly budget in dollars">
      </div>
      <p class="hint">One number for the whole month. Categories below are just labels for where the money went. Tap a name to rename it.</p>
    </section>

    <section class="section">
      <span class="label">Categories</span>
      ${categoryRows}
      ${newRow}
      ${renamingCategoryId === "new" ? "" : `<button class="ghost-btn" id="add-category">Add category</button>`}
      ${archivedBlock}
    </section>

    <section class="section">
      <span class="label">Backup</span>
      <div class="backup-btns">
        <button class="ghost-btn" id="export-backup">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11M7.5 9.5L12 14l4.5-4.5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
          Export backup
        </button>
        <button class="ghost-btn" id="import-backup">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14V3M7.5 7.5L12 3l4.5 4.5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
          Import backup
        </button>
      </div>
      <p class="hint">All data lives on this phone — nothing is sent anywhere. Export a backup now and then (and before clearing browser data, which would erase the app's storage).</p>
    </section>`;

  // A just-created rename/add input gets focus immediately.
  const renameInput = $("#rename-input");
  if (renameInput) {
    renameInput.focus();
    renameInput.select();
  }
}

function commitRename() {
  const input = $("#rename-input");
  if (!input || renamingCategoryId === null) return;
  const name = input.value.trim();

  if (renamingCategoryId === "new") {
    if (name) {
      data.categories.push({ id: `cat-${Date.now().toString(36)}`, name, archived: false });
      persist();
      showToast(`Added ${name}`);
    }
  } else {
    const category = data.categories.find((c) => c.id === renamingCategoryId);
    if (category && name && name !== category.name) {
      category.name = name;
      persist();
      showToast(`Renamed to ${name}`);
    }
  }

  renamingCategoryId = null;
  renderSettings();
  renderHome();
  renderHistory();
}

function setCategoryArchived(id, archived) {
  const category = data.categories.find((c) => c.id === id);
  if (!category) return;

  // Never archive the last active category — the add sheet needs one.
  const activeCount = data.categories.filter((c) => !c.archived).length;
  if (archived && activeCount <= 1) {
    showToast("Keep at least one category");
    return;
  }

  category.archived = archived;
  persist();
  renderSettings();
  renderHome();
  showToast(archived ? `Archived ${category.name}` : `Restored ${category.name}`);
}

function commitBudgetInput() {
  const input = $("#budget-input");
  if (!input) return;
  const text = input.value.trim();

  // Empty or zero clears the budget (Home falls back to "spent" mode).
  if (text === "" || text === "0" || text === "0.00") {
    if (data.monthlyBudgetCents !== 0) {
      data.monthlyBudgetCents = 0;
      persist();
      renderHome();
      showToast("Budget cleared");
    }
    renderSettings();
    return;
  }

  const cents = parseAmountToCents(text);
  if (cents === null) {
    showToast("Couldn't read that amount");
    renderSettings(); // revert to the stored value
    return;
  }

  if (cents !== data.monthlyBudgetCents) {
    data.monthlyBudgetCents = cents;
    persist();
    renderHome();
    showToast(`Budget set — ${formatCents(cents)} per month`);
  }
  renderSettings();
}

// ---------------------------------------------------------------------------
// Backup: export downloads a JSON file, import restores one
// ---------------------------------------------------------------------------

function exportBackup() {
  const backup = { app: "simple-budget", exportedAt: todayStr(), ...data };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `budget-backup-${todayStr()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Backup downloaded");
}

async function importBackupFile(file) {
  let parsed = null;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    showToast("That file isn't a readable backup");
    return;
  }

  // normalizeData accepts anything and repairs what it can.
  const incoming = normalizeData(parsed);
  const summaryText =
    `Replace everything in the app with this backup?\n\n` +
    `${incoming.expenses.length} expense${incoming.expenses.length === 1 ? "" : "s"}, ` +
    `budget ${formatCents(incoming.monthlyBudgetCents)} per month.\n\n` +
    `Your current data will be overwritten.`;

  if (!window.confirm(summaryText)) return;

  data = incoming;
  selectedCategoryId = firstActiveCategoryId();
  persist();
  renderHome();
  renderHistory();
  renderSettings();
  showToast("Backup restored");
}

// ---------------------------------------------------------------------------
// The add/edit sheet
// ---------------------------------------------------------------------------

function renderChips() {
  const active = data.categories.filter((c) => !c.archived);
  if (!active.some((c) => c.id === selectedCategoryId)) {
    selectedCategoryId = active[0]?.id ?? "";
  }
  $("#chips").innerHTML = active
    .map(
      (c) => `
      <button class="chip ${c.id === selectedCategoryId ? "selected" : ""}" data-category-id="${escapeHtml(c.id)}">
        ${escapeHtml(c.name)}
      </button>`
    )
    .join("");
}

function openSheet(expense = null) {
  editingExpenseId = expense ? expense.id : null;
  $("#sheet-title").textContent = expense ? "Edit expense" : "New expense";
  $("#amount").value = expense ? (expense.amountCents / 100).toFixed(2) : "";
  $("#date").value = expense ? expense.date : todayStr();
  // The picker can't offer future dates — a future expense would be
  // invisible until its month arrives.
  $("#date").max = todayStr();
  $("#note").value = expense ? expense.note : "";
  if (expense) selectedCategoryId = expense.categoryId;
  $("#delete").classList.toggle("show", Boolean(expense));
  clearAmountError();
  renderChips();

  document.body.classList.add("sheet-open");
  // Focus after the slide-up so the keyboard animates in cleanly.
  setTimeout(() => $("#amount").focus(), 280);
}

function closeSheet() {
  document.body.classList.remove("sheet-open");
  editingExpenseId = null;
  $("#amount").blur();
  $("#note").blur();
}

function clearAmountError() {
  $("#amount-row").classList.remove("invalid");
  $("#amount-error").classList.remove("show");
}

function saveFromSheet() {
  const cents = parseAmountToCents($("#amount").value);
  if (cents === null) {
    $("#amount-row").classList.add("invalid");
    $("#amount-error").classList.add("show");
    $("#amount").focus();
    return;
  }

  // Safety net behind the picker's max: never store a future date.
  const dateValue = clampFutureDate($("#date").value || todayStr(), todayStr());
  const note = $("#note").value.trim();

  if (editingExpenseId) {
    const expense = data.expenses.find((e) => e.id === editingExpenseId);
    if (expense) {
      expense.amountCents = cents;
      expense.categoryId = selectedCategoryId;
      expense.note = note;
      expense.date = dateValue;
    }
    showToast(`Updated — ${formatCents(cents)}`);
  } else {
    // Newest first, so same-day entries keep entry order on screen.
    data.expenses.unshift({
      id: newId(),
      amountCents: cents,
      categoryId: selectedCategoryId,
      note,
      date: dateValue,
    });
    showToast(`Saved — ${formatCents(cents)} · ${categoryName(data, selectedCategoryId)}`);
  }

  persist();
  closeSheet();
  renderHome();
  renderHistory();
}

function deleteFromSheet() {
  if (!editingExpenseId) return;
  const expense = data.expenses.find((e) => e.id === editingExpenseId);
  data.expenses = data.expenses.filter((e) => e.id !== editingExpenseId);
  persist();
  closeSheet();
  renderHome();
  renderHistory();
  if (expense) showToast(`Deleted — ${formatCents(expense.amountCents)}`);
}

// ---------------------------------------------------------------------------
// Navigation + events
// ---------------------------------------------------------------------------

function goTo(view) {
  $("#app").setAttribute("data-view", view);
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.getAttribute("data-go") === view);
  });
}

// One listener handles every tap; targets are matched by data attributes.
document.addEventListener("click", (event) => {
  const go = event.target.closest("[data-go]");
  if (go) {
    goTo(go.getAttribute("data-go"));
    return;
  }

  const rename = event.target.closest("[data-rename-id]");
  if (rename) {
    renamingCategoryId = rename.getAttribute("data-rename-id");
    renderSettings();
    return;
  }

  const archive = event.target.closest("[data-archive-id]");
  if (archive) {
    setCategoryArchived(archive.getAttribute("data-archive-id"), true);
    return;
  }

  const restore = event.target.closest("[data-restore-id]");
  if (restore) {
    setCategoryArchived(restore.getAttribute("data-restore-id"), false);
    return;
  }

  if (event.target.closest("#add-category")) {
    renamingCategoryId = "new";
    renderSettings();
    return;
  }

  if (event.target.closest("#archived-toggle")) {
    showArchived = !showArchived;
    renderSettings();
    return;
  }

  if (event.target.closest("#export-backup")) {
    exportBackup();
    return;
  }

  if (event.target.closest("#import-backup")) {
    $("#import-file").click();
    return;
  }

  const chip = event.target.closest(".chip");
  if (chip) {
    selectedCategoryId = chip.getAttribute("data-category-id");
    renderChips();
    return;
  }

  const month = event.target.closest(".month");
  if (month) {
    month.classList.toggle("open");
    return;
  }

  const expenseRow = event.target.closest("[data-expense-id]");
  if (expenseRow) {
    const expense = data.expenses.find((e) => e.id === expenseRow.getAttribute("data-expense-id"));
    if (expense) openSheet(expense);
    return;
  }
});

$("#import-file").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) importBackupFile(file);
  event.target.value = ""; // allow picking the same file again later
});

$("#fab").addEventListener("click", () => openSheet());
$("#sheet-close").addEventListener("click", closeSheet);
$("#backdrop").addEventListener("click", closeSheet);
$("#save").addEventListener("click", saveFromSheet);
$("#delete").addEventListener("click", deleteFromSheet);
$("#amount").addEventListener("input", clearAmountError);

// Enter in the amount or note field saves — keeps entry under 5 seconds.
for (const id of ["#amount", "#note"]) {
  $(id).addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveFromSheet();
  });
}

// Settings inputs commit when they lose focus; Enter just blurs them
// so both paths run through the same commit.
document.addEventListener("focusout", (event) => {
  if (event.target.id === "rename-input") commitRename();
  if (event.target.id === "budget-input") commitBudgetInput();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (event.target.id === "rename-input" || event.target.id === "budget-input") {
    event.target.blur();
  }
});

// If the app was left open overnight (or across a month boundary),
// refresh the numbers when it comes back into view.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    renderHome();
    renderHistory();
  }
});

// ---------------------------------------------------------------------------
// First paint
// ---------------------------------------------------------------------------

renderHome();
renderHistory();
renderSettings();

// Register the service worker (offline support). "./sw.js" keeps the
// path correct under GitHub Pages' /simple-budget/ subfolder.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // Offline support is a bonus, never a blocker — ignore failures.
  });
}
