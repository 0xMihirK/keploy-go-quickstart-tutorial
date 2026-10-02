"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import { useStack, type StackId } from "./stack";

type Mode = "record" | "replay";

interface Hop {
  from: number;
  to: number;
  /** tape row to write (record) or read (replay) when the hop ends */
  tape?: number;
  caption: string;
  check?: boolean;
}

// Positions on the wire (viewBox 0 0 560 262).
const X = { client: 104, proxyIn: 152, app: 200, app2: 336, proxyOut: 386, db: 452 };
const Y = 92;

const HOPS: Record<Mode, Hop[]> = {
  record: [
    { from: X.client, to: X.app, tape: 0, caption: "You send a request. Keploy copies it as the start of a test case." },
    { from: X.app2, to: X.db, caption: "The app queries the database through Keploy's proxy." },
    { from: X.db, to: X.app2, tape: 1, caption: "The database answers. Keploy saves the query and its answer as a mock." },
    { from: X.app, to: X.client, tape: 0, caption: "The app responds. Keploy stores the response as the expected result." },
  ],
  replay: [
    { from: X.client, to: X.app, tape: 0, caption: "keploy test sends the recorded request to your app." },
    { from: X.app2, to: X.proxyOut, caption: "The app queries the database. Nothing is running there." },
    { from: X.proxyOut, to: X.app2, tape: 1, caption: "Keploy answers from the recorded mock instead." },
    { from: X.app, to: X.client, check: true, caption: "Keploy compares the response with the recording. It matches: pass." },
  ],
};

const TAPE: Record<StackId, [string, string][]> = {
  gin: [
    ["tests/post-url-1.yaml", "POST /url → 200"],
    ["mocks.yaml", "mongo update url-shortener → n: 1"],
  ],
  echo: [
    ["tests/post-url-1.yaml", "POST /url → 200"],
    ["mocks.yaml", "postgres INSERT INTO url_map → INSERT 0 1"],
  ],
};

const HOP_MS = 900;
const PAUSE_MS = 650;

export function RecordReplaySim({ className }: { className?: string }) {
  const stack = useStack();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>("record");
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const hops = HOPS[mode];
  const active = playing && inView && !reduce;

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(
      () => {
        if (step + 1 >= hops.length) {
          setStep(-1);
          setMode((m) => (m === "record" ? "replay" : "record"));
        } else {
          setStep(step + 1);
        }
      },
      step === -1 ? PAUSE_MS : HOP_MS + PAUSE_MS,
    );
    return () => clearTimeout(t);
  }, [active, step, hops.length]);

  const shown = reduce ? hops.length - 1 : step;
  const hop = shown >= 0 ? hops[shown] : null;
  const isRec = mode === "record";
  const color = isRec ? "var(--record)" : "var(--replay)";
  const db = stack === "gin" ? "MongoDB" : "PostgreSQL";
  const app = stack === "gin" ? "Gin app" : "Echo app";
  const written = isRec ? ([1, 1, 2, 2][shown] ?? 0) : 2;
  const tapeRead = !isRec && hop?.tape !== undefined ? hop.tape : null;

  const pick = (m: Mode) => {
    setMode(m);
    setStep(-1);
  };

  return (
    <div
      ref={ref}
      className={cn(
        "not-prose overflow-hidden rounded-2xl border border-rule bg-surface",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-2.5">
        <div role="group" aria-label="Keploy mode" className="inline-flex rounded-lg bg-muted p-0.5 text-[13px]">
          {(["record", "replay"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => pick(m)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
                mode === m ? "bg-surface text-ink ring-1 ring-border" : "text-graphite hover:text-ink",
              )}
            >
              <span
                aria-hidden="true"
                className={cn("size-1.5 rounded-full", m === "record" ? "bg-record" : "bg-replay")}
              />
              {m === "record" ? "keploy record" : "keploy test"}
            </button>
          ))}
        </div>
        {!reduce && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-graphite hover:text-ink"
            aria-label={playing ? "Pause animation" : "Play animation"}
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {playing ? "Pause" : "Play"}
          </button>
        )}
      </div>

      <svg
        viewBox="0 0 560 262"
        role="img"
        aria-label={
          isRec
            ? `Record mode: requests flow from curl to the ${app} and on to ${db}. Keploy sits on both connections and writes test cases and mocks.`
            : `Replay mode: ${db} is stopped. Keploy sends recorded requests to the ${app} and answers its database calls from recorded mocks.`
        }
        className="block w-full"
      >
        <defs>
          <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--rule)" />
          </pattern>
        </defs>
        <rect width="560" height="262" fill="url(#dots)" opacity="0.8" />

        {/* wires */}
        <line x1={X.client} y1={Y} x2={X.app} y2={Y} stroke="var(--graphite)" strokeOpacity="0.5" strokeWidth="1.75" />
        <line x1={X.app2} y1={Y} x2={isRec ? X.db : X.proxyOut + 12} y2={Y} stroke="var(--graphite)" strokeOpacity="0.5" strokeWidth="1.75" />
        {!isRec && (
          <line x1={X.proxyOut + 22} y1={Y} x2={X.db - 4} y2={Y} stroke="var(--graphite)" strokeOpacity="0.35" strokeWidth="1.75" strokeDasharray="3 5" />
        )}

        {/* client */}
        <rect x="8" y={Y - 28} width={X.client - 8} height="56" rx="10" fill="var(--paper)" stroke="var(--rule)" strokeWidth="1.25" />
        <text x={(8 + X.client) / 2} y={Y - 2} textAnchor="middle" className="fill-ink font-mono text-[13.5px] font-medium">
          {isRec ? "curl" : "keploy test"}
        </text>
        <text x={(8 + X.client) / 2} y={Y + 16} textAnchor="middle" className="fill-graphite text-[12px]">
          {isRec ? "you" : "replayer"}
        </text>

        {/* app */}
        <rect x={X.app} y={Y - 34} width={X.app2 - X.app} height="68" rx="11" fill="var(--paper)" stroke="var(--ink)" strokeOpacity="0.6" strokeWidth="1.25" />
        <text x={(X.app + X.app2) / 2} y={Y - 4} textAnchor="middle" className="fill-ink text-[15px] font-semibold">
          {app}
        </text>
        <text x={(X.app + X.app2) / 2} y={Y + 16} textAnchor="middle" className="fill-graphite text-[12px]">
          port {stack === "gin" ? "8080" : "8082"}
        </text>

        {/* database */}
        <g opacity={isRec ? 1 : 0.4}>
          <path d={`M${X.db} ${Y - 22} a46 10 0 0 1 92 0 v46 a46 10 0 0 1 -92 0 z`} fill="var(--paper)" stroke="var(--rule)" strokeWidth="1.25" />
          <ellipse cx={X.db + 46} cy={Y - 22} rx="46" ry="10" fill="var(--paper)" stroke="var(--rule)" strokeWidth="1.25" />
          <text x={X.db + 46} y={Y + 12} textAnchor="middle" className="fill-ink text-[13.5px] font-semibold">
            {db}
          </text>
        </g>
        {!isRec && (
          <text x={X.db + 46} y={Y + 50} textAnchor="middle" className="fill-record-text text-[12.5px] font-semibold">
            stopped
          </text>
        )}

        {/* keploy taps */}
        {[X.proxyIn, X.proxyOut].map((x) => (
          <g key={x}>
            <circle cx={x} cy={Y} r="14" fill="var(--surface)" stroke="var(--orange)" strokeWidth="1.75" />
            <circle cx={x} cy={Y} r="4.5" fill="var(--orange)" />
          </g>
        ))}
        <text x={X.proxyIn} y={Y - 26} textAnchor="middle" className="fill-orange-text text-[12.5px] font-semibold">
          Keploy
        </text>
        <text x={X.proxyOut} y={Y - 26} textAnchor="middle" className="fill-orange-text text-[12.5px] font-semibold">
          Keploy
        </text>
        {[X.proxyIn, X.proxyOut].map((x) => (
          <line key={x} x1={x} y1={Y + 14} x2={x} y2="160" stroke="var(--orange)" strokeOpacity="0.45" strokeDasharray="2 4" strokeWidth="1.25" />
        ))}

        {/* tape */}
        <rect x="8" y="160" width="544" height="94" rx="11" fill="var(--tape)" />
        <text x="24" y="182" className="fill-tape-dim font-mono text-[12px]">
          keploy/test-set-0/
        </text>
        {TAPE[stack].map(([file, what], i) => {
          const visible = i < written || !isRec;
          const reading = tapeRead === i;
          return (
            <g key={file + i} opacity={visible ? 1 : 0.18} style={{ transition: "opacity 240ms" }}>
              <rect x="16" y={192 + i * 26} width="528" height="22" rx="5" fill="var(--replay)" fillOpacity={reading ? 0.22 : 0} />
              <text x="26" y={207 + i * 26} className="fill-tape-ink font-mono text-[12.5px]">
                {file}
              </text>
              <text x="210" y={207 + i * 26} className="fill-tape-dim font-mono text-[12.5px]">
                {what}
              </text>
            </g>
          );
        })}

        {/* packet */}
        {hop && !reduce && (
          <motion.circle
            key={`${mode}-${shown}`}
            cy={Y}
            r="7"
            fill={color}
            initial={{ cx: hop.from }}
            animate={{ cx: hop.to }}
            transition={{ duration: HOP_MS / 1000, ease: [0.45, 0, 0.2, 1] }}
          />
        )}
        {hop?.check && (
          <motion.g
            key={`check-${mode}`}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: reduce ? 0 : HOP_MS / 1000, duration: 0.25 }}
            style={{ transformOrigin: `${(8 + X.client) / 2}px 26px` }}
          >
            <circle cx={(8 + X.client) / 2} cy="26" r="12" fill="var(--replay)" />
            <path d={`M${(8 + X.client) / 2 - 6} 26.5l4 3.8 7.6-8`} fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </motion.g>
        )}
      </svg>

      <p className="min-h-[3.25rem] border-t border-rule px-4 py-3 text-[14.5px] leading-snug text-ink/85">
        <span className={cn("mr-1.5 font-semibold", isRec ? "text-record-text" : "text-replay-text")}>
          {isRec ? "Record." : "Replay."}
        </span>
        {hop?.caption ??
          (isRec
            ? "Keploy wraps your app and watches every request and every database call."
            : "Same app, database switched off. Keploy plays both sides of the conversation.")}
      </p>
    </div>
  );
}
