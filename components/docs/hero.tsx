"use client";

import { AnimatedSpan, Terminal, TypingAnimation } from "@/components/ui/terminal";
import { Ansi } from "@/lib/ansi";
import { Prompt } from "./sim-terminal";
import { ArrowRight } from "lucide-react";
import { next } from "@/lib/slides";
import { Stack, type StackId } from "./stack";

// Verbatim lines from the captured runs in recordings/terminal (10/20, 40/50).
const LOOP: Record<
  StackId,
  { dir: string; record: string; curl: string; reply: string; logs: string[]; test: string; time: string; stop: string }
> = {
  gin: {
    dir: "~/samples-go/gin-mongo",
    record: 'keploy record -c "go run main.go handler.go"',
    logs: [
      "🐰 Keploy: 2026-10-02T19:53:44.909036735Z \t\x1b[34mINFO\x1b[0m\tKeploy agent is ready to record test cases and mocks.",
      '🐰 Keploy(agent): 2026-10-02T19:53:47Z\t\x1b[34mINFO\x1b[0m\tStarted ingress forwarding\t{"orig_port": 8080, "new_port": 38747}',
      '🐰 Keploy: 2026-10-02T19:53:48.488940284Z \t\x1b[34mINFO\x1b[0m\t🟠 Keploy has captured test cases for the user\'s application.\t{"path": "/home/dev/samples-go/gin-mongo/keploy/test-set-0/tests", "testcase name": "post-url-1"}',
    ],
    curl: `curl --request POST --url http://localhost:8080/url --header "content-type: application/json" --data '{"url": "https://keploy.io"}'`,
    reply: '{"ts":1790970828446964793,"url":"http://localhost:8080/7fvpSsFg"}',
    stop: "docker compose stop mongo",
    test: 'keploy test -c "go run main.go handler.go" --delay 10',
    time: "10.17 s",
  },
  echo: {
    dir: "~/samples-go/echo-sql",
    record: 'keploy record -c "./echo-psql-url-shortener"',
    logs: [
      "🐰 Keploy: 2026-10-02T19:56:28.047624737Z \t\x1b[34mINFO\x1b[0m\tKeploy agent is ready to record test cases and mocks.",
      '🐰 Keploy(agent): 2026-10-02T19:56:28Z\t\x1b[34mINFO\x1b[0m\tStarted ingress forwarding\t{"orig_port": 8082, "new_port": 44065}',
      '🐰 Keploy: 2026-10-02T19:56:28.813643306Z \t\x1b[34mINFO\x1b[0m\t🟠 Keploy has captured test cases for the user\'s application.\t{"path": "/home/dev/samples-go/echo-sql/keploy/test-set-0/tests", "testcase name": "post-url-1"}',
    ],
    curl: `curl --request POST --url http://localhost:8082/url --header "content-type: application/json" --data '{"url": "https://github.com"}'`,
    reply: '{"ts":1790970988777476533,"url":"http://localhost:8082/4KepjkTT"}',
    stop: "docker compose stop postgres",
    test: 'keploy test -c "./echo-psql-url-shortener" --delay 10',
    time: "10.13 s",
  },
};

function Loop({ stack }: { stack: StackId }) {
  const l = LOOP[stack];
  const p = <Prompt cwd={l.dir} />;
  return (
    <Terminal
      title={`bash — ${l.dir}`}
      maxHeight="22.5rem"
      label="The whole loop, from a real run"
      bodyClassName="h-[22.5rem] [&_code]:gap-y-1"
    >
      <TypingAnimation prompt={p} duration={26}>{l.record}</TypingAnimation>
      {l.logs.map((t) => (
        <AnimatedSpan key={t} className="truncate">
          <span className="truncate">
            <Ansi text={t} />
          </span>
        </AnimatedSpan>
      ))}
      <TypingAnimation prompt={p} duration={20}>{l.curl}</TypingAnimation>
      <AnimatedSpan className="truncate text-tape-ink">{l.reply}</AnimatedSpan>
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
      <Stack only="gin">
        <Loop stack="gin" />
      </Stack>
      <Stack only="echo">
        <Loop stack="echo" />
      </Stack>
      <p className="mt-2.5 text-[13px] text-graphite">
        Lines copied from my run on 2 Oct 2026. Long lines are cut off at the
        edge, and Keploy prints more between them.
      </p>
    </div>
  );
}

export function StartButton() {
  return (
    <button
      type="button"
      onClick={next}
      className="not-prose inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-5 text-[15.5px] font-medium text-paper transition-colors hover:bg-ink/85"
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
    ["Docker", "runs the database"],
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
      <p className="mt-3 border-t border-rule pt-2.5 text-[13.5px] text-graphite">
        Pick the sample app with the switch at the top right. Both are URL
        shorteners; the commands and output change to match.
      </p>
    </div>
  );
}
