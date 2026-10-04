#!/usr/bin/env python3
"""Stand-in OpenAI-compatible model server that drives one fixed conversation (SSE streaming)."""
import json, time, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LOG = open("/tmp/model_server.log", "a")
MAIN_GO = "/home/you/samples-go/gin-mongo/main.go"

# step = number of tool results already in the conversation
# (text streamed before the tool call, tool name suffix, tool args); last entry is final text only
SCRIPT = [
    ("I'll check the Keploy connection first.", "get_auth_status", {}),
    ("", "read", {"filePath": MAIN_GO}),
    ("", "search_tools", {"query": "generate tests"}),
    ("", "invoke_tool", {"tool": "generate_and_wait"}),
    ("", "invoke_tool", {"tool": "run_and_report"}),
    ("Keploy generated test suites for both endpoints and ran them against the app. "
     "The report is in your Keploy account.", None, None),
]


def chunk(delta, finish=None):
    return {"id": "chatcmpl-local", "object": "chat.completion.chunk", "created": int(time.time()),
            "model": "local-model", "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]}


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def reply_json(self, obj):
        body = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # /v1/models
        self.reply_json({"object": "list", "data": [{"id": "local-model", "object": "model", "owned_by": "local"}]})

    def do_POST(self):
        req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        tools = [t["function"]["name"] for t in req.get("tools") or []]
        msgs = req.get("messages", [])
        LOG.write(json.dumps({"path": self.path, "tools": tools, "roles": [m.get("role") for m in msgs],
                              "stream": req.get("stream")}) + "\n")
        LOG.flush()
        if not tools:  # title generation / other side request
            text, tool, args = "Generate Keploy API tests", None, None
        else:
            step = min(sum(1 for m in msgs if m.get("role") == "tool"), len(SCRIPT) - 1)
            text, suffix, args = SCRIPT[step]
            tool = None
            if suffix:
                tool = next((t for t in tools if t == suffix or t.endswith("_" + suffix)), suffix)
        usage = {"prompt_tokens": 9800 + 350 * len(msgs), "completion_tokens": 40,
                 "total_tokens": 9840 + 350 * len(msgs)}
        call = None
        if tool:
            call = {"id": "call_%d" % time.time_ns(), "type": "function",
                    "function": {"name": tool, "arguments": json.dumps(args)}}
        if not req.get("stream"):
            msg = {"role": "assistant", "content": text}
            if call:
                msg["tool_calls"] = [call]
            self.reply_json({"id": "chatcmpl-local", "object": "chat.completion", "model": "local-model",
                             "choices": [{"index": 0, "message": msg,
                                          "finish_reason": "tool_calls" if call else "stop"}], "usage": usage})
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()

        def send(obj):
            self.wfile.write(b"data: " + (obj if isinstance(obj, bytes) else json.dumps(obj).encode()) + b"\n\n")
            self.wfile.flush()

        if tools:
            time.sleep(0.7)  # "thinking" pause so each step is visible
        send(chunk({"role": "assistant", "content": ""}))
        if text:
            words = text.split(" ")
            for i, w in enumerate(words):
                send(chunk({"content": w + (" " if i < len(words) - 1 else "")}))
                time.sleep(0.04 if tools else 0)
        if call:
            time.sleep(0.3)
            send(chunk({"tool_calls": [dict(call, index=0)]}))
        send(chunk({}, "tool_calls" if call else "stop"))
        send({"id": "chatcmpl-local", "object": "chat.completion.chunk", "created": int(time.time()),
              "model": "local-model", "choices": [], "usage": usage})
        send(b"[DONE]")
        self.close_connection = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4010
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
