"use client";

import { useRef, useState } from "react";
import {
  Check,
  Copy,
  Info,
  Lightbulb,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { setDone, useProgress } from "@/lib/progress";
import { cn } from "@/lib/utils";

/* Callout -------------------------------------------------------------- */

const CALLOUTS = {
  info: { icon: Info, label: "Note", cls: "border-[#6ca8ff]/40 bg-[#6ca8ff]/[0.07]", ic: "text-[#3b6fd8] dark:text-[#8db8ff]" },
  tip: { icon: Lightbulb, label: "Tip", cls: "border-replay/40 bg-replay/[0.07]", ic: "text-replay-text" },
} as const;

export function Callout({
  type = "info",
  title,
  children,
}: {
  type?: keyof typeof CALLOUTS;
  title?: string;
  children: React.ReactNode;
}) {
  const c = CALLOUTS[type];
  const Icon = c.icon;
  return (
    <div
      role="note"
      className={cn(
        "not-prose my-6 flex gap-3 rounded-lg border px-4 py-3.5 text-[15.5px] leading-relaxed",
        c.cls,
      )}
    >
      <Icon className={cn("mt-1 size-4 shrink-0", c.ic)} aria-hidden="true" />
      <div className="min-w-0 [&_a]:text-orange-text [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.86em] [&_p+p]:mt-2">
        <p className={cn("font-semibold text-ink", !title && "sr-only")}>
          {title ?? c.label}
        </p>
        <div className="text-ink/85">{children}</div>
      </div>
    </div>
  );
}

/* Checkpoint --------------------------------------------------------------- */

export function Checkpoint({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const progress = useProgress();
  const done = !!progress[id];
  return (
    <div
      className={cn(
        "not-prose my-6 rounded-lg border border-dashed px-4 py-3 transition-colors",
        done ? "border-replay/60 bg-replay/[0.06]" : "border-rule bg-surface",
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox
          checked={done}
          onCheckedChange={(v) => setDone(id, !!v)}
          className="mt-1"
          aria-label="Mark this step as done"
        />
        <span className="text-[15.5px] leading-relaxed text-ink/90 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.86em]">
          <span className="font-semibold text-ink">You should see: </span>
          {children}
        </span>
      </label>
    </div>
  );
}

/* Code block (pre override) -------------------------------------------------- */

export function Pre(props: React.ComponentProps<"pre">) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  return (
    // The button gets its own column so long lines scroll beside it, never under it.
    <div className="group/code flex items-start">
      <pre ref={ref} {...props} className={cn("min-w-0 flex-1", props.className)} />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(ref.current?.innerText.trimEnd() ?? "");
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* ignore */
          }
        }}
        aria-label={copied ? "Copied" : "Copy code"}
        className="m-2 inline-flex shrink-0 items-center gap-1 rounded-md border border-rule bg-surface px-1.5 py-1 text-[11px] text-graphite opacity-100 transition-opacity hover:text-ink sm:opacity-0 sm:group-hover/code:opacity-100 sm:focus-visible:opacity-100"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {/* Icon only on phones, where the column is narrow. */}
        <span className="sr-only sm:not-sr-only">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}

/* Tested on --------------------------------------------------------------------- */

export function TestedOn({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="not-prose my-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 rounded-lg border border-rule bg-surface px-4 py-3.5 text-[14.5px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-graphite">{k}</dt>
          <dd className="font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
