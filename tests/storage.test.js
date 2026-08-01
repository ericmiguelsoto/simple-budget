// Unit tests for load/save against a fake localStorage.
// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";

import { loadData, saveData, STORAGE_KEY } from "../docs/js/storage.js";

// A tiny stand-in for the browser's localStorage
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

test("first load seeds the default state", () => {
  const data = loadData(fakeStorage());
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.monthlyBudgetCents, 0);
  assert.deepEqual(
    data.categories.map((c) => c.name),
    ["Groceries", "Random"]
  );
  assert.deepEqual(data.expenses, []);
});

test("save then load round-trips the data", () => {
  const storage = fakeStorage();
  const data = loadData(storage);
  data.monthlyBudgetCents = 80000;
  data.expenses.push({ id: "e1", amountCents: 1234, categoryId: data.categories[0].id, note: "beans", date: "2026-08-01" });
  saveData(storage, data);

  const again = loadData(storage);
  assert.equal(again.monthlyBudgetCents, 80000);
  assert.equal(again.expenses.length, 1);
  assert.equal(again.expenses[0].amountCents, 1234);
});

test("corrupted JSON in storage loads as a fresh seed instead of crashing", () => {
  const storage = fakeStorage({ [STORAGE_KEY]: "{not json!!" });
  const data = loadData(storage);
  assert.equal(data.schemaVersion, 1);
  assert.deepEqual(data.expenses, []);
});
