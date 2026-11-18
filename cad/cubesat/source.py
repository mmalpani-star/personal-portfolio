"""Original CubeSat electronics, read from the Creo -> STEP export of the flex-PCB assembly.

`3d models/cubesat/madhav/ffpcb.stp` (29.8 MB) is the only readable export of the Creo assembly
`fpcb_asm_1.asm`. Its 23 top-level children are the electronics and battery hardware; the lattice
frame, lid and holders (`frame`, `top`, `bottomxx`, `hol2`, `holdb1`) exist only as Creo binaries.
"""
import os

import numpy as np
import trimesh

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC_DIR = os.path.join(ROOT, "3d models", "cubesat")
STEP_PATH = os.path.join(SRC_DIR, "madhav", "ffpcb.stp")

_cache = {}


def top_children():
    """[(index, label, build123d shape)] for every direct child of the STEP's root assembly."""
    if "children" not in _cache:
        from build123d import import_step
        root = import_step(STEP_PATH)
        _cache["root"] = root
        _cache["children"] = [(i, c.label or "", c) for i, c in enumerate(root.children)]
    return _cache["children"]


def solids_of(shape):
    from build123d import Solid
    if isinstance(shape, Solid):
        return [shape]
    kids = list(shape.children) if hasattr(shape, "children") else []
    if not kids:
        return list(shape.solids())          # boolean results carry no assembly children
    out = []
    for c in kids:
        out += solids_of(c)
    return out


def tessellate(shape, tol=0.05, ang=0.3):
    """One trimesh per solid, in the STEP's own (assembly) coordinates, millimetres."""
    meshes = []
    for s in solids_of(shape):
        v, f = s.tessellate(tol, ang)
        if len(f) == 0:
            continue
        V = np.array([[p.X, p.Y, p.Z] for p in v], dtype=np.float64)
        m = trimesh.Trimesh(V, np.array(f, dtype=np.int64), process=False)
        m.metadata["label"] = s.label or ""
        meshes.append(m)
    return meshes


def merged(meshes):
    return trimesh.util.concatenate(meshes) if len(meshes) > 1 else meshes[0]


def pca_frame(mesh):
    """Right-handed frame (rows = x, y, z axes) with x along the longest extent, z along the shortest."""
    pts = mesh.vertices
    c = pts.mean(0)
    w, v = np.linalg.eigh(np.cov((pts - c).T))
    axes = v[:, ::-1].T            # largest variance first
    if np.linalg.det(axes) < 0:
        axes[2] *= -1
    return c, axes
