"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useInView } from "motion/react";
import { Pause, Play } from "lucide-react";

import { AnimatedSpan, Terminal, TypingAnimation } from "@/components/ui/terminal";
import { Ansi, BlockArt, isBlockArt, stripAnsi } from "@/lib/ansi";
import { loadRun, markBusy, streamLines, type RunLine } from "@/lib/runs";
import { setDone } from "@/lib/progress";
import { Prompt } from "./prompt";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/reduced-motion";

/* ------------------------------------------------------------------ */
/* Shell state                                                         */
/* ------------------------------------------------------------------ */

type EntryKind = "cmd" | "out" | "note";
interface Entry {
  id: number;
  kind: EntryKind;
  text: string;
  cwd?: string;
}

export interface Cmd {
  /** The command the reader should run. */
  cmd: string;
  /** Captured run (public/runs/<name>.json) to replay as output. */
  run?: string;
  /** Static output lines, for commands that print little or nothing. */
  out?: string[];
  /** Working directory shown in the prompt for this command. */
  cwd?: string;
  /** Other spellings that count as correct. */
  accept?: string[];
  /** Regex: pause streaming after the first matching line (e.g. "ready"). */
  pauseAt?: string;
}

interface WaitState {
  secs: number;
  ms: number;
}

let nextId = 1;

export function useShell() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [wait, setWait] = useState<WaitState | null>(null);
  const [real, setReal] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<"pass" | "fail" | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!running) return;
    markBusy(1);
    return () => markBusy(-1);
  }, [running]);
  const lines = useRef<RunLine[]>([]);
  const pos = useRef(0);
  const abort = useRef<AbortController | null>(null);

  const push = useCallback((kind: EntryKind, text: string, cwd?: string) => {
    setEntries((e) => [...e, { id: nextId++, kind, text, cwd }]);
  }, []);

  const onLine = useCallback((line: RunLine, i: number) => {
    setProgress((i + 1) / Math.max(1, lines.current.length));
    setEntries((e) => {
      if (line.r && e.length && e[e.length - 1].kind === "out") {
        const copy = e.slice();
        copy[copy.length - 1] = { ...copy[copy.length - 1], text: line.text };
        return copy;
      }
      return [...e, { id: nextId++, kind: "out", text: line.text }];
    });
  }, []);

  /** Streams from the current position to `until` (inclusive) or the end. */
  const stream = useCallback(
    async (until?: RegExp): Promise<"done" | "paused" | "aborted"> => {
      const all = lines.current;
      let end = all.length;
      if (until) {
        const hit = all.findIndex(
          (l, i) => i >= pos.current && until.test(stripAnsi(l.text)),
        );
        if (hit !== -1) end = hit + 1;
      }
      const ctrl = new AbortController();
      abort.current = ctrl;
      setRunning(true);
      setPaused(false);
      try {
        await streamLines(all, pos.current, end, {
          onLine,
          onWait: (secs, ms) => setWait(secs ? { secs, ms } : null),
          signal: ctrl.signal,
          instant: !!reduce,
        });
      } catch {
        return "aborted";
      } finally {
        setWait(null);
      }
      pos.current = end;
      if (end < all.length) {
        setPaused(true);
        return "paused";
      }
      // Keploy's own summary decides pass or fail.
      const failed = all
        .map((l) => stripAnsi(l.text))
        .reverse()
        .find((t) => /Total test failed:/.test(t));
      if (failed) setOutcome(/:\s*0\s*$/.test(failed) ? "pass" : "fail");
      setRunning(false);
      return "done";
    },
    [onLine, reduce],
  );

  const exec = useCallback(
    async (c: Cmd) => {
      if (c.run) {
        setRunning(true);
        const run = await loadRun(c.run);
        lines.current = run.lines;
        setReal(run.real);
      } else {
        lines.current = (c.out ?? []).map((text, i) => ({
          d: i === 0 ? 280 : 40,
          text,
        }));
        setReal(null);
      }
      pos.current = 0;
      setProgress(0);
      setOutcome(null);
      return stream(c.pauseAt ? new RegExp(c.pauseAt) : undefined);
    },
    [stream],
  );

  /** Ctrl+C while a replay streams: stop it where it is, like a real shell. */
  const interrupt = useCallback(() => {
    abort.current?.abort();
    setEntries((e) => [...e, { id: nextId++, kind: "out", text: "^C" }]);
    setRunning(false);
    setPaused(false);
    setWait(null);
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    lines.current = [];
    pos.current = 0;
    setEntries([]);
    setRunning(false);
    setPaused(false);
    setWait(null);
    setReal(null);
    setProgress(0);
    setOutcome(null);
  }, []);

  useEffect(() => () => abort.current?.abort(), []);

  return {
    entries,
    setEntries,
    push,
    exec,
    stream,
    reset,
    interrupt,
    running,
    paused,
    wait,
    real,
    progress,
    outcome,
  };
}

/** Frame glow once Keploy reports a result. */
export function outcomeRing(outcome: "pass" | "fail" | null) {
  return outcome === "pass"
    ? "shadow-[0_0_0_1px_var(--replay),0_18px_40px_-18px_var(--replay)]"
    : outcome === "fail"
      ? "shadow-[0_0_0_1px_var(--record),0_18px_40px_-18px_var(--record)]"
      : "";
}

export type Shell = ReturnType<typeof useShell>;

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function WaitCounter({ secs, ms }: WaitState) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const f = Math.min(1, (t - start) / Math.max(ms, 1));
      setShown(secs * f);
      if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [secs, ms]);
  return <span className="tabular-nums">{shown.toFixed(1)} s</span>;
}

const SPIN = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
function Spinner() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % SPIN.length), 80);
    return () => clearInterval(t);
  }, []);
  return <span aria-hidden="true">{SPIN[i]}</span>;
}

export function StatusBar({
  shell,
  idleText,
  pausedText,
}: {
  shell: Shell;
  idleText?: string;
  pausedText?: string;
}) {
  const { running, paused, wait, real, progress, outcome } = shell;
  // Nothing to report until something runs.
  if (!running && !paused && !idleText && !real) return null;
  return (
    <div className="relative flex min-h-8 items-center gap-2 border-t border-tape-rule px-3.5 py-1.5 font-mono text-[11px] text-tape-dim">
      {(running || progress > 0) && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute -top-px left-0 h-px transition-[width] duration-200",
            outcome === "fail" ? "bg-record" : outcome === "pass" ? "bg-replay" : "bg-orange",
          )}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      )}
      {running && !paused ? (
        <>
          <span className="text-[#ffd77a]">
            <Spinner />
          </span>
          {wait ? (
            <span>
              Keploy is working… <WaitCounter {...wait} /> (sped up)
            </span>
          ) : (
            <span>Running…</span>
          )}
        </>
      ) : paused ? (
        <>
          <span className="rec-pulse size-1.5 rounded-full bg-record" />
          <span>{pausedText ?? "Waiting…"}</span>
        </>
      ) : idleText ? (
        <span>{idleText}</span>
      ) : null}
      {real ? (
        <span className="ml-auto hidden shrink-0 sm:inline">
          real run: {real.toFixed(1)} s
        </span>
      ) : null}
    </div>
  );
}

export function EntryLine({ entry }: { entry: Entry }) {
  if (entry.kind === "cmd") {
    return (
      <AnimatedSpan className="text-tape-ink">
        <span>
          <Prompt cwd={entry.cwd ?? "~"} />
          {entry.text}
        </span>
      </AnimatedSpan>
    );
  }
  if (entry.kind === "note") {
    return (
      <AnimatedSpan className="my-1 border-l-2 border-orange pl-2 text-[#ffb98a]">
        {entry.text}
      </AnimatedSpan>
    );
  }
  if (isBlockArt(entry.text)) return <BlockArt text={entry.text} />;
  // Box-drawing tables (Keploy's diff view) must not wrap; logs should.
  const table = /[│┌├└]/.test(entry.text);
  const plain = stripAnsi(entry.text);
  const isFail = /^Testrun failed/.test(plain);
  const isSummary = /TESTRUN SUMMARY/.test(plain);
  const captured = /captured test cases/.test(entry.text);
  return (
    <div
      data-fail={isFail ? "" : undefined}
      data-summary={isSummary ? "" : undefined}
      className={cn(
        table ? "w-max whitespace-pre leading-[1.2]" : "whitespace-pre-wrap break-words",
        captured && "line-flash",
      )}
    >
      <Ansi text={entry.text} />
    </div>
  );
}

const norm = (s: string) =>
  s
    .trim()
    .replace(/^\$\s*/, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/'/g, '"')
    .replace(/\s+/g, " ");

/** The editable prompt line: hidden input + rendered text, caret and ghost hint. */
export function PromptInput({
  cwd,
  expected,
  onSubmit,
  onInterrupt,
  onClear,
  history,
  label,
  autoType,
  onAutoTyped,
  busy = false,
  onFocus,
}: {
  cwd: string;
  expected?: string;
  onSubmit: (value: string) => void;
  onInterrupt?: () => void;
  onClear?: () => void;
  history: string[];
  label: string;
  autoType?: boolean;
  onAutoTyped?: () => void;
  /** A command is running: keep focus here, show only the cursor. */
  busy?: boolean;
  onFocus?: () => void;
}) {
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const hintId = useId();

  const ghost =
    expected && caret === value.length && expected.startsWith(value)
      ? expected.slice(value.length)
      : "";

  const sync = () => setCaret(ref.current?.selectionStart ?? value.length);

  const fill = () => {
    if (!expected) return;
    setValue(expected);
    setCaret(expected.length);
    requestAnimationFrame(() =>
      ref.current?.setSelectionRange(expected.length, expected.length),
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (busy) {
      if (e.key === "c" && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        onInterrupt?.();
      } else if (e.key.length === 1 || e.key === "Enter" || e.key === "Backspace") {
        e.preventDefault();
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit(value);
      setValue("");
      setCaret(0);
      setHistIdx(null);
    } else if (
      ghost &&
      (e.key === "ArrowRight" || e.key === "End" || (e.key === " " && e.ctrlKey))
    ) {
      e.preventDefault();
      fill();
    } else if (e.key === "c" && e.ctrlKey && !window.getSelection()?.toString()) {
      e.preventDefault();
      e.stopPropagation();
      onInterrupt?.();
      setValue("");
      setCaret(0);
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      onClear?.();
    } else if (e.key === "ArrowUp" && history.length) {
      e.preventDefault();
      const i = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(i);
      setValue(history[i]);
      setCaret(history[i].length);
    } else if (e.key === "ArrowDown" && histIdx !== null) {
      e.preventDefault();
      const i = histIdx + 1;
      if (i >= history.length) {
        setHistIdx(null);
        setValue("");
        setCaret(0);
      } else {
        setHistIdx(i);
        setValue(history[i]);
        setCaret(history[i].length);
      }
    }
  };

  if (autoType && expected) {
    return (
      <TypingAnimation
        startOnView={false}
        duration={22}
        className="text-tape-ink"
        prompt={<Prompt cwd={cwd} />}
        onComplete={onAutoTyped}
      >
        {expected}
      </TypingAnimation>
    );
  }

  const before = value.slice(0, caret);
  const at = value[caret];
  const after = value.slice(caret + 1);

  return (
    <div
      className="relative cursor-text"
      onClick={() => ref.current?.focus()}
    >
      <label className="sr-only" htmlFor={hintId + "-in"}>
        {label}
      </label>
      <input
        ref={ref}
        id={hintId + "-in"}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={sync}
        onSelect={sync}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => setFocused(false)}
        readOnly={busy}
        aria-describedby={hintId}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
        style={{ fontSize: 16 }}
      />
      <span id={hintId} className="sr-only">
        {busy
          ? "Running. Output appears above."
          : expected
            ? `Expected command: ${expected}. Press Right Arrow to fill it in, then Enter to run.`
            : "Press Enter to run."}
      </span>
      {busy ? (
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-[1.05em] w-[0.55em] translate-y-[0.15em] bg-tape-ink",
            focused ? "caret" : "opacity-60",
          )}
        />
      ) : (
      <div aria-hidden="true" className="whitespace-pre-wrap break-all">
        <Prompt cwd={cwd} />
        <span className="text-tape-ink">{before}</span>
        <span
          className={cn(
            "relative",
            focused
              ? "caret bg-tape-ink text-tape"
              : "outline outline-1 -outline-offset-1 outline-tape-dim",
          )}
        >
          {at ?? (ghost ? ghost[0] : " ")}
        </span>
        {at !== undefined ? (
          <span className="text-tape-ink">{after}</span>
        ) : (
          <span className="text-tape-dim">{ghost.slice(1)}</span>
        )}
      </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SimTerminal                                                         */
/* ------------------------------------------------------------------ */

export interface SimTerminalProps {
  /** Checkpoint id ticked when every command has run. */
  id?: string;
  commands: Cmd[];
  /** Prompt directory before the first command. */
  cwd?: string;
  title?: string;
  mode?: "record" | "replay";
  maxHeight?: string;
  className?: string;
  /** Called after each command finishes (index). */
  onCommandDone?: (index: number) => void;
  label?: string;
}

export function SimTerminal({
  id,
  commands,
  cwd = "~",
  title = "bash",
  mode,
  maxHeight = "min(22rem, 58dvh)",
  className,
  onCommandDone,
  label = "Practice terminal",
}: SimTerminalProps) {
  const shell = useShell();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(false);
  // "demo" plays the commands on a loop; "you" means the reader took over.
  const [driver, setDriver] = useState<"demo" | "you">("demo");
  const [history, setHistory] = useState<string[]>([]);
  const [announce, setAnnounce] = useState("");
  const [runs, setRuns] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.35 });
  const done = step >= commands.length;
  const current = commands[step];
  const promptCwd = current?.cwd ?? commands[commands.length - 1]?.cwd ?? cwd;
  const busy = shell.running;

  const runCurrent = async (typed: string, byReader: boolean) => {
    const c = commands[step];
    shell.push("cmd", typed, promptCwd);
    setHistory((h) => [...h, typed]);
    setAnnounce(`Running ${c.cmd}`);
    const result = await shell.exec(c);
    if (result === "aborted") {
      setAnnounce("Stopped");
      return;
    }
    setAnnounce(`Finished: ${c.cmd}`);
    setRuns((n) => n + 1);
    onCommandDone?.(step);
    const next = step + 1;
    setStep(next);
    // Progress counts what the reader ran, not the demo loop.
    if (byReader && next >= commands.length && id) setDone(id, true);
  };

  const restart = () => {
    shell.reset();
    setStep(0);
    setAuto(false);
  };

  // The demo loop: type the next command, run it, hold on the result, start over.
  useEffect(() => {
    if (driver !== "demo" || !inView || busy || auto) return;
    if (!done) {
      const t = setTimeout(() => setAuto(true), step === 0 ? 700 : 1100);
      return () => clearTimeout(t);
    }
    if (reduce) return; // show the finished run once, without looping
    const t = setTimeout(restart, shell.outcome ? 6500 : 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart is stable in effect
  }, [driver, inView, busy, auto, done, step, reduce, shell.outcome]);

  // Leaving the screen pauses typing mid-way; it resumes from the same step.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cancel a half-typed demo command
    if (!inView && auto) setAuto(false);
  }, [inView, auto]);

  const takeOver = () => {
    if (driver === "you") return;
    setDriver("you");
    setAuto(false);
  };

  const submit = (raw: string) => {
    const value = norm(raw);
    if (!value) {
      shell.push("cmd", "", promptCwd);
      return;
    }
    if (value === "clear") {
      shell.setEntries([]);
      return;
    }
    if (current) {
      const ok = [current.cmd, ...(current.accept ?? [])].some((a) => norm(a) === value);
      if (ok) {
        void runCurrent(raw.trim(), true);
        return;
      }
      shell.push("cmd", raw.trim(), promptCwd);
      const sameTool = value.split(" ")[0] === norm(current.cmd).split(" ")[0];
      shell.push(
        "note",
        sameTool
          ? `Close. This step runs:
  ${current.cmd}
Press → to fill it in, then Enter.`
          : `This practice terminal only runs the commands from this step. Next up:
  ${current.cmd}`,
      );
      setHistory((h) => [...h, raw.trim()]);
      return;
    }
    shell.push("cmd", raw.trim(), promptCwd);
    shell.push("note", "That was the last command for this step. Press play in the title bar to watch it again.");
  };

  const playing = driver === "demo";
  const loopButton = (
    <button
      type="button"
      onClick={() => {
        if (playing) return takeOver();
        if (done) restart();
        setDriver("demo");
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-tape-dim transition-colors hover:bg-white/5 hover:text-tape-ink"
      aria-label={playing ? "Pause the demo and type yourself" : "Play the demo"}
    >
      {playing ? <Pause className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
      <span>{playing ? "Pause" : "Play"}</span>
    </button>
  );

  return (
    <div
      ref={rootRef}
      className={cn("not-prose my-6", className)}
      onPointerDown={(e) => {
        // Clicking into the window (not its buttons) hands control to the reader.
        if (!(e.target as Element).closest("button")) takeOver();
      }}
    >
      <Terminal
        sequence={false}
        title={`${title} — ${promptCwd}`}
        mode={mode}
        controls={loopButton}
        copyText={commands.map((c) => c.cmd).join("\n")}
        height={maxHeight}
        label={label}
        anchorKey={shell.outcome ? runs : 0}
        scrollKey={shell.entries.length + (shell.entries.at(-1)?.text.length ?? 0)}
        className={cn(
          "transition-shadow duration-700 focus-within:ring-2 focus-within:ring-orange/70",
          outcomeRing(shell.outcome),
        )}
        footer={
          <PromptInput
            busy={busy}
            cwd={promptCwd}
            expected={current?.cmd}
            onSubmit={submit}
            onInterrupt={() => (busy ? shell.interrupt() : shell.push("cmd", "^C", promptCwd))}
            onClear={() => shell.setEntries([])}
            onFocus={takeOver}
            history={history}
            label={`${label}: type a command`}
            autoType={auto && !!current}
            onAutoTyped={() => {
              setAuto(false);
              if (current) void runCurrent(current.cmd, false);
            }}
          />
        }
        statusBar={<StatusBar shell={shell} />}
      >
        {shell.entries.map((e) => (
          <EntryLine key={e.id} entry={e} />
        ))}
      </Terminal>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
