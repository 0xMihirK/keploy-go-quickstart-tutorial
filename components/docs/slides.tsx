"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, List, RotateCcw } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { resetProgress, useProgress } from "@/lib/progress";
import {
  SLIDES,
  STEP_IDS,
  goTo,
  indexOf,
  next,
  prev,
  useDeck,
  type SlideGroup,
} from "@/lib/slides";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------- */
/* Slide                                                                   */
/* ---------------------------------------------------------------------- */

const SlideCtx = createContext<string>("");

function SlideHeading({ id }: { id: string }) {
  const meta = SLIDES[indexOf(id)];
  const stepNo = STEP_IDS.indexOf(id);
  const progress = useProgress();
  return (
    <header className="mb-6">
      <p className="text-[14px] font-medium text-graphite">
        {stepNo >= 0 ? (
          <>
            Step {stepNo + 1} of {STEP_IDS.length}
            {progress[id] && (
              <span className="ml-2 inline-flex items-center gap-1 text-replay-text">
                <Check className="size-3.5" aria-hidden="true" /> done
              </span>
            )}
          </>
        ) : meta.group === "start" ? (
          "Before you start"
        ) : (
          "After the steps"
        )}
      </p>
      <h2
        id={`${id}-title`}
        className={cn(
          "mt-1.5 font-semibold tracking-[-0.03em] text-balance text-ink",
          id === "overview"
            ? "text-[2.4rem] leading-[1.02] sm:text-[3rem]"
            : "text-[1.85rem] leading-[1.1] sm:text-[2.1rem]",
        )}
      >
        {meta.title}
      </h2>
    </header>
  );
}

/**
 * One page of the tutorial. It fills the space between the header and the
 * footer bar; on large screens its columns scroll on their own.
 */
export function Slide({
  id,
  children,
  layout = "split",
}: {
  id: string;
  children: React.ReactNode;
  /** split: lesson left, lab right. single: one centred column. */
  layout?: "split" | "single";
}) {
  const { index, dir, moved } = useDeck();
  const reduce = useReducedMotion();
  const active = index === indexOf(id);

  return (
    <SlideCtx.Provider value={id}>
      <section
        data-slide={id}
        hidden={!active}
        aria-labelledby={`${id}-title`}
        className="lg:h-full"
      >
        <motion.div
          key={active ? "on" : "off"}
          initial={reduce || !active || !moved ? false : { opacity: 0, x: dir * 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 0.8, 0.3, 1] }}
          className="lg:h-full"
        >
          {layout === "split" ? (
            <div className="lg:grid lg:h-full lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
              {children}
            </div>
          ) : (
            <div data-scroll className="lg:h-full lg:overflow-y-auto lg:overscroll-contain">
              <div className="prose mx-auto max-w-3xl py-8 lg:py-12">
                <SlideHeading id={id} />
                {children}
              </div>
            </div>
          )}
        </motion.div>
      </section>
    </SlideCtx.Provider>
  );
}

/** Explanation column, with the slide title on top. */
export function Lesson({ children }: { children: React.ReactNode }) {
  const id = useContext(SlideCtx);
  return (
    <div
      data-scroll
      className="min-w-0 pt-8 pb-6 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:py-10 lg:pr-10"
    >
      <SlideHeading id={id} />
      <div className="prose text-[16.5px]">{children}</div>
    </div>
  );
}

/** Interactive column. */
export function Lab({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-scroll
      className="min-w-0 pb-8 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-rule lg:py-10 lg:pl-10 [&>*:first-child]:mt-0"
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Controller: hash ↔ slide, keyboard                                      */
/* ---------------------------------------------------------------------- */

const isTyping = (el: Element | null) =>
  !!el &&
  (el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el as HTMLElement).isContentEditable ||
    !!el.closest("[role=log],[data-keys]"));

export function DeckController() {
  const { index } = useDeck();
  const first = useRef(true);

  useEffect(() => {
    // Old anchors from the long-form version still land on the right slide.
    const alias: Record<string, string> = {
      top: "overview",
      "fields-that-change-on-every-run": "noise",
      "problems-i-hit": "problems",
      "where-to-go-next": "next",
    };
    const sync = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      const i = indexOf(alias[h] ?? h);
      goTo(i === -1 ? 0 : i, { updateHash: false });
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || isTyping(document.activeElement)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // New slide: back to the top, focus its heading for screen readers.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // Each slide keeps its own scroll positions; start every visit at the top.
    document.getElementById("content")?.scrollTo({ top: 0 });
    document
      .querySelectorAll<HTMLElement>(`[data-slide="${SLIDES[index].id}"] [data-scroll]`)
      .forEach((el) => el.scrollTo({ top: 0 }));
    const h = document.getElementById(`${SLIDES[index].id}-title`);
    h?.setAttribute("tabindex", "-1");
    h?.focus({ preventScroll: true });
    document.title = `${SLIDES[index].title} · Keploy + Go quickstart`;
  }, [index]);

  return null;
}

/* ---------------------------------------------------------------------- */
/* Footer bar: previous / next                                             */
/* ---------------------------------------------------------------------- */

export function DeckFooter() {
  const { index } = useDeck();
  const before = SLIDES[index - 1];
  const after = SLIDES[index + 1];
  return (
    <nav
      data-deck-ui
      aria-label="Tutorial pages"
      className="shrink-0 border-t border-rule bg-paper"
    >
      <div className="mx-auto flex h-16 max-w-[84rem] items-center gap-3 px-4 sm:px-8">
        <button
          type="button"
          onClick={prev}
          disabled={!before}
          className="group inline-flex h-10 min-w-0 items-center gap-2 rounded-lg px-3 text-[14.5px] text-graphite transition-colors hover:bg-muted hover:text-ink disabled:invisible"
        >
          <ArrowLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          <span className="hidden truncate sm:inline">{before ? before.nav ?? before.title : ""}</span>
          <span className="sm:hidden">Back</span>
        </button>
        <p className="mx-auto hidden shrink-0 items-center gap-2 text-[13px] text-graphite tabular-nums md:flex">
          {index + 1} / {SLIDES.length}
          <span className="text-graphite/70">
            <kbd className="rounded border border-rule px-1 font-mono text-[11px]">←</kbd>{" "}
            <kbd className="rounded border border-rule px-1 font-mono text-[11px]">→</kbd> to move
          </span>
        </p>
        {after ? (
          <button
            type="button"
            onClick={next}
            className="group ml-auto inline-flex h-10 min-w-0 items-center gap-2 rounded-lg bg-ink px-4 text-[14.5px] font-medium text-paper transition-colors hover:bg-ink/85 md:ml-0"
          >
            <span className="truncate">
              <span className="hidden text-paper/65 sm:inline">Next: </span>
              {after.nav ?? after.title}
            </span>
            <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goTo(0)}
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-rule px-4 text-[14.5px] font-medium text-ink hover:bg-muted md:ml-0"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Back to the start
          </button>
        )}
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------------------- */
/* Stepper (header) and full list (sheet)                                  */
/* ---------------------------------------------------------------------- */

export function Stepper() {
  const { index } = useDeck();
  const progress = useProgress();
  return (
    <ol className="flex items-center gap-1" aria-label="Pages">
      {SLIDES.map((s, i) => {
        const done = !!progress[s.id];
        const here = i === index;
        return (
          <li key={s.id} className="flex">
            <button
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${s.title}${done ? " (done)" : ""}`}
              aria-current={here ? "page" : undefined}
              title={s.nav ?? s.title}
              className="group grid h-6 place-items-center px-0.5"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all duration-300",
                  here ? "w-7 bg-ink" : "w-3.5 group-hover:bg-graphite/60",
                  !here && (done ? "bg-replay" : i < index ? "bg-graphite/45" : "bg-rule"),
                  s.group === "steps" ? "" : "opacity-80",
                )}
              />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const GROUPS: [SlideGroup, string][] = [
  ["start", "Start here"],
  ["steps", "The steps"],
  ["after", "After the steps"],
];

export function SlideMenu() {
  const [open, setOpen] = useState(false);
  const { index } = useDeck();
  const progress = useProgress();
  const done = STEP_IDS.filter((id) => progress[id]).length;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13.5px] font-medium text-graphite hover:bg-muted hover:text-ink"
          />
        }
      >
        <List className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">All steps</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-[20rem] gap-0 bg-paper p-0">
        <SheetHeader className="border-b border-rule px-5 py-4">
          <SheetTitle className="text-left">Keploy + Go quickstart</SheetTitle>
          <div className="mt-2 flex items-center gap-3 text-[13px] text-graphite">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={STEP_IDS.length}
              aria-valuenow={done}
              aria-label="Steps completed"
            >
              <div className="h-full rounded-full bg-replay transition-[width]" style={{ width: `${(done / STEP_IDS.length) * 100}%` }} />
            </div>
            <span className="tabular-nums">
              {done}/{STEP_IDS.length} done
            </span>
          </div>
        </SheetHeader>
        <nav aria-label="All pages" className="overflow-y-auto px-3 py-3">
          {GROUPS.map(([g, label]) => (
            <div key={g} className="mb-3">
              <p className="px-2 pb-1 text-[12.5px] font-medium text-graphite">{label}</p>
              <ol>
                {SLIDES.map((s, i) =>
                  s.group !== g ? null : (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          goTo(i);
                          setOpen(false);
                        }}
                        aria-current={i === index ? "page" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[14.5px] transition-colors",
                          i === index ? "bg-muted text-ink" : "text-graphite hover:text-ink",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums",
                            progress[s.id]
                              ? "border-replay bg-replay text-white dark:text-[#06201f]"
                              : i === index
                                ? "border-ink text-ink"
                                : "border-rule",
                          )}
                        >
                          {progress[s.id] ? (
                            <Check className="size-3" />
                          ) : g === "steps" ? (
                            STEP_IDS.indexOf(s.id) + 1
                          ) : (
                            "·"
                          )}
                        </span>
                        <span className="truncate">{s.nav ?? s.title}</span>
                      </button>
                    </li>
                  ),
                )}
              </ol>
            </div>
          ))}
          {done > 0 && (
            <button
              type="button"
              onClick={resetProgress}
              className="mt-1 inline-flex items-center gap-1.5 px-2 text-[12.5px] text-graphite hover:text-ink"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              Reset progress
            </button>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

/** Button that moves to another slide (for in-content links). */
export function GoTo({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <a
      href={`#${id}`}
      onClick={(e) => {
        e.preventDefault();
        goTo(indexOf(id));
      }}
    >
      {children}
    </a>
  );
}
