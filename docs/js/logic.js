// logic.js — the app's calculation brain.
// Pure functions only: no screen updates, no storage, no side effects.
// Everything here is covered by unit tests in tests/logic.test.js.

// Money rule for the whole app: amounts are whole cents (integers).
// Computers store decimal numbers imperfectly (0.1 + 0.2 !== 0.3),
// so we only ever do math on cents and turn them into "$1,234.56" text
// at the last moment, for display.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// The two starting categories every fresh install gets.
function seedCategories() {
  return [
    { id: "cat-groceries", name: "Groceries", archived: false },
    { id: "cat-random", name: "Random", archived: false },
  ];
}

// ---------------------------------------------------------------------------
// Money text <-> cents
// ---------------------------------------------------------------------------

// Turn what the user typed ("12", "12.3", "$1,234.56") into integer cents.
// Returns null when the input is not a usable amount (empty, letters,
// more than two decimal places, zero, or negative).
export function parseAmountToCents(text) {
  if (typeof text !== "string") return null;

  // Ignore dollar signs, thousands commas, and spaces.
  const cleaned = text.replace(/[$,\s]/g, "");

  // Must be digits, optionally a dot, then at most two more digits.
  // Also accepts "12." (mid-typing) and ".50".
  if (!/^(\d+\.?\d{0,2}|\.\d{1,2})$/.test(cleaned)) return null;

  const [dollarPart = "0", centPart = ""] = cleaned.split(".");
  const cents =
    Number(dollarPart || "0") * 100 + Number(centPart.padEnd(2, "0") || "0");

  // Nothing costs $0.00 — treat it as a mistake, not an expense.
  if (cents <= 0) return null;
  return cents;
}

// Turn integer cents into display text: 123456 -> "$1,234.56".
// Negative amounts (over budget) come out as "-$28.50".
export function formatCents(cents) {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const dollars = Math.trunc(absolute / 100);
  const remainder = String(absolute % 100).padStart(2, "0");
  // Insert thousands commas into the dollar part.
  const withCommas = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${withCommas}.${remainder}`;
}

// ---------------------------------------------------------------------------
// Dates and months — always plain text, never Date math.
// Comparing calendar days through Date objects invites timezone bugs
// (see tasks/lessons.md), so dates are "YYYY-MM-DD" and months "YYYY-MM".
// ---------------------------------------------------------------------------

// "2026-08-14" -> "2026-08"
export function monthKey(dateStr) {
  return String(dateStr).slice(0, 7);
}

// "2026-08" -> "August 2026"
export function monthLabel(key) {
  const [year, month] = String(key).split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

// Today's LOCAL date as "YYYY-MM-DD". The only place a Date object is
// used; it takes one as a parameter so tests can pin the clock.
export function todayStr(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Data shape guard
// ---------------------------------------------------------------------------

// Take ANYTHING (parsed localStorage, an imported backup file, garbage)
// and return a valid app state. Broken pieces are dropped or repaired,
// never allowed to crash the app.
export function normalizeData(raw) {
  const data = {
    schemaVersion: 1,
    monthlyBudgetCents: 0,
    categories: [],
    expenses: [],
  };

  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};

  // Budget: a non-negative whole number of cents, or zero.
  if (Number.isInteger(source.monthlyBudgetCents) && source.monthlyBudgetCents >= 0) {
    data.monthlyBudgetCents = source.monthlyBudgetCents;
  }

  // Categories: keep only well-formed ones.
  if (Array.isArray(source.categories)) {
    for (const item of source.categories) {
      if (!item || typeof item !== "object") continue;
      const id = typeof item.id === "string" ? item.id.trim() : "";
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!id || !name) continue;
      data.categories.push({ id, name, archived: item.archived === true });
    }
  }

  // A budget app with no categories is unusable — reseed the defaults.
  if (data.categories.length === 0) {
    data.categories = seedCategories();
  }

  // Expenses: keep only ones with a real amount and a real date.
  if (Array.isArray(source.expenses)) {
    source.expenses.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const amountOk = Number.isInteger(item.amountCents) && item.amountCents > 0;
      const dateOk = typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date);
      if (!amountOk || !dateOk) return;
      data.expenses.push({
        id: typeof item.id === "string" && item.id ? item.id : `exp-${index}`,
        amountCents: item.amountCents,
        categoryId: typeof item.categoryId === "string" ? item.categoryId : "",
        note: typeof item.note === "string" ? item.note : "",
        date: item.date,
      });
    });
  }

  return data;
}

// Look up a category's display name. Expenses keep their category id
// even if the category was deleted from an imported file — they show
// as "(deleted)" rather than vanishing.
export function categoryName(data, id) {
  const found = data.categories.find((c) => c.id === id);
  return found ? found.name : "(deleted)";
}

// ---------------------------------------------------------------------------
// The Home screen numbers
// ---------------------------------------------------------------------------

// Everything Home needs for one month, in one object:
//   spentCents      — total spent that month
//   budgetCents     — the monthly budget
//   remainingCents  — budget minus spent (negative = over budget)
//   byCategory      — "where it went", biggest spend first
//   expenses        — that month's entries, newest date first
export function summarizeMonth(data, key) {
  const expenses = data.expenses
    .filter((e) => monthKey(e.date) === key)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const spentCents = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const budgetCents = data.monthlyBudgetCents;

  // Group spending by category (only categories actually spent from).
  const totals = new Map();
  for (const e of expenses) {
    totals.set(e.categoryId, (totals.get(e.categoryId) || 0) + e.amountCents);
  }

  const byCategory = [...totals.entries()]
    .map(([id, cents]) => ({
      id,
      name: categoryName(data, id),
      spentCents: cents,
      // Each category's slice of the monthly budget, for the filling
      // ledger lines. Capped at 1 so an over-spend can't overflow the bar.
      shareOfBudget: budgetCents > 0 ? Math.min(1, cents / budgetCents) : 0,
    }))
    .sort((a, b) => b.spentCents - a.spentCents);

  return {
    spentCents,
    budgetCents,
    remainingCents: budgetCents - spentCents,
    byCategory,
    expenses,
  };
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

// Past months only (never the current one), newest first. Each month:
//   { key, label, totalCents, byCategory: [{ id, name, spentCents, share }] }
// where share is that category's fraction of the MONTH'S OWN total —
// the budget number changes over time, so history sticks to what was spent.
export function historyMonths(data, currentKey) {
  const byMonth = new Map();
  for (const e of data.expenses) {
    const key = monthKey(e.date);
    if (key >= currentKey) continue; // only the past
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(e);
  }

  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // newest month first
    .map(([key, monthExpenses]) => {
      const totalCents = monthExpenses.reduce((sum, e) => sum + e.amountCents, 0);

      const totals = new Map();
      for (const e of monthExpenses) {
        totals.set(e.categoryId, (totals.get(e.categoryId) || 0) + e.amountCents);
      }

      const byCategory = [...totals.entries()]
        .map(([id, cents]) => ({
          id,
          name: categoryName(data, id),
          spentCents: cents,
          share: totalCents > 0 ? cents / totalCents : 0,
        }))
        .sort((a, b) => b.spentCents - a.spentCents);

      return { key, label: monthLabel(key), totalCents, byCategory };
    });
}
