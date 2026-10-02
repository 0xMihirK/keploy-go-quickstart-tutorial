"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

export type StackId = "gin" | "echo";
export const STACK_KEY = "keploy-tutorial-stack";

export const STACKS: Record<
  StackId,
  { label: string; short: string; db: string; dir: string; port: number }
> = {
  gin: { label: "Gin + MongoDB", short: "Gin", db: "MongoDB", dir: "gin-mongo", port: 8080 },
  echo: { label: "Echo + PostgreSQL", short: "Echo", db: "PostgreSQL", dir: "echo-sql", port: 8082 },
};

/** Runs before paint (inlined in <head>) so the right stack shows on first frame. */
export const stackInitScript = `(function(){try{var s=localStorage.getItem("${STACK_KEY}");document.documentElement.dataset.stack=s==="echo"?"echo":"gin"}catch(e){document.documentElement.dataset.stack="gin"}})()`;

const listeners = new Set<() => void>();

function current(): StackId {
  return document.documentElement.dataset.stack === "echo" ? "echo" : "gin";
}

export function setStack(next: StackId) {
  document.documentElement.dataset.stack = next;
  try {
    localStorage.setItem(STACK_KEY, next);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useStack(): StackId {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    current,
    () => "gin",
  );
}

/** Content for one stack only. Hidden by CSS, so both ship in the HTML. */
export function Stack({
  only,
  children,
  inline,
}: {
  only: StackId;
  children: React.ReactNode;
  inline?: boolean;
}) {
  const Tag = inline ? "span" : "div";
  return <Tag data-only={only}>{children}</Tag>;
}

export function StackSwitch({ className }: { className?: string }) {
  const stack = useStack();
  return (
    <div
      role="group"
      aria-label="Sample app"
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-muted p-0.5 text-[13px]",
        className,
      )}
    >
      {(Object.keys(STACKS) as StackId[]).map((id) => {
        const active = stack === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => setStack(id)}
            className={cn(
              "rounded-md px-2.5 py-1 font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-surface text-ink shadow-[0_1px_2px_rgba(10,12,16,0.08)] ring-1 ring-border"
                : "text-graphite hover:text-ink",
            )}
          >
            <span className="sm:hidden">{STACKS[id].short}</span>
            <span className="hidden sm:inline">{STACKS[id].label}</span>
          </button>
        );
      })}
    </div>
  );
}
