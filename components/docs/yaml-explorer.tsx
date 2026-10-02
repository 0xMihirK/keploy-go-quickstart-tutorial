"use client";

import { useMemo, useState } from "react";
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
  /** Shown above the code, e.g. "1 of 5 mocks shown". */
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

  // Build a tree from paths.
  const tree = useMemo(() => {
    const dirs = new Map<string, number[]>();
    files.forEach((f, i) => {
      const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : "";
      dirs.set(dir, [...(dirs.get(dir) ?? []), i]);
    });
    return [...dirs.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [files]);

  return (
    <div className="not-prose my-7 overflow-hidden rounded-xl border border-tape-rule bg-tape text-tape-ink">
      <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[13.5rem_minmax(0,1fr)]">
        <nav
          aria-label="Files Keploy created"
          className="border-b border-tape-rule p-2 font-mono text-[12px] md:border-r md:border-b-0"
        >
          {tree.map(([dir, idx]) => (
            <div key={dir || "root"} className="mb-1">
              {dir && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-tape-dim">
                  {idx.includes(active) ? (
                    <FolderOpen className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Folder className="size-3.5" aria-hidden="true" />
                  )}
                  {dir}/
                </div>
              )}
              {idx.map((i) => {
                const name = files[i].path.slice(files[i].path.lastIndexOf("/") + 1);
                return (
                  <button
                    key={files[i].path}
                    type="button"
                    onClick={() => {
                      setActive(i);
                      setNoteIdx(0);
                    }}
                    aria-current={i === active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left transition-colors",
                      dir ? "pl-6" : "pl-2",
                      i === active
                        ? "bg-white/[0.07] text-tape-ink"
                        : "text-tape-dim hover:bg-white/[0.04] hover:text-tape-ink",
                    )}
                  >
                    <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="min-w-0">
          <div className="flex items-center gap-2 border-b border-tape-rule px-4 py-2 font-mono text-[11.5px] text-tape-dim">
            <span className="truncate">{file.path}</span>
            {file.caption && <span className="ml-auto shrink-0">{file.caption}</span>}
          </div>
          <div className="max-h-[24rem] overflow-auto py-2">
            <pre className="font-mono text-[12px] leading-[1.65]">
              {lines.map((l, i) => {
                const a = anchors.findIndex((x) => x.line === i);
                const on = a !== -1 && anchors[a] === current;
                return (
                  <div
                    key={i}
                    className={cn(
                      "group flex min-w-max pr-4",
                      on && "bg-orange/[0.14]",
                    )}
                  >
                    <span className="w-10 shrink-0 pr-3 text-right text-tape-dim/60 select-none">
                      {i + 1}
                    </span>
                    {a !== -1 ? (
                      <button
                        type="button"
                        onClick={() => setNoteIdx(a)}
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
            </pre>
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
            <p className="mt-1 text-[14px] leading-relaxed text-[#c8d0dc]">{current.note.body}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[12px]">
            {anchors.map((x, i) => (
              <button
                key={x.line}
                type="button"
                onClick={() => setNoteIdx(i)}
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
