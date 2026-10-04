# Antigravity CLI capture (agent-antigravity.json)

Output: `public/runs/agent-antigravity.json` (92x28, 100 frames, about 12 s, ANSI SGR kept, truecolor).

- CLI: Antigravity CLI 1.2.16 (`agy`), installed with Google's official installer `curl -fsSL https://antigravity.google/cli/install.sh | bash` (binary at `~/.local/bin/agy`). The binary is not modified.
- Container: `cap-antigravity` (node:22-bookworm, hostname `dev`, user `you`), cwd `/home/you/samples-go/gin-mongo` from https://github.com/keploy/samples-go.

## Real
- The `agy` binary and everything it draws: the gradient logo, the header (version, model, cwd), the input box, the "Generating..." / "Calling MCP tool..." / "Reading file..." spinners, tool-call rows and the footer.
- The built-in `view_file` tool reading the real `main.go`. It renders as `Read(~/samples-go/gin-mongo/main.go)`.
- MCP wiring: a stdio server named `keploy` in `~/.gemini/config/mcp_config.json`. That is the user-level file `agy mcp add` writes and the file agy reads. agy lists the server's tools as lazy MCP tools. The model calls them through agy's `call_mcp_tool`, and the UI shows `keploy/<tool>(<summary>)`.

## Scripted
- `model_server.py`: a local Gemini API stand-in on 127.0.0.1:4020. agy uses API-key mode: `modelProvider: "gemini"` in settings, `GEMINI_API_KEY` set to a dummy value, and `GOOGLE_GEMINI_BASE_URL` pointing at the stand-in. agy calls `POST /v1beta/models/<model>:streamGenerateContent?alt=sse` with the google-genai Go SDK. The stand-in streams `data:` SSE chunks with text parts and then one `functionCall` part. It picks the step by counting the `functionCall` parts already in `contents`. The steps are get_auth_status, view_file main.go, search_tools {query: "generate tests"}, invoke_tool generate_and_wait, invoke_tool run_and_report, then the final text. One short sentence comes before each tool step, as in the Claude Code capture. Requests without tools (the title generator, on the flash-lite model) get a short title.
- `mcp_keploy.py`: the same Keploy tool-search MCP stand-in as the OpenCode capture (get_auth_status, search_tools, get_tool_schema, invoke_tool), returning fixed strings.
- No Google sign-in, no real Gemini key, no real Keploy account, and no network calls to Google model endpoints.

## Config that keeps the screen clean (`setup.sh`)
- `~/.gemini/antigravity-cli/settings.json`: `modelProvider: gemini` (API-key mode, no sign-in), `trustedWorkspaces` (skips the "Do you trust this folder" screen), `permissions.allow` with `mcp(keploy/<tool>)` for each tool (the format agy itself writes when you persist an approval; without it every MCP call stops at an "Allow calling this tool?" prompt), `enableTelemetry: false`, `showTips: false`, `showFeedbackSurvey: false`.
- `~/.gemini/antigravity-cli/cache/onboarding.json`: `onboardingComplete` skips the first-run colour-scheme and terms screens.
- Env (`~/.agy-env`): `AGY_CLI_HIDE_ACCOUNT_INFO=1` removes the "Gemini API key" line under the logo, and `AGY_CLI_DISABLE_AUTO_UPDATE=1` turns off auto-update.
- agy rewrites `settings.json` when it exits, so `setup.sh` stops any running agy before it writes the config. `setup.sh` also clears the conversation store, so every capture starts from the same screen.

## Re-run
```
docker run -d --name cap-antigravity --hostname dev node:22-bookworm sleep infinity
docker exec cap-antigravity mkdir -p /opt/standin
docker cp <this dir>/. cap-antigravity:/opt/standin/
docker exec cap-antigravity bash /opt/standin/setup.sh
docker exec -u you -e HOME=/home/you cap-antigravity python3 /opt/standin/capture.py /tmp/frames.json
docker cp cap-antigravity:/tmp/frames.json public/runs/agent-antigravity.json
docker exec cap-antigravity python3 /opt/standin/show.py /tmp/frames.json 1 -1   # ANSI-stripped preview
```
From Git Bash, prefix `docker exec`/`docker cp` with `MSYS_NO_PATHCONV=1`. `capture.py` starts the model stand-in if port 4020 is free. It waits 2 s for the start screen to settle, types the prompt at 45 ms per character, samples `tmux capture-pane -p -e` every ~120 ms, drops identical frames, caps `d` at 1500 ms and stops 3 s after the final reply.
