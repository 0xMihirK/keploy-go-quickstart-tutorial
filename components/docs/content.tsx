"use client";

import { Children, isValidElement, useRef, useState } from "react";
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
  info: { icon: Info, label: "Note", cls: "border-graphite/50", ic: "text-graphite" },
  tip: { icon: Lightbulb, label: "Tip", cls: "border-orange", ic: "text-orange-text dark:text-orange" },
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
        "not-prose my-6 flex gap-3 border-l-2 py-0.5 pl-4 text-[15.5px] leading-relaxed",
        c.cls,
      )}
    >
      <Icon className={cn("mt-1 size-4 shrink-0", c.ic)} aria-hidden="true" />
      <div className="min-w-0 [&_a]:text-orange-text [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-[0.36em] [&_code]:py-[0.12em] [&_code]:font-mono [&_code]:text-[0.82em] [&_p+p]:mt-2">
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

const LANG_LABEL: Record<string, string> = {
  bash: "Terminal",
  sh: "Terminal",
  powershell: "PowerShell",
  yaml: "YAML",
  diff: "Diff",
  go: "Go",
};

/**
 * A highlighted code block (rehype-pretty-code's figure): a header with the
 * block's title, or its kind, and a Copy button that's always visible.
 */
export function CodeFigure({ children, ...props }: React.ComponentProps<"figure">) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  let title: React.ReactNode = null;
  let lang = "";
  const rest: React.ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const p = child.props as Record<string, unknown>;
    if (p["data-rehype-pretty-code-title"] !== undefined) title = p.children as React.ReactNode;
    else {
      lang = String(p["data-language"] ?? lang);
      rest.push(child);
    }
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref.current?.querySelector("pre")?.innerText.trimEnd() ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };
  return (
    <figure {...props}>
      <div className="flex items-center justify-between gap-3 border-b border-rule py-1 pr-1.5 pl-4">
        <span className="min-w-0 truncate font-mono text-[12px] text-graphite">
          {title ?? LANG_LABEL[lang] ?? lang}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy code"}
          className="relative inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-graphite transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:bg-muted hover:text-ink"
        >
          {copied ? <Check className="size-3.5 text-replay-text" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div ref={ref}>{rest}</div>
    </figure>
  );
}

/* Tested on --------------------------------------------------------------------- */

export function TestedOn({ rows }: { rows: [string, string][] }) {
  return (
    <div className="not-prose my-6">
      <h3 className="text-[14px] font-medium text-graphite">Tested with</h3>
      <dl className="mt-2 grid grid-cols-[8rem_minmax(0,1fr)] border-t border-rule text-[14.5px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="border-b border-rule py-2 text-graphite">{k}</dt>
            <dd className="border-b border-rule py-2 text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
