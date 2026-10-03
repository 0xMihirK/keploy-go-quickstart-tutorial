"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

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

type VTDocument = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

/** True when slide changes animate with the View Transitions API. */
export const supportsViewTransitions = () =>
  typeof document !== "undefined" && "startViewTransition" in document;

/**
 * Show slide `i` and put its scroll positions back at the top. Inside a view
 * transition React must commit synchronously; elsewhere a normal update is
 * enough (and flushSync would fail when called from an effect).
 */
function commit(i: number, sync = false) {
  const toTop = () => {
    document.getElementById("content")?.scrollTo({ top: 0, behavior: "instant" });
    document
      .querySelectorAll<HTMLElement>(`[data-slide="${SLIDES[i].id}"] [data-scroll]`)
      .forEach((el) => el.scrollTo({ top: 0, behavior: "instant" }));
  };
  if (sync) {
    flushSync(emit);
    toTop();
  } else {
    // Not flushed: the slide is still hidden now, so reset once it has rendered.
    emit();
    requestAnimationFrame(toTop);
  }
}

export function goTo(index: number, opts: { updateHash?: boolean } = {}) {
  const i = Math.max(0, Math.min(SLIDES.length - 1, index));
  if (i === state.index) return;
  const user = opts.updateHash !== false;
  state = { index: i, dir: i > state.index ? 1 : -1, moved: user };
  if (user && typeof window !== "undefined") {
    const hash = i === 0 ? " " : `#${SLIDES[i].id}`;
    history.pushState(null, "", hash === " " ? location.pathname : hash);
  }
  if (typeof document === "undefined") return emit();

  const doc = document as VTDocument;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!user) return commit(i);
  if (reduce || !doc.startViewTransition) return commit(i, true);

  // Crossfade the old slide out and the new one in, in the direction of travel.
  const root = document.documentElement;
  root.dataset.vt = state.dir > 0 ? "forward" : "back";
  doc
    .startViewTransition(() => commit(i, true))
    .finished.finally(() => {
      delete root.dataset.vt;
    });
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
