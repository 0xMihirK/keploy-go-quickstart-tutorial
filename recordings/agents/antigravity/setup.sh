#!/bin/bash
# Runs as root inside the cap-antigravity container (node:22-bookworm).
# Expects this directory copied to /opt/standin. Safe to re-run: it resets agy's config to the capture state.
set -e
command -v tmux >/dev/null || { apt-get update -qq && apt-get install -y -qq tmux >/dev/null; }
id you >/dev/null 2>&1 || useradd -m -s /bin/bash you
[ -d /home/you/samples-go ] || su you -c 'git clone -q https://github.com/keploy/samples-go.git /home/you/samples-go'
[ -x /home/you/.local/bin/agy ] || su you -c 'curl -fsSL https://antigravity.google/cli/install.sh | bash'
pkill -u you -x agy 2>/dev/null || true   # agy rewrites settings.json on exit; never edit it while agy runs
sleep 0.5

G=/home/you/.gemini
mkdir -p $G/antigravity-cli/cache $G/config
# API-key mode (no Google sign-in), dark-terminal colours, trusted workspace, Keploy MCP tools pre-approved
cat > $G/antigravity-cli/settings.json <<'JSON'
{
  "modelProvider": "gemini",
  "colorScheme": "terminal",
  "enableTelemetry": false,
  "showTips": false,
  "showFeedbackSurvey": false,
  "permissions": {
    "allow": [
      "mcp(keploy/get_auth_status)",
      "mcp(keploy/search_tools)",
      "mcp(keploy/get_tool_schema)",
      "mcp(keploy/invoke_tool)"
    ]
  },
  "trustedWorkspaces": [
    "/home/you/samples-go/gin-mongo"
  ]
}
JSON
# first-run onboarding (colour scheme + terms screen) already done
cat > $G/antigravity-cli/cache/onboarding.json <<'JSON'
{
  "consumerOnboardingComplete": true,
  "enterpriseOnboardingComplete": false,
  "onboardingComplete": true
}
JSON
# user-level MCP config: the file `agy mcp add` writes and agy reads
cat > $G/config/mcp_config.json <<'JSON'
{
  "mcpServers": {
    "keploy": {
      "command": "python3",
      "args": ["/opt/standin/mcp_keploy.py"],
      "disabled": false
    }
  }
}
JSON
# fresh conversation store, so every capture starts from the same first-launch screen
rm -rf $G/antigravity-cli/conversations/* $G/antigravity-cli/brain/* $G/antigravity-cli/implicit/* \
       $G/antigravity-cli/conversation_summaries.db*
cat > /home/you/.agy-env <<'ENV'
export GEMINI_API_KEY=standin-dummy-key
export GOOGLE_GEMINI_BASE_URL=http://127.0.0.1:4020
export AGY_CLI_DISABLE_AUTO_UPDATE=1
export AGY_CLI_HIDE_ACCOUNT_INFO=1
export TERM=xterm-256color
export COLORTERM=truecolor
ENV
chown -R you:you $G /home/you/.agy-env
