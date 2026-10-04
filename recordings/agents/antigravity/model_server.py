#!/usr/bin/env python3
"""Stand-in Gemini API (streamGenerateContent?alt=sse) that drives one scripted agy conversation.

agy is pointed here with GOOGLE_GEMINI_BASE_URL + a dummy GEMINI_API_KEY. Main-loop requests
(those carrying tool declarations) get the next scripted step, picked by counting the
functionCall parts already in the history. Requests without tools (title generator) get a title.
"""
import json, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAIN_GO = "/home/you/samples-go/gin-mongo/main.go"


def mcp(tool, args, summary, action):
    return "call_mcp_tool", {"ServerName": "keploy", "ToolName": tool, "Arguments": args,
                             "toolSummary": summary, "toolAction": action}


STEPS = [
    ("I'll check the Keploy connection first.",
     mcp("get_auth_status", {}, "Keploy auth status", "Checking Keploy sign-in")),
    ("Signed in. Let me look at the service's routes.",
     ("view_file", {"AbsolutePath": MAIN_GO, "toolSummary": "Service routes", "toolAction": "Reading main.go"})),
    ("Two routes: POST /url and GET /:param. Finding Keploy's test tools.",
     mcp("search_tools", {"query": "generate tests"}, "Keploy tool search", "Searching Keploy tools")),
    ("Generating test suites for both endpoints.",
     mcp("invoke_tool", {"tool": "generate_and_wait"}, "Test generation", "Generating test suites")),
    ("Running the suites against the app.",
     mcp("invoke_tool", {"tool": "run_and_report"}, "Test run and report", "Running test suites")),
    ("Keploy generated test suites for both endpoints and ran them against the app. "
     "The report is in your Keploy account.", None),
]
LOG = open("/tmp/model.log", "a")


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def do_GET(self):
        LOG.write("GET %s\n" % self.path)
        LOG.flush()
        b = json.dumps({"models": []}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))) or b"{}")
        contents = body.get("contents", [])
        has_tools = bool(body.get("tools"))
        n = sum(1 for c in contents if c.get("role") == "model" for p in c.get("parts", []) if "functionCall" in p)
        LOG.write("POST %s tools=%s contents=%d calls=%d\n" % (self.path, has_tools, len(contents), n))
        LOG.flush()
        if has_tools:
            text, call = STEPS[min(n, len(STEPS) - 1)]
            time.sleep(0.8)  # "thinking" pause so each step is visible
        else:
            text, call = "Generate Keploy API Tests", None
        usage = {"promptTokenCount": 12000 + 400 * len(contents), "candidatesTokenCount": 40,
                 "totalTokenCount": 12040 + 400 * len(contents)}
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.send_header("cache-control", "no-cache")
        self.send_header("connection", "close")
        self.end_headers()

        def send(parts, finish=None):
            cand = {"content": {"role": "model", "parts": parts}, "index": 0}
            if finish:
                cand["finishReason"] = finish
            obj = {"candidates": [cand], "modelVersion": "gemini-3.1-pro-preview"}
            if finish:
                obj["usageMetadata"] = usage
            self.wfile.write(b"data: " + json.dumps(obj).encode() + b"\r\n\r\n")
            self.wfile.flush()

        words = text.split(" ")
        for j in range(0, len(words), 3):
            send([{"text": " ".join(words[j:j + 3]) + (" " if j + 3 < len(words) else "")}])
            if has_tools:
                time.sleep(0.05)
        if call:
            time.sleep(0.3)
            send([{"functionCall": {"name": call[0], "args": call[1]}}], "STOP")
        else:
            send([{"text": ""}], "STOP")
        self.close_connection = True


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 4020), H).serve_forever()
