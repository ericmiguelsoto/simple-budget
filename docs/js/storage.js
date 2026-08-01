// storage.js — the only file that touches localStorage.
// The whole app lives under ONE key as one JSON blob. Both functions
// take the storage object as a parameter (the app passes the browser's
// localStorage; tests pass a fake), which keeps this file testable.

import { normalizeData } from "./logic.js";

export const STORAGE_KEY = "simple-budget:v1";

// Read the saved state. Anything unexpected — first run, corrupted
// JSON, a hand-edited file — comes back as a clean, seeded state
// instead of crashing the app.
export function loadData(storage) {
  let parsed = null;
  try {
    const rawText = storage.getItem(STORAGE_KEY);
    if (rawText) parsed = JSON.parse(rawText);
  } catch {
    // Corrupted JSON: fall through with null and start fresh.
  }
  return normalizeData(parsed);
}

// Write the state back. Called after every change — the data is tiny
// (a few KB), so saving the whole blob each time is simplest and safe.
export function saveData(storage, data) {
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}
