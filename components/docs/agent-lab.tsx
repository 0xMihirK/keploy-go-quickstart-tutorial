"use client";
import { useState } from "react";
import type { RunLine } from "@/lib/runs";
import { SimTerminal, type Cmd } from "./sim-terminal";
import { cn } from "@/lib/utils";

/*
 * Each agent: Keploy's real install output (a recorded run), then the agent
 * opening in the same terminal and being asked Keploy's suggested prompt. The
 * sessions are illustrations: the tool names are Keploy MCP's, the wording is
 * ours, and a real agent's replies vary.
 */

const ESC = "\x1b[";
const rgb = (c: string) => (s: string) => `${ESC}38;2;${c}m${s}${ESC}0m`;
const dim = (s: string) => `${ESC}2m${s}${ESC}0m`;
const bold = (s: string) => `${ESC}1m${s}${ESC}0m`;

const PROMPT = "generate Keploy API tests for this service.";
const CWD = "~/samples-go/gin-mongo";

/** The prompt typed into the agent's input, one character per redraw. */
function typed(prefix: string, text: string, after = 600): RunLine[] {
  return [
    { d: after, text: prefix },
    ...[...text].map((_, i) => ({ d: 26, text: prefix + text.slice(0, i + 1), r: 1 as const })),
  ];
}

const gap = (d = 120): RunLine => ({ d, text: "" });

const RECORDED =
  "The install output is a recorded run of Keploy 3.8.58, minus one line about replacing an earlier token. The agent session is an illustration: the tool names are Keploy's MCP tools, and a real agent words its replies its own way.";

interface Agent {
  id: string;
  name: string;
  commands: Cmd[];
  /** Says which lines are a recording and which are an illustration. */
  note: string;
}

const claude = rgb("217;119;87");
const agyBlue = rgb("138;180;248");
const ocInk = rgb("250;178;131");

const AGENTS: Agent[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    note: RECORDED,
    commands: [
      { cmd: "keploy mcp-install --editor claude-code", run: "40-mcp-claude", cwd: CWD },
      {
        cmd: "claude",
        cwd: CWD,
        clear: true,
        title: "claude",
        out: [
          { d: 700, text: `${claude("✻")} ${bold("Claude Code")}  ${dim(CWD)}` },
          gap(),
          ...typed(`${dim(">")} `, PROMPT),
          gap(500),
          { d: 600, text: `${claude("⏺")} keploy - get_auth_status ${dim("(MCP)")}` },
          { d: 900, text: dim("  ⎿  Signed in to Keploy") },
          { d: 700, text: `${claude("⏺")} Read ${bold("main.go")}, ${bold("handler.go")}` },
          { d: 800, text: dim("  ⎿  Gin on :8080: POST /url and GET /:param, backed by MongoDB") },
          { d: 700, text: `${claude("⏺")} keploy - search_tools ${dim("(MCP)")}(query: "generate tests")` },
          { d: 800, text: dim("  ⎿  generate_and_wait, run_and_report") },
          { d: 700, text: `${claude("⏺")} keploy - invoke_tool ${dim("(MCP)")}(tool: "generate_and_wait")` },
          { d: 1700, text: dim("  ⎿  Test suites created for POST /url and GET /:param") },
          { d: 700, text: `${claude("⏺")} keploy - invoke_tool ${dim("(MCP)")}(tool: "run_and_report")` },
          { d: 1700, text: dim("  ⎿  Suites run against localhost:8080, report ready") },
          gap(600),
          { d: 300, text: `${claude("⏺")} Keploy generated test suites for both endpoints and ran them against the app. The report is in your Keploy account.` },
        ],
      },
    ],
  },
  {
    id: "antigravity",
    name: "Antigravity",
    note: RECORDED,
    commands: [
      { cmd: "keploy mcp-install --editor antigravity", run: "42-mcp-antigravity", cwd: CWD },
      {
        cmd: "agy",
        cwd: CWD,
        clear: true,
        title: "agy",
        out: [
          { d: 700, text: `${agyBlue("◆")} ${bold("Antigravity CLI")}  ${dim(CWD)}` },
          { d: 60, text: dim("  MCP servers: keploy") },
          gap(),
          ...typed(`${agyBlue("›")} `, PROMPT),
          gap(500),
          { d: 600, text: `  ${agyBlue("●")} keploy.get_auth_status` },
          { d: 900, text: dim("    ↳ signed in") },
          { d: 700, text: `  ${agyBlue("●")} Reading main.go, handler.go` },
          { d: 800, text: dim("    ↳ Gin service on :8080 with POST /url and GET /:param") },
          { d: 700, text: `  ${agyBlue("●")} keploy.search_tools  "generate tests"` },
          { d: 800, text: dim("    ↳ generate_and_wait, run_and_report") },
          { d: 700, text: `  ${agyBlue("●")} keploy.invoke_tool  generate_and_wait` },
          { d: 1700, text: dim("    ↳ test suites created for both endpoints") },
          { d: 700, text: `  ${agyBlue("●")} keploy.invoke_tool  run_and_report` },
          { d: 1700, text: dim("    ↳ suites run against localhost:8080") },
          gap(600),
          { d: 300, text: "  Generated and ran Keploy test suites for POST /url and GET /:param. The report is in your Keploy account." },
        ],
      },
    ],
  },
  {
    id: "opencode",
    name: "OpenCode",
    note: "The session is an illustration: the tool names are Keploy's MCP tools, and a real agent words its replies its own way.",
    commands: [
      // Not on mcp-install's list: the server goes into opencode.json by hand.
      { cmd: "export KEPLOY_API_KEY=kep_xxxxxxxx", out: [], cwd: CWD },
      {
        cmd: "cat opencode.json",
        cwd: CWD,
        out: [
          "{",
          `  ${dim('"$schema"')}: "https://opencode.ai/config.json",`,
          `  ${dim('"mcp"')}: {`,
          `    ${dim('"keploy"')}: {`,
          `      ${dim('"type"')}: "remote",`,
          `      ${dim('"url"')}: "https://api.keploy.io/client/v1/mcp",`,
          `      ${dim('"headers"')}: {`,
          `        ${dim('"Authorization"')}: "Bearer {env:KEPLOY_API_KEY}"`,
          "      }",
          "    }",
          "  }",
          "}",
        ],
      },
      {
        cmd: "opencode",
        cwd: CWD,
        clear: true,
        title: "opencode",
        out: [
          { d: 700, text: `${bold("opencode")}  ${dim(CWD)}` },
          { d: 60, text: dim("  mcp: keploy connected") },
          gap(),
          ...typed(`${ocInk("┃")} `, PROMPT),
          gap(500),
          { d: 600, text: `${ocInk("⚙")} keploy_get_auth_status` },
          { d: 900, text: dim("  signed in") },
          { d: 700, text: `${ocInk("→")} Read main.go, handler.go` },
          { d: 800, text: dim("  Gin on :8080: POST /url and GET /:param") },
          { d: 700, text: `${ocInk("⚙")} keploy_search_tools ${dim('query="generate tests"')}` },
          { d: 800, text: dim("  generate_and_wait, run_and_report") },
          { d: 700, text: `${ocInk("⚙")} keploy_invoke_tool ${dim("tool=generate_and_wait")}` },
          { d: 1700, text: dim("  test suites created for both endpoints") },
          { d: 700, text: `${ocInk("⚙")} keploy_invoke_tool ${dim("tool=run_and_report")}` },
          { d: 1700, text: dim("  suites run against localhost:8080") },
          gap(600),
          { d: 300, text: "Keploy generated and ran test suites for both endpoints. The report is in your Keploy account." },
        ],
      },
    ],
  },
];

/**
 * One terminal that cycles through the agents: install, open the agent, ask
 * for tests. Picking an agent jumps to it; the cycle carries on from there.
 */
export function AgentLab() {
  const [i, setI] = useState(0);
  const agent = AGENTS[i];
  return (
    <div className="not-prose">
      <div role="group" aria-label="Agent shown in the terminal" className="flex flex-wrap gap-1.5">
        {AGENTS.map((a, n) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={n === i}
            onClick={() => setI(n)}
            className={cn(
              "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
              n === i
                ? "border-orange/50 bg-orange/10 text-ink"
                : "border-rule text-graphite hover:border-graphite/50 hover:text-ink",
            )}
          >
            {a.name}
          </button>
        ))}
      </div>
      <SimTerminal
        key={agent.id}
        className="mt-4 mb-3"
        // Short windows: leave room for the picker and the note in the pane.
        maxHeight="min(var(--term-h), calc(100dvh - 24rem))"
        cwd={CWD}
        commands={agent.commands}
        onFinish={() => setI((n) => (n + 1) % AGENTS.length)}
        label={`${agent.name} terminal`}
      />
      {/* Three lines tall for every agent, so the centred lab doesn't shift. */}
      <p className="min-h-[3lh] text-[13px] leading-snug text-graphite">{agent.note}</p>
    </div>
  );
}
