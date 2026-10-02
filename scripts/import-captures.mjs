// Converts real terminal captures (`script -T`) into timed line events
// the simulated terminal replays. Run: node scripts/import-captures.mjs
//
// Input:  recordings/terminal/<name>.ansi  (typescript)  + <name>.tm (classic timing: "<delay> <bytes>")
// Output: public/runs/<name>.json  →  { real, lines: [{ d, text, wait?, r? }] }
//   d     ms to wait before printing the line (compressed)
//   wait  real seconds Keploy spent before this line, when it was long enough to compress
//   r     1 = redraw the previous line (carriage-return progress, e.g. git clone)
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SRC = "recordings/terminal";
const OUT = "public/runs";
const MAX_GAP_MS = 1400; // longest pause we replay as-is
const MAX_TOTAL_MS = 10000; // longest any single run replays
const SGR = /\x1b\[[0-9;]*m/g;
const OTHER_ESC = /\x1b(\[[0-9;?]*[A-Za-ln-z]|\][^\x07]*\x07|[()][A-Z0-9])/g;

mkdirSync(OUT, { recursive: true });

function clean(line) {
  return line.replace(OTHER_ESC, "").replace(/\x00/g, "");
}

for (const file of readdirSync(SRC).filter((f) => f.endsWith(".ansi"))) {
  const name = file.replace(/\.ansi$/, "");
  const buf = readFileSync(join(SRC, file));
  const timing = readFileSync(join(SRC, `${name}.tm`), "utf8")
    .trim()
    .split("\n")
    .map((l) => l.split(" ").map(Number));

  // The typescript starts with a "Script started" header line.
  let offset = buf.indexOf(0x0a) + 1;
  let clock = 0;
  let pending = "";
  let lastEmit = 0;
  let redraw = false;
  const lines = [];

  for (const [delay, bytes] of timing) {
    clock += delay * 1000;
    pending += buf.subarray(offset, offset + bytes).toString("utf8");
    offset += bytes;
    // "\r\n" or "\n" ends a line; a lone "\r" means the next text redraws it.
    let m;
    while ((m = /\r\n|\n|\r(?!$)/.exec(pending))) {
      const raw = pending.slice(0, m.index);
      pending = pending.slice(m.index + m[0].length);
      const gap = clock - lastEmit;
      lastEmit = clock;
      const line = { d: Math.round(Math.min(gap, MAX_GAP_MS)), text: clean(raw) };
      if (gap > MAX_GAP_MS + 300) line.wait = Math.round(gap / 100) / 10;
      if (redraw) line.r = 1;
      redraw = m[0] === "\r";
      if (raw || !line.r) lines.push(line);
    }
  }
  if (pending.trim()) lines.push({ d: 0, text: clean(pending) });

  // Drop the "Script done" footer and the block Keploy prints for AI agents.
  let out = lines.filter((l) => !l.text.startsWith("Script done on"));
  const next = out.findIndex((l) => l.text.replace(SGR, "").startsWith("=== KEPLOY NEXT ==="));
  if (next !== -1) {
    const end = out.findIndex((l, i) => i > next && /^=+$/.test(l.text.replace(SGR, "").trim()));
    out.splice(next, (end === -1 ? out.length : end + 1) - next);
  }
  // Trim trailing blank lines.
  while (out.length && !out[out.length - 1].text.replace(SGR, "").trim()) out.pop();

  // Keep any one run under MAX_TOTAL_MS of replay by scaling its pacing.
  const total = out.reduce((s, l) => s + l.d, 0);
  if (total > MAX_TOTAL_MS) {
    const k = MAX_TOTAL_MS / total;
    for (const l of out) l.d = Math.round(l.d * k);
  }
  const real = Math.round(clock / 100) / 10;
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify({ real, lines: out }));
  const replay = (out.reduce((s, l) => s + l.d, 0) / 1000).toFixed(1);
  console.log(`${name}: ${out.length} lines, ${real}s real → ${replay}s replay`);
}
