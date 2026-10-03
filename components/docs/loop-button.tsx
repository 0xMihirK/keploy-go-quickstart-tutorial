"use client";

import { Pause, Play } from "lucide-react";

/** Pause/Play in a terminal's title bar. */
export function LoopButton({
  playing,
  onToggle,
}: {
  playing: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="relative inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-tape-dim transition-colors after:absolute after:-inset-2 after:content-[''] hover:bg-white/5 hover:text-tape-ink"
      aria-label={playing ? "Pause the terminal" : "Play the terminal"}
    >
      {playing ? (
        <Pause className="size-3.5" aria-hidden="true" />
      ) : (
        <Play className="size-3.5" aria-hidden="true" />
      )}
      <span className="max-sm:sr-only">{playing ? "Pause" : "Play"}</span>
    </button>
  );
}
