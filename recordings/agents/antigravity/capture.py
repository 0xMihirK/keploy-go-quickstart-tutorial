#!/usr/bin/env python3
"""Run as user `you` inside the container. Starts agy in a 92x28 tmux pane, types the
prompt, samples the screen every ~120 ms and writes frames JSON (arg 1, default /tmp/frames.json)."""
import json, os, re, subprocess, sys, time

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/frames.json"
COLS, ROWS = int(os.environ.get("COLS", 92)), int(os.environ.get("ROWS", 28))
PROMPT = "generate Keploy API tests for this service."
DONE = "The report is in your Keploy account."
HOME = "/home/you"
CWD = HOME + "/samples-go/gin-mongo"


def tmux(*a):
    return subprocess.run(["tmux", "-f", HOME + "/.cap-tmux.conf", *a],
                          capture_output=True, text=True).stdout


def grab():
    return tmux("capture-pane", "-p", "-e", "-t", "cap")


# model stand-in
if subprocess.run(["sh", "-c", "curl -s -o /dev/null http://127.0.0.1:4020/"]).returncode != 0:
    subprocess.Popen(["python3", "/opt/standin/model_server.py", "4020"], start_new_session=True,
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)

open(HOME + "/.cap-tmux.conf", "w").write(
    'set -g status off\nset -g mouse on\nset -g focus-events on\nset -g default-terminal "xterm-256color"\nset -g history-limit 0\n')
tmux("kill-server")
time.sleep(0.3)
tmux("new-session", "-d", "-s", "cap", "-x", str(COLS), "-y", str(ROWS), "-c", CWD,
     "bash -c 'source ~/.agy-env; cd %s; exec ~/.local/bin/agy'" % CWD)

frames, t0 = [], time.time()


def sample():
    s = grab()
    if not frames or frames[-1][1] != s:
        frames.append((time.time() - t0, s))
    return s


# wait for the start screen to settle (no change for 2 s)
last_change = time.time()
while time.time() - t0 < 30:
    n = len(frames)
    sample()
    if len(frames) != n:
        last_change = time.time()
    if len(frames) > 1 and time.time() - last_change > 2:
        break
    time.sleep(0.12)

for ch in PROMPT:
    tmux("send-keys", "-t", "cap", "-l", ch)
    time.sleep(0.045)
    sample()
time.sleep(0.4)
sample()
tmux("send-keys", "-t", "cap", "Enter")

done_at = None
while time.time() - t0 < 120:
    s = sample()
    if done_at is None and DONE in " ".join(re.sub(r"\x1b\[[0-9;:]*m", "", s).split()):
        done_at = time.time()
    if done_at and time.time() - done_at > 3:
        break
    time.sleep(0.12)

sgr = re.compile(r"\x1b\[[0-9;:]*m")
other = re.compile(r"\x1b(\[[0-9;?:<>=]*[@-~]|\][^\x07\x1b]*(\x07|\x1b\\)|[()][0-9A-Za-z]|[=>78DEHMc])")
out, prev_t = [], 0.0
for t, s in frames:
    lines = s.split("\n")
    if lines and lines[-1] == "":
        lines.pop()
    clean = []
    for ln in lines[:ROWS]:
        keep = []
        pos = 0
        for m in other.finditer(ln):
            seg = ln[pos:m.start()]
            keep.append(seg)
            if sgr.fullmatch(m.group(0)):
                keep.append(m.group(0))
            pos = m.end()
        keep.append(ln[pos:])
        clean.append("".join(keep))
    clean += [""] * (ROWS - len(clean))
    if out and out[-1]["lines"] == clean:
        continue  # identical after cleaning; its time rolls into the next kept frame
    out.append({"d": min(1500, int(round((t - prev_t) * 1000))), "lines": clean})
    prev_t = t
json.dump({"cols": COLS, "rows": ROWS, "frames": out}, open(OUT, "w"), ensure_ascii=False)
print("frames", len(out), "total_ms", sum(f["d"] for f in out), "done", done_at is not None)
