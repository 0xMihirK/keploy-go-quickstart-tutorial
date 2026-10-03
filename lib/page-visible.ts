"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
}

/** False while the tab is in the background. */
export function usePageVisible() {
  return useSyncExternalStore(
    subscribe,
    () => !document.hidden,
    () => true,
  );
}
