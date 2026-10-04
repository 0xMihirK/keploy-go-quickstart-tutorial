# OpenCode capture (agent-opencode.json)

Output: `public/runs/agent-opencode.json`, a 92x28 frame recording (`{"cols","rows","frames":[{"d","lines"}]}`) with ANSI SGR colour codes kept. It has 142 frames and runs about 19 s.

## CLI
- OpenCode 1.18.34 (`npm i -g opencode-ai`), started as `opencode` from `/home/you/samples-go/gin-mongo`.
- Container `cap-opencode` (image `node:22-bookworm`, hostname `dev`, user `you`). tmux runs at 92x28 with `TERM=xterm-256color` and `COLORTERM=truecolor`.

## What is real
- The OpenCode TUI: logo, input box, agent/model line, MCP status, tool-call rendering, spinner, token counter and footer.
- The working directory: a clone of `keploy/samples-go`, directory `gin-mongo`.
- The `read` tool call on `main.go` is OpenCode's own tool reading the real file.
- MCP wiring: OpenCode starts the `keploy` MCP server over stdio and lists its tools as `keploy_*`.

## What is scripted
- `model_server.py` is an OpenAI-compatible `/v1/chat/completions` SSE server on 127.0.0.1:4010. It picks the reply by counting the `tool` messages in the request: text + `get_auth_status`, `read main.go`, `search_tools {query: "generate tests"}`, `invoke_tool {tool: generate_and_wait}`, `invoke_tool {tool: run_and_report}`, then the final text. A request with no tools (the title generator) gets a short title.
- `mcp_keploy.py` is a stdio MCP server named `keploy` with the tool-search meta-tools `get_auth_status`, `search_tools`, `get_tool_schema` and `invoke_tool`. Each one returns a fixed string.
- No sign-in, no real Keploy account and no real model provider are used. The provider is a custom one named `Local` with the model `local-model`.

## Files
- `opencode.json`: goes to `/home/you/.config/opencode/opencode.json`. It sets the custom provider (`@ai-sdk/openai-compatible`), the default and small model, the `mcp.keploy` stdio server, `autoupdate: false` and tool permissions set to allow.
- `model_server.py`, `mcp_keploy.py`, `capture.py`: go to `/opt/standin/`.
- `capture.py` wipes the OpenCode session database, so the home screen looks like a first launch. Once sessions exist, OpenCode adds a "Tip" line under the input. The script then starts tmux, waits until the home screen has been stable for 2 s, types the prompt one character every 45 ms and presses Enter. It samples `tmux capture-pane -p -e` about every 120 ms, drops identical frames, caps `d` at 1500 ms, strips non-SGR escapes and stops 3 s after the final reply appears.

## Re-run
```sh
docker run -d --name cap-opencode --hostname dev node:22-bookworm sleep infinity
docker exec cap-opencode bash -c "apt-get update && apt-get install -y tmux && useradd -m -s /bin/bash you && npm i -g opencode-ai && su you -c 'git clone https://github.com/keploy/samples-go.git ~/samples-go' && mkdir -p /opt/standin /home/you/.config/opencode"
docker cp opencode.json cap-opencode:/home/you/.config/opencode/opencode.json
docker cp model_server.py cap-opencode:/opt/standin/
docker cp mcp_keploy.py cap-opencode:/opt/standin/
docker cp capture.py cap-opencode:/opt/standin/
docker exec cap-opencode chown -R you:you /home/you/.config
docker exec -d -u you cap-opencode python3 /opt/standin/model_server.py
docker exec -u you -e HOME=/home/you cap-opencode python3 /opt/standin/capture.py /tmp/agent-opencode.json
docker cp cap-opencode:/tmp/agent-opencode.json ../../../public/runs/agent-opencode.json
```
On Git Bash for Windows, prefix `docker exec` commands that contain unix paths with `MSYS_NO_PATHCONV=1`. The first launch downloads `@ai-sdk/openai-compatible` and the models.dev catalog, so it needs network access. Run a warm-up launch once before capturing.
