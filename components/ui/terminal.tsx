"use client";

// Adapted from Magic UI's Terminal (https://magicui.design/docs/components/terminal).
// Changes: design tokens, header with title/mode badge/copy, size props,
// reduced-motion support, a11y live region, and a rules-of-hooks fix.

import {
  Children,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type RefAttributes,
} from "react";
import {
  motion,
  useInView,
  type DOMMotionComponents,
  type HTMLMotionProps,
  type MotionProps,
} from "motion/react";
import { Check, Copy, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/reduced-motion";

interface SequenceContextValue {
  completeItem: (index: number) => void;
  activeIndex: number;
  sequenceStarted: boolean;
}

const SequenceContext = createContext<SequenceContextValue | null>(null);
const useSequence = () => useContext(SequenceContext);

const ItemIndexContext = createContext<number | null>(null);
const useItemIndex = () => useContext(ItemIndexContext);

const motionElements = {
  article: motion.article,
  div: motion.div,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
  h5: motion.h5,
  h6: motion.h6,
  li: motion.li,
  p: motion.p,
  section: motion.section,
  span: motion.span,
} as const;

type MotionElementType = Extract<
  keyof DOMMotionComponents,
  keyof typeof motionElements
>;
type TerminalTypingMotionComponent = ComponentType<
  Omit<HTMLMotionProps<"span">, "ref"> & RefAttributes<HTMLElement>
>;

interface AnimatedSpanProps extends MotionProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  startOnView?: boolean;
}

export const AnimatedSpan = ({
  children,
  delay = 0,
  className,
  startOnView = false,
  ...props
}: AnimatedSpanProps) => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(elementRef as React.RefObject<Element>, {
    amount: 0.3,
    once: true,
  });
  const reduce = useReducedMotion();

  const sequence = useSequence();
  const itemIndex = useItemIndex();
  // The active index only moves forward, so "started" is derived, not stored.
  const hasStarted =
    !!sequence &&
    itemIndex !== null &&
    sequence.sequenceStarted &&
    sequence.activeIndex >= itemIndex;

  const shouldAnimate = sequence ? hasStarted : startOnView ? isInView : true;

  return (
    <motion.div
      ref={elementRef}
      initial={reduce ? false : { opacity: 0, y: -4 }}
      animate={
        reduce || shouldAnimate ? { opacity: 1, y: 0 } : { opacity: 0, y: -4 }
      }
      transition={{
        duration: reduce ? 0 : 0.18,
        delay: sequence || reduce ? 0 : delay / 1000,
      }}
      // In a sequence, lines take no space until they print, like a real tty.
      className={cn(
        "grid whitespace-pre-wrap break-words",
        sequence && !hasStarted && !reduce && "hidden",
        className,
      )}
      onAnimationComplete={() => {
        if (!sequence) return;
        if (itemIndex === null) return;
        sequence.completeItem(itemIndex);
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

interface TypingAnimationProps extends Omit<MotionProps, "children"> {
  children: string;
  className?: string;
  duration?: number;
  delay?: number;
  as?: MotionElementType;
  startOnView?: boolean;
  /** Text shown before the typed string, e.g. a shell prompt. Not typed. */
  prompt?: React.ReactNode;
  /** Called once the full string is on screen. */
  onComplete?: () => void;
}

export const TypingAnimation = ({
  children,
  className,
  duration = 28,
  delay = 0,
  as: Component = "span",
  startOnView = true,
  prompt,
  onComplete,
  ...props
}: TypingAnimationProps) => {
  const MotionComponent = motionElements[
    Component
  ] as TerminalTypingMotionComponent;
  const reduce = useReducedMotion();

  const [typed, setTyped] = useState<string>("");
  const [timerStarted, setTimerStarted] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const isInView = useInView(elementRef as React.RefObject<Element>, {
    amount: 0.3,
    once: true,
  });

  const sequence = useSequence();
  const itemIndex = useItemIndex();
  const hasSequence = sequence !== null;
  const sequenceStarted = sequence?.sequenceStarted ?? false;
  const sequenceActiveIndex = sequence?.activeIndex ?? null;
  const sequenceCompleteItemRef = useRef<
    SequenceContextValue["completeItem"] | null
  >(null);
  const sequenceItemIndexRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    sequenceCompleteItemRef.current = sequence?.completeItem ?? null;
    sequenceItemIndexRef.current = itemIndex;
  }, [sequence?.completeItem, itemIndex]);

  // In a sequence, start when it's this item's turn; otherwise on a timer.
  const started =
    hasSequence && itemIndex !== null
      ? sequenceStarted && sequenceActiveIndex !== null && sequenceActiveIndex >= itemIndex
      : timerStarted;

  useEffect(() => {
    if (hasSequence && itemIndex !== null) return;
    if (startOnView && !isInView) return;
    const t = setTimeout(() => setTimerStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay, startOnView, isInView, hasSequence, itemIndex]);

  useEffect(() => {
    if (!started) return;
    const finish = () => {
      onCompleteRef.current?.();
      const completeItem = sequenceCompleteItemRef.current;
      const currentItemIndex = sequenceItemIndexRef.current;
      if (completeItem && currentItemIndex !== null) {
        completeItem(currentItemIndex);
      }
    };

    // Reduced motion: the full text renders at once (see `displayedText`).
    if (reduce) {
      const t = setTimeout(finish, 0);
      return () => clearTimeout(t);
    }

    let i = 0;
    const typingEffect = setInterval(() => {
      if (i < children.length) {
        setTyped(children.substring(0, i + 1));
        i++;
      } else {
        clearInterval(typingEffect);
        finish();
      }
    }, duration);

    return () => clearInterval(typingEffect);
  }, [children, duration, started, reduce]);

  const displayedText = reduce && started ? children : typed;

  if (typeof children !== "string") {
    throw new Error("TypingAnimation: children must be a string.");
  }

  return (
    <MotionComponent
      ref={elementRef}
      className={cn(
        "whitespace-pre-wrap [overflow-wrap:anywhere]",
        hasSequence && !started && !reduce && "hidden",
        className,
      )}
      {...props}
    >
      {prompt}
      <span aria-hidden="true">{displayedText}</span>
      <span className="sr-only">{children}</span>
      {started && displayedText.length < children.length && (
        <span
          aria-hidden="true"
          className="caret ml-px inline-block h-[1.05em] w-[0.55em] translate-y-[0.15em] bg-tape-ink"
        />
      )}
    </MotionComponent>
  );
};

export type TerminalMode = "record" | "replay" | "passed" | "failed" | null;

interface TerminalProps {
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  sequence?: boolean;
  startOnView?: boolean;
  /** Shell + working directory shown in the title bar. */
  title?: string;
  mode?: TerminalMode;
  /** Plain-text commands copied by the header copy button. */
  copyText?: string;
  /** Max body height (CSS length). Body scrolls beyond it. */
  maxHeight?: string;
  /** Fixed body height, so the window is full size before any output. */
  height?: string;
  /** Accessible name for the output log. */
  label?: string;
  /** Rendered at the bottom of the body (e.g. an input row). */
  footer?: React.ReactNode;
  /** Change this to keep the view pinned to new output. */
  scrollKey?: unknown;
  /** Shown under the body, e.g. run status. */
  statusBar?: React.ReactNode;
  /** Extra controls in the title bar (e.g. play/pause). */
  controls?: React.ReactNode;
  /** A soft brand-colored halo behind the window. */
  glow?: boolean;
  /** Change this to scroll to the run's result ([data-fail], else the last [data-summary]). */
  anchorKey?: number;
  /** The focused window of a pair: colored traffic lights. */
  active?: boolean;
  /** Sequence mode: called once every item has played. */
  onDone?: () => void;
}

function ModeBadge({ mode }: { mode: Exclude<TerminalMode, null> }) {
  if (mode === "passed" || mode === "failed") {
    const pass = mode === "passed";
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
          pass
            ? "border-replay/40 bg-replay/10 text-[#5fe0d8]"
            : "border-record/40 bg-record/10 text-[#ff8a8e]",
        )}
      >
        {pass ? (
          <Check className="size-3" aria-hidden="true" />
        ) : (
          <X className="size-3" aria-hidden="true" />
        )}
        {pass ? "Passed" : "Failed"}
      </span>
    );
  }
  return mode === "record" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-record/40 bg-record/10 px-2 py-0.5 text-[11px] font-medium text-[#ff8a8e]">
      <span className="rec-pulse size-1.5 rounded-full bg-record" />
      Recording
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-replay/40 bg-replay/10 px-2 py-0.5 text-[11px] font-medium text-[#5fe0d8]">
      <svg viewBox="0 0 8 8" className="size-2 fill-current" aria-hidden="true">
        <path d="M1 0.5 7 4 1 7.5z" />
      </svg>
      Replaying
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
      className="relative inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-tape-dim transition-colors after:absolute after:-inset-2 after:content-[''] hover:bg-white/5 hover:text-tape-ink"
      aria-label={copied ? "Copied" : "Copy commands"}
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      <span className="max-sm:sr-only">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export const Terminal = ({
  children,
  className,
  bodyClassName,
  sequence = true,
  startOnView = true,
  title,
  mode = null,
  copyText,
  maxHeight = "26rem",
  height,
  label = "Terminal output",
  footer,
  scrollKey,
  statusBar,
  anchorKey,
  controls,
  active = false,
  glow = false,
  onDone,
}: TerminalProps) => {
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(containerRef as React.RefObject<Element>, {
    amount: 0.3,
    once: true,
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const sequenceHasStarted = sequence ? !startOnView || isInView : false;
  const count = Children.toArray(children).length;
  const shownIndex = reduce ? count : activeIndex;
  const done = sequence ? shownIndex >= count : true;
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (sequence && done && count) onDoneRef.current?.();
  }, [sequence, done, count]);

  const contextValue = useMemo<SequenceContextValue | null>(() => {
    if (!sequence) return null;
    return {
      completeItem: (index: number) => {
        setActiveIndex((current) =>
          index === current ? current + 1 : current,
        );
      },
      activeIndex: shownIndex,
      sequenceStarted: sequenceHasStarted,
    };
  }, [sequence, shownIndex, sequenceHasStarted]);

  // Follow new output like a real terminal. Only the reader's own input
  // (wheel, touch, keys) unpins; scrolling back to the bottom re-pins.
  const pinned = useRef(true);
  const innerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = bodyRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    const stick = () => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    };
    const ro = new ResizeObserver(stick);
    ro.observe(inner);
    const unpin = () => {
      requestAnimationFrame(() => {
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
      });
    };
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) pinned.current = false;
      else unpin();
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "PageUp", "Home"].includes(e.key)) pinned.current = false;
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchmove", unpin, { passive: true });
    el.addEventListener("keydown", onKey);
    stick();
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", unpin);
      el.removeEventListener("keydown", onKey);
    };
  }, []);
  // A restarted loop clears the output: start again from the top, pinned.
  const lastKey = useRef(scrollKey);
  useEffect(() => {
    const el = bodyRef.current;
    const prev = lastKey.current;
    lastKey.current = scrollKey;
    if (el && typeof prev === "number" && typeof scrollKey === "number" && scrollKey < prev) {
      pinned.current = true;
      el.scrollTop = 0;
    }
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [activeIndex, scrollKey]);

  // When a run ends, show its result rather than the shutdown logs after it.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !anchorKey) return;
    const summaries = el.querySelectorAll<HTMLElement>("[data-summary]");
    const target = el.querySelector<HTMLElement>("[data-fail]") ?? summaries[summaries.length - 1];
    if (!target) return;
    pinned.current = false;
    // Wait a frame for the final prompt to render, then jump (a smooth scroll
    // would pass the bottom and re-pin to the shutdown logs).
    requestAnimationFrame(() => {
      pinned.current = false;
      const top = (target.previousElementSibling as HTMLElement | null) ?? target;
      el.scrollTo({ top: top.offsetTop - 8, behavior: "instant" });
    });
  }, [anchorKey]);

  const wrappedChildren = useMemo(() => {
    if (!sequence) return children;
    return Children.toArray(children).map((child, index) => (
      <ItemIndexContext.Provider key={index} value={index}>
        {child as React.ReactNode}
      </ItemIndexContext.Provider>
    ));
  }, [children, sequence]);

  const content = (
    <div
      ref={containerRef}
      className={cn(
        "z-0 w-full min-w-0 overflow-hidden rounded-xl border border-tape-rule bg-tape text-tape-ink shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_20px_40px_-24px_rgba(8,10,14,0.55)]",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-tape-rule px-3.5 py-2">
        <div className="flex shrink-0 gap-1.5" aria-hidden="true">
          <span className={cn("size-2.5 rounded-full transition-colors duration-300", active ? "bg-[#ff5f57]/85" : "bg-[#3a4250]")} />
          <span className={cn("size-2.5 rounded-full transition-colors duration-300", active ? "bg-[#febc2e]/85" : "bg-[#3a4250]")} />
          <span className={cn("size-2.5 rounded-full transition-colors duration-300", active ? "bg-[#28c840]/85" : "bg-[#3a4250]")} />
        </div>
        {title && (
          <span className="min-w-0 truncate font-mono text-[11.5px] text-tape-dim">
            {title}
          </span>
        )}
        <span data-controls="" className="ml-auto flex shrink-0 items-center gap-2">
          {mode && <ModeBadge mode={mode} />}
          {controls}
          {copyText && <CopyButton text={copyText} />}
        </span>
      </div>
      <div
        ref={bodyRef}
        role="log"
        aria-live="off"
        aria-label={label}
        aria-busy={!done}
        // Focusable so keyboard readers can scroll back through the output.
        tabIndex={0}
        className={cn(
          "relative overflow-auto px-4 py-3.5 font-term text-[12.5px] leading-[1.6] outline-none focus-visible:ring-2 focus-visible:ring-orange/60 focus-visible:ring-inset",
          bodyClassName,
        )}
        style={height ? { height } : { maxHeight }}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 8) pinned.current = true;
          // Soft top edge while scrolled, so a half-visible line reads as scrollback.
          el.toggleAttribute("data-scrolled", el.scrollTop > 2);
        }}
      >
        <div ref={innerRef}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-y-0.5 whitespace-pre-wrap">{wrappedChildren}</div>
          {footer}
        </div>
      </div>
      {statusBar}
    </div>
  );

  const framed = glow ? (
    <div className="relative isolate">
      <div aria-hidden="true" className="term-glow" />
      {content}
    </div>
  ) : (
    content
  );

  if (!sequence) return framed;

  return (
    <SequenceContext.Provider value={contextValue}>
      {framed}
    </SequenceContext.Provider>
  );
};

export default Terminal;
