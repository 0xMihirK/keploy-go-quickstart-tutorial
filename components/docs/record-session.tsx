"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { Pause, Play, Square } from "lucide-react";

import { Terminal } from "@/components/ui/terminal";
import { setDone } from "@/lib/progress";
import { useReducedMotion } from "@/lib/reduced-motion";
import { cn } from "@/lib/utils";
import {
  EntryLine,
  MAX_LOOPS,
  PromptInput,
  StatusBar,
  outcomeMode,
  outcomeRing,
  useAnnounce,
  usePageVisible,
  useShell,
  type Cmd,
} from "./sim-terminal";

const READY = /Started ingress forwarding/;
const CAPTURED = /captured test cases/;
// How long Terminal 1 comes forward to show each captured test case.
const PEEK_MS = 1400;

type Phase = "start" | "booting" | "listening" | "stopping" | "done";

/**
 * Two terminals, like a real record session: Keploy records in the first
 * while requests go out from the second. It plays itself on a loop until
 * the reader clicks in or types, then it's theirs to drive.
 */
export function RecordSession({
  id = "record",
  cwd,
  record,
  requests,
}: {
  id?: string;
  cwd: string;
  record: Cmd;
  requests: Cmd[];
}) {
  const a = useShell();
  const b = useShell();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("start");
  const [sent, setSent] = useState(0);
  // A request is out and its capture hasn't shown in Terminal 1 yet.
  const [sending, setSending] = useState(false);
  const [cycles, setCycles] = useState(0);
  const [autoA, setAutoA] = useState(false);
  const [autoB, setAutoB] = useState(false);
  const [driver, setDriver] = useState<"demo" | "you">("demo");
  const [announce, say] = useAnnounce(driver);
  const [anchor, setAnchor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const paneA = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.3 });
  const visible = usePageVisible();
  const stopping = useRef(false);
  // Bumped on reset, so async steps from a previous cycle don't act.
  const gen = useRef(0);
  const [front, setFront] = useState<"a" | "b">("a");
  // Terminal 2 appears once Keploy is listening for requests.
  const showB =
    phase === "listening" ||
    phase === "stopping" ||
    phase === "done" ||
    b.entries.length > 0;

  const startRecord = async (typed: string) => {
    a.push("cmd", typed, cwd);
    setPhase("booting");
    say("Keploy is starting the app in record mode.");
    if ((await a.exec({ ...record, pauseAt: READY.source }, { demo: driver === "demo" })) === "aborted") {
      // Only a failed load gets here; stop the demo so it doesn't retry forever.
      setPhase("start");
      setDriver("you");
      return;
    }
    setPhase("listening");
    setFront("b");
    say("Keploy is recording. Send a request from the second terminal.");
  };

  const sendRequest = async (typed: string) => {
    const g = gen.current;
    const c = requests[sent];
    setSending(true);
    b.push("cmd", typed, cwd);
    if ((await b.exec(c)) === "aborted") {
      if (gen.current === g) setSending(false);
      return;
    }
    // Count it before the capture streams, so the hint moves on and the same
    // request can't go out twice.
    const n = sent + 1;
    setSent(n);
    // Keploy logs the captured test case in the recording pane: bring it
    // forward so the line is visible, then hand Terminal 2 back.
    setFront("a");
    if ((await a.stream(CAPTURED)) === "aborted") return;
    say(
      n < requests.length
        ? "Keploy captured a test case. Send the next request."
        : "Both test cases captured. Stop the recording with Control C in the first terminal.",
    );
    await new Promise((r) => setTimeout(r, PEEK_MS));
    if (gen.current !== g) return;
    if (n < requests.length) setFront("b");
    setSending(false);
  };

  const canStop = phase === "listening" && sent >= requests.length && !sending;

  const stop = async (byReader: boolean) => {
    // Ctrl+C can arrive from the input and the pane at once; act on it once.
    if (!canStop || stopping.current) return;
    stopping.current = true;
    setFront("a");
    a.push("out", "^C");
    setPhase("stopping");
    say("Recording stopped. Keploy is replaying what it captured.");
    if ((await a.stream()) === "aborted") return;
    setPhase("done");
    if (byReader) setDone(id, true);
    setAnchor((n) => n + 1);
    say("Auto-replay finished: both tests passed.");
  };

  const reset = () => {
    gen.current++;
    stopping.current = false;
    a.reset();
    b.reset();
    setPhase("start");
    setFront("a");
    setSent(0);
    setSending(false);
    setAutoA(false);
    setAutoB(false);
  };

  const nextReq = requests[sent];
  const demo = driver === "demo";
  // Finished and not going to loop again (reduced motion, or loop limit hit).
  const stalled = phase === "done" && (reduce || cycles >= MAX_LOOPS);
  const playing = demo && !stalled;

  // The demo loop: start the recorder, send both requests, Ctrl+C, hold on the
  // passing replay, then start over.
  useEffect(() => {
    if (!demo || !inView || !visible || autoA || autoB || stalled) return;
    let wait = 0;
    let act: (() => void) | null = null;
    if (phase === "start") {
      wait = 700;
      act = () => setAutoA(true);
    } else if (phase === "listening" && !b.running && !sending && nextReq) {
      wait = 900;
      act = () => setAutoB(true);
    } else if (canStop) {
      wait = 1300;
      act = () => void stop(false);
    } else if (phase === "done") {
      wait = 7000;
      act = () => {
        setCycles((n) => n + 1);
        if (cycles + 1 < MAX_LOOPS) reset();
      };
    }
    if (!act) return;
    const t = setTimeout(act, wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stop/reset read current state when they fire
  }, [
    demo,
    inView,
    visible,
    autoA,
    autoB,
    stalled,
    phase,
    sent,
    sending,
    b.running,
    canStop,
    cycles,
  ]);

  const takeOver = () => {
    if (driver === "you") return;
    setDriver("you");
    setAutoA(false);
    setAutoB(false);
  };

  const submitA = (raw: string) => {
    const v = raw.trim().replace(/\s+/g, " ").replace(/'/g, '"');
    if (!v) return a.push("cmd", "", cwd);
    if (v === record.cmd.replace(/'/g, '"'))
      return void startRecord(raw.trim());
    a.push("cmd", raw.trim(), cwd);
    a.push("note", `Start the recorder first:\n  ${record.cmd}`);
  };

  const submitB = (raw: string) => {
    // Fold the `\` line continuations from the page's multi-line curl.
    const v = raw.trim().replace(/\\\s+/g, " ").replace(/\s+/g, " ").replace(/'/g, '"');
    if (!v) return b.push("cmd", "", cwd);
    if (phase === "start" || phase === "booting") {
      b.push("cmd", raw.trim(), cwd);
      // Real curl output for a port nothing listens on (recordings/terminal/curl-refused.txt).
      b.push(
        "out",
        "curl: (7) Failed to connect to localhost port 8080 after 0 ms: Connection refused",
      );
      b.push(
        "note",
        "Nothing is listening yet. Start keploy record in the first terminal and wait for “Started ingress forwarding”.",
      );
      return;
    }
    if (nextReq && v === nextReq.cmd.replace(/\s+/g, " ").replace(/'/g, '"'))
      return void sendRequest(raw.trim());
    b.push("cmd", raw.trim(), cwd);
    b.push(
      "note",
      nextReq
        ? `Next request:\n  ${nextReq.cmd}`
        : "Both requests are recorded. Press Ctrl+C in the first terminal to stop.",
    );
  };

  const loopButton = (
    <button
      type="button"
      onClick={() => {
        if (playing) {
          takeOver();
          a.pause();
          b.pause();
          return;
        }
        a.resume();
        b.resume();
        if (phase === "done") {
          reset();
          setCycles(0);
        }
        setDriver("demo");
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-tape-dim transition-colors hover:bg-white/5 hover:text-tape-ink"
      aria-label={playing ? "Pause the demo" : "Play the demo"}
    >
      {playing ? (
        <Pause className="size-3.5" aria-hidden="true" />
      ) : (
        <Play className="size-3.5" aria-hidden="true" />
      )}
      <span>{playing ? "Pause" : "Play"}</span>
    </button>
  );

  return (
    <div
      ref={rootRef}
      className="not-prose relative my-7"
      onPointerDown={(e) => {
        if (!(e.target as Element).closest("button")) takeOver();
      }}
    >
      {/* Two overlapping windows, like a desktop: Terminal 2 pops up over the
          lower right of Terminal 1 once Keploy is listening; click either to
          bring it forward. Below sm they stack instead. */}
      <div className="grid grid-cols-[minmax(0,1fr)]">
        <motion.div
          ref={paneA}
          style={{ zIndex: front === "a" ? 20 : 10 }}
          animate={{ scale: showB && front !== "a" ? 0.985 : 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          onPointerDown={() => setFront("a")}
          onFocusCapture={() => setFront("a")}
          tabIndex={phase === "listening" ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === "c" && e.ctrlKey) {
              e.preventDefault();
              takeOver();
              void stop(true);
            }
          }}
          role="group"
          className="relative col-start-1 row-start-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-orange/70"
          aria-label="Terminal 1: keploy record"
        >
          <Terminal
            sequence={false}
            title={`Terminal 1 — ${cwd}`}
            mode={outcomeMode(
              a.outcome,
              phase === "stopping"
                ? "replay"
                : phase === "booting" || phase === "listening"
                  ? "record"
                  : null,
            )}
            controls={loopButton}
            copyText={record.cmd}
            height="min(19rem, 46dvh)"
            label="Terminal 1 output"
            anchorKey={anchor}
            className={cn(
              "transition-shadow duration-700",
              outcomeRing(a.outcome),
            )}
            scrollKey={a.entries.length + (a.entries.at(-1)?.text.length ?? 0)}
            footer={
              <PromptInput
                busy={phase !== "start" && phase !== "done"}
                cwd={cwd}
                expected={phase === "start" ? record.cmd : undefined}
                onSubmit={
                  phase === "start" ? submitA : (v) => a.push("cmd", v, cwd)
                }
                onInterrupt={() => void stop(true)}
                onFocus={takeOver}
                history={[]}
                label="Terminal 1: type a command"
                autoType={autoA}
                onAutoTyped={() => {
                  setAutoA(false);
                  void startRecord(record.cmd);
                }}
              />
            }
            statusBar={
              <StatusBar
                shell={a}
                idleText={
                  phase === "done" ? "Recording saved and replayed." : undefined
                }
                pausedText={
                  canStop
                    ? "Recording · press Ctrl+C here to stop"
                    : "Recording · waiting for requests from terminal 2"
                }
              />
            }
          >
            {a.entries.map((e) => (
              <EntryLine key={e.id} entry={e} />
            ))}
          </Terminal>
          <BackShade show={showB && front !== "a"} />
        </motion.div>

        <AnimatePresence>
          {showB && (
            <motion.div
              key="t2"
              role="group"
              aria-label="Terminal 2: requests"
              style={{ zIndex: front === "b" ? 20 : 10 }}
              className={cn(
                // Offset so Terminal 2's bottom always sticks out 4.5rem below
                // Terminal 1 (heights match the two Terminal height props).
                "relative col-start-1 row-start-2 mt-2 self-start sm:row-start-1 sm:mt-[calc(min(19rem,46dvh)_-_min(12rem,30dvh)_+_4.5rem)] sm:w-[78%] sm:justify-self-end",
                // Behind Terminal 1: hide the header's right side so no clipped bits show.
                front !== "b" && "sm:[&_[data-controls]]:invisible",
              )}
              initial={reduce ? false : { opacity: 0, y: 18, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: front === "b" ? 1 : 0.985 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              onPointerDown={() => setFront("b")}
              onFocusCapture={() => setFront("b")}
            >
              <Terminal
                sequence={false}
                title={`Terminal 2 — ${cwd}`}
                copyText={requests.map((r) => r.cmd).join("\n")}
                height="min(12rem, 30dvh)"
                className="shadow-[0_28px_60px_-20px_rgba(0,0,0,0.6)]"
                label="Terminal 2 output"
                scrollKey={b.entries.length}
                footer={
                  <PromptInput
                    busy={b.running || sending}
                    cwd={cwd}
                    expected={phase === "listening" ? nextReq?.cmd : undefined}
                    onSubmit={submitB}
                    onFocus={takeOver}
                    history={[]}
                    label="Terminal 2: type a command"
                    autoType={autoB && !!nextReq}
                    onAutoTyped={() => {
                      setAutoB(false);
                      if (nextReq) void sendRequest(nextReq.cmd);
                    }}
                  />
                }
                statusBar={<StatusBar shell={b} />}
              >
                {b.entries.map((e) => (
                  <EntryLine key={e.id} entry={e} />
                ))}
              </Terminal>
              <BackShade show={front !== "b"} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!demo && canStop && (
        <div className="mt-2.5 flex items-center gap-2 text-[13px]">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-record/50 bg-surface px-2.5 py-1 font-medium text-record-text transition-transform active:scale-[0.97]"
            onClick={() => {
              paneA.current?.focus();
              void stop(true);
            }}
          >
            <Square className="size-3 fill-current" aria-hidden="true" />
            Stop recording (Ctrl+C)
          </button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

/** Dims the window that's behind (sm and up, where they overlap). */
function BackShade({ show }: { show: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-xl bg-black/35 opacity-0 transition-opacity duration-300",
        show && "sm:opacity-100",
      )}
    />
  );
}
