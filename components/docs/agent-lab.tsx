"use client";
import { useState } from "react";
import { SimTerminal, type Cmd } from "./sim-terminal";
import { cn } from "@/lib/utils";

/*
 * Each agent: Keploy's real install output (a recorded run), then the agent's
 * own screen, recorded from the real program (recordings/agents/<id>/) while a
 * local stand-in supplied the model's replies and Keploy's tool results.
 */

const ESC = "[";
const dim = (s: string) => `${ESC}2m${s}${ESC}0m`;

const CWD = "~/samples-go/gin-mongo";

interface Agent {
  id: string;
  name: string;
  commands: Cmd[];
  /** Says what is recorded and what is scripted. */
  note: string;
}

const AGENTS: Agent[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    note: "Both are recordings: Keploy 3.8.58's install output (minus one line about replacing an earlier token), then Claude Code 2.1.289's own screen. Claude's replies and Keploy's tool results come from a local stand-in, so the conversation is scripted.",
    commands: [
      { cmd: "keploy mcp-install --editor claude-code", run: "40-mcp-claude", cwd: CWD },
      { cmd: "claude", cwd: CWD, screen: "agent-claude-code", title: "claude" },
    ],
  },
  {
    id: "antigravity",
    name: "Antigravity CLI",
    note: "The agy mcp add output is from a real run, and the screen is a recording of the Antigravity CLI 1.2.16. The replies and Keploy's tool results come from a local stand-in, so the conversation is scripted.",
    commands: [
      // agy reads ~/.gemini/config/mcp_config.json, which mcp-install doesn't write.
      { cmd: "export KEPLOY_API_KEY=kep_xxxxxxxx", out: [], cwd: CWD },
      {
        cmd: 'agy mcp add --header "Authorization: Bearer $KEPLOY_API_KEY" keploy https://api.keploy.io/client/v1/mcp',
        cwd: CWD,
        out: ['Added MCP server "keploy" (http)'],
      },
      { cmd: "agy", cwd: CWD, screen: "agent-antigravity", title: "agy" },
    ],
  },
  {
    id: "opencode",
    name: "OpenCode",
    note: "The screen is a recording of OpenCode 1.18.34 itself. The replies and Keploy's tool results come from a local stand-in, so the conversation is scripted.",
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
      { cmd: "opencode", cwd: CWD, screen: "agent-opencode", title: "opencode" },
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
