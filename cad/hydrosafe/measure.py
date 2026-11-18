"""
Identify the supplied HydroSafe files and recover where each part sits in the
Onshape assembly export.

    python cad/hydrosafe/measure.py            # from the repository root

Inputs (read only): 3d models/hydrosafe/*.stl
Outputs: export/measured.json (identification + poses), cache/pipe_elbow.stl

What it establishes
-------------------
* `lid + bottom.stl` is a whole-assembly export: 34 separate solids. Each one
  is matched to an individual file by registering that file onto it
  (principal axes + ICP). Fits with a point-to-surface residual of ~0 are
  exact copies; the residual is reported for every part.
* Parts that are repeated (20 springs, 4 collars, 4 discs, 4 elbows) are exact
  rigid copies of one another, so their relative poses are solved exactly
  from the triangles (Kabsch).
* The remaining files are classified: duplicates, scaled copies, alternates,
  or not readable.
"""
import collections
import hashlib
import itertools
import json
import os
import pickle
import struct

import numpy as np
import shapely.geometry as sg
import trimesh
import trimesh.graph as tg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "3d models", "hydrosafe")
OUT = os.path.join(HERE, "export")
CACHE = os.path.join(HERE, "cache")
os.makedirs(OUT, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)

FILES = dict(
    lid="lid.stl", tank="bottom face.stl", collar="pipe attachment.stl", disc="Part Studio 1.stl",
    pipe="pipe.stl", spring="Spring.stl", ps2="Part Studio 2.stl", ps3="Part Studio 3.stl",
    cylinder="hydro_cylinder.stl", bottom_pipe="bottom + pipe.stl",
)
COMBINED = "lid + bottom.stl"


def load(key_or_file, process=True):
    f = FILES.get(key_or_file, key_or_file)
    return trimesh.load(os.path.join(SRC, f), force="mesh", process=process)


def raw_triangles(fname):
    b = open(os.path.join(SRC, fname), "rb").read()
    n = struct.unpack("<I", b[80:84])[0]
    a = np.frombuffer(b[84:84 + 50 * n], dtype=np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")]))
    return a["v"].astype(np.float64)


def surface_residual(src, dst, T, n=6000):
    """Point-to-surface distance from `src` (moved by T) to `dst`: mean, p99, max (mm)."""
    p = trimesh.sample.sample_surface(src, n, seed=3)[0]
    p = (T[:3, :3] @ p.T).T + T[:3, 3]
    _, d, _ = trimesh.proximity.closest_point(dst, p)
    return [float(d.mean()), float(np.percentile(d, 99)), float(d.max())]


def _kd_score(src_pts, tree, T):
    p = (T[:3, :3] @ src_pts.T).T + T[:3, 3]
    return float(tree.query(p)[0].mean())


def cube_rotations():
    out = []
    for perm in itertools.permutations(range(3)):
        for s in itertools.product([1, -1], repeat=3):
            R = np.zeros((3, 3))
            for i, p in enumerate(perm):
                R[i, p] = s[i]
            if np.linalg.det(R) > 0:
                out.append(R)
    return out


def bbox_center(m):
    return (m.bounds[0] + m.bounds[1]) / 2


def register_axis_aligned(A, B):
    """Pose T (A -> B) when the two differ by a multiple-of-90-degree rotation and
    a translation. Tries the 24 cube rotations, then refines with ICP."""
    from scipy.spatial import cKDTree
    tree = cKDTree(trimesh.sample.sample_surface(B, 60000, seed=2)[0])
    pts = trimesh.sample.sample_surface(A, 3000, seed=1)[0]
    best = None
    for R in cube_rotations():
        T = np.eye(4)
        T[:3, :3] = R
        T[:3, 3] = bbox_center(B) - R @ bbox_center(A)
        sc = _kd_score(pts, tree, T)
        if best is None or sc < best[0]:
            best = (sc, T)
    T, _, _ = trimesh.registration.icp(trimesh.sample.sample_surface(A, 6000, seed=1)[0], B, initial=best[1],
                                       max_iterations=40, scale=False, threshold=1e-9)
    return T, surface_residual(A, B, T)


def kabsch(P, Q):
    pc, qc = P.mean(0), Q.mean(0)
    U, _, Vt = np.linalg.svd((P - pc).T @ (Q - qc))
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    R = Vt.T @ np.diag([1, 1, d]) @ U.T
    return R, qc - R @ pc


def circ_diameters(m, z):
    s = m.section(plane_origin=[0, 0, z], plane_normal=[0, 0, 1])
    out = []
    if s is not None:
        for e in s.discrete:
            p = sg.Polygon(e[:, :2])
            if p.area > 1:
                out.append(round(2 * np.sqrt(p.area / np.pi), 2))
    return sorted(set(out), reverse=True)


def main():
    rep = {"files": {}, "notes": {}}
    # ---------------------------------------------------------------- survey
    for f in sorted(os.listdir(SRC)):
        if not f.endswith(".stl") or f == COMBINED:
            continue
        m = load(f)
        rep["files"][f] = dict(
            faces=int(len(m.faces)), bodies=len(m.split(only_watertight=False)), watertight=bool(m.is_watertight),
            volume_cm3=round(abs(m.volume) / 1000, 2), extents_mm=np.round(m.extents, 2).tolist(),
            bounds_lo=np.round(m.bounds[0], 1).tolist(),
        )
    rep["files"][COMBINED] = dict(size_mb=round(os.path.getsize(os.path.join(SRC, COMBINED)) / 1e6, 1))

    # ----------------------------------------------- duplicates / scaled copies
    a, b = load("tank"), load("ps3")
    from scipy.spatial import cKDTree
    d, _ = cKDTree(a.vertices).query(b.vertices)
    rep["notes"]["part_studio_3_vs_bottom_face"] = dict(max_vertex_distance_mm=float(d.max()),
                                                       verdict="identical geometry" if d.max() < 1e-3 else "differs")
    lid, ps2 = load("lid"), load("ps2")
    rep["notes"]["part_studio_2_vs_lid"] = dict(
        plate_extent_ratio=[round(float(ps2.extents[0] / lid.extents[0]), 4), round(float(ps2.extents[1] / lid.extents[1]), 4)],
        hole_diameter_ratio=round(float(circ_diameters(ps2, 3)[-1] / 103.57), 4),
        verdict="a 0.35x scale model of the lid, not part of the assembly")
    cyl = load("cylinder")
    rep["notes"]["hydro_cylinder_vs_lid"] = dict(
        cylinder_seat_face_diameters=circ_diameters(cyl, 39.9), lid_seat_face_diameters=circ_diameters(lid, -39.9),
        verdict="same cylinder as the lid's five hanging cylinders (same seat-face diameters, 137.29 x 40 mm); "
                "a stand-alone export, non-watertight (22 shells), not used")
    xt = os.path.join(SRC, "Cyclone pipe adapter.STEP.x_t")
    head = open(xt, "rb").read(900).decode("latin1")
    rep["notes"]["cyclone_pipe_adapter_x_t"] = dict(
        format="Parasolid transmit (text) written by " + [l for l in head.splitlines() if l.startswith("APPL=")][0][5:],
        verdict="not readable here (no Parasolid kernel); not used; its size and fit are unverified")

    # ------------------------------------- split the whole-assembly export
    tri = raw_triangles(COMBINED)
    verts = tri.reshape(-1, 3)
    mm = trimesh.Trimesh(verts, np.arange(len(verts)).reshape(-1, 3), process=True)
    comps = tg.connected_components(mm.face_adjacency, nodes=np.arange(len(mm.faces)))
    groups = collections.defaultdict(list)
    for c in comps:
        groups[len(c)].append(np.sort(c))

    def body(c):
        t = tri[c].reshape(-1, 3)
        return trimesh.Trimesh(t, np.arange(len(t)).reshape(-1, 3), process=True)

    rep["combined"] = dict(triangles=int(len(tri)), solids=len(comps),
                           groups={str(k): len(v) for k, v in sorted(groups.items(), key=lambda kv: -len(kv[1]))})
    N = dict(spring=136304, collar=1768, pipe=10230, disc=112592, lid=21576, tank=12452)
    assert {k: len(groups[v]) for k, v in N.items()} == dict(spring=20, collar=4, pipe=4, disc=4, lid=1, tank=1), \
        "the export no longer contains the expected 20/4/4/4/1/1 solids"

    # ------------------------------------------- poses: individual file -> export
    poses, resid = {}, {}
    for key in ("lid", "tank"):
        T, r = register_axis_aligned(load(key), body(groups[N[key]][0]))
        poses[key] = [T.tolist()]; resid[key] = [r]
    for key in ("collar", "disc"):
        A = load(key); poses[key] = []; resid[key] = []
        for c in groups[N[key]]:
            T, r = register_axis_aligned(A, body(c)); poses[key].append(T.tolist()); resid[key].append(r)
    # springs and pipes: instance 0 against the file, the rest exactly from triangle order
    sp = load("spring"); B0 = body(groups[N["spring"]][0])
    T0, r0 = register_axis_aligned(sp, B0)
    rel = {}
    for key in ("spring", "pipe", "collar", "disc"):
        cs = groups[N[key]]; P = tri[cs[0]].reshape(-1, 3); rel[key] = []; err = 0.0
        for c in cs:
            Q = tri[c].reshape(-1, 3); R, t = kabsch(P, Q)
            err = max(err, float(np.abs(P @ R.T + t - Q).max()))
            T = np.eye(4); T[:3, :3] = R; T[:3, 3] = t; rel[key].append(T.tolist())
        rep["notes"][f"{key}_instances_are_exact_copies_max_err_mm"] = err
    poses["spring_file_to_instance0"] = [T0.tolist()]; resid["spring_file_to_instance0"] = [r0]

    # the assembly's own elbow body is the geometry used (pipe.stl differs slightly)
    pipe0 = body(groups[N["pipe"]][0]); pipe0.export(os.path.join(CACHE, "pipe_elbow.stl"))
    pf = load("pipe")
    from trimesh.registration import icp
    best = None
    def principal(m):
        w = np.linalg.eigh(m.moment_inertia)[1]
        if np.linalg.det(w) < 0:
            w[:, 0] *= -1                      # a proper rotation frame
        return m.center_mass, w
    (c1, w1), (c2, w2) = principal(pf), principal(pipe0)
    pts = trimesh.sample.sample_surface(pf, 5000, seed=1)[0]
    for P in cube_rotations():      # every principal-axis labelling, so no symmetry is missed
        R = w2 @ P @ w1.T
        if np.linalg.det(R) < 0:
            continue
        T = np.eye(4); T[:3, :3] = R; T[:3, 3] = c2 - R @ c1
        Ti, _, cost = icp(pts, pipe0, initial=T, max_iterations=60, scale=False, threshold=1e-6)
        if best is None or cost < best[1]:
            best = (Ti, cost)
    res = surface_residual(pf, pipe0, best[0])
    rep["notes"]["pipe_stl_vs_assembly_elbow"] = dict(
        point_to_surface_mean_p99_max_mm=[round(x, 3) for x in res],
        volume_cm3=[round(abs(pf.volume) / 1000, 2), round(abs(pipe0.volume) / 1000, 2)],
        faces=[int(len(pf.faces)), int(len(pipe0.faces))],
        verdict=("closely matches but is not identical (mean %.2f mm, worst %.1f mm apart, about 1 %% different in "
                 "volume); the assembly's own elbow is used" % (res[0], res[2])) if res[0] < 1.0 else
                "could not be registered onto the assembly's elbow; the assembly's own elbow is used")

    # ------------------------------------------------- assembly-frame bookkeeping
    Tt = np.array(poses["tank"][0])
    # Assembly frame: the tank file turned upright (x -> -x, z -> -z), outer floor face on z = 0.
    # The export holds the tank in exactly that orientation plus a translation, so
    # p_asm = p_export - Tt[:3, 3]  (a pure translation, no rotation).
    assert np.allclose(Tt[:3, :3], np.diag([-1.0, 1.0, -1.0]), atol=1e-6), "tank orientation in the export changed"
    t_shift = (-Tt[:3, 3]).tolist()

    rep["export_frame_to_assembly_frame_translation_mm"] = t_shift
    rep["poses_file_to_export"] = poses
    rep["instance_poses_relative_to_instance0"] = rel
    rep["registration_residual_mm_mean_p99_max"] = resid
    with open(os.path.join(OUT, "measured.json"), "w") as f:
        json.dump(rep, f, indent=1)

    print(json.dumps({k: rep[k] for k in ("combined",)}, indent=1))
    for k, v in rep["notes"].items():
        print(k, "->", v)
    for k, v in resid.items():
        print(f"registration {k:26s}", ["%.4f/%.4f/%.4f" % tuple(x) for x in v][:4])


if __name__ == "__main__":
    main()
