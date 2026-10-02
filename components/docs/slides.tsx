"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
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
  supportsViewTransitions,
  indexOf,
  next,
  prev,
  useDeck,
  type SlideGroup,
} from "@/lib/slides";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/reduced-motion";

/* ---------------------------------------------------------------------- */
/* Slide                                                                   */
/* ---------------------------------------------------------------------- */

const SlideCtx = createContext<string>("");

function SlideHeading({ id }: { id: string }) {
  const meta = SLIDES[indexOf(id)];
  const stepNo = STEP_IDS.indexOf(id);
  const progress = useProgress();
  // The overview title is the page's h1; every other slide title is an h2.
  const Heading = id === "overview" ? "h1" : "h2";
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
      <Heading
        id={`${id}-title`}
        className={cn(
          "mt-1.5 font-semibold tracking-[-0.03em] text-balance text-ink",
          id === "overview"
            ? "text-[2.4rem] leading-[1.02] sm:text-[3rem]"
            : "text-[1.85rem] leading-[1.1] sm:text-[2.1rem]",
        )}
      >
        {meta.title}
      </Heading>
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
        data-active={active ? "" : undefined}
        aria-labelledby={`${id}-title`}
        className="tall:h-full"
      >
        <motion.div
          key={active ? "on" : "off"}
          // View Transitions animate slide changes where supported; this is the fallback.
          initial={
            reduce || !active || !moved || supportsViewTransitions()
              ? false
              : { opacity: 0, x: dir * 24 }
          }
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 0.8, 0.3, 1] }}
          className="tall:h-full"
        >
          {layout === "split" ? (
            // Stacked (small or short windows): one centred, readable column.
            <div className="mx-auto max-w-3xl tall:grid tall:h-full tall:max-w-none tall:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:tall:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
              {children}
            </div>
          ) : (
            <div data-scroll className="tall:flex tall:h-full tall:flex-col tall:overflow-y-auto tall:overscroll-contain">
              <div className="prose mx-auto w-full max-w-3xl py-8 tall:my-auto tall:py-12">
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
      tabIndex={0}
      aria-label="Lesson"
      className="min-w-0 pt-8 pb-6 outline-none focus-visible:ring-2 focus-visible:ring-orange/60 tall:flex tall:h-full tall:flex-col tall:overflow-y-auto tall:overscroll-contain tall:py-10 tall:pr-12"
    >
      {/* my-auto centres short content and still scrolls from the top when long. */}
      <div className="tall:my-auto">
        <SlideHeading id={id} />
        <div className="prose text-[16.5px]">{children}</div>
      </div>
    </div>
  );
}

/** Interactive column. */
export function Lab({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-scroll
      tabIndex={0}
      aria-label="Practice"
      className="min-w-0 pb-8 outline-none focus-visible:ring-2 focus-visible:ring-orange/60 tall:flex tall:h-full tall:flex-col tall:overflow-y-auto tall:overscroll-contain tall:border-l tall:border-rule tall:py-10 tall:pl-12"
    >
      <div data-lab className="tall:my-auto">
        {children}
      </div>
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
      // Unknown hashes (like the skip link's #content) leave the slide alone.
      if (i !== -1 || !h) goTo(i === -1 ? 0 : i, { updateHash: false });
      delete document.documentElement.dataset.start;
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
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Swipe left or right on touch screens. Terminals and wide tables keep
  // their own horizontal scrolling, so swipes that start there are ignored.
  useEffect(() => {
    const main = document.getElementById("content");
    if (!main) return;
    let start: { x: number; y: number; t: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const target = e.target as Element;
      if (e.touches.length !== 1 || target.closest("[role=log],[data-no-swipe],.overflow-x-auto,input,button")) {
        start = null;
        return;
      }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.changedTouches[0].clientX - start.x;
      const dy = e.changedTouches[0].clientY - start.y;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - start.t < 700) {
        if (dx < 0) next();
        else prev();
      }
      start = null;
    };
    main.addEventListener("touchstart", onStart, { passive: true });
    main.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      main.removeEventListener("touchstart", onStart);
      main.removeEventListener("touchend", onEnd);
    };
  }, []);

  // New slide: title for the tab, focus on its heading for screen readers.
  // (goTo already put the slide's scroll positions back at the top.)
  useEffect(() => {
    // Next applies its metadata title during hydration; set ours a frame later.
    const title = `${SLIDES[index].title} · Keploy + Go quickstart`;
    requestAnimationFrame(() => {
      document.title = title;
    });
    if (first.current) {
      first.current = false;
      return;
    }
    const h = document.getElementById(`${SLIDES[index].id}-title`);
    h?.setAttribute("tabindex", "-1");
    h?.focus({ preventScroll: true });
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
      {/* Three columns so the hint sits at the true centre. */}
      <div className="mx-auto grid h-16 max-w-[84rem] grid-cols-2 items-center gap-3 px-4 sm:px-8 md:grid-cols-[1fr_auto_1fr]">
        <button
          type="button"
          onClick={prev}
          disabled={!before}
          className="group inline-flex h-10 min-w-0 items-center gap-2 justify-self-start rounded-lg px-3 text-[14.5px] text-graphite transition-colors hover:bg-muted hover:text-ink disabled:invisible"
        >
          <ArrowLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          <span className="hidden truncate sm:inline">{before ? before.nav ?? before.title : ""}</span>
          <span className="sm:hidden">Back</span>
        </button>
        <p className="hidden items-center gap-2 text-[13px] text-graphite md:flex">
          <span>
            <kbd className="rounded border border-rule px-1 font-mono text-[11px]">←</kbd>{" "}
            <kbd className="rounded border border-rule px-1 font-mono text-[11px]">→</kbd> to move
          </span>
        </p>
        {after ? (
          <button
            type="button"
            onClick={next}
            className="group inline-flex h-10 min-w-0 items-center gap-2 justify-self-end rounded-lg bg-ink px-4 text-[14.5px] font-medium text-paper transition-[background-color,transform] hover:bg-ink/85 active:scale-[0.97]"
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
            className="inline-flex h-10 items-center gap-2 justify-self-end rounded-lg border border-rule px-4 text-[14.5px] font-medium text-ink hover:bg-muted"
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
    <ol className="flex items-center" aria-label="Pages">
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
              className="group grid h-6 min-w-6 place-items-center"
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
                className={cn(
                  "block h-1.5 rounded-full transition-colors duration-300",
                  here ? "w-7 bg-ink" : "w-3.5 group-hover:bg-graphite/60",
                  !here && (done ? "bg-replay" : i < index ? "bg-graphite/45" : "bg-rule"),
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
        <span className="sr-only sm:not-sr-only">All steps</span>
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

/** How far through the tutorial you are, along the bottom edge of the header. */
export function DeckProgress() {
  const { index } = useDeck();
  const pct = ((index + 1) / SLIDES.length) * 100;
  return (
    <div
      className="h-[3px] w-full bg-rule/70"
      role="progressbar"
      aria-label="Tutorial progress"
      aria-valuemin={1}
      aria-valuemax={SLIDES.length}
      aria-valuenow={index + 1}
      aria-valuetext={`Page ${index + 1} of ${SLIDES.length}`}
    >
      <div
        className="h-full rounded-r-full bg-gradient-to-r from-record via-orange to-replay transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
