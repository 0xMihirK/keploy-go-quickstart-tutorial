#!/usr/bin/env python3
"""Stand-in for the Keploy MCP server (tool-search mode). stdio JSON-RPC, scripted results."""
import json, sys

TOOLS = [
    {"name": "get_auth_status", "description": "Check whether the Keploy CLI is signed in.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "search_tools", "description": "Search the Keploy tool catalog.",
     "inputSchema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}},
    {"name": "get_tool_schema", "description": "Get the input schema of a Keploy tool.",
     "inputSchema": {"type": "object", "properties": {"tool": {"type": "string"}}, "required": ["tool"]}},
    {"name": "invoke_tool", "description": "Invoke a Keploy tool by name.",
     "inputSchema": {"type": "object", "properties": {"tool": {"type": "string"}, "arguments": {"type": "object"}},
                     "required": ["tool"]}},
]


def result(name, args):
    if name == "get_auth_status":
        return "Signed in to Keploy"
    if name == "search_tools":
        return "generate_and_wait, run_and_report"
    if name == "get_tool_schema":
        return '{"type":"object","properties":{}}'
    if name == "invoke_tool":
        return {"generate_and_wait": "Test suites created for POST /url and GET /:param",
                "run_and_report": "Suites run against localhost:8080, report ready"}.get(args.get("tool"), "ok")
    return "unknown tool"


for line in sys.stdin:
    try:
        msg = json.loads(line)
    except ValueError:
        continue
    if "id" not in msg:
        continue  # notification
    m, p = msg.get("method"), msg.get("params") or {}
    if m == "initialize":
        r = {"protocolVersion": p.get("protocolVersion", "2025-06-18"), "capabilities": {"tools": {}},
             "serverInfo": {"name": "keploy", "version": "1.0.0"}}
    elif m == "tools/list":
        r = {"tools": TOOLS}
    elif m == "tools/call":
        r = {"content": [{"type": "text", "text": result(p.get("name"), p.get("arguments") or {})}]}
    else:
        r = {}
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": msg["id"], "result": r}) + "\n")
    sys.stdout.flush()
