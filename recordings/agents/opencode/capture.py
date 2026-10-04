#!/usr/bin/env python3
"""Run OpenCode in tmux (92x28), type the prompt, sample the pane every ~120 ms, write frames JSON.
Run as user "you" inside the cap-opencode container:  python3 /opt/standin/capture.py /tmp/agent-opencode.json
"""
import json, os, re, subprocess, sys, time

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/agent-opencode.json"
COLS, ROWS = int(os.environ.get("COLS", 92)), int(os.environ.get("ROWS", 28))
PROMPT = "generate Keploy API tests for this service."
DONE_MARK = "Keploy account."
NON_SGR = re.compile(r"\x1b(?:\[[0-9;:?<>=]*[A-Za-ln-z@`~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[()][A-Za-z0-9]|[=>78])")


def tmux(*a):
    return subprocess.run(["tmux", *a], capture_output=True, text=True).stdout


def grab():
    lines = NON_SGR.sub("", tmux("capture-pane", "-p", "-e", "-t", "cap")).split("\n")[:ROWS]
    return lines + [""] * (ROWS - len(lines))


tmux("kill-server")
time.sleep(0.3)
# fresh session store -> real first-launch home screen (OpenCode only shows the "Tip" line once sessions exist)
subprocess.run("rm -rf ~/.local/share/opencode/opencode.db* ~/.local/state/opencode/prompt-history.jsonl", shell=True)
subprocess.run(["tmux", "new-session", "-d", "-s", "cap", "-x", str(COLS), "-y", str(ROWS),
                "-e", "TERM=xterm-256color", "-e", "COLORTERM=truecolor",
                "cd /home/you/samples-go/gin-mongo && exec opencode"], check=True)

frames, last, last_t = [], None, None
start = time.monotonic()
typed = sent_enter = False
settled_at = done_at = None
typing = list(PROMPT)
next_key = 0.0

while time.monotonic() - start < 90:
    now = time.monotonic()
    lines = grab()
    if lines != last:
        d = 0 if last_t is None else min(1500, int((now - last_t) * 1000))
        frames.append({"d": d, "lines": lines})
        last, last_t = lines, now
        if not typed:
            settled_at = now
    # start typing once the start screen shows and has been stable ~2 s
    if not typed and any("Ask anything" in l for l in lines) and settled_at and now - settled_at > 2.0:
        typed = True
        next_key = now
    if typed and typing and now >= next_key:
        tmux("send-keys", "-t", "cap", "-l", typing.pop(0))
        next_key = now + 0.045
        time.sleep(0.045)
        continue
    if typed and not typing and not sent_enter:
        time.sleep(0.5)
        tmux("send-keys", "-t", "cap", "Enter")
        sent_enter = True
    plain = "\n".join(re.sub(r"\x1b\[[0-9;:]*m", "", l) for l in lines)
    if sent_enter and done_at is None and DONE_MARK in plain:
        done_at = now
    if done_at and now - done_at > 3.0:
        break
    time.sleep(0.12)

json.dump({"cols": COLS, "rows": ROWS, "frames": frames}, open(OUT, "w"), ensure_ascii=False)
print(len(frames), "frames,", sum(f["d"] for f in frames), "ms")
