"""Tape-spring antenna: stowed coil -> straight blade, in the plane of the cassette.

Every number here is an ASSUMPTION chosen for a legible, mechanically plausible depiction. The source
files contain no antenna geometry; the case study only says "steel tape antenna" and "burn-wire mechanism".
This file is mirrored by lib/three/cubesat.ts (same algorithm; the manifest carries reference values that
the web code is checked against).

Cassette frame: origin on the top plate's outer face at the cassette centre, +Z out of the plate (the
deployment direction), the reel axis along Y. All lengths mm.
"""
import math

import numpy as np

PARAMS = dict(
    width=8.0,              # tape width, along Y
    thickness=0.4,
    sagitta=1.4,            # transverse curvature of the straight (deployed) tape
    length=190.0,           # total tape length
    core_radius=3.0,
    pitch=0.75,             # radial gain per turn: thickness plus a little air
    hub=(-4.0, 10.5),        # reel centre (x, z)
    exit_x=4.0,             # the straight tape leaves the cassette at this x
    top_z=20.5,             # outer face of the cassette's top cap
    stowed_stub=6.0,        # tape standing out of the cap while stowed
    deployed_extension=150.0,
)


def _bezier(p0, p1, p2, p3, n=24):
    t = np.linspace(0, 1, n)[:, None]
    return ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3


def _arc_length(pts):
    return float(np.linalg.norm(np.diff(pts, axis=0), axis=1).sum())


def solve(e, P=PARAMS):
    """Outer coil radius for extension e (mm above the cap), plus the pieces of the centreline."""
    cx, cz = P["hub"]
    dx = P["exit_x"] - cx
    k = 0.5523 * dx

    def pieces(r):
        za = cz - r + dx
        a = np.array([P["exit_x"], za]); b = np.array([cx, cz - r])
        bez = _bezier(a, a + [0, -k], b + [k, 0], b)
        l1 = P["top_z"] + e - za
        l2 = _arc_length(bez)
        lsp = math.pi * (r * r - P["core_radius"] ** 2) / P["pitch"]
        return za, bez, l1, l2, lsp

    lo, hi = P["core_radius"] + 1e-6, dx + 1.0
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        _, _, l1, l2, lsp = pieces(mid)
        if l1 + l2 + lsp > P["length"]:
            hi = mid
        else:
            lo = mid
    r = 0.5 * (lo + hi)
    return r, pieces(r)


def centreline(e, P=PARAMS, step=0.5):
    """Polyline (x, z) from the free tip back to the hub, plus the arc length at which the straight part ends."""
    r, (za, bez, l1, l2, lsp) = solve(e, P)
    cx, cz = P["hub"]
    tip = np.array([P["exit_x"], P["top_z"] + e])
    a = np.array([P["exit_x"], za])
    nstraight = max(2, int(l1 / step))
    straight = np.linspace(tip, a, nstraight)
    # spiral from B, clockwise, radius shrinking to the core
    phi_end = 2 * math.pi * (r - P["core_radius"]) / P["pitch"]
    n = max(8, int(lsp / step))
    phi = np.linspace(0, phi_end, n)
    rad = r - P["pitch"] * phi / (2 * math.pi)
    th = -math.pi / 2 - phi
    spiral = np.stack([cx + rad * np.cos(th), cz + rad * np.sin(th)], axis=1)
    pts = np.concatenate([straight, bez[1:], spiral[1:]])
    return pts, dict(coil_radius=r, straight_length=l1, bend_length=l2, spiral_length=lsp, spiral_turns=phi_end / (2 * math.pi))


def reference_values(P=PARAMS):
    out = {}
    for name, e in (("stowed", P["stowed_stub"]), ("half", 0.5 * P["deployed_extension"]), ("deployed", P["deployed_extension"])):
        pts, info = centreline(e, P)
        out[name] = dict(extension=e, **{k: round(v, 4) for k, v in info.items()},
                         total_length=round(_arc_length(pts), 3))
    return out


if __name__ == "__main__":
    import json
    print(json.dumps(reference_values(), indent=1))
