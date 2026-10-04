#!/usr/bin/env python3
"""Stand-in Anthropic Messages API that drives one scripted conversation.

Main-loop requests (those carrying the mcp__keploy__* tools) get the next scripted
step, picked by counting tool_use blocks already in the history. Every other
request (title generation, quota probes, ...) gets a short valid text reply.
"""
import json, sys, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAIN_GO = "/home/you/samples-go/gin-mongo/main.go"
STEPS = [
    ("I'll check the Keploy connection first.", "mcp__keploy__get_auth_status", {}),
    ("Signed in. Let me look at the service's routes.", "Read", {"file_path": MAIN_GO}),
    ("Two routes: POST /url and GET /:param. Finding Keploy's test tools.",
     "mcp__keploy__search_tools", {"query": "generate tests"}),
    ("Generating test suites for both endpoints.", "mcp__keploy__invoke_tool", {"tool": "generate_and_wait"}),
    ("Running the suites against the app.", "mcp__keploy__invoke_tool", {"tool": "run_and_report"}),
    ("Keploy generated test suites for both endpoints and ran them against the app. "
     "The report is in your Keploy account.", None, None),
]
LOG = open("/tmp/model.log", "a")


def plan(body):
    tools = [t.get("name", "") for t in body.get("tools") or []]
    if not any(n.startswith("mcp__keploy__") for n in tools):
        sysp = json.dumps(body.get("system", "")).lower()
        if "title" in sysp:
            return '{"title": "Generate Keploy API tests"}', None, 0
        return "OK", None, 0
    n = sum(1 for m in body.get("messages", []) if m.get("role") == "assistant"
            for c in (m.get("content") if isinstance(m.get("content"), list) else [])
            if c.get("type") == "tool_use")
    text, tool, args = STEPS[min(n, len(STEPS) - 1)]
    return text, ((tool, args) if tool else None), 0.9


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        LOG.write("GET %s\n" % self.path)
        LOG.flush()
        self._json({"data": [], "has_more": False, "first_id": None, "last_id": None})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))) or b"{}")
        LOG.write("POST %s model=%s stream=%s tools=%d msgs=%d sys=%s\n" % (
            self.path, body.get("model"), body.get("stream"), len(body.get("tools") or []),
            len(body.get("messages") or []), json.dumps(body.get("system", ""))[:200]))
        LOG.flush()
        if "count_tokens" in self.path:
            return self._json({"input_tokens": 1200})
        text, tool, delay = plan(body)
        model = body.get("model", "claude")
        mid = "msg_" + uuid.uuid4().hex[:24]
        usage = {"input_tokens": 1200, "output_tokens": 40, "cache_creation_input_tokens": 0,
                 "cache_read_input_tokens": 0}
        blocks = [{"type": "text", "text": text}] if text else []
        if tool:
            blocks.append({"type": "tool_use", "id": "toolu_" + uuid.uuid4().hex[:24],
                           "name": tool[0], "input": tool[1]})
        stop = "tool_use" if tool else "end_turn"
        if not body.get("stream"):
            return self._json({"id": mid, "type": "message", "role": "assistant", "model": model,
                               "content": blocks, "stop_reason": stop, "stop_sequence": None, "usage": usage})
        time.sleep(delay)
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.send_header("cache-control", "no-cache")
        self.send_header("connection", "close")
        self.end_headers()

        def ev(name, data):
            self.wfile.write(("event: %s\ndata: %s\n\n" % (name, json.dumps(data))).encode())
            self.wfile.flush()

        ev("message_start", {"type": "message_start", "message": {
            "id": mid, "type": "message", "role": "assistant", "model": model, "content": [],
            "stop_reason": None, "stop_sequence": None, "usage": dict(usage, output_tokens=1)}})
        for i, b in enumerate(blocks):
            if b["type"] == "text":
                ev("content_block_start", {"type": "content_block_start", "index": i,
                                           "content_block": {"type": "text", "text": ""}})
                words = b["text"].split(" ")
                for j in range(0, len(words), 3):
                    chunk = " ".join(words[j:j + 3]) + (" " if j + 3 < len(words) else "")
                    ev("content_block_delta", {"type": "content_block_delta", "index": i,
                                               "delta": {"type": "text_delta", "text": chunk}})
                    if delay:
                        time.sleep(0.05)
            else:
                ev("content_block_start", {"type": "content_block_start", "index": i, "content_block": {
                    "type": "tool_use", "id": b["id"], "name": b["name"], "input": {}}})
                ev("content_block_delta", {"type": "content_block_delta", "index": i, "delta": {
                    "type": "input_json_delta", "partial_json": json.dumps(b["input"])}})
            ev("content_block_stop", {"type": "content_block_stop", "index": i})
        ev("message_delta", {"type": "message_delta", "delta": {"stop_reason": stop, "stop_sequence": None},
                             "usage": {"output_tokens": 40}})
        ev("message_stop", {"type": "message_stop"})
        self.close_connection = True


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 4000), H).serve_forever()
