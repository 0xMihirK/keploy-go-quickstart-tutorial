"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Info,
  Lightbulb,
  ShieldAlert,
  X,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { setDone, useProgress } from "@/lib/progress";
import { cn } from "@/lib/utils";

/* Callout -------------------------------------------------------------- */

const CALLOUTS = {
  info: { icon: Info, label: "Note", cls: "border-[#6ca8ff]/40 bg-[#6ca8ff]/[0.07]", ic: "text-[#3b6fd8] dark:text-[#8db8ff]" },
  tip: { icon: Lightbulb, label: "Tip", cls: "border-replay/40 bg-replay/[0.07]", ic: "text-replay-text" },
  warning: { icon: AlertTriangle, label: "Watch out", cls: "border-[#e5a400]/45 bg-[#e5a400]/[0.08]", ic: "text-[#9a6b00] dark:text-[#ffd77a]" },
  hit: { icon: ShieldAlert, label: "I hit this", cls: "border-record/40 bg-record/[0.06]", ic: "text-record-text" },
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

/* Quiz ------------------------------------------------------------------------ */

export function Quiz({
  question,
  options,
  answer,
  explain,
}: {
  question: string;
  options: string[];
  answer: number;
  explain: React.ReactNode;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const right = picked === answer;
  return (
    <fieldset className="not-prose my-8 rounded-xl border border-rule bg-surface p-4 sm:p-5">
      <legend className="sr-only">Check your understanding</legend>
      <p className="text-[13px] font-medium text-graphite">Quick check</p>
      <p className="mt-1 text-[17px] font-semibold text-ink">{question}</p>
      <div className="mt-3 grid gap-2">
        {options.map((o, i) => {
          const state =
            picked === null ? "idle" : i === answer ? "right" : i === picked ? "wrong" : "idle";
          return (
            <button
              key={o}
              type="button"
              onClick={() => setPicked(i)}
              aria-pressed={picked === i}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[15px] transition-colors",
                state === "right" && "border-replay bg-replay/[0.08]",
                state === "wrong" && "border-record/60 bg-record/[0.06]",
                state === "idle" && "border-rule hover:border-graphite/50",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                  state === "right" && "border-replay bg-replay text-white",
                  state === "wrong" && "border-record bg-record text-white",
                  state === "idle" && "border-rule text-graphite",
                )}
              >
                {state === "right" ? <Check className="size-3" /> : state === "wrong" ? <X className="size-3" /> : String.fromCharCode(65 + i)}
              </span>
              <span className="text-ink/90">{o}</span>
            </button>
          );
        })}
      </div>
      <div aria-live="polite">
        {picked !== null && (
          <p className="mt-3 text-[15px] leading-relaxed text-ink/85">
            <span className={cn("font-semibold", right ? "text-replay-text" : "text-record-text")}>
              {right ? "Right. " : "Not quite. "}
            </span>
            {explain}
          </p>
        )}
      </div>
    </fieldset>
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
