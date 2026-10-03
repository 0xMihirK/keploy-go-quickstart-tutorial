import type { CSSProperties, ReactNode } from "react";

// Terminal palette tuned for the dark "tape" surface (both themes).
const BASE = [
  "#5c6370", // black
  "#ff6b6b", // red
  "#4fd18b", // green
  "#f2c14e", // yellow
  "#6ca8ff", // blue
  "#d68cff", // magenta
  "#4fd1c5", // cyan
  "#d7dce4", // white
];
const BRIGHT = [
  "#7d8696",
  "#ff8f8f",
  "#7ee2a8",
  "#ffd77a",
  "#93c0ff",
  "#e3a8ff",
  "#7fe3da",
  "#f4f6fa",
];

// Background colors are darker than the text palette so light text on them
// (e.g. Gin's " 200 " status badges) keeps at least 4.5:1 contrast.
const BG = [
  "#2a2f38", // black
  "#a83232", // red
  "#1f7a4a", // green
  "#7a5a00", // yellow
  "#2f5fb3", // blue
  "#7a3fa8", // magenta
  "#1d6f6a", // cyan
  "#5c6370", // white
];

function xterm256(n: number): string {
  if (n < 8) return BASE[n];
  if (n < 16) return BRIGHT[n - 8];
  if (n < 232) {
    const i = n - 16;
    const steps = [0, 95, 135, 175, 215, 255];
    const r = steps[Math.floor(i / 36)];
    const g = steps[Math.floor(i / 6) % 6];
    const b = steps[i % 6];
    return `rgb(${r},${g},${b})`;
  }
  const v = 8 + (n - 232) * 10;
  return `rgb(${v},${v},${v})`;
}

interface Style {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

function apply(style: Style, codes: number[]): Style {
  const s = { ...style };
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    if (c === 0) Object.keys(s).forEach((k) => delete s[k as keyof Style]);
    else if (c === 1) s.bold = true;
    else if (c === 2) s.dim = true;
    else if (c === 3) s.italic = true;
    else if (c === 4) s.underline = true;
    else if (c === 22) s.bold = s.dim = false;
    else if (c === 23) s.italic = false;
    else if (c === 24) s.underline = false;
    else if (c >= 30 && c <= 37) s.fg = BASE[c - 30];
    else if (c === 39) delete s.fg;
    else if (c >= 40 && c <= 47) s.bg = BG[c - 40];
    else if (c === 49) delete s.bg;
    else if (c >= 90 && c <= 97) s.fg = BRIGHT[c - 90];
    else if (c >= 100 && c <= 107) s.bg = BG[c - 100];
    else if ((c === 38 || c === 48) && codes[i + 1] === 5) {
      const color = xterm256(codes[i + 2] ?? 7);
      if (c === 38) s.fg = color;
      else s.bg = color;
      i += 2;
    } else if ((c === 38 || c === 48) && codes[i + 1] === 2) {
      const color = `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})`;
      if (c === 38) s.fg = color;
      else s.bg = color;
      i += 4;
    }
  }
  return s;
}

function toCss(s: Style): CSSProperties | undefined {
  if (!s.fg && !s.bg && !s.bold && !s.dim && !s.italic && !s.underline)
    return undefined;
  return {
    color: s.fg,
    backgroundColor: s.bg,
    fontWeight: s.bold ? 700 : undefined,
    opacity: s.dim ? 0.65 : undefined,
    fontStyle: s.italic ? "italic" : undefined,
    textDecoration: s.underline ? "underline" : undefined,
  };
}

const SGR = /\x1b\[([0-9;]*)m/g;

/** Renders one line of ANSI-coloured text as styled spans. */
export function Ansi({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let style: Style = {};
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(SGR)) {
    if (m.index! > last) {
      out.push(
        <span key={key++} style={toCss(style)}>
          {text.slice(last, m.index)}
        </span>,
      );
    }
    style = apply(
      style,
      (m[1] || "0").split(";").map((n) => Number(n || 0)),
    );
    last = m.index! + m[0].length;
  }
  if (last < text.length) {
    out.push(
      <span key={key++} style={toCss(style)}>
        {text.slice(last)}
      </span>,
    );
  }
  return <>{out.length ? out : " "}</>;
}

export function stripAnsi(text: string) {
  return text.replace(SGR, "");
}

/** One character cell with the colour it was printed in. */
export function ansiCells(text: string): { ch: string; fg?: string }[] {
  const cells: { ch: string; fg?: string }[] = [];
  let style: Style = {};
  let last = 0;
  const push = (s: string) => {
    for (const ch of s) cells.push({ ch, fg: style.fg });
  };
  for (const m of text.matchAll(SGR)) {
    push(text.slice(last, m.index));
    style = apply(style, (m[1] || "0").split(";").map((n) => Number(n || 0)));
    last = m.index! + m[0].length;
  }
  push(text.slice(last));
  return cells;
}

// How a terminal draws block elements itself: shapes and shades on the cell
// grid, not font glyphs. Each cell is 1 unit wide and 2 units tall.
const SHAPES: Record<string, { x: number; y: number; w: number; h: number; o?: number }> = {
  "█": { x: 0, y: 0, w: 1, h: 2 },
  "▀": { x: 0, y: 0, w: 1, h: 1 },
  "▄": { x: 0, y: 1, w: 1, h: 1 },
  "▌": { x: 0, y: 0, w: 0.5, h: 2 },
  "▐": { x: 0.5, y: 0, w: 0.5, h: 2 },
  "▓": { x: 0, y: 0, w: 1, h: 2, o: 0.85 },
  "▒": { x: 0, y: 0, w: 1, h: 2, o: 0.6 },
  "░": { x: 0, y: 0, w: 1, h: 2, o: 0.25 },
};

export const isBlockArt = (text: string) => /[█▀▄▌▐▓▒░]/.test(text);

/**
 * A line of block art (Keploy's banner). Blocks are drawn as one crisp SVG so
 * neighbouring cells join without seams; any letters on the line sit in a text
 * layer on the same cell grid.
 */
export function BlockArt({ text }: { text: string }) {
  const cells = ansiCells(text);
  const n = cells.length;
  return (
    <div className="relative h-[1.2em] w-max whitespace-pre leading-[1.2em]" aria-hidden="true">
      <svg
        className="absolute inset-0 h-full"
        style={{ width: `${n}ch` }}
        viewBox={`0 0 ${n} 2`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
      >
        {cells.map((c, i) => {
          const s = SHAPES[c.ch];
          if (!s) return null;
          return (
            <rect
              key={i}
              x={i + s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              fill={c.fg ?? "#d7dce4"}
              opacity={s.o}
            />
          );
        })}
      </svg>
      <span className="relative">
        {cells.map((c, i) => (
          <span key={i} style={{ color: c.fg }}>
            {SHAPES[c.ch] ? " " : c.ch}
          </span>
        ))}
      </span>
    </div>
  );
}
