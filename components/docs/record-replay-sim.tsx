"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/reduced-motion";

type Mode = "record" | "replay";

// Positions on the wire (viewBox 0 0 560 300).
const X = { client: 104, proxyIn: 152, app: 200, app2: 336, proxyOut: 388, db: 452 };
const Y = 96;
const TAPE_Y = 176;
const ROW_Y = (i: number) => TAPE_Y + 44 + i * 30;

interface Hop {
  from: number;
  to: number;
  /** What travels on this hop, shown on the moving chip. */
  label: string;
  caption: string;
  /** x of a Keploy tap the packet passes through: it ripples. */
  tap?: number;
  /** After the hop, a copy drops from the tap onto this tape row. */
  drop?: number;
  /** Before the hop, the recorded mock rises from this tape row. */
  rise?: number;
  check?: boolean;
}

const HOPS: Record<Mode, Hop[]> = {
  record: [
    { from: X.client, to: X.app, tap: X.proxyIn, drop: 0, label: "POST /url", caption: "Your request passes Keploy, which copies it as the start of a test case." },
    { from: X.app2, to: X.db - 30, tap: X.proxyOut, label: "update", caption: "The app queries the database. The query goes through Keploy's proxy." },
    { from: X.db - 30, to: X.app2, tap: X.proxyOut, drop: 1, label: "n: 1", caption: "The database answers. Keploy saves the query and the answer as a mock." },
    { from: X.app, to: X.client, tap: X.proxyIn, drop: 0, label: "200", caption: "The app responds. Keploy stores the response as the expected result." },
  ],
  replay: [
    { from: X.client, to: X.app, tap: X.proxyIn, label: "POST /url", caption: "keploy test reads the test case and sends the same request to your app." },
    { from: X.app2, to: X.proxyOut, label: "update", caption: "The app queries the database, but nothing is running there." },
    { from: X.proxyOut, to: X.app2, rise: 1, label: "n: 1", caption: "Keploy's proxy answers with the recorded mock instead." },
    { from: X.app, to: X.client, tap: X.proxyIn, check: true, label: "200", caption: "The response matches the recording, so the test passes." },
  ],
};

const TAPE: [string, string][] = [
  ["tests/post-url-1.yaml", "POST /url → 200"],
  ["mocks.yaml", "mongo update url-shortener → n: 1"],
];

const HOP_S = 1.05;
const EASE = [0.45, 0, 0.2, 1] as const;

function hopDuration(h: Hop) {
  return (h.rise !== undefined ? 0.55 : 0) + HOP_S + (h.drop !== undefined ? 0.55 : 0);
}

export function RecordReplaySim({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>("record");
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  // Let hydration and first paint finish before the loop starts (mobile TBT/LCP).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) {
      w.requestIdleCallback(() => setReady(true), { timeout: 2500 });
      return;
    }
    const t = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(t);
  }, []);
  const hops = HOPS[mode];
  const active = playing && inView && !reduce && ready;

  useEffect(() => {
    if (!active) return;
    const wait = step === -1 ? 900 : hopDuration(hops[step]) * 1000 + 700;
    const t = setTimeout(() => {
      if (step + 1 >= hops.length) {
        setStep(-1);
        setMode((m) => (m === "record" ? "replay" : "record"));
      } else {
        setStep(step + 1);
      }
    }, wait);
    return () => clearTimeout(t);
  }, [active, step, hops]);

  const shown = reduce ? hops.length - 1 : step;
  const hop = shown >= 0 ? hops[shown] : null;
  const isRec = mode === "record";
  const color = isRec ? "var(--record)" : "var(--replay)";
  const db = "MongoDB";
  const app = "URL shortener";
  // Tape rows written so far in record mode (row 0 starts on hop 0, row 1 on hop 2).
  const written = isRec ? ([1, 1, 2, 2][shown] ?? 0) : 2;
  const reading = !isRec && hop?.rise !== undefined ? hop.rise : !isRec && shown === 0 ? 0 : null;
  const riseDelay = hop?.rise !== undefined ? 0.55 : 0;
  const tapDelay =
    hop?.tap !== undefined ? riseDelay + (HOP_S * Math.abs(hop.tap - hop.from)) / Math.abs(hop.to - hop.from) : 0;

  const pick = (m: Mode) => {
    setMode(m);
    setStep(-1);
  };

  return (
    <div
      ref={ref}
      className={cn(
        "@container not-prose relative overflow-hidden rounded-xl border border-rule bg-surface shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_24px_48px_-32px_rgba(16,20,28,0.35)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_20px_40px_-24px_rgba(8,10,14,0.55)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-rule px-3.5 py-2">
        <div role="group" aria-label="Keploy mode" className="relative inline-flex rounded-lg bg-muted p-0.5 text-[13px]">
          {(["record", "replay"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => pick(m)}
              className={cn(
                "relative inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
                mode === m ? "text-ink" : "text-graphite hover:text-ink",
              )}
            >
              {mode === m && (
                <motion.span
                  layoutId="sim-mode"
                  className="absolute inset-0 rounded-md bg-surface ring-1 ring-border"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "relative size-1.5 rounded-full",
                  m === "record" ? "bg-record" : "bg-replay",
                  mode === m && m === "record" && active && "rec-pulse",
                )}
              />
              <span className="relative font-mono text-[12.5px]">
                {m === "record" ? "keploy record" : "keploy test"}
              </span>
            </button>
          ))}
        </div>
        {!reduce && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-graphite hover:bg-muted hover:text-ink"
            aria-label={playing ? "Pause animation" : "Play animation"}
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {playing ? "Pause" : "Play"}
          </button>
        )}
      </div>

      <svg
        viewBox="0 0 560 300"
        role="img"
        aria-label={
          isRec
            ? `Record mode: requests flow from curl to the ${app} and on to ${db}. Keploy sits on both connections and writes test cases and mocks.`
            : `Replay mode: ${db} is stopped. Keploy sends recorded requests to the ${app} and answers its database calls from recorded mocks.`
        }
        className="block w-full"
      >
        <defs>
          <pattern id="sim-dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--rule)" />
          </pattern>
          <linearGradient id="sim-fade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--surface)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--surface)" stopOpacity="1" />
          </linearGradient>
        </defs>
        <rect width="560" height="300" fill="url(#sim-dots)" opacity="0.85" />

        {/* wires, with traffic flowing while the sim plays */}
        <g className="sim-flow" data-paused={active ? undefined : ""}>
          <line x1={X.client} y1={Y} x2={X.app} y2={Y} stroke="var(--graphite)" strokeOpacity="0.45" strokeWidth="1.75" strokeDasharray="5 6" />
          <motion.line
            x1={X.app2}
            y1={Y}
            y2={Y}
            animate={{ x2: isRec ? X.db : X.proxyOut + 16 }}
            transition={{ duration: reduce ? 0 : 0.5, ease: EASE }}
            stroke="var(--graphite)"
            strokeOpacity="0.45"
            strokeWidth="1.75"
            strokeDasharray="5 6"
          />
        </g>
        {/* the unplugged end of the database cable */}
        <motion.g
          initial={false}
          animate={{ opacity: isRec ? 0 : 1, x: isRec ? -16 : 0 }}
          transition={{ duration: reduce ? 0 : 0.5, ease: EASE }}
        >
          <line x1={X.proxyOut + 34} y1={Y} x2={X.db} y2={Y} stroke="var(--graphite)" strokeOpacity="0.3" strokeWidth="1.75" />
          <rect x={X.proxyOut + 28} y={Y - 5} width="7" height="10" rx="1.5" fill="var(--graphite)" opacity="0.5" />
        </motion.g>

        {/* client */}
        <rect x="8" y={Y - 30} width={X.client - 8} height="60" rx="11" fill="var(--paper)" stroke="var(--rule)" strokeWidth="1.25" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.g key={mode} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
            <text x={(8 + X.client) / 2} y={Y - 2} textAnchor="middle" className="fill-ink font-mono text-[13px] font-medium @max-md:text-[17px]">
              {isRec ? "curl" : "keploy"}
            </text>
            <text x={(8 + X.client) / 2} y={Y + 16} textAnchor="middle" className="fill-graphite text-[12px] @max-md:hidden">
              {isRec ? "you" : "test"}
            </text>
          </motion.g>
        </AnimatePresence>

        {/* app */}
        <rect x={X.app} y={Y - 36} width={X.app2 - X.app} height="72" rx="12" fill="var(--paper)" stroke="var(--ink)" strokeOpacity="0.55" strokeWidth="1.25" />
        <text x={(X.app + X.app2) / 2} y={Y - 4} textAnchor="middle" className="fill-ink text-[15px] font-semibold @max-md:text-[18px]">
          {app}
        </text>
        <text x={(X.app + X.app2) / 2} y={Y + 16} textAnchor="middle" className="fill-graphite text-[12px] @max-md:hidden">
          Go app, port 8080
        </text>

        {/* database */}
        <motion.g initial={false} animate={{ opacity: isRec ? 1 : 0.35 }} transition={{ duration: reduce ? 0 : 0.45 }}>
          <path d={`M${X.db} ${Y - 24} a46 10 0 0 1 92 0 v48 a46 10 0 0 1 -92 0 z`} fill="var(--paper)" stroke="var(--rule)" strokeWidth="1.25" />
          <ellipse cx={X.db + 46} cy={Y - 24} rx="46" ry="10" fill="var(--paper)" stroke="var(--rule)" strokeWidth="1.25" />
          <text x={X.db + 46} y={Y + 12} textAnchor="middle" className="fill-ink text-[13.5px] font-semibold @max-md:text-[16px]">
            {db}
          </text>
        </motion.g>
        <AnimatePresence>
          {!isRec && (
            <motion.g
              key="stopped"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : 0.25 }}
            >
              <rect x={X.db + 14} y={Y + 38} width="64" height="20" rx="10" fill="var(--record)" fillOpacity="0.12" stroke="var(--record)" strokeOpacity="0.4" />
              <text x={X.db + 46} y={Y + 52} textAnchor="middle" className="fill-record-text text-[11.5px] font-semibold">
                stopped
              </text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* keploy taps */}
        {[X.proxyIn, X.proxyOut].map((x) => (
          <g key={x}>
            <line x1={x} y1={Y + 15} x2={x} y2={TAPE_Y} stroke={color} strokeOpacity="0.4" strokeDasharray="2 4" strokeWidth="1.25" style={{ transition: "stroke 300ms" }} />
            <circle cx={x} cy={Y} r="15" fill="var(--surface)" stroke={color} strokeWidth="1.75" style={{ transition: "stroke 300ms" }} />
            <circle cx={x} cy={Y} r="4.5" fill={color} style={{ transition: "fill 300ms" }} />
            <text x={x} y={Y - 26} textAnchor="middle" className="fill-orange-text text-[12.5px] font-semibold @max-md:text-[15px]">
              Keploy
            </text>
          </g>
        ))}

        {/* tape */}
        <rect x="8" y={TAPE_Y} width="544" height="104" rx="12" fill="var(--tape)" stroke="var(--tape-rule)" />
        <text x="24" y={TAPE_Y + 24} className="fill-tape-dim font-mono text-[12px] @max-md:text-[15px]">
          keploy/test-set-0/
        </text>
        {TAPE.map(([file, what], i) => {
          const visible = i < written;
          const isReading = reading === i;
          return (
            <g key={file + i}>
              <motion.rect
                x="16"
                y={ROW_Y(i) - 16}
                width="528"
                height="24"
                rx="6"
                fill="var(--replay)"
                initial={false}
                animate={{ opacity: isReading ? 0.22 : 0 }}
                transition={{ duration: 0.25 }}
              />
              <text x="26" y={ROW_Y(i)} className="fill-tape-ink font-mono text-[12.5px] @max-md:text-[16px]" opacity={visible ? 1 : 0.16}>
                {file}
              </text>
              {/* the description types in when Keploy writes the row */}
              <clipPath id={`sim-clip-${i}`}>
                <motion.rect
                  x="206"
                  y={ROW_Y(i) - 16}
                  width="340"
                  height="24"
                  style={{ transformBox: "fill-box", transformOrigin: "left" }}
                  initial={false}
                  animate={{ scaleX: visible ? 1 : 0 }}
                  transition={{ duration: reduce || !visible ? 0 : 0.55, ease: "linear", delay: reduce ? 0 : 0.2 }}
                />
              </clipPath>
              <text x="210" y={ROW_Y(i)} clipPath={`url(#sim-clip-${i})`} className="fill-tape-dim font-mono text-[12.5px] @max-md:hidden">
                {what}
              </text>
            </g>
          );
        })}

        {/* motion: ripple at the tap, the labelled chip, and its copy onto the tape */}
        {hop && !reduce && (
          <g key={`${mode}-${shown}`}>
            {hop.tap !== undefined && (
              <motion.circle
                cx={hop.tap}
                cy={Y}
                r="15"
                fill="none"
                stroke={color}
                strokeWidth="2"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                initial={{ scale: 1, opacity: 0 }}
                animate={{ scale: [1, 2.1], opacity: [0.8, 0] }}
                transition={{ duration: 0.7, delay: tapDelay, ease: "easeOut" }}
              />
            )}
            {hop.drop !== undefined && hop.tap !== undefined && (
              <motion.g
                initial={{ x: hop.tap, y: Y, scale: 0.9, opacity: 0 }}
                animate={{ y: ROW_Y(hop.drop) - 4, scale: 0.6, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.6, delay: tapDelay + 0.05, ease: EASE }}
              >
                <Chip label={hop.label} color={color} />
              </motion.g>
            )}
            <motion.g
              initial={{ x: hop.from, y: hop.rise !== undefined ? ROW_Y(hop.rise) - 4 : Y, opacity: 0 }}
              animate={
                hop.rise !== undefined
                  ? { x: [hop.from, hop.from, hop.to], y: [ROW_Y(hop.rise) - 4, Y, Y], opacity: [0, 1, 1, 1, 0] }
                  : { x: hop.to, y: Y, opacity: [0, 1, 1, 1, 0] }
              }
              transition={{
                duration: riseDelay + HOP_S,
                ease: EASE,
                times: hop.rise !== undefined ? [0, riseDelay / (riseDelay + HOP_S), 1] : undefined,
                opacity: { duration: riseDelay + HOP_S, times: [0, 0.1, 0.5, 0.9, 1] },
              }}
            >
              <Chip label={hop.label} color={color} />
            </motion.g>
          </g>
        )}
        <AnimatePresence>
          {hop?.check && (
            <motion.g
              key={`pass-${mode}`}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: reduce ? 0 : HOP_S, type: "spring", stiffness: 420, damping: 18 }}
              style={{ transformOrigin: `${(8 + X.client) / 2}px 32px` }}
            >
              <rect x={(8 + X.client) / 2 - 39} y="20" width="78" height="24" rx="12" fill="var(--replay)" />
              <path d={`M${(8 + X.client) / 2 - 28} 32.5l3.4 3.2 6.4-6.8`} fill="none" stroke="#0c0f14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <text x={(8 + X.client) / 2 + 6} y="36.5" textAnchor="middle" className="fill-[#0c0f14] text-[12px] font-semibold">
                Passed
              </text>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>

      <div className="relative min-h-[3.5rem] border-t border-rule px-4 py-3 text-[14.5px] leading-snug" aria-live="off">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={`${mode}-${shown}`}
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="text-ink/85"
          >
            <span className={cn("mr-1.5 font-semibold", isRec ? "text-record-text" : "text-replay-text")}>
              {isRec ? "Record." : "Replay."}
            </span>
            {hop?.caption ??
              (isRec
                ? "Keploy wraps your app and watches every request and every database call."
                : "Same app, database switched off. Keploy plays both sides of the conversation.")}
          </motion.p>
        </AnimatePresence>
        {/* progress through this mode's four hops */}
        <div className="absolute inset-x-0 bottom-0 flex h-0.5 gap-px" aria-hidden="true">
          {hops.map((_, i) => (
            <span key={i} className="flex-1 bg-rule">
              <motion.span
                className="block h-full w-full origin-left"
                style={{ background: color }}
                initial={false}
                animate={{ scaleX: i <= shown ? 1 : 0 }}
                transition={{ duration: reduce ? 0 : i === shown ? hopDuration(hops[i]) : 0.2, ease: "linear" }}
              />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A labelled packet on the wire: the request, query, or response in flight. */
function Chip({ label, color }: { label: string; color: string }) {
  const w = label.length * 7 + 18;
  return (
    <g>
      <rect x={-w / 2} y={-11} width={w} height={22} rx={11} fill={color} />
      <text x={0} y={4} textAnchor="middle" className="fill-[#0c0f14] font-mono text-[11.5px] font-semibold">
        {label}
      </text>
    </g>
  );
}
