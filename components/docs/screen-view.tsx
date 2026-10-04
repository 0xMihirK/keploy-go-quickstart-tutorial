"use client";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { apply, type Style } from "@/lib/ansi";

/*
 * Replays a full-screen terminal program (an agent's TUI) from captured
 * frames: a cols x rows character grid, drawn the way a terminal draws it.
 * Backgrounds, block elements and box-drawing lines are vector shapes on the
 * cell grid, so they join without seams at any size; text sits on the same
 * grid (cells are 1ch wide and 2ch tall).
 */

const FG = "#d7dce4";
const SGR = /\x1b\[([0-9;]*)m/g;

interface Cell {
  ch: string;
  /** 2 for a wide character (emoji, CJK); the next column is its tail. */
  w: 1 | 2;
  s: Style;
}

function wide(cp: number) {
  return (
    cp >= 0x1f000 ||
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    [
      0x231a, 0x231b, 0x23e9, 0x23ea, 0x23eb, 0x23ec, 0x23f0, 0x23f3, 0x25fd,
      0x25fe, 0x2614, 0x2615, 0x267f, 0x2693, 0x26a1, 0x26aa, 0x26ab, 0x26bd,
      0x26be, 0x26c4, 0x26c5, 0x26ce, 0x26d4, 0x26ea, 0x26f2, 0x26f3, 0x26f5,
      0x26fa, 0x26fd, 0x2705, 0x270a, 0x270b, 0x2728, 0x274c, 0x274e, 0x2753,
      0x2754, 0x2755, 0x2757, 0x2795, 0x2796, 0x2797, 0x27b0, 0x27bf, 0x2b1b,
      0x2b1c, 0x2b50, 0x2b55,
    ].includes(cp) ||
    (cp >= 0x2648 && cp <= 0x2653)
  );
}

/** One captured line as cells: one per terminal column (wide chars take two). */
export function parseLine(text: string, cols: number): Cell[] {
  const cells: Cell[] = [];
  let style: Style = {};
  let last = 0;
  const push = (seg: string) => {
    for (const ch of seg) {
      const cp = ch.codePointAt(0)!;
      // Zero-width joiners and variation selectors attach to the previous cell.
      if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) {
        if (cells.length) cells[cells.length - 1].ch += ch;
        continue;
      }
      const w = wide(cp) ? 2 : 1;
      cells.push({ ch, w, s: style });
      if (w === 2) cells.push({ ch: "", w: 1, s: style });
    }
  };
  for (const m of text.matchAll(SGR)) {
    push(text.slice(last, m.index));
    style = apply(
      style,
      (m[1] || "0").split(";").map((n) => Number(n || 0)),
    );
    last = m.index! + m[0].length;
  }
  push(text.slice(last));
  while (cells.length < cols) cells.push({ ch: " ", w: 1, s: {} });
  return cells.slice(0, cols);
}

function colors(s: Style) {
  let fg = s.fg ?? FG;
  let bg = s.bg;
  if (s.inverse) {
    [fg, bg] = [bg ?? "var(--tape)", fg];
  }
  return { fg, bg };
}

// Block elements: rectangles in a 1 x 2 cell (x, y, w, h), plus shade opacity.
const B: Record<string, [number, number, number, number, number?][]> = {
  "█": [[0, 0, 1, 2]],
  "▀": [[0, 0, 1, 1]],
  "▄": [[0, 1, 1, 1]],
  "▌": [[0, 0, 0.5, 2]],
  "▐": [[0.5, 0, 0.5, 2]],
  "▔": [[0, 0, 1, 0.25]],
  "▁": [[0, 1.75, 1, 0.25]],
  "▂": [[0, 1.5, 1, 0.5]],
  "▃": [[0, 1.25, 1, 0.75]],
  "▅": [[0, 0.75, 1, 1.25]],
  "▆": [[0, 0.5, 1, 1.5]],
  "▇": [[0, 0.25, 1, 1.75]],
  "▉": [[0, 0, 0.875, 2]],
  "▊": [[0, 0, 0.75, 2]],
  "▋": [[0, 0, 0.625, 2]],
  "▍": [[0, 0, 0.375, 2]],
  "▎": [[0, 0, 0.25, 2]],
  "▏": [[0, 0, 0.125, 2]],
  "▕": [[0.875, 0, 0.125, 2]],
  "▖": [[0, 1, 0.5, 1]],
  "▗": [[0.5, 1, 0.5, 1]],
  "▘": [[0, 0, 0.5, 1]],
  "▝": [[0.5, 0, 0.5, 1]],
  "▙": [
    [0, 0, 0.5, 2],
    [0.5, 1, 0.5, 1],
  ],
  "▛": [
    [0, 0, 1, 1],
    [0, 1, 0.5, 1],
  ],
  "▜": [
    [0, 0, 1, 1],
    [0.5, 1, 0.5, 1],
  ],
  "▟": [
    [0.5, 0, 0.5, 2],
    [0, 1, 0.5, 1],
  ],
  "▚": [
    [0, 0, 0.5, 1],
    [0.5, 1, 0.5, 1],
  ],
  "▞": [
    [0.5, 0, 0.5, 1],
    [0, 1, 0.5, 1],
  ],
  "▓": [[0, 0, 1, 2, 0.8]],
  "▒": [[0, 0, 1, 2, 0.5]],
  "░": [[0, 0, 1, 2, 0.25]],
};

// Box drawing: which arms leave the cell centre (up, right, down, left), and
// their weight: 1 light, 2 heavy, 3 double. "r" marks a rounded corner.
const L = 1,
  H = 2,
  D = 3;
const X: Record<string, [number, number, number, number, ("r" | "dash")?]> = {
  "─": [0, L, 0, L],
  "━": [0, H, 0, H],
  "│": [L, 0, L, 0],
  "┃": [H, 0, H, 0],
  "┄": [0, L, 0, L, "dash"],
  "┅": [0, H, 0, H, "dash"],
  "┆": [L, 0, L, 0, "dash"],
  "┇": [H, 0, H, 0, "dash"],
  "┈": [0, L, 0, L, "dash"],
  "┉": [0, H, 0, H, "dash"],
  "┊": [L, 0, L, 0, "dash"],
  "┋": [H, 0, H, 0, "dash"],
  "╌": [0, L, 0, L, "dash"],
  "╍": [0, H, 0, H, "dash"],
  "╎": [L, 0, L, 0, "dash"],
  "╏": [H, 0, H, 0, "dash"],
  "┌": [0, L, L, 0],
  "┐": [0, 0, L, L],
  "└": [L, L, 0, 0],
  "┘": [L, 0, 0, L],
  "┏": [0, H, H, 0],
  "┓": [0, 0, H, H],
  "┗": [H, H, 0, 0],
  "┛": [H, 0, 0, H],
  "├": [L, L, L, 0],
  "┤": [L, 0, L, L],
  "┬": [0, L, L, L],
  "┴": [L, L, 0, L],
  "┼": [L, L, L, L],
  "┣": [H, H, H, 0],
  "┫": [H, 0, H, H],
  "┳": [0, H, H, H],
  "┻": [H, H, 0, H],
  "╋": [H, H, H, H],
  "╭": [0, L, L, 0, "r"],
  "╮": [0, 0, L, L, "r"],
  "╯": [L, 0, 0, L, "r"],
  "╰": [L, L, 0, 0, "r"],
  "╴": [0, 0, 0, L],
  "╵": [L, 0, 0, 0],
  "╶": [0, L, 0, 0],
  "╷": [0, 0, L, 0],
  "╸": [0, 0, 0, H],
  "╹": [H, 0, 0, 0],
  "╺": [0, H, 0, 0],
  "╻": [0, 0, H, 0],
  "═": [0, D, 0, D],
  "║": [D, 0, D, 0],
  "╔": [0, D, D, 0],
  "╗": [0, 0, D, D],
  "╚": [D, D, 0, 0],
  "╝": [D, 0, 0, D],
  "╠": [D, D, D, 0],
  "╣": [D, 0, D, D],
  "╦": [0, D, D, D],
  "╩": [D, D, 0, D],
  "╬": [D, D, D, D],
};
const SW = { [L]: 0.11, [H]: 0.24 } as Record<number, number>;

function boxShapes(
  ch: string,
  x: number,
  y: number,
  color: string,
  key: string,
) {
  const spec = X[ch];
  if (!spec) return null;
  const [u, r, d, l, mode] = spec;
  const cx = x + 0.5;
  const cy = y + 1;
  const out: React.ReactNode[] = [];
  if (mode === "r") {
    // Rounded corner: two arms joined by a quarter arc.
    const w = SW[L];
    const ax = r ? x + 1 : x;
    const ay = u ? y : y + 2;
    const rad = 0.5;
    const hx = r ? cx + rad : cx - rad;
    const vy = u ? cy - rad : cy + rad;
    const path = `M ${ax} ${cy} L ${hx} ${cy} Q ${cx} ${cy} ${cx} ${vy} L ${cx} ${ay}`;
    out.push(
      <path
        key={key}
        d={path}
        fill="none"
        style={{ stroke: color }}
        strokeWidth={w}
      />,
    );
    return out;
  }
  const arm = (
    weight: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    k: string,
  ) => {
    if (!weight) return;
    const dash =
      mode === "dash" ? (x1 === x2 ? "0.32 0.18" : "0.22 0.12") : undefined;
    if (weight === D) {
      const o = 0.16;
      const vertical = x1 === x2;
      for (const s of [-o, o]) {
        out.push(
          <line
            key={k + s}
            x1={vertical ? x1 + s : x1}
            y1={vertical ? y1 : y1 + s}
            x2={vertical ? x2 + s : x2}
            y2={vertical ? y2 : y2 + s}
            style={{ stroke: color }}
            strokeWidth={SW[L]}
          />,
        );
      }
      return;
    }
    out.push(
      <line
        key={k}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        style={{ stroke: color }}
        strokeWidth={SW[weight]}
        strokeDasharray={dash}
      />,
    );
  };
  // Arms overlap the centre by half a stroke so joints are solid.
  const hw = Math.max(SW[u] ?? 0, SW[d] ?? 0) / 2;
  const vw = Math.max(SW[l] ?? 0, SW[r] ?? 0) / 2;
  arm(u, cx, y, cx, cy + vw, key + "u");
  arm(d, cx, cy - vw, cx, y + 2, key + "d");
  arm(l, x, cy, cx + hw, cy, key + "l");
  arm(r, cx - hw, cy, x + 1, cy, key + "r");
  return out;
}

const Row = memo(function Row({ cells }: { cells: Cell[] }) {
  // Text layer: runs of plain ASCII share a span; anything else gets its own
  // cell-sized box so a fallback font can't push the rest of the row off-grid.
  const out: React.ReactNode[] = [];
  let run = "";
  let runStyle: Style | null = null;
  const flush = (k: number) => {
    if (!run) return;
    const { fg } = colors(runStyle!);
    out.push(
      <span
        key={`t${k}`}
        style={{
          color: fg,
          fontWeight: runStyle!.bold ? 700 : undefined,
          opacity: runStyle!.dim ? 0.6 : undefined,
          fontStyle: runStyle!.italic ? "italic" : undefined,
          textDecoration: runStyle!.underline ? "underline" : undefined,
        }}
      >
        {run}
      </span>,
    );
    run = "";
  };
  cells.forEach((c, i) => {
    if (c.ch === "") return; // tail of a wide character
    // Blocks and box lines are drawn as shapes; the text layer keeps a space.
    const ch = B[c.ch] || X[c.ch] ? " " : c.ch;
    if (ch.length === 1 && ch.charCodeAt(0) < 0x7f) {
      if (run && runStyle !== c.s) flush(i);
      if (!run) runStyle = c.s;
      run += ch;
      return;
    }
    flush(i);
    const { fg } = colors(c.s);
    out.push(
      <span
        key={`g${i}`}
        className="inline-block text-center"
        style={{
          width: `${c.w}ch`,
          color: fg,
          fontWeight: c.s.bold ? 700 : undefined,
          opacity: c.s.dim ? 0.6 : undefined,
        }}
      >
        {ch}
      </span>,
    );
  });
  flush(cells.length);
  return <div className="h-[2ch] overflow-hidden whitespace-pre">{out}</div>;
});

/** One frame of the screen, fitted to the box it sits in. */
export function ScreenView({
  lines,
  cols,
  rows,
}: {
  lines: string[];
  cols: number;
  rows: number;
}) {
  const grid = useMemo(
    () => lines.slice(0, rows).map((l) => parseLine(l, cols)),
    [lines, cols, rows],
  );
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<number | null>(null);

  // Size the font so the grid fills the terminal's width, or its height when
  // that's the tighter fit. Measured, since 1ch differs between fonts.
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.closest<HTMLElement>("[role=log]");
    if (!el || !box) return;
    const fit = () => {
      const cs = getComputedStyle(box);
      const w =
        box.clientWidth -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight);
      const h =
        box.clientHeight -
        parseFloat(cs.paddingTop) -
        parseFloat(cs.paddingBottom);
      const probe = el.querySelector<HTMLElement>("[data-probe]");
      if (!probe) return;
      const ch = probe.getBoundingClientRect().width / 10 / 10; // probe: 10 chars at 10px
      const cell = Math.min(w / cols, h / (rows * 2));
      setSize(Math.max(4, cell / ch));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [cols, rows]);

  const shapes: React.ReactNode[] = [];
  grid.forEach((row, y) => {
    // Backgrounds: one rectangle per run of cells sharing a colour.
    let start = 0;
    for (let x = 1; x <= row.length; x++) {
      const prev = colors(row[x - 1].s).bg;
      if (x < row.length && colors(row[x].s).bg === prev) continue;
      if (prev)
        shapes.push(
          <rect
            key={`b${start}.${y}`}
            x={start}
            y={y * 2}
            width={x - start + 0.06}
            height={2.06}
            shapeRendering="crispEdges"
            style={{ fill: prev }}
          />,
        );
      start = x;
    }
  });
  grid.forEach((row, y) =>
    row.forEach((c, x) => {
      const { fg } = colors(c.s);
      const block = B[c.ch];
      if (block)
        block.forEach(([bx, by, bw, bh, o], i) =>
          shapes.push(
            <rect
              key={`k${x}.${y}.${i}`}
              x={x + bx}
              y={y * 2 + by}
              width={bw + 0.06}
              height={bh + 0.06}
              shapeRendering="crispEdges"
              style={{ fill: fg }}
              opacity={o}
            />,
          ),
        );
      const box = boxShapes(c.ch, x, y * 2, fg, `x${x}.${y}`);
      if (box) shapes.push(...box);
    }),
  );

  return (
    <div
      ref={ref}
      className="relative"
      style={{ fontSize: size ?? 10, visibility: size ? undefined : "hidden" }}
      aria-hidden="true"
    >
      <span
        data-probe
        className="pointer-events-none absolute whitespace-pre opacity-0"
        style={{ fontSize: 10 }}
      >
        0000000000
      </span>
      <div
        className="relative"
        style={{
          width: `${cols}ch`,
          height: `${rows * 2}ch`,
          lineHeight: "2ch",
        }}
      >
        <svg
          className="absolute inset-0 size-full"
          viewBox={`0 0 ${cols} ${rows * 2}`}
          preserveAspectRatio="none"
          shapeRendering="geometricPrecision"
        >
          {shapes}
        </svg>
        <div className="relative">
          {grid.map((row, y) => (
            <Row key={y} cells={row} />
          ))}
        </div>
      </div>
    </div>
  );
}
