#!/bin/bash
# Runs as root inside the cap-claude-code container (node:22-bookworm).
# Expects this directory copied to /opt/standin.
set -e
apt-get update -qq && apt-get install -y -qq tmux >/dev/null
id you >/dev/null 2>&1 || useradd -m -s /bin/bash you
command -v claude >/dev/null || npm i -g @anthropic-ai/claude-code >/dev/null 2>&1
[ -d /home/you/samples-go ] || su you -c 'git clone -q https://github.com/keploy/samples-go.git /home/you/samples-go'

KEY=sk-ant-api03-standin-dummy-key-000000000000000000000000AA
VER=$(claude --version | awk '{print $1}')
mkdir -p /home/you/.claude
cat > /home/you/.claude.json <<JSON
{
  "hasCompletedOnboarding": true,
  "lastOnboardingVersion": "$VER",
  "lastReleaseNotesSeen": "$VER",
  "theme": "dark",
  "numStartups": 5,
  "autoUpdates": false,
  "hasSeenAutoDefaultNotice": true,
  "hasSeenAutoModeEntryWarning": true,
  "customApiKeyResponses": {"approved": ["${KEY: -20}"], "rejected": []},
  "mcpServers": {
    "keploy": {"type": "stdio", "command": "python3", "args": ["/opt/standin/keploy_mcp.py"], "env": {}}
  },
  "projects": {
    "/home/you/samples-go": {"allowedTools": [], "hasTrustDialogAccepted": true, "hasCompletedProjectOnboarding": true},
    "/home/you/samples-go/gin-mongo": {
      "allowedTools": [],
      "hasTrustDialogAccepted": true,
      "hasCompletedProjectOnboarding": true,
      "projectOnboardingSeenCount": 1
    }
  }
}
JSON
cat > /home/you/.claude/settings.json <<JSON
{"permissions": {"allow": ["mcp__keploy__*", "Read"]}}
JSON
cat > /home/you/.claude-env <<ENV
export ANTHROPIC_BASE_URL=http://127.0.0.1:4000
export ANTHROPIC_API_KEY=$KEY
export DISABLE_AUTOUPDATER=1
export DISABLE_TELEMETRY=1
export DISABLE_ERROR_REPORTING=1
export TERM=xterm-256color
export COLORTERM=truecolor
export CLAUDE_CODE_TMUX_TRUECOLOR=1
ENV
chown -R you:you /home/you/.claude /home/you/.claude.json /home/you/.claude-env
