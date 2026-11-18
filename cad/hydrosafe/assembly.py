"""
HydroSafe assembly: mating, validation and export.

    python cad/hydrosafe/measure.py       # identify the files, recover poses from the export
    python cad/hydrosafe/assembly.py      # mate, validate, export

Assembly frame: millimetres, Z up, origin at the centre of the tank's outer floor
face. It is the frame of your Onshape export, shifted by a constant (measure.py).

Why mating is needed
--------------------
`lid + bottom.stl` is a snapshot of an Onshape assembly in which the lid, the
springs and the elbows are NOT mated: the lid is 308 mm above the tank and 57 mm
off to the side, the springs hover ~40 mm above their seats and ~10 mm off them,
and the elbows sit 45-56 mm below the floor, 14-17 mm off the hole axes and tilted
0-2 degrees. The assembled pose below is derived from the parts' own features:

  tank        as exported (it is the reference)
  springs     axis on a tank spring seat, bottom on the seat's pad
  lid         seat pattern over the tank's, spring tops on the lid's pin ends
              (springs at their free length: the lid's REST position)
  collars     axis on a tank floor hole, resting on the inner floor face
  discs       axis on a hole, top flush with the inner floor face
  elbows      inlet axis vertical and on a hole, inlet face on the floor underside

Every number used (hole and seat positions, levels, spring length) is read from
the meshes. What is an assumption is listed in the manifest ("assumptions").
"""
import itertools
import json
import os
import sys
import time

import numpy as np
import shapely.geometry as sg
import trimesh
from scipy.optimize import linear_sum_assignment

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from measure import CACHE, FILES, OUT, SRC, cube_rotations, load  # noqa: E402

for d in ("step", "stl", "glb"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
MEAS = json.load(open(os.path.join(OUT, "measured.json")))
SHIFT = np.array(MEAS["export_frame_to_assembly_frame_translation_mm"])      # p_asm = p_export + SHIFT

# Web geometry budgets (triangles). The sources are far finer than a browser needs.
SPRING_FACES = 6000      # 136k -> 6k: worst surface deviation 0.08 mm
DISC_FACES = 20850       # 112k -> ~21k: all 472 holes kept, open area within 2.3 %

# Exploded view: straight along the assembly axis (z), top part furthest.
EXPLODE = dict(lid=230.0, springs=120.0, collars=100.0, discs=50.0, tank=0.0, pipes=-110.0)
LABELS = dict(lid="Lid", springs="Springs ×20", collars="Pipe attachments ×4", discs="Mesh discs ×4",
              tank="Tank body", pipes="Elbow pipes ×4")
COLORS = dict(tank=(0.56, 0.78, 0.95, 0.30), lid=(0.84, 0.85, 0.87, 1.0), springs=(0.22, 0.22, 0.25, 1.0),
              collars=(0.60, 0.77, 0.90, 1.0), discs=(0.10, 0.10, 0.12, 1.0), pipes=(0.93, 0.94, 0.95, 1.0))


# ------------------------------------------------------------- helpers ---
def Tt(v):
    T = np.eye(4); T[:3, 3] = v; return T


def Rz(deg):
    a = np.radians(deg); c, s = np.cos(a), np.sin(a)
    T = np.eye(4); T[:2, :2] = [[c, -s], [s, c]]; return T


def rot_between(a, b):
    """Smallest rotation taking unit vector a onto unit vector b."""
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b)
    v = np.cross(a, b); c = float(a @ b)
    if np.linalg.norm(v) < 1e-12:
        return np.eye(4)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    T = np.eye(4); T[:3, :3] = np.eye(3) + K + K @ K / (1 + c); return T


def moved(mesh, T):
    return mesh.copy().apply_transform(T)


def export_to_asm(T_export):
    """File/instance -> export-frame pose  =>  file/instance -> assembly-frame pose."""
    return Tt(SHIFT) @ np.asarray(T_export)


def section_circles(mesh, z, dmin=None, dmax=None):
    s = mesh.section(plane_origin=[0, 0, z], plane_normal=[0, 0, 1])
    out = []
    if s is None:
        return out
    for e in s.discrete:
        p = sg.Polygon(e[:, :2])
        if p.area < 1:
            continue
        d = 2 * np.sqrt(p.area / np.pi)
        if (dmin is None or d >= dmin) and (dmax is None or d <= dmax):
            out.append((d, np.array(p.centroid.coords[0])))
    return out


def decimate(mesh, faces):
    import fast_simplification as fs
    v, f = fs.simplify(mesh.vertices.astype(np.float32), mesh.faces.astype(np.int32), target_count=faces, agg=4)
    return trimesh.Trimesh(v, f, process=True)


def deviation(a, b, n=20000):
    """Mean / p99 / max distance from a's surface to b's (mm)."""
    p = trimesh.sample.sample_surface(a, n, seed=5)[0]
    _, d, _ = trimesh.proximity.closest_point(b, p[::4])
    return [round(float(d.mean()), 4), round(float(np.percentile(d, 99)), 4), round(float(d.max()), 4)]


# -------------------------------------------------------------- build ----
def build():
    P = {}                                   # all the parts, in their own local frames
    # ---- tank: the reference, upright
    tank_file = load("tank")
    T_tank = export_to_asm(MEAS["poses_file_to_export"]["tank"][0])
    assert np.allclose(T_tank[:3, :3], np.diag([-1, 1, -1]), atol=1e-6) and np.allclose(T_tank[:3, 3], 0, atol=1e-3)
    tank = moved(tank_file, T_tank)

    # floor levels, read from the faces: the largest up-facing horizontal face is the inner floor
    up = np.where(tank.face_normals[:, 2] > 0.999)[0]
    levels = {}
    for i in up:
        levels[round(float(tank.triangles_center[i, 2]), 1)] = levels.get(round(float(tank.triangles_center[i, 2]), 1), 0) + tank.area_faces[i]
    z_inner = max(levels.items(), key=lambda kv: kv[1])[0]                 # inner floor face
    z_rim = float(tank.bounds[1][2])
    holes = [(d, c) for d, c in section_circles(tank, z_inner / 2, 60, 120)]
    hole_c = np.array([c for _, c in holes]); hole_d = float(np.mean([d for d, _ in holes]))
    seats = section_circles(tank, z_inner + 2.0, 20, 40)                    # the bosses
    seat_c = np.array([c for _, c in seats]); boss_d = float(np.mean([d for d, _ in seats]))
    near = np.min(np.hypot(tank.vertices[:, None, 0] - seat_c[None, :, 0], tank.vertices[:, None, 1] - seat_c[None, :, 1]), axis=1)
    on_seat = tank.vertices[near < boss_d / 2 + 0.1]
    on_seat = on_seat[on_seat[:, 2] > z_inner + 0.5]
    peg_top = float(on_seat[:, 2].max())                                   # top of the Ø17.5 pad
    boss_top = float(np.unique(np.round(on_seat[:, 2], 1))[-2])           # shoulder below the pad
    P["tank"] = dict(mesh=tank, z_inner=z_inner, z_rim=z_rim, hole_c=hole_c, hole_d=hole_d, seat_c=seat_c,
                     boss_d=boss_d, boss_top=boss_top, peg_top=peg_top)

    # ---- spring: local frame = axis centre at the origin, bottom on z = 0
    sp_file = load("spring")
    lo, hi = sp_file.bounds
    sp_local = sp_file.copy(); sp_local.apply_translation([-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]])
    L_free = float(hi[2] - lo[2])
    P["spring"] = dict(mesh=sp_local, length=L_free, od=float(hi[0] - lo[0]))

    # ---- lid: seat pattern and pin ends, in the lid's own frame
    lid_file = load("lid")
    pockets = [(d, c) for d, c in section_circles(lid_file, -39.9, 27.0, 28.0)]
    pocket_c = np.array([c for _, c in pockets])
    near = np.min(np.hypot(lid_file.vertices[:, None, 0] - pocket_c[None, :, 0], lid_file.vertices[:, None, 1] - pocket_c[None, :, 1]), axis=1)
    pin = lid_file.vertices[near < 7.4]
    pin_end = float(pin[:, 2].min())                                       # lowest point of a pin end (z = -31.4)
    P["lid"] = dict(mesh=lid_file, pocket_c=pocket_c, pin_end=pin_end, bottom=float(lid_file.bounds[0][2]))

    # ---- web geometry for the heavy parts
    disc_file = load("disc")
    P["disc"] = dict(mesh=disc_file, web=decimate(disc_file, DISC_FACES))
    P["spring"]["web"] = decimate(sp_local, SPRING_FACES)
    P["collar"] = dict(mesh=load("collar"))
    elbow = trimesh.load(os.path.join(CACHE, "pipe_elbow.stl"), force="mesh", process=True)
    elbow.apply_translation(SHIFT)                                         # instance 0, in the assembly frame
    P["elbow"] = dict(mesh=elbow)
    return P


def mate(P):
    """Poses (4x4, local part frame -> assembly frame) for every instance, plus the
    deviation of the supplied export from each mated pose."""
    tk = P["tank"]
    poses = {k: [] for k in ("tank", "lid", "spring", "collar", "disc", "elbow")}
    dev = {}
    poses["tank"].append(np.eye(4))
    H = tk["hole_c"]

    # ---- springs onto the seats (assignment by nearest export position; identical parts)
    L = P["spring"]["length"]
    T0 = np.array(MEAS["poses_file_to_export"]["spring_file_to_instance0"][0])
    sp_file = load("spring"); lo, hi = sp_file.bounds
    to_local = Tt([-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]])       # file -> local (axis at origin)
    exp_xy = []
    yaws = []
    for k in range(20):
        Rk = np.array(MEAS["instance_poses_relative_to_instance0"]["spring"][k])
        T_file_to_k = export_to_asm(Rk @ T0)
        T_local_to_k = T_file_to_k @ np.linalg.inv(to_local)                  # local spring -> assembly
        assert abs(T_local_to_k[2, 2] - 1) < 1e-6, "a spring in the export is not vertical"
        yaws.append(np.degrees(np.arctan2(T_local_to_k[1, 0], T_local_to_k[0, 0])))
        exp_xy.append(T_local_to_k[:2, 3]);
    exp_xy = np.array(exp_xy)
    cost = np.linalg.norm(exp_xy[:, None] - tk["seat_c"][None], axis=2)
    ri, ci = linear_sum_assignment(cost)
    seat_of = dict(zip(ri, ci))
    sp_dev = []
    for k in range(20):
        s = tk["seat_c"][seat_of[k]]
        poses["spring"].append(Tt([s[0], s[1], tk["peg_top"]]) @ Rz(yaws[k]))
        sp_dev.append(float(cost[k, seat_of[k]]))
    dev["springs_xy_off_seat_mm"] = [round(min(sp_dev), 2), round(float(np.mean(sp_dev)), 2), round(max(sp_dev), 2)]
    # export spring bottom (asm): the file's lowest point carried through the export pose
    zb = [(export_to_asm(np.array(MEAS["instance_poses_relative_to_instance0"]["spring"][k]) @ T0) @ np.r_[0, 0, lo[2], 1])[2]
          for k in range(20)]
    dev["springs_bottom_above_pad_mm"] = [round(min(zb) - tk["peg_top"], 2), round(max(zb) - tk["peg_top"], 2)]

    # ---- lid: seat pattern over the tank's, spring tops on the pin ends
    lid = P["lid"]
    cost = np.linalg.norm(lid["pocket_c"][:, None] - tk["seat_c"][None], axis=2)
    # the two 20-point patterns share a centre; match by centroids and check every point
    off = tk["seat_c"].mean(0) - lid["pocket_c"].mean(0)
    r, c = linear_sum_assignment(np.linalg.norm((lid["pocket_c"] + off)[:, None] - tk["seat_c"][None], axis=2))
    pat_err = float(np.linalg.norm((lid["pocket_c"] + off)[r] - tk["seat_c"][c], axis=1).max())
    z_lid = tk["peg_top"] + L - lid["pin_end"]
    poses["lid"].append(Tt([off[0], off[1], z_lid]))
    Tl_exp = export_to_asm(MEAS["poses_file_to_export"]["lid"][0])
    dev["lid_export_offset_mm"] = np.round(Tl_exp[:3, 3] - np.array([off[0], off[1], z_lid]), 1).tolist()
    dev["lid_seat_pattern_match_max_mm"] = round(pat_err, 4)

    # ---- collars and discs onto the holes
    def assign_to_holes(xy):
        r, c = linear_sum_assignment(np.linalg.norm(xy[:, None] - H[None], axis=2))
        return {int(i): int(j) for i, j in zip(r, c)}, np.linalg.norm(xy[r] - H[c], axis=1)

    for key in ("collar", "disc"):
        mesh = P[key]["mesh"]
        Ts = [export_to_asm(T) for T in MEAS["poses_file_to_export"][key]]
        ctr = np.array([(T @ np.r_[(mesh.bounds[0] + mesh.bounds[1]) / 2, 1])[:2] for T in Ts])
        amap, d = assign_to_holes(ctr)
        dev[f"{key}s_xy_off_hole_mm"] = [round(float(d.min()), 2), round(float(d.mean()), 2), round(float(d.max()), 2)]
        zb = []
        for i, T in enumerate(Ts):
            R = np.eye(4); R[:3, :3] = T[:3, :3]
            m = moved(mesh, R)
            h = H[amap[i]]
            c0 = (m.bounds[0] + m.bounds[1]) / 2
            zbottom = tk["z_inner"] if key == "collar" else tk["z_inner"] - float(mesh.extents[2])
            zb.append(float(moved(mesh, T).bounds[0][2]) - zbottom)
            poses[key].append(Tt([h[0] - c0[0], h[1] - c0[1], zbottom - m.bounds[0][2]]) @ R)
        dev[f"{key}s_bottom_above_mated_mm"] = [round(min(zb), 2), round(max(zb), 2)]

    # ---- elbows: inlet face vertical, on the hole axis, against the floor underside
    el = P["elbow"]["mesh"]
    n = el.face_normals; a = el.area_faces
    clusters = {}
    for i, nn in enumerate(np.round(n, 2)):
        clusters.setdefault(tuple(nn), []).append(i)
    ends = sorted(clusters.items(), key=lambda kv: -a[kv[1]].sum())[:2]       # the two annular end faces
    end_info = []
    for nn, idx in ends:
        w = a[idx] / a[idx].sum()
        end_info.append((np.array(nn) / np.linalg.norm(nn), (el.triangles_center[idx] * w[:, None]).sum(0), float(a[idx].sum())))
    Tp = [Tt(SHIFT) @ np.array(MEAS["instance_poses_relative_to_instance0"]["pipe"][k]) @ Tt(-SHIFT) for k in range(4)]
    inlet_xy, tilt, zgap = [], [], []
    pick = []
    for k in range(4):
        nz = [(Tp[k][:3, :3] @ e[0])[2] for e in end_info]
        j = int(np.argmax(nz)); pick.append(j)
        c_k = (Tp[k] @ np.r_[end_info[j][1], 1])[:3]
        inlet_xy.append(c_k[:2]); zgap.append(c_k[2])
        tilt.append(float(np.degrees(np.arccos(np.clip(nz[j], -1, 1)))))
    inlet_xy = np.array(inlet_xy)
    amap, d = assign_to_holes(inlet_xy)
    for k in range(4):
        j = pick[k]
        n_k = Tp[k][:3, :3] @ end_info[j][0]
        c_k = (Tp[k] @ np.r_[end_info[j][1], 1])[:3]
        Q = rot_between(n_k, np.array([0, 0, 1.0]))
        h = H[amap[k]]
        M = Tt([h[0], h[1], 0.0]) @ Q @ Tt(-c_k)
        T_k = M @ Tp[k]
        # seat the inlet face exactly on the floor underside (the face-cluster centre can sit a hair off the plane)
        T_k = Tt([0, 0, -float(moved(P["elbow"]["mesh"], T_k).bounds[1][2])]) @ T_k
        poses["elbow"].append(T_k)
    dev["elbows_inlet_xy_off_hole_mm"] = [round(float(d.min()), 1), round(float(d.max()), 1)]
    dev["elbows_inlet_below_floor_mm"] = [round(float(-max(zgap)), 1), round(float(-min(zgap)), 1)]
    dev["elbows_inlet_tilt_deg"] = [round(min(tilt), 1), round(max(tilt), 1)]
    P["_ends"] = end_info
    P["_amap"] = amap
    return poses, dev


# ----------------------------------------------------------- the model ---
def web_parts(P):
    """Group -> (local mesh, poses, node-name prefix, geometry used)."""
    return dict(
        # single parts get a suffix so no instance shares a name with its group node
        tank=("tank", P["tank"]["mesh"], "tank_body"),
        lid=("lid", P["lid"]["mesh"], "lid_plate"),
        springs=("spring", P["spring"]["web"], "spring"),
        collars=("collar", P["collar"]["mesh"], "collar"),
        discs=("disc", P["disc"]["web"], "disc"),
        pipes=("elbow", P["elbow"]["mesh"], "elbow"),
    )


def instances(P, poses):
    """(group, name, local mesh, pose) for every part, with tank pose = identity."""
    out = []
    tank = P["tank"]["mesh"]
    for g, (pk, mesh, pre) in web_parts(P).items():
        for i, T in enumerate(poses[pk]):
            name = pre if len(poses[pk]) == 1 else f"{pre}_{i + 1:02d}"
            assert name != g, f"instance {name} would collide with its group node"
            out.append((g, name, mesh, T))
    return out


# ---------------------------------------------------------- validation ---
def overlap_volume(a, b):
    if np.any(a.bounds[1] <= b.bounds[0]) or np.any(b.bounds[1] <= a.bounds[0]):
        return 0.0
    try:
        return float(abs(trimesh.boolean.intersection([a, b], engine="manifold").volume))
    except Exception:
        return float("nan")


# Designed contacts that are fits, not collisions (mm^3 tolerated, with the reason)
FITS = {("disc", "tank"): "mesh disc 103.67 mm in a 103.57 mm hole (0.05 mm per side)",
        ("disc", "collar"): "disc against the collar's bore edge"}
OVERLAP_LIMIT = 2.0   # mm^3


def check_pairs(items, explode_t=0.0, label=""):
    """Every pair of parts whose boxes meet, with the exploded offsets applied."""
    ms = []
    for g, name, mesh, T in items:
        T2 = Tt([0, 0, EXPLODE[g] * explode_t]) @ T
        ms.append((g, name, moved(mesh, T2)))
    hits, pairs = [], 0
    for (g1, n1, m1), (g2, n2, m2) in itertools.combinations(ms, 2):
        v = overlap_volume(m1, m2)
        pairs += 1
        if v > OVERLAP_LIMIT or np.isnan(v):
            hits.append(dict(a=n1, b=n2, volume_mm3=round(v, 2)))
    return hits, pairs


def contact_gaps(P, poses):
    """Distances that should be zero (touching) or positive (clearance) at rest."""
    tk = P["tank"]["mesh"]
    out = {}
    sp = [moved(P["spring"]["web"], T) for T in poses["spring"]]
    lid = moved(P["lid"]["mesh"], poses["lid"][0])
    # spring bottom end vs tank pad, spring top vs lid pin end
    lowest = np.array([m.vertices[m.vertices[:, 2] < m.bounds[0][2] + 0.5] for m in sp], dtype=object)
    d_bot = [float(trimesh.proximity.closest_point(tk, v)[1].min()) for v in lowest]
    tops = [m.vertices[m.vertices[:, 2] > m.bounds[1][2] - 0.5] for m in sp]
    d_top = [float(trimesh.proximity.closest_point(lid, v)[1].min()) for v in tops]
    out["spring_bottom_to_tank_pad_mm"] = [round(min(d_bot), 3), round(max(d_bot), 3)]
    out["spring_top_to_lid_pin_mm"] = [round(min(d_top), 3), round(max(d_top), 3)]
    col = [moved(P["collar"]["mesh"], T) for T in poses["collar"]]
    out["collar_bottom_to_floor_mm"] = [round(float(m.bounds[0][2] - P["tank"]["z_inner"]), 3) for m in col]
    dsc = [moved(P["disc"]["web"], T) for T in poses["disc"]]
    out["disc_top_vs_floor_face_mm"] = [round(float(m.bounds[1][2] - P["tank"]["z_inner"]), 3) for m in dsc]
    el0 = [moved(P["elbow"]["mesh"], T) for T in poses["elbow"]]
    out["elbow_top_vs_floor_underside_mm"] = [round(float(m.bounds[1][2]), 3) for m in el0]
    out["lid_plate_underside_above_rim_mm"] = round(float(lid.bounds[0][2] + 40.0 - P["tank"]["z_rim"]), 2)
    # the lid's hanging cylinders against the tank walls, and the lid plate against the opening
    cyl = lid.vertices[lid.vertices[:, 2] < poses["lid"][0][2, 3] - 1.0]
    out["lid_cylinders_to_tank_wall_mm"] = round(float(trimesh.proximity.closest_point(tk, cyl)[1].min()), 2)
    mid = (P["tank"]["z_inner"] + P["tank"]["z_rim"]) / 2
    s = tk.section(plane_origin=[0, 0, mid], plane_normal=[0, 0, 1])
    inner = min(s.discrete, key=lambda e: sg.Polygon(e[:, :2]).area)
    out["tank_opening_mm"] = [round(float(np.ptp(inner[:, 0])), 2), round(float(np.ptp(inner[:, 1])), 2)]
    out["lid_plate_mm"] = [round(float(np.ptp(lid.vertices[:, 0])), 2), round(float(np.ptp(lid.vertices[:, 1])), 2)]
    el = [moved(P["elbow"]["mesh"], T) for T in poses["elbow"]]
    out["elbow_to_elbow_min_gap_mm"] = round(min(float(trimesh.proximity.closest_point(a, b.vertices)[1].min())
                                              for a, b in itertools.combinations(el, 2)), 2)
    out["parts_in_assembly"] = {k: len(v) for k, v in poses.items()}
    return out


# ------------------------------------------------------------- export ----
def export_glb(P, poses):
    sc = trimesh.Scene()
    conv = np.eye(4); conv[:3, :3] = [[1, 0, 0], [0, 0, 1], [0, -1, 0]]
    sc.graph.update(frame_from=sc.graph.base_frame, frame_to="hydrosafe", matrix=conv @ np.diag([0.001, 0.001, 0.001, 1]))

    def vis(g):
        r, gg, b, al = COLORS[g]
        mat = trimesh.visual.material.PBRMaterial(
            baseColorFactor=[r, gg, b, al], alphaMode="BLEND" if al < 1 else "OPAQUE",
            metallicFactor=0.85 if g == "springs" else 0.0, roughnessFactor=0.34 if g == "springs" else 0.55,
            doubleSided=False)
        return trimesh.visual.TextureVisuals(material=mat)

    groups, manifest_nodes = {}, {}
    for g in EXPLODE:
        sc.graph.update(frame_from="hydrosafe", frame_to=g, matrix=np.eye(4))
        manifest_nodes[g] = []
    shared = {}
    for g, name, mesh, T in instances(P, poses):
        geom_name = f"{g}_mesh"
        if geom_name not in shared:
            m = mesh.copy(); m.visual = vis(g); shared[geom_name] = m
        sc.add_geometry(shared[geom_name], node_name=name, geom_name=geom_name, parent_node_name=g, transform=T)
        manifest_nodes[g].append(name)
    path = os.path.join(OUT, "glb", "hydrosafe.glb")
    sc.export(path)
    return path, manifest_nodes


def export_stl(P):
    d = os.path.join(OUT, "stl")
    parts = dict(
        hydrosafe_tank=moved(P["tank"]["mesh"], np.eye(4)),                   # assembly frame (upright)
        hydrosafe_lid=P["lid"]["mesh"], hydrosafe_pipe_attachment=P["collar"]["mesh"],
        hydrosafe_mesh_disc_web=P["disc"]["web"], hydrosafe_spring_web=P["spring"]["web"],
        hydrosafe_elbow_pipe=P["elbow"]["mesh"],
    )
    for n, m in parts.items():
        m.export(os.path.join(d, n + ".stl"))
    return {n: [len(m.faces), round(os.path.getsize(os.path.join(d, n + ".stl")) / 1e6, 2)] for n, m in parts.items()}


def export_step(items):
    from build123d import Color, Compound, Mesher, Location, export_step as _export
    from OCP.gp import gp_Trsf
    import tempfile

    def loc(T):
        t = gp_Trsf(); t.SetValues(*T[0, :4], *T[1, :4], *T[2, :4]); return Location(t)

    tmp = tempfile.mkdtemp(prefix="hs_stl_")
    solids = {}
    groups = {}
    for g, name, mesh, T in items:
        key = f"{g}_mesh"
        if key not in solids:
            p = os.path.join(tmp, key + ".stl"); mesh.export(p, file_type="stl")
            solids[key] = Mesher().read(p)[0]
        s = loc(T) * solids[key]
        s.label = name; r, gg, b, _ = COLORS[g]; s.color = Color(r, gg, b)
        groups.setdefault(g, []).append(s)
    root = Compound(label="hydrosafe", children=[Compound(label=g, children=kids) for g, kids in groups.items()])
    path = os.path.join(OUT, "step", "hydrosafe_assembly.step")
    _export(root, path)
    return path


# ---------------------------------------------------------------- main ---
def main():
    t0 = time.time()
    P = build()
    poses, dev = mate(P)
    items = instances(P, poses)

    tk = P["tank"]
    spring_dev = deviation(P["spring"]["web"], P["spring"]["mesh"])
    disc_dev = deviation(P["disc"]["web"], P["disc"]["mesh"])
    def holes_of(m):
        s = m.section(plane_origin=[0, 0, 1.0], plane_normal=[0, 0, 1])
        h = [sg.Polygon(e[:, :2]) for e in s.discrete if len(e) > 3]
        h = [p for p in h if p.area < 50]; return len(h), round(sum(p.area for p in h), 1)
    disc_holes = dict(original=holes_of(P["disc"]["mesh"]), web=holes_of(P["disc"]["web"]))

    # rest-state interference and contacts
    hits0, npairs = check_pairs(items, 0.0)
    gaps = contact_gaps(P, poses)
    # exploded states
    explode_hits = {}
    for t in (0.25, 0.5, 0.75, 1.0):
        h, _ = check_pairs(items, t)
        explode_hits[str(t)] = h

    # extents
    allm = [moved(m, T) for _, _, m, T in items]
    ext0 = np.array([np.min([m.bounds[0] for m in allm], axis=0), np.max([m.bounds[1] for m in allm], axis=0)])
    allm1 = [moved(m, Tt([0, 0, EXPLODE[g]]) @ T) for g, _, m, T in items]
    ext1 = np.array([np.min([m.bounds[0] for m in allm1], axis=0), np.max([m.bounds[1] for m in allm1], axis=0)])

    glb, nodes = export_glb(P, poses)
    stl = export_stl(P)

    manifest = dict(
        units="metres, Y up, origin at the centre of the tank's outer floor face (CAD: mm, Z up)",
        explode_units="millimetres along CAD z (the assembly axis); set each group node's position to explode * t, t in [0, 1]",
        groups={g: dict(nodes=nodes[g], explode=[0.0, 0.0, EXPLODE[g]]) for g in EXPLODE},
        labels=LABELS,
        sources={
            "tank": "bottom face.stl (identical to Part Studio 3.stl)", "lid": "lid.stl",
            "springs": "Spring.stl (x20, decimated for the web)", "collars": "pipe attachment.stl (x4)",
            "discs": "Part Studio 1.stl (x4, decimated for the web)",
            "pipes": "the elbow solid in lid + bottom.stl (x4); pipe.stl is a close match but not identical",
        },
        poses_mm=dict((n, np.round(T, 4).tolist()) for _, n, _, T in items),
        measured=dict(
            hole_centres_mm=np.round(tk["hole_c"], 2).tolist(), hole_diameter_mm=round(tk["hole_d"], 2),
            spring_seat_centres_mm=np.round(tk["seat_c"], 2).tolist(), seat_boss_diameter_mm=round(tk["boss_d"], 2),
            floor_inner_z_mm=tk["z_inner"], seat_boss_top_z_mm=tk["boss_top"], seat_pad_top_z_mm=round(tk["peg_top"], 2),
            tank_rim_z_mm=round(tk["z_rim"], 2), spring_free_length_mm=round(P["spring"]["length"], 2),
            spring_outer_diameter_mm=round(P["spring"]["od"], 2), lid_pin_end_z_in_lid_frame_mm=round(P["lid"]["pin_end"], 2),
            lid_rest_z_offset_mm=round(float(poses["lid"][0][2, 3]), 2),
        ),
        assumptions=[
            "Rest pose: springs at their free length (58.27 mm) between the tank's seat pads and the lid's pin ends. "
            "The compressed height under load is not known.",
            "Lid centred on the tank by matching the lid's 20 seat pockets to the tank's 20 seats (match error "
            "%.4f mm). The lid's four holes sit 0.88 mm from the tank's in y, so they are not perfectly coaxial." % dev["lid_seat_pattern_match_max_mm"],
            "Elbows: inlet axis made vertical, centred on a hole, inlet face against the floor underside. The elbow "
            "outer diameter (104.1 mm) is 0.5 mm larger than the hole (103.57 mm), so it butts the floor and does not enter the hole.",
            "Discs: top flush with the inner floor face, as three of the four are in the export (the fourth is 13.5 mm higher).",
            "Collars: bottom face on the inner floor face; the export has them 0.1-0.4 mm above it.",
            "Units: the STL files carry none; millimetres are assumed (spring OD 16.5 mm, tank 550 x 400 mm).",
            "The function of the mesh disc, the collar and the elbow is not stated by the geometry and is not claimed.",
        ],
    )
    with open(os.path.join(OUT, "hydrosafe.manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)

    validation = dict(
        registration_residual_mm_mean_p99_max=MEAS["registration_residual_mm_mean_p99_max"],
        files_identified=MEAS["notes"], export_deviation_from_mated_pose=dev,
        web_geometry=dict(spring=dict(faces=[len(P["spring"]["mesh"].faces), len(P["spring"]["web"].faces)], deviation_mm_mean_p99_max=spring_dev),
                          disc=dict(faces=[len(P["disc"]["mesh"].faces), len(P["disc"]["web"].faces)], deviation_mm_mean_p99_max=disc_dev, holes_and_open_area_mm2=disc_holes)),
        rest_state=dict(pairs_checked=npairs, interference=hits0, contacts=gaps, tolerated_overlap_mm3=OVERLAP_LIMIT),
        exploded_states_interference=explode_hits,
        extent_mm=dict(assembled=np.round(ext0[1] - ext0[0], 1).tolist(), exploded=np.round(ext1[1] - ext1[0], 1).tolist()),
        glb_mb=round(os.path.getsize(glb) / 1e6, 2), stl_faces_mb=stl,
    )
    with open(os.path.join(OUT, "validation.json"), "w") as f:
        json.dump(validation, f, indent=1, default=lambda o: o.tolist() if hasattr(o, "tolist") else str(o))

    step = None
    if os.environ.get("HYDROSAFE_STEP", "1") == "1":
        step = export_step(items)
        validation["step_mb"] = round(os.path.getsize(step) / 1e6, 1)
        with open(os.path.join(OUT, "validation.json"), "w") as f:
            json.dump(validation, f, indent=1, default=lambda o: o.tolist() if hasattr(o, "tolist") else str(o))

    print(json.dumps({k: validation[k] for k in ("export_deviation_from_mated_pose", "web_geometry", "extent_mm", "glb_mb")}, indent=1, default=str))
    print("rest interference:", hits0 or "none", f"({npairs} pairs)")
    print("contacts:", json.dumps(gaps))
    print("exploded interference:", {k: v or "none" for k, v in explode_hits.items()})
    print("time", round(time.time() - t0, 1), "s", "step", step)


if __name__ == "__main__":
    main()
