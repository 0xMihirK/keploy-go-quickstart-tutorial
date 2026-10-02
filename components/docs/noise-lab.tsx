"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { SimTerminal } from "./sim-terminal";

/**
 * Flip Keploy's noise rule for `body.ts` off and on, then replay the
 * matching real run: without the rule the test fails, with it it passes.
 */
export function NoiseLab({
  cwd,
  command,
  passRun,
  failRun,
}: {
  cwd: string;
  command: string;
  passRun: string;
  failRun: string;
}) {
  const [on, setOn] = useState(true);
  return (
    <div className="not-prose my-7">
      <div className="overflow-hidden rounded-xl border border-rule bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-3">
          <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => setOn((v) => !v)}
            className="inline-flex items-center gap-2.5 text-[14.5px] font-medium text-ink"
          >
            <span
              aria-hidden="true"
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                on ? "bg-replay" : "bg-graphite/40",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left]",
                  on ? "left-[18px]" : "left-0.5",
                )}
              />
            </span>
            Ignore <code className="font-mono text-[0.9em]">body.ts</code> while comparing
          </button>
          <span className={cn("ml-auto text-[13px] font-medium", on ? "text-replay-text" : "text-record-text")}>
            {on ? "Expect: pass" : "Expect: fail"}
          </span>
        </div>
        <pre className="overflow-x-auto bg-tape px-4 py-3 font-mono text-[12.5px] leading-[1.7] text-tape-ink">
          <span className="text-tape-dim"># keploy/test-set-0/tests/post-url-1.yaml</span>
          {"\n"}
          <span className="text-[#93c0ff]">  assertions</span>:{"\n"}
          <span className="text-[#93c0ff]">    noise</span>:{"\n"}
          <span className="block">
            {"      "}
            <span className={cn("transition-opacity", on ? "opacity-100" : "line-through opacity-40")}>
              <span className="text-[#93c0ff]">body.ts</span>: []
            </span>
          </span>
          {"      "}
          <span className="text-[#93c0ff]">header.Date</span>: []
        </pre>
      </div>
      <SimTerminal
        key={on ? "pass" : "fail"}
        cwd={cwd}
        commands={[{ cmd: command, run: on ? passRun : failRun, cwd }]}
        mode="replay"
        label={on ? "Replay with the noise rule" : "Replay without the noise rule"}
        className="mt-3"
      />
    </div>
  );
}
