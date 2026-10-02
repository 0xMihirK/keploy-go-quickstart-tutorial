"use client";

import { AnimatedSpan, Terminal, TypingAnimation } from "@/components/ui/terminal";
import { Ansi } from "@/lib/ansi";
import { Prompt } from "./prompt";
import { ArrowRight } from "lucide-react";
import { next } from "@/lib/slides";

// Verbatim lines from the captured runs in recordings/terminal (10-gin-record, 20-gin-test).
const LOOP = {
  dir: "~/samples-go/gin-mongo",
  record: 'keploy record -c "go run main.go handler.go"',
  logs: [
    "🐰 Keploy: 2026-10-02T19:53:44.909036735Z \t\x1b[34mINFO\x1b[0m\tKeploy agent is ready to record test cases and mocks.",
    '🐰 Keploy(agent): 2026-10-02T19:53:47Z\t\x1b[34mINFO\x1b[0m\tStarted ingress forwarding\t{"orig_port": 8080, "new_port": 38747}',
    '🐰 Keploy: 2026-10-02T19:53:48.488940284Z \t\x1b[34mINFO\x1b[0m\t🟠 Keploy has captured test cases for the user\'s application.\t{"path": "/home/dev/samples-go/gin-mongo/keploy/test-set-0/tests", "testcase name": "post-url-1"}',
  ],
  stop: "docker compose stop mongo",
  test: 'keploy test -c "go run main.go handler.go" --delay 10',
  time: "10.17 s",
};

function Loop() {
  const l = LOOP;
  const p = <Prompt cwd={l.dir} />;
  return (
    <Terminal
      title={`bash — ${l.dir}`}
      maxHeight="22.5rem"
      label="The whole loop, from a real run"
      bodyClassName="h-[22.5rem]"
    >
      <TypingAnimation prompt={p} duration={26}>{l.record}</TypingAnimation>
      {l.logs.map((t) => (
        <AnimatedSpan key={t} className="truncate">
          <span className="truncate">
            <Ansi text={t} />
          </span>
        </AnimatedSpan>
      ))}
      <AnimatedSpan className="text-tape-ink">^C</AnimatedSpan>
      <TypingAnimation prompt={p} duration={26}>{l.stop}</TypingAnimation>
      <TypingAnimation prompt={p} duration={26}>{l.test}</TypingAnimation>
      <AnimatedSpan>
        <span>
          <Ansi text={"  COMPLETE TESTRUN SUMMARY. "} />
        </span>
      </AnimatedSpan>
      {[
        "\tTotal tests: \x1b[34m\x1b[1m2\x1b[0m",
        "\tTotal test passed: \x1b[34m\x1b[1m2\x1b[0m",
        "\tTotal test failed: \x1b[34m\x1b[1m0\x1b[0m",
        `\tTotal time taken: \x1b[32m\x1b[1m"\x1b[0m\x1b[32m${l.time}\x1b[0m\x1b[32m\x1b[1m"\x1b[0m`,
      ].map((t) => (
        <AnimatedSpan key={t} className="whitespace-pre">
          <span>
            <Ansi text={t} />
          </span>
        </AnimatedSpan>
      ))}
    </Terminal>
  );
}

/** The record → curl → test loop, typed out with lines from the real run. */
export function LoopTerminal() {
  return (
    <div className="not-prose">
      <Loop />
    </div>
  );
}

export function StartButton() {
  return (
    <button
      type="button"
      onClick={next}
      className="not-prose inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-5 text-[15.5px] font-medium text-paper transition-[background-color,transform] hover:bg-ink/85 active:scale-[0.97]"
    >
      Start the tutorial
      <ArrowRight className="size-4" aria-hidden="true" />
    </button>
  );
}

export function Needs() {
  const items = [
    ["Linux or WSL2", "Ubuntu 22.04 is what I used"],
    ["Go 1.22+", "to build the sample app"],
    ["Docker", "only to run MongoDB"],
    ["A Keploy account", "free; step 2 covers it"],
  ];
  return (
    <div className="not-prose mt-4 rounded-xl border border-rule bg-surface px-4 py-3.5">
      <p className="text-[14px] font-semibold text-ink">You&apos;ll need</p>
      <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-[14px] sm:grid-cols-2">
        {items.map(([k, v]) => (
          <li key={k} className="leading-snug">
            <span className="font-medium text-ink">{k}</span>{" "}
            <span className="text-graphite">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
