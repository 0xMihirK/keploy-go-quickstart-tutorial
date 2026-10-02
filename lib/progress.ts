"use client";

import { useSyncExternalStore } from "react";

const KEY = "keploy-tutorial-progress";
const listeners = new Set<() => void>();
let state: Record<string, boolean> | null = null;
const EMPTY: Record<string, boolean> = {};

function read(): Record<string, boolean> {
  if (state) return state;
  try {
    state = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    state = {};
  }
  return state!;
}

function write(next: Record<string, boolean>) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: progress lives for this visit only */
  }
  listeners.forEach((l) => l());
}

export function setDone(id: string, done: boolean) {
  const cur = read();
  if (!!cur[id] === done) return;
  write({ ...cur, [id]: done });
}

export function resetProgress() {
  write({});
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useProgress() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
