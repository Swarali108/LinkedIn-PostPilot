import type { CalendarPlan } from "../types";

/**
 * The most recently generated content plan, persisted in the browser so the
 * dashboard calendar can surface upcoming planned posts. Per-browser/per-device
 * (localStorage) — lightweight by design; no server round-trip needed.
 */

const STORAGE_KEY = "postpilot.calendar";

export function saveCalendar(plan: CalendarPlan): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export function loadCalendar(): CalendarPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CalendarPlan) : null;
  } catch {
    return null;
  }
}

export function clearCalendar(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
