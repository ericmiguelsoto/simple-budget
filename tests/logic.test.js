// Unit tests for the app's pure calculation functions.
// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";

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
} from "../docs/js/logic.js";

// ---------- parseAmountToCents: user-typed dollars -> integer cents ----------

test("parses plain dollars", () => {
  assert.equal(parseAmountToCents("12"), 1200);
});

test("parses one decimal place", () => {
  assert.equal(parseAmountToCents("12.3"), 1230);
});

test("parses two decimal places", () => {
  assert.equal(parseAmountToCents("12.34"), 1234);
});

test("parses dollar sign, commas, and spaces", () => {
  assert.equal(parseAmountToCents(" $1,234.56 "), 123456);
});

test("parses a trailing decimal point as whole dollars", () => {
  assert.equal(parseAmountToCents("12."), 1200);
});

test("parses a leading decimal point as cents", () => {
  assert.equal(parseAmountToCents(".50"), 50);
});

test("rejects empty and non-numeric input", () => {
  assert.equal(parseAmountToCents(""), null);
  assert.equal(parseAmountToCents("   "), null);
  assert.equal(parseAmountToCents("abc"), null);
  assert.equal(parseAmountToCents("12a"), null);
});

test("rejects more than two decimal places (likely a typo)", () => {
  assert.equal(parseAmountToCents("12.345"), null);
});

test("rejects zero and negative amounts", () => {
  assert.equal(parseAmountToCents("0"), null);
  assert.equal(parseAmountToCents("0.00"), null);
  assert.equal(parseAmountToCents("-5"), null);
});

// ---------- formatCents: integer cents -> display dollars ----------

test("formats cents as dollars with commas", () => {
  assert.equal(formatCents(123456), "$1,234.56");
});

test("formats zero", () => {
  assert.equal(formatCents(0), "$0.00");
});

test("formats negative amounts with a leading minus", () => {
  assert.equal(formatCents(-2850), "-$28.50");
});

test("formats whole dollars with .00", () => {
  assert.equal(formatCents(80000), "$800.00");
});

// ---------- month helpers: plain text, no Date objects ----------

test("monthKey takes the year-month part of a date string", () => {
  assert.equal(monthKey("2026-08-14"), "2026-08");
});

test("monthLabel turns a key into a readable name", () => {
  assert.equal(monthLabel("2026-08"), "August 2026");
  assert.equal(monthLabel("2025-01"), "January 2025");
});

test("todayStr formats a local date as YYYY-MM-DD", () => {
  // month is 0-based in the Date constructor: 7 = August
  assert.equal(todayStr(new Date(2026, 7, 5)), "2026-08-05");
  assert.equal(todayStr(new Date(2026, 11, 31)), "2026-12-31");
});

// ---------- clampFutureDate: expenses can't happen in the future ----------

test("keeps today's and past dates unchanged", () => {
  assert.equal(clampFutureDate("2026-08-01", "2026-08-01"), "2026-08-01");
  assert.equal(clampFutureDate("2026-07-15", "2026-08-01"), "2026-07-15");
});

test("pulls future dates back to today", () => {
  assert.equal(clampFutureDate("2026-09-03", "2026-08-01"), "2026-08-01");
  assert.equal(clampFutureDate("2027-01-01", "2026-08-01"), "2026-08-01");
});

// ---------- normalizeData: guard everything read from storage/import ----------

test("normalizes garbage into a fresh seeded state", () => {
  for (const raw of [null, undefined, 42, "hello", []]) {
    const data = normalizeData(raw);
    assert.equal(data.schemaVersion, 1);
    assert.equal(data.monthlyBudgetCents, 0);
    assert.deepEqual(
      data.categories.map((c) => c.name),
      ["Groceries", "Random"]
    );
    assert.deepEqual(data.expenses, []);
  }
});

test("keeps valid data intact", () => {
  const raw = {
    schemaVersion: 1,
    monthlyBudgetCents: 80000,
    categories: [{ id: "cat-groceries", name: "Groceries", archived: false }],
    expenses: [
      { id: "e1", amountCents: 1234, categoryId: "cat-groceries", note: "beans", date: "2026-08-01" },
    ],
  };
  const data = normalizeData(raw);
  assert.equal(data.monthlyBudgetCents, 80000);
  assert.equal(data.categories.length, 1);
  assert.equal(data.expenses.length, 1);
  assert.equal(data.expenses[0].note, "beans");
});

test("drops expenses with invalid amounts or dates", () => {
  const raw = {
    schemaVersion: 1,
    monthlyBudgetCents: 0,
    categories: [{ id: "c1", name: "Groceries", archived: false }],
    expenses: [
      { id: "e1", amountCents: -50, categoryId: "c1", note: "", date: "2026-08-01" },
      { id: "e2", amountCents: 100.5, categoryId: "c1", note: "", date: "2026-08-01" },
      { id: "e3", amountCents: 100, categoryId: "c1", note: "", date: "not-a-date" },
      { id: "e4", amountCents: 100, categoryId: "c1", note: "", date: "2026-08-02" },
    ],
  };
  const data = normalizeData(raw);
  assert.deepEqual(
    data.expenses.map((e) => e.id),
    ["e4"]
  );
});

test("repairs a missing or negative budget to zero", () => {
  assert.equal(normalizeData({ schemaVersion: 1, categories: [], expenses: [] }).monthlyBudgetCents, 0);
  assert.equal(
    normalizeData({ schemaVersion: 1, monthlyBudgetCents: -100, categories: [], expenses: [] }).monthlyBudgetCents,
    0
  );
});

test("seeds default categories when none survive", () => {
  const data = normalizeData({ schemaVersion: 1, monthlyBudgetCents: 0, categories: [{ bad: true }], expenses: [] });
  assert.deepEqual(
    data.categories.map((c) => c.name),
    ["Groceries", "Random"]
  );
});

// ---------- categoryName ----------

test("finds a category name by id", () => {
  const data = normalizeData({
    schemaVersion: 1,
    monthlyBudgetCents: 0,
    categories: [{ id: "c1", name: "Groceries", archived: false }],
    expenses: [],
  });
  assert.equal(categoryName(data, "c1"), "Groceries");
});

test("falls back for an unknown category id", () => {
  const data = normalizeData(null);
  assert.equal(categoryName(data, "nope"), "(deleted)");
});

// ---------- summarizeMonth: the Home screen numbers ----------

function sampleData() {
  return normalizeData({
    schemaVersion: 1,
    monthlyBudgetCents: 80000, // $800 budget
    categories: [
      { id: "groc", name: "Groceries", archived: false },
      { id: "rand", name: "Random", archived: false },
      { id: "gear", name: "Gear", archived: true }, // archived but has spending
    ],
    expenses: [
      { id: "e1", amountCents: 23320, categoryId: "groc", note: "big shop", date: "2026-08-14" },
      { id: "e2", amountCents: 6175, categoryId: "rand", note: "", date: "2026-08-12" },
      { id: "e3", amountCents: 17850, categoryId: "gear", note: "cables", date: "2026-08-13" },
      { id: "e4", amountCents: 99999, categoryId: "groc", note: "july, not august", date: "2026-07-20" },
    ],
  });
}

test("sums only the requested month", () => {
  const s = summarizeMonth(sampleData(), "2026-08");
  assert.equal(s.spentCents, 23320 + 6175 + 17850);
});

test("remaining = budget minus spent (can go negative)", () => {
  const s = summarizeMonth(sampleData(), "2026-08");
  assert.equal(s.budgetCents, 80000);
  assert.equal(s.remainingCents, 80000 - 47345);

  const tight = sampleData();
  tight.monthlyBudgetCents = 40000;
  assert.equal(summarizeMonth(tight, "2026-08").remainingCents, 40000 - 47345);
});

test("byCategory is sorted biggest spend first and skips zero-spend categories", () => {
  const s = summarizeMonth(sampleData(), "2026-08");
  assert.deepEqual(
    s.byCategory.map((c) => c.name),
    ["Groceries", "Gear", "Random"] // archived Gear still shows: the money was spent
  );
  assert.deepEqual(
    s.byCategory.map((c) => c.spentCents),
    [23320, 17850, 6175]
  );
});

test("shareOfBudget is each category's fraction of the budget, capped at 1", () => {
  const s = summarizeMonth(sampleData(), "2026-08");
  const groceries = s.byCategory[0];
  assert.ok(Math.abs(groceries.shareOfBudget - 23320 / 80000) < 1e-9);

  const noBudget = sampleData();
  noBudget.monthlyBudgetCents = 0;
  const s2 = summarizeMonth(noBudget, "2026-08");
  assert.equal(s2.byCategory[0].shareOfBudget, 0);

  const tiny = sampleData();
  tiny.monthlyBudgetCents = 100; // $1 budget, spending way over
  assert.equal(summarizeMonth(tiny, "2026-08").byCategory[0].shareOfBudget, 1);
});

test("month expenses come newest date first", () => {
  const s = summarizeMonth(sampleData(), "2026-08");
  assert.deepEqual(
    s.expenses.map((e) => e.id),
    ["e1", "e3", "e2"]
  );
});

test("an empty month summarizes to zeros", () => {
  const s = summarizeMonth(sampleData(), "2026-06");
  assert.equal(s.spentCents, 0);
  assert.deepEqual(s.byCategory, []);
  assert.deepEqual(s.expenses, []);
  assert.equal(s.remainingCents, 80000);
});

// ---------- historyMonths: past months only, newest first ----------

test("groups past months, excluding the current one", () => {
  const data = sampleData();
  data.expenses.push(
    { id: "e5", amountCents: 5000, categoryId: "rand", note: "", date: "2026-06-10" },
    { id: "e6", amountCents: 7000, categoryId: "groc", note: "", date: "2026-06-05" }
  );
  const months = historyMonths(data, "2026-08");
  assert.deepEqual(
    months.map((m) => m.key),
    ["2026-07", "2026-06"]
  );
  assert.equal(months[0].label, "July 2026");
  assert.equal(months[0].totalCents, 99999);
  assert.equal(months[1].totalCents, 12000);
});

test("history breakdown shares are fractions of that month's total", () => {
  const data = sampleData();
  data.expenses.push(
    { id: "e5", amountCents: 5000, categoryId: "rand", note: "", date: "2026-06-10" },
    { id: "e6", amountCents: 7000, categoryId: "groc", note: "", date: "2026-06-05" }
  );
  const june = historyMonths(data, "2026-08").find((m) => m.key === "2026-06");
  assert.deepEqual(
    june.byCategory.map((c) => [c.name, c.spentCents]),
    [
      ["Groceries", 7000],
      ["Random", 5000],
    ]
  );
  assert.ok(Math.abs(june.byCategory[0].share - 7000 / 12000) < 1e-9);
});

test("no past months means empty history", () => {
  const data = normalizeData(null);
  assert.deepEqual(historyMonths(data, "2026-08"), []);
});
