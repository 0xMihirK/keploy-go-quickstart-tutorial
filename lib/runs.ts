export interface RunLine {
  /** ms to wait before printing (already compressed) */
  d: number;
  text: string;
  /** real seconds Keploy waited before this line, when compressed */
  wait?: number;
  /** 1 = redraw the previous line (carriage-return progress) */
  r?: 1;
}

export interface Run {
  /** real duration of the captured session, seconds */
  real: number;
  lines: RunLine[];
}

const cache = new Map<string, Promise<Run>>();

/** Loads a captured run from /public/runs on first use. */
export function loadRun(name: string): Promise<Run> {
  let p = cache.get(name);
  if (!p) {
    p = fetch(`/runs/${name}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`run ${name}: ${r.status}`);
        return r.json() as Promise<Run>;
      });
    cache.set(name, p);
    p.catch(() => cache.delete(name));
  }
  return p;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true },
    );
  });

export interface StreamHandlers {
  onLine: (line: RunLine, index: number) => void;
  /** Called when a long real wait starts (seconds) and ends (null). */
  onWait?: (realSeconds: number | null, ms: number) => void;
  signal: AbortSignal;
  /** Skip delays entirely (reduced motion). */
  instant?: boolean;
  /** Speed multiplier for short gaps; keeps fast bursts from feeling sluggish. */
  speed?: number;
  /** While this returns true, output holds before the next line. */
  isPaused?: () => boolean;
  /** ms to linger after printing line i (e.g. so a banner can be read). */
  holdAfter?: (index: number) => number;
}

/** Streams lines[from, to) with their recorded pacing. */
export async function streamLines(
  lines: RunLine[],
  from: number,
  to: number,
  { onLine, onWait, signal, instant, speed = 1, isPaused, holdAfter }: StreamHandlers,
) {
  for (let i = from; i < Math.min(to, lines.length); i++) {
    const line = lines[i];
    if (!instant) {
      if (line.wait) {
        onWait?.(line.wait, line.d);
        await sleep(line.d, signal);
        onWait?.(null, 0);
      } else if (line.d > 4) {
        await sleep(Math.max(6, line.d / speed), signal);
      } else if (i % 6 === 0) {
        // Same-chunk lines still arrive a frame apart, like a real tty.
        await sleep(8, signal);
      }
    }
    while (isPaused?.()) await sleep(120, signal);
    onLine(line, i);
    const hold = instant ? 0 : (holdAfter?.(i) ?? 0);
    if (hold) await sleep(hold, signal);
  }
}

/* How many terminals are busy right now (drives the logo's spinning reels). */
let busy = 0;
const busyListeners = new Set<() => void>();
export function markBusy(delta: 1 | -1) {
  busy = Math.max(0, busy + delta);
  busyListeners.forEach((l) => l());
}
export function subscribeBusy(l: () => void) {
  busyListeners.add(l);
  return () => {
    busyListeners.delete(l);
  };
}
export const getBusy = () => busy;
