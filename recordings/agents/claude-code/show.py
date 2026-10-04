#!/usr/bin/env python3
"""Print frames of a frames JSON with ANSI stripped. usage: show.py file.json [idx ...] (negative ok)"""
import json, re, sys

d = json.load(open(sys.argv[1], encoding="utf-8"))
fr = d["frames"]
idx = [int(a) for a in sys.argv[2:]] or range(len(fr))
for i in idx:
    f = fr[i]
    print("=== frame %d/%d d=%d" % (i % len(fr), len(fr), f["d"]))
    for ln in f["lines"]:
        print("|" + re.sub(r"\x1b\[[0-9;:]*m", "", ln))
