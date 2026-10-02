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
    else if (c >= 40 && c <= 47) s.bg = BASE[c - 40];
    else if (c === 49) delete s.bg;
    else if (c >= 90 && c <= 97) s.fg = BRIGHT[c - 90];
    else if (c >= 100 && c <= 107) s.bg = BRIGHT[c - 100];
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
