"use client";

import { useSyncExternalStore } from "react";

import { SLIDES } from "./slides-data";
export { SLIDES, STEP_IDS, type SlideGroup, type SlideMeta } from "./slides-data";

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
