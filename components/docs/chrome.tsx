"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { SlideMenu, Stepper } from "./slides";
import { StackSwitch } from "./stack";

export function Mark({ className }: { className?: string }) {
  // Two tape reels: record and replay.
  return (
    <svg viewBox="0 0 28 18" aria-hidden="true" className={cn("h-[18px] w-7", className)}>
      <circle cx="7" cy="9" r="6" fill="none" stroke="var(--record)" strokeWidth="2" />
      <circle cx="7" cy="9" r="1.8" fill="var(--record)" />
      <circle cx="21" cy="9" r="6" fill="none" stroke="var(--replay)" strokeWidth="2" />
      <circle cx="21" cy="9" r="1.8" fill="var(--replay)" />
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
