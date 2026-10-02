"use client";

import { useSyncExternalStore } from "react";

export type SlideGroup = "start" | "steps" | "after";

export interface SlideMeta {
  id: string;
  title: string;
  group: SlideGroup;
  /** Short label for the sidebar when the title is long. */
  nav?: string;
}

/** Order of the tutorial. Ids double as URL hashes and checkpoint ids. */
export const SLIDES: SlideMeta[] = [
  { id: "overview", title: "Test a Go API by recording it", nav: "Overview", group: "start" },
  { id: "how-it-works", title: "How Keploy works", group: "start" },
  { id: "install", title: "Install Keploy", group: "steps" },
  { id: "sign-in", title: "Sign in", group: "steps" },
  { id: "clone", title: "Get the sample app and its database", nav: "Get the sample app", group: "steps" },
  { id: "record", title: "Record traffic", group: "steps" },
  { id: "inspect", title: "Read what Keploy wrote", group: "steps" },
  { id: "replay", title: "Replay with the database off", group: "steps" },
  { id: "break", title: "Break it on purpose", group: "steps" },
  { id: "noise", title: "Fields that change on every run", nav: "Noise", group: "after" },
  { id: "problems", title: "Problems I hit", group: "after" },
  { id: "next", title: "Where to go next", group: "after" },
];

export const STEP_IDS = SLIDES.filter((s) => s.group === "steps").map((s) => s.id);

/* ---------------------------------------------------------------------- */
/* Active slide store                                                      */
/* ---------------------------------------------------------------------- */

interface DeckState {
  index: number;
  /** +1 forward, -1 back: drives the transition direction. */
  dir: 1 | -1;
  /** False until the reader moves; the first paint never animates. */
  moved: boolean;
}

let state: DeckState = { index: 0, dir: 1, moved: false };
const listeners = new Set<() => void>();
const SERVER: DeckState = { index: 0, dir: 1, moved: false };

function emit() {
  listeners.forEach((l) => l());
}

export function indexOf(id: string) {
  return SLIDES.findIndex((s) => s.id === id);
}

export function goTo(index: number, opts: { updateHash?: boolean } = {}) {
  const i = Math.max(0, Math.min(SLIDES.length - 1, index));
  if (i === state.index) return;
  state = { index: i, dir: i > state.index ? 1 : -1, moved: opts.updateHash !== false };
  if (opts.updateHash !== false && typeof window !== "undefined") {
    const hash = i === 0 ? " " : `#${SLIDES[i].id}`;
    history.pushState(null, "", hash === " " ? location.pathname : hash);
  }
  emit();
}

export const next = () => goTo(state.index + 1);
export const prev = () => goTo(state.index - 1);

export function useDeck(): DeckState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => SERVER,
  );
}
