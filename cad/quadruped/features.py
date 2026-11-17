"""
Measure the mechanical interfaces of the supplied quadruped STLs.

    python cad/quadruped/features.py            # from the repository root

For every part, slices are taken every 0.5 mm along each mesh axis. Interior
loops that are circles (isoperimetric ratio > 0.97) are collected and grouped
into hole axes: the same centre line on consecutive slices. Each hole is
reported with its axis direction, centre, diameter and the span it runs
through. The result is written to export/features.json and drives the
assembly in assembly.py, so every joint position traces back to a hole.
"""
import json
import os
from collections import defaultdict

import numpy as np
import shapely.geometry as sg
import trimesh

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "3d models", "quadruped")
PARTS = {
    "body_u": "body_u_PCBWay Community.stl",
    "body_d": "body_d_PCBWay Community.stl",
    "coxa_l": "coxa_l_PCBWay Community.stl",
    "coxa_r": "coxa_r_PCBWay Community.stl",
    "femur": "femur_1_PCBWay Community.stl",
    "tibia_l": "tibia_l_PCBWay Community.stl",
    "tibia_r": "tibia_r_PCBWay Community.stl",
    "s_hold": "s_hold_PCBWay Community.stl",
}


def load(name):
    return trimesh.load(os.path.join(SRC, PARTS[name]), force="mesh")


def circles(mesh, axis, step=0.5):
    """Yield (offset, centre_2d_in_mesh_coords, diameter) for circular holes."""
    lo, hi = mesh.bounds[0][axis], mesh.bounds[1][axis]
    n = np.zeros(3); n[axis] = 1
    others = [i for i in range(3) if i != axis]
    for off in np.arange(lo + step / 2, hi, step):
        o = np.zeros(3); o[axis] = off
        try:
            s = mesh.section(plane_origin=o, plane_normal=n)
        except Exception:
            continue
        if s is None:
            continue
        for e in s.discrete:
            if len(e) < 8:
                continue
            pts = e[:, others]
            poly = sg.Polygon(pts)
            if not poly.is_valid or poly.area < 0.5:
                continue
            ratio = 4 * np.pi * poly.area / poly.length ** 2
            d = 2 * np.sqrt(poly.area / np.pi)
            if ratio > 0.97 and 1.0 < d < 12.0:
                c = np.array(poly.centroid.coords[0])
                yield off, c, d


def holes(mesh):
    """Group circle sections into hole axes."""
    out = []
    for axis in range(3):
        groups = defaultdict(list)
        for off, c, d in circles(mesh, axis):
            key = (round(c[0] * 2) / 2, round(c[1] * 2) / 2, round(d))
            groups[key].append((off, c, d))
        for key, items in groups.items():
            if len(items) < 2:       # a single slice is not a hole
                continue
            offs = np.array([i[0] for i in items])
            cs = np.array([i[1] for i in items])
            ds = np.array([i[2] for i in items])
            # loops on the outside of a boss also pass the circle test; keep
            # them but label: an interior loop has material around it, which
            # we cannot tell from the loop alone, so both are recorded.
            out.append(dict(axis="XYZ"[axis], centre=[round(float(x), 2) for x in cs.mean(0)],
                            diameter=round(float(ds.mean()), 2),
                            span=[round(float(offs.min()), 2), round(float(offs.max()), 2)],
                            slices=len(items)))
    out.sort(key=lambda h: (h["axis"], -h["diameter"]))
    return out


def main():
    report = {}
    for name in PARTS:
        m = load(name)
        report[name] = dict(
            bounds=[np.round(m.bounds[0], 2).tolist(), np.round(m.bounds[1], 2).tolist()],
            faces=int(len(m.faces)), watertight=bool(m.is_watertight),
            volume_cm3=round(float(abs(m.volume)) / 1000, 2),
            holes=holes(m),
        )
        print(f"\n== {name}  bounds {report[name]['bounds']}  faces {report[name]['faces']}  "
              f"watertight {report[name]['watertight']}")
        for h in report[name]["holes"]:
            print(f"   {h['axis']}  d={h['diameter']:5.2f}  centre={h['centre']}  span={h['span']}")
    os.makedirs(os.path.join(HERE, "export"), exist_ok=True)
    with open(os.path.join(HERE, "export", "features.json"), "w") as f:
        json.dump(report, f, indent=1)


if __name__ == "__main__":
    main()
