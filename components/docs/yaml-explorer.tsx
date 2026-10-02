"use client";

import { useMemo, useRef, useState } from "react";
import { FileText, Folder, FolderOpen } from "lucide-react";

import { cn } from "@/lib/utils";

export interface Note {
  /** Regex matched against each line; the first match gets the note. */
  match: string;
  title: string;
  body: string;
}

export interface ExplorerFile {
  path: string; // e.g. "keploy/test-set-0/tests/post-url-1.yaml"
  content: string;
  notes: Note[];
  /** Shown above the code, e.g. "mock-3 of 5". */
  caption?: string;
}

function YamlLine({ text }: { text: string }) {
  if (/^\s*#/.test(text)) return <span className="text-tape-dim italic">{text}</span>;
  const m = text.match(/^(\s*-?\s*)([\w.$\-]+)(:)(.*)$/);
  if (!m) return <span className="text-[#c8d0dc]">{text || " "}</span>;
  const [, lead, key, colon, rest] = m;
  const value = rest.trim();
  const valueCls = /^["']/.test(value)
    ? "text-[#7ee2a8]"
    : /^-?\d[\d.]*$/.test(value)
      ? "text-[#f2c14e]"
      : /^(true|false|null|\{\}|\[\])$/.test(value)
        ? "text-[#d68cff]"
        : "text-[#c8d0dc]";
  return (
    <>
      <span className="text-tape-dim">{lead}</span>
      <span className="text-[#93c0ff]">{key}</span>
      <span className="text-tape-dim">{colon}</span>
      <span className={valueCls}>{rest}</span>
    </>
  );
}

/** Note text with `backtick` spans shown as inline code. */
function NoteBody({ text }: { text: string }) {
  // split() with a capture group puts the code spans at odd indexes.
  return text.split(/`([^`]+)`/).map((part, i) =>
    i % 2 ? (
      <code key={i} className="rounded bg-white/[0.08] px-1 py-px font-mono text-[0.88em] text-tape-ink">
        {part}
      </code>
    ) : (
      part
    ),
  );
}

export function YamlExplorer({ files }: { files: ExplorerFile[] }) {
  const [active, setActive] = useState(0);
  const file = files[active];
  const lines = useMemo(() => file.content.replace(/\n$/, "").split("\n"), [file]);

  // Map each note to the first line it matches.
  const anchors = useMemo(() => {
    const out: { line: number; note: Note }[] = [];
    for (const note of file.notes) {
      const re = new RegExp(note.match);
      const i = lines.findIndex((l) => re.test(l));
      if (i !== -1) out.push({ line: i, note });
    }
    return out.sort((a, b) => a.line - b.line);
  }, [file, lines]);
  const [noteIdx, setNoteIdx] = useState(0);
  const current = anchors[Math.min(noteIdx, anchors.length - 1)];
  const codeRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Pick a note and bring its line into view inside the code pane.
  const showNote = (i: number) => {
    setNoteIdx(i);
    requestAnimationFrame(() => {
      const el = lineRefs.current[anchors[i]?.line ?? -1];
      const box = codeRef.current;
      if (el && box) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + 12, behavior: "smooth" });
    });
  };

  // A real tree: folders before files, each level indented.
  const rows = useMemo(() => {
    const items = files.map((f, i) => ({ parts: f.path.split("/"), i }));
    items.sort((a, b) => {
      for (let k = 0; k < Math.min(a.parts.length, b.parts.length); k++) {
        if (a.parts[k] === b.parts[k]) continue;
        const aDir = k < a.parts.length - 1;
        const bDir = k < b.parts.length - 1;
        if (aDir !== bDir) return aDir ? -1 : 1;
        return a.parts[k].localeCompare(b.parts[k]);
      }
      return a.parts.length - b.parts.length;
    });
    const out: ({ kind: "dir"; name: string; depth: number; path: string } | { kind: "file"; name: string; depth: number; i: number })[] = [];
    const seen = new Set<string>();
    for (const { parts, i } of items) {
      for (let d = 0; d < parts.length - 1; d++) {
        const path = parts.slice(0, d + 1).join("/");
        if (!seen.has(path)) {
          seen.add(path);
          out.push({ kind: "dir", name: parts[d], depth: d, path });
        }
      }
      out.push({ kind: "file", name: parts[parts.length - 1], depth: parts.length - 1, i });
    }
    return out;
  }, [files]);

  return (
    <div className="not-prose my-7 overflow-hidden rounded-xl border border-tape-rule bg-tape text-tape-ink">
      <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[14.5rem_minmax(0,1fr)]">
        <nav
          aria-label="Files Keploy created"
          className="border-b border-tape-rule p-2 font-mono text-[12px] md:border-r md:border-b-0"
        >
          {rows.map((r) =>
            r.kind === "dir" ? (
              <div
                key={r.path}
                className="flex items-center gap-1.5 py-1 pr-2 whitespace-nowrap text-tape-dim"
                style={{ paddingLeft: 8 + r.depth * 12 }}
              >
                {files[active].path.startsWith(r.path + "/") ? (
                  <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Folder className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                {r.name}/
              </div>
            ) : (
              <button
                key={files[r.i].path}
                type="button"
                onClick={() => {
                  setActive(r.i);
                  setNoteIdx(0);
                  codeRef.current?.scrollTo({ top: 0 });
                }}
                aria-current={r.i === active ? "true" : undefined}
                title={files[r.i].path}
                style={{ paddingLeft: 8 + r.depth * 12 }}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left whitespace-nowrap transition-colors",
                  r.i === active
                    ? "bg-white/[0.07] text-tape-ink"
                    : "text-tape-dim hover:bg-white/[0.04] hover:text-tape-ink",
                )}
              >
                <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{r.name}</span>
              </button>
            ),
          )}
        </nav>

        <div className="min-w-0">
          <div className="flex items-center gap-2 border-b border-tape-rule px-4 py-2 font-mono text-[11.5px] text-tape-dim">
            <span className="truncate">{file.path}</span>
            {file.caption && <span className="ml-auto shrink-0">{file.caption}</span>}
          </div>
          <div ref={codeRef} className="relative max-h-[24rem] overflow-auto py-2">
            <div className="font-mono text-[12px] leading-[1.65] whitespace-pre">
              {lines.map((l, i) => {
                const a = anchors.findIndex((x) => x.line === i);
                const on = a !== -1 && anchors[a] === current;
                return (
                  <div
                    key={i}
                    ref={(el) => {
                      lineRefs.current[i] = el;
                    }}
                    className={cn(
                      "group flex min-w-max pr-4",
                      on && "bg-orange/[0.14]",
                    )}
                  >
                    <span aria-hidden="true" className="w-10 shrink-0 pr-3 text-right text-tape-dim select-none">
                      {i + 1}
                    </span>
                    {a !== -1 ? (
                      <button
                        type="button"
                        onClick={() => showNote(a)}
                        className={cn(
                          "relative -ml-1 rounded-sm px-1 text-left underline decoration-dotted underline-offset-4",
                          on ? "decoration-orange" : "decoration-tape-dim/70 hover:decoration-orange",
                        )}
                        aria-label={`Explain line ${i + 1}: ${anchors[a].note.title}`}
                      >
                        <YamlLine text={l} />
                      </button>
                    ) : (
                      <span>
                        <YamlLine text={l} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {current && (
        <div
          className="flex flex-col gap-3 border-t border-tape-rule bg-[#141a22] px-4 py-3 sm:flex-row sm:items-start"
          aria-live="polite"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[#ffb98a]">
              Line {current.line + 1}: {current.note.title}
            </p>
            <p className="mt-1 text-[14px] leading-relaxed text-[#c8d0dc]">
              <NoteBody text={current.note.body} />
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[12px]">
            {anchors.map((x, i) => (
              <button
                key={x.line}
                type="button"
                onClick={() => showNote(i)}
                aria-label={`Note ${i + 1}: ${x.note.title}`}
                aria-pressed={x === current}
                className={cn(
                  "grid size-6 place-items-center rounded-full border font-mono",
                  x === current
                    ? "border-orange bg-orange text-[#1a0d04]"
                    : "border-tape-rule text-tape-dim hover:text-tape-ink",
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
