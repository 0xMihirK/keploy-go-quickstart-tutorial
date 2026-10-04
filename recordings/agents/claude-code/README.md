# Claude Code capture

Output: `public/runs/agent-claude-code.json` (92x28, 109 frames, ~14 s, ANSI SGR kept, truecolor).

- CLI: Claude Code 2.1.289 (`npm i -g @anthropic-ai/claude-code`, command `claude`), unmodified.
- Container: `cap-claude-code` (node:22-bookworm, hostname `dev`, user `you`), cwd `/home/you/samples-go/gin-mongo` from https://github.com/keploy/samples-go.

## Real
- The `claude` binary and everything it draws: logo animation, header, input box, spinner, tool-call rows, footer.
- The built-in Read tool reading the real `main.go`.
- MCP wiring: a stdio server registered as `keploy` in `~/.claude.json`, so the UI shows "Calling keploy… / Called keploy" exactly as for any MCP server.

## Scripted
- `model_server.py`: local Anthropic Messages API stand-in on 127.0.0.1:4000 (`ANTHROPIC_BASE_URL`, dummy `ANTHROPIC_API_KEY`). Streams a fixed six-step conversation: get_auth_status, Read main.go, search_tools, invoke_tool generate_and_wait, invoke_tool run_and_report, final text. Each tool step is preceded by one short sentence. Side requests (title generation on haiku) get a short valid reply.
- `keploy_mcp.py`: stand-in for Keploy's tool-search MCP (get_auth_status, search_tools, get_tool_schema, invoke_tool) returning fixed strings.
- No sign-in, no real account, no network calls to Anthropic or Keploy.

## Config that keeps the screen clean (`setup.sh`)
- `~/.claude.json`: onboarding done, theme dark, dummy key suffix in `customApiKeyResponses.approved`, trust accepted for the gin-mongo dir and the git root, `hasSeenAutoDefaultNotice` (hides the "Auto mode is now Claude Code's default permission mode" box).
- `~/.claude/settings.json`: `permissions.allow` = `mcp__keploy__*`, `Read`.
- Env: `CLAUDE_CODE_TMUX_TRUECOLOR=1` (otherwise Claude Code clamps to 256 colours inside tmux), telemetry/autoupdate off.
- tmux: `status off`, `mouse on`, `focus-events on` (the last two suppress Claude Code's tmux hints).

## Display note
Version 2.1.289 condenses tool calls by default: MCP calls render as "Called keploy" and reads as "Read 1 file" (ctrl+o expands). The capture keeps that default.

## Re-run
```
docker run -d --name cap-claude-code --hostname dev node:22-bookworm sleep infinity
docker exec cap-claude-code mkdir -p /opt/standin
docker cp <this dir>/. cap-claude-code:/opt/standin/
docker exec cap-claude-code bash /opt/standin/setup.sh
docker exec cap-claude-code su you -c 'python3 /opt/standin/capture.py /tmp/frames.json'
docker cp cap-claude-code:/tmp/frames.json public/runs/agent-claude-code.json
docker exec cap-claude-code python3 /opt/standin/show.py /tmp/frames.json 0 -1   # ANSI-stripped preview
```
From Git Bash, prefix `docker exec`/`docker cp` with `MSYS_NO_PATHCONV=1`. `setup.sh` rewrites `~/.claude.json` each run so start-up state is identical; the capture script starts the model stand-in if port 4000 is free.
