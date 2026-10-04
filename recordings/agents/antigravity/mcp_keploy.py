#!/usr/bin/env python3
"""Stand-in for the Keploy MCP server (tool-search mode). stdio JSON-RPC, no deps."""
import json, sys

TOOLS = [
    {"name": "get_auth_status", "description": "Report whether Keploy is signed in.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "search_tools", "description": "Search the Keploy tool catalog by free-text query.",
     "inputSchema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}},
    {"name": "get_tool_schema", "description": "Return the input schema of a Keploy tool.",
     "inputSchema": {"type": "object", "properties": {"tool": {"type": "string"}}, "required": ["tool"]}},
    {"name": "invoke_tool", "description": "Invoke a Keploy tool by name with arguments.",
     "inputSchema": {"type": "object", "properties": {"tool": {"type": "string"}, "arguments": {"type": "object"}},
                     "required": ["tool"]}},
]


def call(name, args):
    if name == "get_auth_status":
        return "Signed in to Keploy"
    if name == "search_tools":
        return "generate_and_wait, run_and_report"
    if name == "get_tool_schema":
        return json.dumps({"type": "object", "properties": {}})
    if name == "invoke_tool":
        return {"generate_and_wait": "Test suites created for POST /url and GET /:param",
                "run_and_report": "Suites run against localhost:8080, report ready"}.get(args.get("tool"), "ok")
    return "unknown tool"


for line in sys.stdin:
    try:
        msg = json.loads(line)
    except ValueError:
        continue
    mid, method, p = msg.get("id"), msg.get("method"), msg.get("params") or {}
    if mid is None:
        continue  # notification
    if method == "initialize":
        res = {"protocolVersion": p.get("protocolVersion", "2025-06-18"),
               "capabilities": {"tools": {"listChanged": False}},
               "serverInfo": {"name": "keploy", "version": "1.0.0"}}
    elif method == "tools/list":
        res = {"tools": TOOLS}
    elif method == "tools/call":
        res = {"content": [{"type": "text", "text": call(p.get("name"), p.get("arguments") or {})}], "isError": False}
    elif method == "prompts/list":
        res = {"prompts": []}
    elif method == "resources/list":
        res = {"resources": []}
    else:
        res = {}
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": mid, "result": res}) + "\n")
    sys.stdout.flush()
