"""Reads export/step/cubesat_assembly.step back and checks it against the GLB it was built with.
Adds a `step_roundtrip` block to export/validation.json."""
import json
import os

import numpy as np
from build123d import Solid, import_step

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "export")
path = os.path.join(OUT, "step", "cubesat_assembly.step")


def count(node):
    if isinstance(node, Solid):
        return 1
    kids = list(node.children)
    return sum(count(k) for k in kids) if kids else len(list(node.solids()))


root = import_step(path)
groups = {}
for g in root.children:
    bb = g.bounding_box()
    groups[g.label] = dict(solids=count(g), volume_mm3=round(sum(s.volume for s in g.solids()), 1),
                           min=[round(bb.min.X, 1), round(bb.min.Y, 1), round(bb.min.Z, 1)],
                           max=[round(bb.max.X, 1), round(bb.max.Y, 1), round(bb.max.Z, 1)])
bb = root.bounding_box()
manifest = json.load(open(os.path.join(OUT, "cubesat.manifest.json")))
glb_groups = sorted(manifest["groups"])
res = dict(
    file_mb=round(os.path.getsize(path) / 1e6, 1),
    groups=groups, total_solids=sum(g["solids"] for g in groups.values()),
    bounds_mm=dict(min=[round(bb.min.X, 1), round(bb.min.Y, 1), round(bb.min.Z, 1)], max=[round(bb.max.X, 1), round(bb.max.Y, 1), round(bb.max.Z, 1)]),
    groups_missing_from_step=[g for g in glb_groups if g not in groups and g != "antenna_tape"],
    note="antenna_tape (stowed coil and deployed blade) is in the STEP only; the web model builds it live from the manifest",
)
v = json.load(open(os.path.join(OUT, "validation.json")))
expected = v["group_bounds_mm"]
worst = 0.0
off = {}
for g, d in groups.items():
    if g not in expected:
        continue
    dev = max(np.abs(np.array(d["min"]) - np.array(expected[g]["min"])).max(), np.abs(np.array(d["max"]) - np.array(expected[g]["max"])).max())
    worst = max(worst, dev)
    if dev > 0.15:
        off[g] = round(float(dev), 2)
res["max_group_bounds_deviation_from_glb_mm"] = round(float(worst), 3)
res["groups_off_by_more_than_0p15_mm"] = off
v["step_roundtrip"] = res
json.dump(v, open(os.path.join(OUT, "validation.json"), "w"), indent=1)
print(json.dumps({k: res[k] for k in ("file_mb", "total_solids", "bounds_mm", "groups_missing_from_step", "max_group_bounds_deviation_from_glb_mm", "groups_off_by_more_than_0p15_mm")}, indent=1))
print({g: (d["solids"], d["volume_mm3"]) for g, d in groups.items()})
