// app.js — UI wiring. Reads state via storage.js, calculates via logic.js,
// and renders the three views. This is the only file that touches the DOM.

import {
  parseAmountToCents,
  formatCents,
  monthKey,
  monthLabel,
  todayStr,
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

  const dateValue = $("#date").value || todayStr();
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
