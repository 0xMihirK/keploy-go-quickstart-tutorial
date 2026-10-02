"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { getBusy, subscribeBusy } from "@/lib/runs";
import { cn } from "@/lib/utils";
import { DeckProgress, SlideMenu, Stepper } from "./slides";

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

  // The new theme grows as a circle from the button (View Transitions API).
  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = dark ? "light" : "dark";
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reduce) {
      setTheme(next);
      return;
    }
    const root = document.documentElement;
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.dataset.vt = "theme";
    const t = doc.startViewTransition(() => {
      flushSync(() => setTheme(next));
      root.classList.toggle("dark", next === "dark");
      root.style.colorScheme = next;
    });
    t.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    });
    t.finished.finally(() => {
      delete root.dataset.vt;
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
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
    <header data-site-header className="z-40 shrink-0 bg-paper">
      {/* The page's one h1; slide titles below it are h2s. */}
      <h1 className="sr-only">Keploy + Go quickstart: record API tests from real traffic</h1>
      {/* Three columns: the stepper sits at the true centre whatever the sides hold. */}
      <div className="mx-auto grid h-14 max-w-[84rem] grid-cols-[1fr_auto] items-center gap-3 px-4 sm:px-8 md:grid-cols-[1fr_auto_1fr]">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <SlideMenu />
          <span className="flex items-center gap-2 font-semibold tracking-[-0.01em] text-ink">
            <Mark />
            <span className="hidden lg:inline">Keploy + Go</span>
          </span>
        </div>
        <div className="hidden md:block">
          <Stepper />
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <ThemeToggle />
        </div>
      </div>
      <DeckProgress />
    </header>
  );
}
