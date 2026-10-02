"use client";

import { useRef, useState } from "react";
import { Check, RotateCcw, Sparkles, Square } from "lucide-react";

import { Terminal } from "@/components/ui/terminal";
import { setDone } from "@/lib/progress";
import { cn } from "@/lib/utils";
import {
  EntryLine,
  PromptInput,
  StatusBar,
  useShell,
  type Cmd,
} from "./sim-terminal";

const READY = /Started ingress forwarding/;
const CAPTURED = /captured test cases/;

/**
 * Two terminals, like a real record session: Keploy records in the left
 * pane while you send requests from the right one.
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
  const [phase, setPhase] = useState<
    "start" | "booting" | "listening" | "stopping" | "done"
  >("start");
  const [sent, setSent] = useState(0);
  const [autoA, setAutoA] = useState(false);
  const [autoB, setAutoB] = useState(false);
  const [announce, setAnnounce] = useState("");
  const paneA = useRef<HTMLDivElement>(null);

  const startRecord = async (typed: string) => {
    a.push("cmd", typed, cwd);
    setPhase("booting");
    setAnnounce("Keploy is starting the app in record mode.");
    await a.exec({ ...record, pauseAt: READY.source });
    setPhase("listening");
    setAnnounce("Keploy is recording. Send a request from the second terminal.");
  };

  const sendRequest = async (typed: string) => {
    const c = requests[sent];
    b.push("cmd", typed, cwd);
    await b.exec(c);
    // Keploy logs the captured test case in the recording pane.
    await a.stream(CAPTURED);
    const n = sent + 1;
    setSent(n);
    setAnnounce(
      n < requests.length
        ? "Keploy captured a test case. Send the next request."
        : "Both test cases captured. Stop the recording with Control C in the first terminal.",
    );
  };

  const stop = async () => {
    if (phase !== "listening" || sent < requests.length) return;
    a.push("out", "^C");
    setPhase("stopping");
    setAnnounce("Recording stopped. Keploy is replaying what it captured.");
    await a.stream();
    setPhase("done");
    setDone(id, true);
    setAnnounce("Auto-replay finished: both tests passed.");
  };

  const reset = () => {
    a.reset();
    b.reset();
    setPhase("start");
    setSent(0);
    setAutoA(false);
    setAutoB(false);
  };

  const canStop = phase === "listening" && sent >= requests.length;
  const nextReq = requests[sent];

  const submitA = (raw: string) => {
    const v = raw.trim().replace(/\s+/g, " ").replace(/'/g, '"');
    if (!v) return a.push("cmd", "", cwd);
    if (v === record.cmd.replace(/'/g, '"')) return void startRecord(raw.trim());
    a.push("cmd", raw.trim(), cwd);
    a.push("note", `Start the recorder first:\n  ${record.cmd}`);
  };

  const submitB = (raw: string) => {
    const v = raw.trim().replace(/\s+/g, " ").replace(/'/g, '"');
    if (!v) return b.push("cmd", "", cwd);
    if (phase === "start" || phase === "booting") {
      b.push("cmd", raw.trim(), cwd);
      b.push(
        "out",
        "curl: (7) Failed to connect to localhost port " +
          (requests[0]?.cmd.match(/localhost:(\d+)/)?.[1] ?? "8080") +
          " after 0 ms: Connection refused",
      );
      b.push(
        "note",
        "Nothing is listening yet. Start keploy record in the left terminal and wait for “Started ingress forwarding”.",
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
        : "Both requests are recorded. Press Ctrl+C in the left terminal to stop.",
    );
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 font-medium text-ink transition-colors hover:border-orange/60 disabled:opacity-50";

  return (
    <div className="not-prose my-7">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div
          ref={paneA}
          tabIndex={phase === "listening" ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === "c" && e.ctrlKey) {
              e.preventDefault();
              void stop();
            }
          }}
          className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-orange/70"
          aria-label="Terminal 1: keploy record"
        >
          <Terminal
            sequence={false}
            title={`Terminal 1 — ${cwd}`}
            mode={phase === "stopping" || phase === "done" ? "replay" : phase === "start" ? null : "record"}
            copyText={record.cmd}
            maxHeight="19rem"
            label="Terminal 1 output"
            scrollKey={a.entries.length + (a.entries.at(-1)?.text.length ?? 0)}
            bodyClassName="min-h-44"
            footer={
              phase === "start" ? (
                <PromptInput
                  cwd={cwd}
                  expected={record.cmd}
                  onSubmit={submitA}
                  history={[]}
                  label="Terminal 1: type a command"
                  autoType={autoA}
                  onAutoTyped={() => {
                    setAutoA(false);
                    void startRecord(record.cmd);
                  }}
                />
              ) : phase === "done" ? (
                <PromptInput
                  cwd={cwd}
                  onSubmit={(v) => {
                    a.push("cmd", v, cwd);
                  }}
                  history={[]}
                  label="Terminal 1: type a command"
                />
              ) : (
                <span className="caret inline-block h-[1.05em] w-[0.55em] translate-y-[0.15em] bg-tape-ink" />
              )
            }
            statusBar={
              <StatusBar
                shell={a}
                idleText={
                  phase === "done"
                    ? "Recording saved and replayed."
                    : "Simulated · start the recorder here"
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
        </div>

        <Terminal
          sequence={false}
          title={`Terminal 2 — ${cwd}`}
          copyText={requests.map((r) => r.cmd).join("\n")}
          maxHeight="12rem"
          label="Terminal 2 output"
          scrollKey={b.entries.length}
          bodyClassName="min-h-28"
          className={cn(phase === "start" && "opacity-80")}
          footer={
            !b.running ? (
              <PromptInput
                cwd={cwd}
                expected={phase === "listening" ? nextReq?.cmd : undefined}
                onSubmit={submitB}
                history={[]}
                label="Terminal 2: type a command"
                autoType={autoB && !!nextReq}
                onAutoTyped={() => {
                  setAutoB(false);
                  if (nextReq) void sendRequest(nextReq.cmd);
                }}
              />
            ) : (
              <span className="caret inline-block h-[1.05em] w-[0.55em] translate-y-[0.15em] bg-tape-ink" />
            )
          }
          statusBar={
            <StatusBar
              shell={b}
              idleText={
                phase === "listening" && nextReq
                  ? `Request ${sent + 1} of ${requests.length}`
                  : phase === "start" || phase === "booting"
                    ? "Waiting for the recorder"
                    : "Requests sent"
              }
            />
          }
        >
          {b.entries.map((e) => (
            <EntryLine key={e.id} entry={e} />
          ))}
        </Terminal>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px]">
        {phase === "start" && (
          <button type="button" className={btn} onClick={() => setAutoA(true)} disabled={autoA}>
            <Sparkles className="size-3.5 text-orange-text" aria-hidden="true" />
            Start recording for me
          </button>
        )}
        {phase === "listening" && nextReq && (
          <button
            type="button"
            className={btn}
            disabled={b.running || a.running && !a.paused || autoB}
            onClick={() => setAutoB(true)}
          >
            <Sparkles className="size-3.5 text-orange-text" aria-hidden="true" />
            Send request {sent + 1} for me
          </button>
        )}
        {phase === "listening" && (
          <button
            type="button"
            className={cn(btn, canStop && "border-record/50 text-record-text")}
            disabled={!canStop}
            onClick={() => {
              paneA.current?.focus();
              void stop();
            }}
          >
            <Square className="size-3 fill-current" aria-hidden="true" />
            Stop recording (Ctrl+C)
          </button>
        )}
        {phase === "done" && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-replay/10 px-2.5 py-1 font-medium text-replay-text">
            <Check className="size-3.5" aria-hidden="true" />
            Recorded 2 tests, auto-replay passed
          </span>
        )}
        {phase !== "start" && (
          <button
            type="button"
            onClick={reset}
            disabled={phase === "booting" || phase === "stopping"}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-graphite hover:text-ink disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
