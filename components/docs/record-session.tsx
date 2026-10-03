"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { Terminal } from "@/components/ui/terminal";
import { useReducedMotion } from "@/lib/reduced-motion";
import { cn } from "@/lib/utils";
import {
  EntryLine,
  LoopButton,
  PromptLine,
  StatusBar,
  outcomeMode,
  outcomeRing,
  useLive,
  useShell,
  type Cmd,
} from "./sim-terminal";

const READY = /Started ingress forwarding/;
const CAPTURED = /captured test cases/;
// How long Terminal 1 comes forward to show each captured test case.
const PEEK_MS = 1800;

// Raising a window: the stacking order flips at once, as on a desktop, while
// the raised window's shade fades out and it settles from 0.985 to full scale.
// The window going back eases down and dims. Eased, not sprung, so nothing
// overshoots, and never translucent, so nothing shows through.
const RAISE = { duration: 0.36, ease: [0.22, 1, 0.36, 1] } as const;
const raised = (isFront: boolean) => ({ scale: isFront ? 1 : 0.985, opacity: 1, y: 0 });
// Time to read Terminal 2's response before Terminal 1 comes forward.
const RESPONSE_MS = 700;

// closing: after Ctrl+C, while Keploy shuts the recorder down; stopping: its auto-replay.
type Phase = "start" | "booting" | "listening" | "closing" | "stopping" | "done";

/**
 * Two terminals, like a real record session: Keploy records in the first
 * while requests go out from the second. It plays itself on a loop: start the
 * recorder, send both requests, Ctrl+C, hold on the passing replay, start over.
 */
export function RecordSession({
  cwd,
  record,
  requests,
}: {
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
  const [typingA, setTypingA] = useState(false);
  const [typingB, setTypingB] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [broken, setBroken] = useState(false);
  const [anchor, setAnchor] = useState(0);
  const [front, setFront] = useState<"a" | "b">("a");
  const rootRef = useRef<HTMLDivElement>(null);
  // Terminal 1 sits centred in the stage until Terminal 2 pops up below it.
  const stageRef = useRef<HTMLDivElement>(null);
  const paneARef = useRef<HTMLDivElement>(null);
  const [alone, setAlone] = useState(0);
  useEffect(() => {
    const stage = stageRef.current;
    const pane = paneARef.current;
    if (!stage || !pane) return;
    const measure = () => setAlone(Math.max(0, (stage.offsetHeight - pane.offsetHeight) / 2));
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    ro.observe(pane);
    measure();
    return () => ro.disconnect();
  }, []);
  // Bumped on reset, so async steps from a previous loop don't act.
  const gen = useRef(0);
  const live = useLive(rootRef, playing, a, b);
  // Terminal 2 appears once Keploy is listening for requests.
  const showB = phase !== "start" && phase !== "booting";
  const nextReq = requests[sent];
  const canStop = phase === "listening" && sent >= requests.length && !sending;
  // Reduced motion: play through once with no animation and stay on the result.
  const finished = phase === "done" && reduce;

  const startRecord = async () => {
    const g = gen.current;
    a.push("cmd", record.cmd, cwd);
    setPhase("booting");
    const r = await a.exec({ ...record, pauseAt: READY.source }, { demo: true });
    if (gen.current !== g) return;
    if (r === "aborted") return setBroken(true);
    setPhase("listening");
    setFront("b");
  };

  const sendRequest = async () => {
    const g = gen.current;
    const c = requests[sent];
    setSending(true);
    b.push("cmd", c.cmd, cwd);
    const r = await b.exec(c);
    if (gen.current !== g) return;
    if (r === "aborted") return setBroken(true);
    const n = sent + 1;
    setSent(n);
    await a.sleep(reduce ? 0 : RESPONSE_MS);
    if (gen.current !== g) return;
    // Keploy logs the captured test case in the recording pane: bring it
    // forward so the line is visible, then hand Terminal 2 back.
    setFront("a");
    if ((await a.stream(CAPTURED)) === "aborted" || gen.current !== g) return;
    await a.sleep(reduce ? 0 : PEEK_MS);
    if (gen.current !== g) return;
    if (n < requests.length) setFront("b");
    setSending(false);
  };

  const stop = async () => {
    const g = gen.current;
    setFront("a");
    a.push("out", "^C");
    setPhase("closing");
    if ((await a.stream(/auto-replay: recording stopped/)) === "aborted" || gen.current !== g) return;
    setPhase("stopping");
    if ((await a.stream()) === "aborted" || gen.current !== g) return;
    setPhase("done");
    setAnchor((n) => n + 1);
  };

  const reset = () => {
    gen.current++;
    const g = gen.current;
    a.reset();
    setPhase("start");
    setTimeout(() => {
      if (gen.current === g) b.reset();
    }, 400);
    setFront("a");
    setSent(0);
    setSending(false);
    setTypingA(false);
    setTypingB(false);
  };

  // The loop. Each branch waits a beat, then takes the next step.
  useEffect(() => {
    if (!live || typingA || typingB || broken || finished) return;
    let ms = 0;
    let act: (() => void) | null = null;
    if (phase === "start") {
      ms = 700;
      act = () => (reduce ? void startRecord() : setTypingA(true));
    } else if (phase === "listening" && !b.running && !sending && nextReq) {
      ms = sent > 0 ? 1500 : 900;
      act = () => (reduce ? void sendRequest() : setTypingB(true));
    } else if (canStop) {
      ms = 1300;
      act = () => void stop();
    } else if (phase === "done") {
      ms = 7000;
      act = reset;
    }
    if (!act) return;
    const t = setTimeout(act, reduce ? 0 : ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the actions read current state when they fire
  }, [live, typingA, typingB, broken, finished, phase, sent, sending, b.running, canStop, reduce]);

  // Leaving the screen mid-way through typing: retype it on return.
  useEffect(() => {
    if (live) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cancel a half-typed command
    setTypingA(false);
    setTypingB(false);
  }, [live]);

  return (
    <div ref={rootRef} className="not-prose relative my-7">
      {/* Two overlapping windows, like a desktop: Terminal 2 pops up over the
          lower right of Terminal 1 once Keploy is listening; click either to
          bring it forward. Terminal 2 is always mounted (just hidden before it
          pops up) so the stage never changes height mid-loop. */}
      <div ref={stageRef} className="grid grid-cols-[minmax(0,1fr)]">
        <motion.div
          ref={paneARef}
          style={{ zIndex: front === "a" ? 20 : 10 }}
          animate={{ ...raised(!showB || front === "a"), y: showB ? 0 : alone }}
          transition={reduce ? { duration: 0 } : { ...RAISE, y: { duration: 0.6, ease: RAISE.ease } }}
          onPointerDown={() => setFront("a")}
          onFocusCapture={() => setFront("a")}
          role="group"
          className="relative col-start-1 row-start-1 self-start rounded-xl"
          aria-label="Terminal 1: keploy record"
        >
          <Terminal
            glow
            sequence={false}
            title={`Terminal 1 — ${cwd}`}
            active={!showB || front === "a"}
            mode={outcomeMode(
              a.outcome,
              phase === "stopping"
                ? "replay"
                : phase === "booting" || phase === "listening" || phase === "closing"
                  ? "record"
                  : null,
            )}
            controls={
              <LoopButton
                playing={playing && !finished}
                onToggle={() => (finished ? reset() : setPlaying((p) => !p))}
              />
            }
            copyText={record.cmd}
            height="min(26rem, 46dvh)"
            label="Terminal 1 output"
            anchorKey={anchor}
            className={cn("transition-shadow duration-700", outcomeRing(a.outcome))}
            scrollKey={a.entries.length + (a.entries.at(-1)?.text.length ?? 0)}
            footer={
              <PromptLine
                cwd={cwd}
                busy={phase !== "start" && phase !== "done"}
                command={typingA ? record.cmd : undefined}
                onTyped={() => {
                  setTypingA(false);
                  void startRecord();
                }}
              />
            }
            statusBar={
              <StatusBar
                shell={a}
                userPaused={!playing}
                runningText={
                  phase === "listening"
                    ? `Recording · capturing request ${sent}…`
                    : phase === "closing"
                      ? "Stopping the recorder…"
                      : undefined
                }
                idleText={phase === "done" ? "Recording saved and replayed." : undefined}
                pausedText={
                  sent > 0
                    ? `Recording · ${sent} of ${requests.length} test cases captured`
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

            <motion.div
              role="group"
              aria-label="Terminal 2: requests"
              aria-hidden={!showB}
              inert={!showB}
              style={{ zIndex: front === "b" ? 20 : 10 }}
              className={cn(
                // Offset so Terminal 2's bottom always sticks out 4.5rem below
                // Terminal 1 (heights match the two Terminal height props).
                "relative col-start-1 row-start-1 mt-[calc(min(26rem,46dvh)_-_min(10rem,24dvh)_+_4.5rem)] w-[88%] self-start justify-self-end sm:w-[78%]",
                // Behind Terminal 1: hide the header's right side so no clipped bits show.
                front !== "b" && "[&_[data-controls]]:opacity-0 [&_[data-controls]]:focus-within:opacity-100",
                !showB && "pointer-events-none",
              )}
              initial={false}
              animate={showB ? raised(front === "b") : { opacity: 0, y: 18, scale: 0.95 }}
              transition={reduce ? { duration: 0 } : RAISE}
              onPointerDown={() => setFront("b")}
              onFocusCapture={() => setFront("b")}
            >
              <Terminal
                sequence={false}
                title={`Terminal 2 — ${cwd}`}
                active={front === "b"}
                copyText={requests.map((r) => r.cmd).join("\n")}
                height="min(10rem, 24dvh)"
                className="shadow-[0_28px_60px_-20px_rgba(0,0,0,0.6)]"
                label="Terminal 2 output"
                scrollKey={b.entries.length}
                footer={
                  <PromptLine
                    cwd={cwd}
                    busy={b.running || sending}
                    command={typingB ? nextReq?.cmd : undefined}
                    onTyped={() => {
                      setTypingB(false);
                      if (nextReq) void sendRequest();
                    }}
                  />
                }
                statusBar={
                  <StatusBar
                    shell={b}
                    userPaused={!playing}
                    idleText={
                      phase === "closing" || phase === "stopping" || phase === "done"
                        ? `${requests.length} requests sent and recorded.`
                        : sent >= requests.length
                          ? "All requests sent. Stopping the recording in terminal 1."
                          : `Request ${sent + 1} of ${requests.length} · Keploy is listening on :8080`
                    }
                  />
                }
              >
                {b.entries.map((e) => (
                  <EntryLine key={e.id} entry={e} />
                ))}
              </Terminal>
              <BackShade show={front !== "b"} />
            </motion.div>
      </div>
    </div>
  );
}

/** Dims the window that's behind. */
function BackShade({ show }: { show: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-xl bg-black/35 opacity-0 transition-opacity duration-300 ease-out",
        show && "opacity-100",
      )}
    />
  );
}
