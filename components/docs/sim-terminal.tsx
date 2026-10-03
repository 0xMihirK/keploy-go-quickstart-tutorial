"use client";

import {
  useCallback,
  useEffect,
  useRef,
  memo,
  useState,
} from "react";
import { useInView } from "motion/react";
import { Pause } from "lucide-react";

import {
  AnimatedSpan,
  Terminal,
  TypingAnimation,
  type TerminalMode,
} from "@/components/ui/terminal";
import { Ansi, BlockArt, isBlockArt, stripAnsi } from "@/lib/ansi";
import { loadRun, markBusy, streamLines, type RunLine } from "@/lib/runs";
import { Prompt } from "./prompt";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/reduced-motion";
import { usePageVisible } from "@/lib/page-visible";
import { LoopButton } from "./loop-button";

export { LoopButton, usePageVisible };

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
  /** Regex: pause streaming after the first matching line (e.g. "ready"). */
  pauseAt?: string;
  /** Regex: in the demo, linger on the first matching line so it can be read. */
  holdAt?: string;
}

/** Default holds per captured run, for lines that would otherwise fly past. */
const RUN_HOLDS: Record<string, RegExp> = {
  // The banner's version line; the "🐰 Keploy: 2026-..." log lines must not match.
  "01-install": /^Keploy: \d/,
};
const HOLD_MS = 2500;

interface WaitState {
  secs: number;
  ms: number;
}

let nextId = 1;

export function useShell() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  // Pause button: output holds before the next line until resume().
  const [held, setHeld] = useState(false);
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
  const heldRef = useRef(false);
  // A command is loading or streaming (pause only applies then).
  const active = useRef(false);

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
    async (
      until?: RegExp,
      opts: { ctrl?: AbortController; holdAt?: RegExp } = {},
    ): Promise<"done" | "paused" | "aborted"> => {
      const all = lines.current;
      const find = (re: RegExp) =>
        all.findIndex((l, i) => i >= pos.current && re.test(stripAnsi(l.text)));
      let end = all.length;
      if (until) {
        const hit = find(until);
        if (hit !== -1) end = hit + 1;
      }
      const holdIdx = opts.holdAt ? find(opts.holdAt) : -1;
      const ctrl = opts.ctrl ?? new AbortController();
      abort.current = ctrl;
      active.current = true;
      setRunning(true);
      setPaused(false);
      try {
        await streamLines(all, pos.current, end, {
          onLine,
          onWait: (secs, ms) => setWait(secs ? { secs, ms } : null),
          signal: ctrl.signal,
          instant: !!reduce,
          isPaused: () => heldRef.current,
          holdAfter: (i) => (i === holdIdx ? HOLD_MS : 0),
        });
      } catch {
        return "aborted";
      } finally {
        setWait(null);
        if (abort.current === ctrl) active.current = false;
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

  /** Runs a command; `demo` applies the holds meant for the self-playing loop. */
  const exec = useCallback(
    async (c: Cmd, { demo = false } = {}) => {
      // Created before the fetch so Ctrl+C or a reset works while loading.
      const ctrl = new AbortController();
      abort.current = ctrl;
      active.current = true;
      if (c.run) {
        setRunning(true);
        try {
          const run = await loadRun(c.run);
          if (ctrl.signal.aborted) return "aborted";
          lines.current = run.lines;
          setReal(run.real);
        } catch {
          if (ctrl.signal.aborted) return "aborted";
          active.current = false;
          push("note", "Couldn't load the recorded run.");
          setRunning(false);
          return "aborted";
        }
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
      const hold = c.holdAt ? new RegExp(c.holdAt) : c.run ? RUN_HOLDS[c.run] : undefined;
      return stream(c.pauseAt ? new RegExp(c.pauseAt) : undefined, {
        ctrl,
        holdAt: demo ? hold : undefined,
      });
    },
    [stream, push],
  );

  const pause = useCallback(() => {
    heldRef.current = true;
    setHeld(true);
  }, []);

  /** Waits ms, then for as long as the shell is held (paused or off screen). */
  const sleep = useCallback(async (ms: number) => {
    await new Promise((r) => setTimeout(r, ms));
    while (heldRef.current) await new Promise((r) => setTimeout(r, 120));
  }, []);

  const resume = useCallback(() => {
    heldRef.current = false;
    setHeld(false);
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    active.current = false;
    heldRef.current = false;
    setHeld(false);
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
    push,
    exec,
    stream,
    reset,
    pause,
    resume,
    sleep,
    running,
    paused,
    held,
    wait,
    real,
    progress,
    outcome,
  };
}

/** Title badge: Keploy's result once there is one, else the mode while it runs. */
export function outcomeMode(
  outcome: "pass" | "fail" | null,
  mode: TerminalMode | undefined,
): TerminalMode {
  return outcome === "pass" ? "passed" : outcome === "fail" ? "failed" : (mode ?? null);
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
      const f = Math.min(1, Math.max(0, (t - start) / Math.max(ms, 1)));
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
  runningText = "Running…",
  userPaused = false,
}: {
  shell: Shell;
  idleText?: string;
  pausedText?: string;
  runningText?: string;
  /** The reader pressed Pause (not an automatic off-screen hold). */
  userPaused?: boolean;
}) {
  const { running, paused, held, wait, real, progress, outcome } = shell;
  // The row is always there (empty when idle) so the window doesn't reflow.
  return (
    <div className="relative flex min-h-8 items-center gap-2 border-t border-tape-rule px-3.5 py-1.5 font-mono text-[11px] text-tape-dim">
      {/* Run progress along the top edge; fades out once the command ends so
          a finished run doesn't leave a stray line. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute -top-px left-0 h-px transition-[width,opacity] duration-500",
          running && !paused && !held ? "opacity-100" : "opacity-0",
          outcome === "fail" ? "bg-record" : outcome === "pass" ? "bg-replay" : "bg-orange",
        )}
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
      {held && userPaused ? (
        <>
          <Pause className="size-3" aria-hidden="true" />
          <span>Paused. Press Play to continue.</span>
        </>
      ) : running && !paused ? (
        <>
          <span className="text-[#ffd77a]">
            <Spinner />
          </span>
          {wait ? (
            <span>
              Waiting… <WaitCounter {...wait} /> (sped up)
            </span>
          ) : (
            <span>{runningText}</span>
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

export const EntryLine = memo(function EntryLine({ entry }: { entry: Entry }) {
  if (entry.kind === "cmd") {
    return (
      <AnimatedSpan className="break-all text-tape-ink">
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
  const table = /[│┌├└╭╰]/.test(entry.text);
  const plain = stripAnsi(entry.text);
  const isFail = /^Testrun failed/.test(plain);
  const isSummary = /TESTRUN SUMMARY/.test(plain);
  const captured = /captured test cases/.test(entry.text);
  // A thin bar marks results so they stand out from the INFO logs.
  const accent = /Total test failed:\s*[1-9]/.test(plain)
    ? "shadow-[inset_2px_0_0_var(--record)]"
    : /^\s*Total (tests|test passed|test failed|time taken):/.test(plain) || isSummary
      ? "shadow-[inset_2px_0_0_var(--replay)]"
      : captured
        ? "shadow-[inset_2px_0_0_var(--orange)]"
        : null;
  return (
    <div
      data-fail={isFail ? "" : undefined}
      data-summary={isSummary ? "" : undefined}
      className={cn(
        table ? "w-max whitespace-pre leading-[1.2]" : "whitespace-pre-wrap break-words",
        accent && "-mx-2 px-2",
        accent,
        captured && "line-flash",
      )}
    >
      <Ansi text={entry.text} />
    </div>
  );
});

/** The prompt line under the output. The loop types each command here. */
export function PromptLine({
  cwd,
  command,
  busy = false,
  onTyped,
}: {
  cwd: string;
  /** When set, it's typed out after the prompt, then onTyped fires. */
  command?: string;
  /** A command is running: show only the cursor, like a real shell. */
  busy?: boolean;
  onTyped?: () => void;
}) {
  if (command) {
    return (
      <TypingAnimation
        startOnView={false}
        duration={22}
        className="text-tape-ink"
        prompt={<Prompt cwd={cwd} />}
        onComplete={onTyped}
      >
        {command}
      </TypingAnimation>
    );
  }
  return (
    <div aria-hidden="true" className="whitespace-pre-wrap break-all">
      {!busy && <Prompt cwd={cwd} />}
      <span className="caret inline-block h-[1.05em] w-[0.55em] translate-y-[0.15em] bg-tape-ink" />
    </div>
  );
}

/**
 * True while a looping animation should move: not paused by the reader, on
 * screen, and the tab in front. Streaming output holds while it's false and
 * picks up from the same line when it's true again.
 */
export function useLive(
  ref: React.RefObject<Element | null>,
  playing: boolean,
  ...shells: Shell[]
) {
  const inView = useInView(ref as React.RefObject<Element>, { amount: 0.35 });
  const visible = usePageVisible();
  const live = playing && inView && visible;
  useEffect(() => {
    for (const s of shells) {
      if (live) s.resume();
      else s.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pause/resume are stable; only `live` matters
  }, [live]);
  return live;
}

/* ------------------------------------------------------------------ */
/* SimTerminal                                                         */
/* ------------------------------------------------------------------ */

export interface SimTerminalProps {
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

/**
 * A terminal that plays a step's commands by itself, on a loop: it types each
 * command, streams the real captured output, holds on the result, then starts
 * over. It pauses off screen and when the reader presses Pause.
 */
export function SimTerminal({
  commands,
  cwd = "~",
  title = "bash",
  mode,
  maxHeight = "min(28rem, 54dvh)",
  className,
  onCommandDone,
  label = "Terminal",
}: SimTerminalProps) {
  const shell = useShell();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [runs, setRuns] = useState(0);
  // A run that failed to load; stop instead of retrying forever.
  const [broken, setBroken] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Bumped on restart, so a run from the previous loop can't advance the step.
  const gen = useRef(0);
  const live = useLive(rootRef, playing, shell);
  const done = step >= commands.length;
  const current = commands[step];
  const promptCwd = current?.cwd ?? commands[commands.length - 1]?.cwd ?? cwd;
  const busy = shell.running;
  // Reduced motion: play through once with no animation and stay on the result.
  const finished = done && reduce;

  const runCurrent = async () => {
    const g = gen.current;
    const c = commands[step];
    shell.push("cmd", c.cmd, promptCwd);
    const result = await shell.exec(c, { demo: true });
    if (gen.current !== g) return;
    if (result === "aborted") {
      setBroken(true);
      return;
    }
    setRuns((n) => n + 1);
    onCommandDone?.(step);
    setStep(step + 1);
  };

  const restart = () => {
    gen.current++;
    shell.reset();
    setStep(0);
    setTyping(false);
  };

  // The loop: type the next command, run it, hold on the result, start over.
  useEffect(() => {
    if (!live || busy || typing || broken || finished) return;
    const t = done
      ? setTimeout(restart, shell.outcome ? 6500 : 4000)
      : setTimeout(
          () => (reduce ? void runCurrent() : setTyping(true)),
          reduce ? 0 : step === 0 ? 700 : 1100,
        );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart/runCurrent read current state when they fire
  }, [live, busy, typing, broken, finished, done, step, shell.outcome, reduce]);

  // Leaving the screen mid-way through typing: retype it on return.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cancel a half-typed command
    if (!live && typing) setTyping(false);
  }, [live, typing]);

  return (
    <div ref={rootRef} className={cn("not-prose my-6", className)}>
      <Terminal
        glow
        sequence={false}
        title={`${title} — ${promptCwd}`}
        mode={outcomeMode(shell.outcome, mode)}
        controls={
          <LoopButton
            playing={playing && !finished}
            onToggle={() => (finished ? restart() : setPlaying((p) => !p))}
          />
        }
        copyText={commands.map((c) => c.cmd).join("\n")}
        height={maxHeight}
        label={label}
        anchorKey={shell.outcome ? runs : 0}
        scrollKey={shell.entries.length + (shell.entries.at(-1)?.text.length ?? 0)}
        className={cn("transition-shadow duration-700", outcomeRing(shell.outcome))}
        footer={
          <PromptLine
            cwd={promptCwd}
            busy={busy}
            command={typing ? current?.cmd : undefined}
            onTyped={() => {
              setTyping(false);
              if (current) void runCurrent();
            }}
          />
        }
        statusBar={<StatusBar shell={shell} userPaused={!playing} />}
      >
        {shell.entries.map((e) => (
          <EntryLine key={e.id} entry={e} />
        ))}
      </Terminal>
    </div>
  );
}
