"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { getBusy, subscribeBusy } from "@/lib/runs";
import { cn } from "@/lib/utils";
import { SlideMenu, Stepper } from "./slides";
import { StackSwitch } from "./stack";

function Reel({ cx, color, spin }: { cx: number; color: string; spin: boolean }) {
  return (
    <g className={cn(spin && "reel-spin")}>
      <circle cx={cx} cy="9" r="6" fill="none" stroke={color} strokeWidth="2" />
      <circle cx={cx} cy="9" r="1.6" fill={color} />
      {[0, 120, 240].map((deg) => (
        <line
          key={deg}
          x1={cx}
          y1="9"
          // Rounded so server and browser floating point agree (hydration).
          x2={Math.round((cx + 4.2 * Math.cos((deg * Math.PI) / 180)) * 100) / 100}
          y2={Math.round((9 + 4.2 * Math.sin((deg * Math.PI) / 180)) * 100) / 100}
          stroke={color}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

export function Mark({ className }: { className?: string }) {
  // Two tape reels: record and replay. They turn while a terminal is busy.
  const busy = useSyncExternalStore(subscribeBusy, getBusy, () => 0) > 0;
  return (
    <svg viewBox="0 0 28 18" aria-hidden="true" className={cn("h-[18px] w-7", className)}>
      <Reel cx={7} color="var(--record)" spin={busy} />
      <Reel cx={21} color="var(--replay)" spin={busy} />
      <path d="M7 15h14" stroke="var(--graphite)" strokeWidth="1.5" />
    </svg>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard next-themes mount guard
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={mounted ? `Switch to ${dark ? "light" : "dark"} theme` : "Toggle theme"}
      className="grid size-8 place-items-center rounded-md text-graphite transition-colors hover:bg-muted hover:text-ink"
    >
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
    </button>
  );
}

export function Header() {
  return (
    <header className="z-40 shrink-0 border-b border-rule bg-paper">
      <div className="mx-auto flex h-14 max-w-[84rem] items-center gap-2 px-4 sm:gap-3 sm:px-8">
        <SlideMenu />
        <span className="flex items-center gap-2 font-semibold tracking-[-0.01em] text-ink">
          <Mark />
          <span className="hidden lg:inline">Keploy + Go</span>
        </span>
        <div className="mx-auto hidden md:block">
          <Stepper />
        </div>
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <StackSwitch />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
