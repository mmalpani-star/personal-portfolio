"""1U CubeSat assembly: original electronics + reconstructed frame, antenna cassette and burn-wire hardware.

Run from /cad/cubesat:  python assembly.py        (HYDROSAFE-style: set CUBESAT_STEP=0 to skip the STEP)

Provenance of every part is recorded in export/cubesat.manifest.json (`source`):
  original      geometry read from the Creo -> STEP export of the flex-PCB assembly (ffpcb.stp), placed by me
  reconstructed geometry I modelled, because the original is unreadable or does not exist
Nothing is claimed to be the original frame, antenna or release mechanism.
"""
import json
import math
import os
import sys
import time

import numpy as np
import trimesh

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import frame as FR      # noqa: E402
import source as SRC    # noqa: E402
import tape as TP       # noqa: E402

OUT = os.path.join(HERE, "export")
for d in ("glb", "stl", "step"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

P = TP.PARAMS
H = FR.H
CAV = FR.CAVITY / 2                    # 47.5
Z_TOP = H                              # outer face of the top plate (cassette base plane)
PCB_Z0 = -20.0                         # underside of the flex-PCB base
PCB_T = 1.6
PCB_TOP = PCB_Z0 + PCB_T
FLOOR_Z = -CAV                         # inner face of the bottom plate

# ------------------------------------------------------------------ materials ---
MAT = dict(
    frame=((0.86, 0.85, 0.82, 1.0), 0.0, 0.55),
    graphite=((0.16, 0.17, 0.19, 1.0), 0.0, 0.5),
    pcb_green=((0.04, 0.30, 0.17, 1.0), 0.0, 0.42),
    pcb_blue=((0.03, 0.21, 0.36, 1.0), 0.0, 0.42),
    black=((0.025, 0.025, 0.03, 1.0), 0.0, 0.45),
    gold=((0.83, 0.65, 0.22, 1.0), 1.0, 0.32),
    steel=((0.78, 0.8, 0.83, 1.0), 1.0, 0.28),
    cell=((0.60, 0.66, 0.10, 1.0), 0.0, 0.45),
    cord=((0.96, 0.95, 0.9, 1.0), 0.0, 0.7),
    nichrome=((0.34, 0.33, 0.33, 1.0), 1.0, 0.4),
    passive=((0.62, 0.55, 0.42, 1.0), 0.0, 0.5),
)


# ----------------------------------------------------------------- helpers ----
def Tm(x=0.0, y=0.0, z=0.0):
    m = np.eye(4); m[:3, 3] = [x, y, z]; return m


def Rm(R3):
    m = np.eye(4); m[:3, :3] = R3; return m


def moved(mesh, T):
    m = mesh.copy(); m.apply_transform(T); return m


def seat(meshes, R3, xy, z_min):
    """Pose that rotates by R3, centres the group on `xy` and puts its lowest point at z_min."""
    allv = np.concatenate([(m.vertices @ R3.T) for m in meshes])
    lo, hi = allv.min(0), allv.max(0)
    t = np.array([xy[0] - (lo[0] + hi[0]) / 2, xy[1] - (lo[1] + hi[1]) / 2, z_min - lo[2]])
    T = np.eye(4); T[:3, :3] = R3; T[:3, 3] = t
    return T


def decimate(mesh, faces):
    import fast_simplification as fs
    m = mesh.copy(); m.merge_vertices()
    if len(m.faces) <= faces:
        return m
    v, f = fs.simplify(m.vertices, m.faces, target_reduction=1 - faces / len(m.faces))
    return trimesh.Trimesh(v, f, process=True)


def shape_mesh(shape, tol=0.05, ang=0.3):
    ms = SRC.tessellate(shape, tol, ang)
    return SRC.merged(ms) if ms else None


# ---------------------------------------------------------------- original ----
ROT_NANO = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)      # board normal (+Y) -> up (+Z), long axis stays X


def nano_class(label, vol_rank):
    L = label.upper()
    if "NANO-BOARD" in L:
        return "board"
    if "HEADER" in L:
        return "headers"
    if "USB" in L:
        return "usb"
    if any(k in L for k in ("ATMEGA", "FTDI", "REG", "RESET")):
        return "chips"
    return "small"


CACHE = os.path.join(HERE, "cache")


def build_originals():
    """Original components as meshes + poses (cached: tessellating and decimating the Nano takes ~90 s)."""
    import pickle
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, "originals.pkl")
    stamp = (os.path.getmtime(SRC.STEP_PATH), os.path.getmtime(__file__))
    if os.path.exists(path):
        with open(path, "rb") as f:
            saved = pickle.load(f)
        if saved["stamp"] == stamp:
            return saved["parts"]
    parts = _build_originals()
    with open(path, "wb") as f:
        pickle.dump(dict(stamp=stamp, parts=parts), f)
    return parts


def _build_originals():
    ch = {i: (lab, sh) for i, lab, sh in SRC.top_children()}
    parts = {}      # name -> dict(group, source_idx, pose(4x4), meshes{role: mesh}, material per role)

    # flex-PCB base --------------------------------------------------------
    m = shape_mesh(ch[0][1], 0.05)
    b = m.bounds
    T = Tm(-(b[0][0] + b[1][0]) / 2, -(b[0][1] + b[1][1]) / 2, PCB_Z0 - b[0][2])
    parts["pcb_base"] = dict(group="pcb", idx=0, pose=T, meshes={"main": m}, mat={"main": "pcb_green"},
                             label="Flex-PCB base (original board outline)")

    # Arduino Nano ---------------------------------------------------------
    solids = SRC.tessellate(ch[8][1], 0.12, 0.6)
    roles = {}
    for s in solids:
        roles.setdefault(nano_class(s.metadata["label"], 0), []).append(s)
    T = seat(solids, ROT_NANO, (-8.0, 30.0), PCB_TOP)
    budgets = dict(board=7000, headers=4000, usb=3000, chips=3500, small=9000)
    parts["arduino_nano"] = dict(
        group="arduino_nano", idx=8, pose=T,
        meshes={r: decimate(SRC.merged(v), budgets[r]) for r, v in roles.items()},
        mat=dict(board="pcb_blue", headers="black", usb="steel", chips="black", small="passive"),
        label="Arduino Nano (original model)")

    # MPU6050 IMU ----------------------------------------------------------
    solids = SRC.tessellate(ch[22][1], 0.05, 0.4)
    board = max(solids, key=lambda s: np.prod(s.bounds[1] - s.bounds[0]))
    rest = [s for s in solids if s is not board]
    T = seat(solids, ROT_NANO, (30.0, 30.0), PCB_TOP)
    parts["imu_mpu6050"] = dict(group="imu", idx=22, pose=T, meshes={"board": board, "parts": SRC.merged(rest)},
                                mat=dict(board="pcb_blue", parts="black"), label="MPU6050 IMU (original model)")

    # MOSFET (TO-220 body) -------------------------------------------------
    solids = SRC.tessellate(ch[9][1], 0.05, 0.4)
    is_leg = [bool(np.ptp(s.bounds[:, 2]) > 9 and np.ptp(s.bounds[:, 1]) < 1.0) for s in solids]
    is_tab = [bool(s.bounds[0][2] > 21.0) for s in solids]
    legs = [s for s, a in zip(solids, is_leg) if a]
    tab = [s for s, a in zip(solids, is_tab) if a]
    body = [s for s, a, b in zip(solids, is_leg, is_tab) if not a and not b]
    T = seat(solids, np.eye(3), (30.0, -22.0), PCB_TOP)
    parts["mosfet"] = dict(group="mosfet", idx=9, pose=T,
                           meshes={"body": SRC.merged(body), "metal": SRC.merged(legs + tab)},
                           mat=dict(body="black", metal="steel"), label="MOSFET, TO-220 (original model)")

    # transmitter module ---------------------------------------------------
    m = shape_mesh(ch[10][1], 0.05)
    T = seat([m], np.eye(3), (6.0, -22.0), PCB_TOP)
    parts["transmitter"] = dict(group="transmitter", idx=10, pose=T, meshes={"main": m}, mat={"main": "pcb_green"},
                                label="Transmitter module (original model)")

    # spring: source part, role undocumented --------------------------------
    m = shape_mesh(ch[18][1], 0.1, 0.6)
    c, ax = SRC.pca_frame(m)
    W = np.array([[0, 0, 1], [1, 0, 0], [0, 1, 0]], float)
    R3 = W @ ax
    mm = m.copy(); mm.apply_translation(-c)
    T = seat([mm], R3, (-32.0, -26.0), PCB_TOP)
    T = T @ Tm(*(-c))
    parts["spring_source"] = dict(group="spring_source", idx=18, pose=T, meshes={"main": decimate(m, 9000)},
                                  mat={"main": "steel"}, label="Spring (original part; its role is not documented)")

    # battery holder + 18650 cell -------------------------------------------
    m = shape_mesh(ch[16][1], 0.05)
    b = m.bounds
    T = Tm(-(b[0][0] + b[1][0]) / 2, -(b[0][1] + b[1][1]) / 2, FLOOR_Z - b[0][2])
    parts["battery_holder"] = dict(group="battery", idx=16, pose=T, meshes={"main": m}, mat={"main": "graphite"},
                                   label="Single-cell battery holder (original model)")
    cell_solids = SRC.tessellate(ch[17][1], 0.05, 0.3)
    cell = max(cell_solids, key=lambda s: np.prod(s.bounds[1] - s.bounds[0]))
    R3 = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)          # cell axis Z -> Y
    holder_top_of_floor = FLOOR_Z + 1.0
    zc = holder_top_of_floor + 9.1
    allv = cell.vertices @ R3.T
    lo, hi = allv.min(0), allv.max(0)
    T = np.eye(4); T[:3, :3] = R3
    T[:3, 3] = [-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, zc - (lo[2] + hi[2]) / 2]
    parts["battery_cell"] = dict(group="battery", idx=17, pose=T, meshes={"main": decimate(cell, 9000)},
                                 mat={"main": "cell"}, label="18650 Li-ion cell (original model)")
    return parts


# ------------------------------------------------------------ reconstructed ----
def build_reconstructed():
    from build123d import Box, Cylinder, Location, Plane, Pos, Solid, Vector, Compound, Rot
    rec = {}

    # lattice frame
    frame = FR.build_frame()
    rec["frame_lattice"] = dict(group="frame", solid=frame, mat="frame",
                                label="Lattice frame (reconstructed; original unreadable)")

    # four PCB standoff posts
    for i, (sx, sy) in enumerate([(-1, -1), (1, -1), (1, 1), (-1, 1)], 1):
        h = PCB_Z0 - FLOOR_Z
        s = Pos(sx * 43.0, sy * 43.0, FLOOR_Z) * Cylinder(2.5, h, align=_ALIGN)
        rec[f"standoff_{i}"] = dict(group="standoffs", solid=s, mat="graphite",
                                    label="PCB standoff (reconstructed)")

    # antenna cassette (cassette frame -> world: +Z_TOP)
    cx, cz = P["hub"]
    xe, tz = P["exit_x"], P["top_z"]
    X0, X1 = -15.5, 12.5
    xm, wx = (X0 + X1) / 2, X1 - X0
    base = Pos(xm, 0, 0) * Box(wx, 14, 3, align=_ALIGN)
    back = Pos(xm, 7 - 1.25, 3) * Box(wx, 2.5, tz - 2.0 - 3, align=_ALIGN)
    back = back - Pos(cx, 7 - 1.25, cz) * Rot(X=90) * Cylinder(1.4, 3.0, align=(_C, _C, _C))
    front = Pos(xm, -7 + 1.25, 3) * Box(wx, 2.5, tz - 2.0 - 3, align=_ALIGN)
    window = Pos((cx - 8.6 + xe + 2.5) / 2, -7 + 1.25, 3) * Box(xe + 2.5 - (cx - 8.6), 3.0, tz - 2.0 - 3, align=_ALIGN)
    front = front - window
    cap = Pos(xm, 0, tz - 2.0) * Box(wx, 14, 2.0, align=_ALIGN)
    slot = Pos(xe + 0.8, 0, tz - 2.5) * Box(3.4, 9.2, 3.5, align=_ALIGN)
    cap = cap - slot
    hub = Pos(cx, 0, cz) * Rot(X=90) * Cylinder(P["core_radius"], 9.0, align=(_C, _C, _C))
    axle = Pos(cx, 0, cz) * Rot(X=90) * Cylinder(1.2, 14.0, align=(_C, _C, _C))
    cass = dict(cassette_base=base, cassette_cheek_back=back, cassette_cheek_front=front, cassette_cap=cap,
                cassette_hub=hub + axle)
    for n, s in cass.items():
        rec[n] = dict(group="antenna_cassette", solid=Pos(0, 0, Z_TOP) * s, mat="graphite" if n != "cassette_hub" else "steel",
                      label="Antenna cassette (reconstructed)")

    # burn-wire hardware: posts, restraint cord, nichrome wire, terminals
    cord_z = tz + 7.0
    for i, sy in enumerate((-1, 1)):
        post = Pos(xe, sy * 5.8, tz) * Cylinder(1.1, cord_z + 2.5 - tz, align=_ALIGN)
        rec[f"cord_post_{'ab'[i]}"] = dict(group="burn_wire", solid=Pos(0, 0, Z_TOP) * post, mat="graphite", label="Cord post (reconstructed)")
        term = Pos(xe + 6.0, sy * 2.5, tz) * Box(2.4, 2.4, 1.2, align=_ALIGN)
        rec[f"terminal_{'ab'[i]}"] = dict(group="burn_wire", solid=Pos(0, 0, Z_TOP) * term, mat="gold", label="Wire terminal (reconstructed)")
    cord = Pos(xe, 0, cord_z) * Rot(X=90) * Cylinder(0.4, 9.4, align=(_C, _C, _C))
    rec["restraint_cord"] = dict(group="burn_wire", solid=Pos(0, 0, Z_TOP) * cord, mat="cord", label="Restraint cord (reconstructed)")
    return rec, dict(cord_z=cord_z)


def tube(points, radius, sides=8):
    """Simple swept tube through a polyline (for the nichrome helix and its leads)."""
    pts = np.asarray(points, float)
    verts, faces = [], []
    for i, p in enumerate(pts):
        t = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]
        t /= np.linalg.norm(t)
        a = np.array([0, 0, 1.0]) if abs(t[2]) < 0.9 else np.array([1.0, 0, 0])
        u = np.cross(t, a); u /= np.linalg.norm(u); v = np.cross(t, u)
        for k in range(sides):
            ang = 2 * math.pi * k / sides
            verts.append(p + radius * (math.cos(ang) * u + math.sin(ang) * v))
    for i in range(len(pts) - 1):
        for k in range(sides):
            a, b = i * sides + k, i * sides + (k + 1) % sides
            c, d = (i + 1) * sides + k, (i + 1) * sides + (k + 1) % sides
            faces += [[a, b, d], [a, d, c]]
    m = trimesh.Trimesh(np.array(verts), np.array(faces), process=False)
    return m


def nichrome_meshes(cord_z):
    """Helix wound round the cord, and two leads down to the terminals (cassette frame + Z_TOP)."""
    xe, tz = P["exit_x"], P["top_z"]
    zc = Z_TOP + cord_z
    n = 80
    t = np.linspace(0, 1, n)
    y = -1.4 + 2.8 * t
    ang = 2 * math.pi * 4.5 * t
    helix = np.stack([xe + 0.62 * np.cos(ang), y, zc + 0.62 * np.sin(ang)], axis=1)
    out = {"nichrome_helix": tube(helix, 0.16, 6)}
    for i, sy in enumerate((-1, 1)):
        end = helix[0] if sy < 0 else helix[-1]
        pad = np.array([xe + 6.0, sy * 2.5, Z_TOP + tz + 1.2])
        mid = np.array([xe + 3.2, sy * 2.2, Z_TOP + tz + 4.5])
        lead = np.array([end, mid, pad])
        # smooth with a quadratic Bezier
        tt = np.linspace(0, 1, 16)[:, None]
        curve = (1 - tt) ** 2 * end + 2 * (1 - tt) * tt * mid + tt ** 2 * pad
        out[f"nichrome_lead_{'ab'[i]}"] = tube(curve, 0.16, 6)
    return out


def tape_solids():
    """Tape as STEP/STL solids: the stowed coil (flat band) and the deployed straight blade (curved section)."""
    import shapely.geometry as sg
    from build123d import Face, Solid, Vector, Wire, Pos
    out = {}
    pts, info = TP.centreline(P["stowed_stub"], P, step=0.4)
    line = sg.LineString(pts)
    band = line.buffer(P["thickness"] / 2, cap_style=2, join_style=2, resolution=2).simplify(0.01)
    ext = list(band.exterior.coords)[:-1]
    face = Face(Wire.make_polygon([Vector(x, -P["width"] / 2, Z_TOP + z) for x, z in ext], close=True))
    out["antenna_tape_stowed"] = Solid.extrude(face, Vector(0, P["width"], 0))
    # deployed: straight section (curved cross-section) + the same coil remainder
    e = P["deployed_extension"]
    pts, info = TP.centreline(e, P, step=0.4)
    out["antenna_tape_deployed"] = None
    # straight blade: arc band extruded along +Z
    w, s, t = P["width"], P["sagitta"], P["thickness"]
    R = (w * w) / (8 * s) + s / 2
    half = math.asin(w / 2 / R)
    n = 24
    xs_o, xs_i = [], []
    for k in range(n + 1):
        a = -half + 2 * half * k / n
        xs_o.append((P["exit_x"] + (R + t / 2) * math.cos(a) - R + s / 2, (R + t / 2) * math.sin(a)))
        xs_i.append((P["exit_x"] + (R - t / 2) * math.cos(a) - R + s / 2, (R - t / 2) * math.sin(a)))
    ring = xs_o + xs_i[::-1]
    f2 = Face(Wire.make_polygon([Vector(x, y, Z_TOP + P["top_z"]) for x, y in ring], close=True))
    blade = Solid.extrude(f2, Vector(0, 0, e))
    out["antenna_tape_deployed"] = blade
    return out, info


# ------------------------------------------------------------------- export ---
class Assembly:
    pass


def mats_for(name):
    r, m, ro = MAT[name]
    return trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
        baseColorFactor=list(r), metallicFactor=m, roughnessFactor=ro, doubleSided=False))


def collect_nodes(orig, rec, wires):
    """Flat list of GLB nodes: (name, group, source, mesh in CAD world, material, label)."""
    nodes = []
    for pname, p in orig.items():
        for role, mesh in p["meshes"].items():
            name = pname if len(p["meshes"]) == 1 else f"{pname}_{role}"
            nodes.append(dict(name=name, group=p["group"], source="original", mesh=moved(mesh, p["pose"]),
                              mat=p["mat"][role], label=p["label"]))
    for name, r in rec.items():
        sol = r["solid"]
        m = shape_mesh(sol, 0.03, 0.2)
        nodes.append(dict(name=name, group=r["group"], source="reconstructed", mesh=m, mat=r["mat"], label=r["label"]))
    for name, m in wires.items():
        nodes.append(dict(name=name, group="burn_wire", source="reconstructed", mesh=m,
                          mat="nichrome", label="Nichrome wire (reconstructed)"))
    return nodes


GROUP_LABELS = dict(
    frame="Frame", standoffs="PCB standoffs", pcb="Flex-PCB base", arduino_nano="Arduino Nano", imu="MPU6050 IMU",
    mosfet="MOSFET", transmitter="Transmitter module", spring_source="Spring", battery="18650 cell and holder",
    antenna_cassette="Antenna cassette", burn_wire="Burn wire",
)
GROUP_SOURCE = dict(
    frame="reconstructed", standoffs="reconstructed", pcb="original", arduino_nano="original", imu="original",
    mosfet="original", transmitter="original", spring_source="original", battery="original",
    antenna_cassette="reconstructed", burn_wire="reconstructed",
)


def export_glb(nodes):
    sc = trimesh.Scene()
    conv = np.eye(4); conv[:3, :3] = [[1, 0, 0], [0, 0, 1], [0, -1, 0]]
    sc.graph.update(frame_from=sc.graph.base_frame, frame_to="cubesat", matrix=conv @ np.diag([0.001, 0.001, 0.001, 1]))
    groups = {}
    for n in nodes:
        groups.setdefault(n["group"], []).append(n)
    for g in groups:
        sc.graph.update(frame_from="cubesat", frame_to=f"grp_{g}", matrix=np.eye(4))
    for n in nodes:
        m = n["mesh"].copy(); m.visual = mats_for(n["mat"])
        sc.add_geometry(m, node_name=n["name"], geom_name=n["name"] + "_mesh", parent_node_name=f"grp_{n['group']}")
    path = os.path.join(OUT, "glb", "cubesat.glb")
    sc.export(path)
    return path


def export_stl(nodes, tapes):
    d = os.path.join(OUT, "stl")
    sizes = {}
    by = {}
    for n in nodes:
        by.setdefault(n["group"], []).append(n["mesh"])
    for g, ms in by.items():
        if g in ("frame", "antenna_cassette", "burn_wire", "pcb", "battery", "standoffs"):
            m = trimesh.util.concatenate(ms)
            m.export(os.path.join(d, f"cubesat_{g}.stl"))
            sizes[f"cubesat_{g}"] = [len(m.faces), round(os.path.getsize(os.path.join(d, f"cubesat_{g}.stl")) / 1e6, 2)]
    for k, s in tapes.items():
        if s is None:
            continue
        m = shape_mesh(s, 0.02, 0.2)
        m.export(os.path.join(d, f"cubesat_{k}.stl"))
        sizes[f"cubesat_{k}"] = [len(m.faces), round(os.path.getsize(os.path.join(d, f"cubesat_{k}.stl")) / 1e6, 2)]
    return sizes


def loc4(T):
    from build123d import Location
    from OCP.gp import gp_Trsf
    t = gp_Trsf(); t.SetValues(*T[0, :4], *T[1, :4], *T[2, :4]); return Location(t)


def export_step(orig, rec, tapes):
    from build123d import Color, Compound, export_step as _export
    ch = {i: (lab, sh) for i, lab, sh in SRC.top_children()}
    groups = {}
    for pname, p in orig.items():
        # Pose each solid individually: its tessellation is exactly what the pose was measured on, so this is
        # correct whatever location the imported assembly node carries.
        P = loc4(p["pose"])
        kids = []
        for leaf in SRC.solids_of(ch[p["idx"]][1]):
            s = P * leaf
            s.label = leaf.label or pname
            try:
                s.color = Color(*MAT[list(p["mat"].values())[0]][0][:3])
            except Exception:
                pass
            kids.append(s)
        groups.setdefault(p["group"], []).append(Compound(label=pname, children=kids))
    for name, r in rec.items():
        s = r["solid"]; s.label = name; s.color = Color(*MAT[r["mat"]][0][:3])
        groups.setdefault(r["group"], []).append(s)
    for name, s in tapes.items():
        if s is None:
            continue
        s.label = name; s.color = Color(*MAT["steel"][0][:3])
        groups.setdefault("antenna_tape", []).append(s)
    root = Compound(label="cubesat_1u", children=[Compound(label=g, children=kids) for g, kids in groups.items()])
    path = os.path.join(OUT, "step", "cubesat_assembly.step")
    _export(root, path)
    return path


# --------------------------------------------------------------- validation ---
def overlap_volume(a, b):
    try:
        v = (a & b)
        return float(sum(s.volume for s in SRC.solids_of(v))) if v is not None else 0.0
    except Exception:
        return float("nan")


def validate(nodes, orig, rec, tape_info):
    out = {}
    # 1 hierarchy
    out["hierarchy"] = dict(
        nodes=len(nodes), groups=sorted({n["group"] for n in nodes}),
        original_nodes=sum(n["source"] == "original" for n in nodes),
        reconstructed_nodes=sum(n["source"] == "reconstructed" for n in nodes),
        duplicate_names=len(nodes) - len({n["name"] for n in nodes}),
    )
    # 2 interior parts inside the cavity (axis-aligned), minimum clearance to the inner walls
    inner = ("pcb", "arduino_nano", "imu", "mosfet", "transmitter", "spring_source", "battery", "standoffs")
    lo = np.full(3, 1e9); hi = np.full(3, -1e9)
    for n in nodes:
        if n["group"] in inner:
            b = n["mesh"].bounds; lo = np.minimum(lo, b[0]); hi = np.maximum(hi, b[1])
    out["interior_extent_mm"] = dict(
        min=lo.round(2).tolist(), max=hi.round(2).tolist(),
        side_clearance_to_cavity_walls_mm=round(float(min(CAV - hi[0], CAV - hi[1], lo[0] + CAV, lo[1] + CAV)), 3),
        top_clearance_mm=round(float(CAV - hi[2]), 2),
        note="the standoffs and the battery holder rest on the bottom plate (zero clearance by design)")
    # 3 pairwise interference: boolean on the meshes (manifold3d) wherever both are closed volumes
    def closed(m):
        mm = m.copy(); mm.merge_vertices(digits_vertex=4); mm.remove_unreferenced_vertices()
        if not mm.is_volume:
            trimesh.repair.fill_holes(mm); trimesh.repair.fix_normals(mm)
        return mm

    cl = {n["name"]: closed(n["mesh"]) for n in nodes}
    boxes = {n["name"]: n["mesh"].bounds for n in nodes}
    byname = {n["name"]: n for n in nodes}
    names = [n["name"] for n in nodes]
    hits, touching, unchecked, checked = [], [], [], 0
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            na, nb = names[i], names[j]
            ga, gb = byname[na]["group"], byname[nb]["group"]
            A, B = boxes[na], boxes[nb]
            if (A[1] < B[0] - 0.01).any() or (B[1] < A[0] - 0.01).any():
                continue
            ov = np.minimum(A[1], B[1]) - np.maximum(A[0], B[0])
            ma, mb = cl[na], cl[nb]
            if ma.is_volume and mb.is_volume:
                checked += 1
                try:
                    v = trimesh.boolean.intersection([ma, mb], engine="manifold")
                    vol = float(v.volume) if len(v.faces) else 0.0
                except Exception:
                    vol = float("nan")
                (hits if (vol != vol or vol > 0.5) else touching).append(
                    dict(a=na, b=nb, overlap_mm3=round(vol, 3), box_overlap_mm=ov.round(2).tolist()))
            else:
                same = ga == gb
                pa, pb = ma.sample(4000), mb.sample(4000)
                dmin = float(min(trimesh.proximity.closest_point(mb, pa)[1].min(), trimesh.proximity.closest_point(ma, pb)[1].min()))
                inside = 0
                if mb.is_volume:
                    inside += int(mb.contains(pa).sum())
                if ma.is_volume:
                    inside += int(ma.contains(pb).sum())
                unchecked.append(dict(a=na, b=nb, same_part=same, min_surface_distance_mm=round(dmin, 3),
                                      sampled_points_inside_a_closed_partner=inside, box_overlap_mm=ov.round(2).tolist()))
    out["interference"] = dict(pairs_boolean_checked=checked, overlaps_over_0p5_mm3=hits, contacts_or_tiny=touching,
                               pairs_with_overlapping_boxes_not_boolean_checked=unchecked,
                               note="mesh booleans (manifold3d) on closed meshes; for pairs where a mesh is open (decimated electronics, tubes) the report gives sampled surface distance and the number of 4000 sampled points that fall inside a closed partner (an approximation, not a boolean)")
    # 4 antenna mechanics
    cx, cz = P["hub"]
    r_st = tape_info["stowed"]["coil_radius"]
    out["antenna"] = dict(
        coil_radius_stowed_mm=r_st,
        coil_clearance_to_cassette_floor_mm=round(cz - r_st - 3.0, 3),
        coil_clearance_to_cap_mm=round((P["top_z"] - 2.0) - (cz + r_st), 3),
        coil_clearance_to_cheek_window_left_mm=round((cx - (cx - 8.6)) - r_st, 3),
        slot_clearance_x_mm=round(3.4 - (P["sagitta"] + P["thickness"]), 3),
        slot_clearance_y_mm=round(9.2 - P["width"], 3),
        cord_above_stub_tip_mm=round(7.0 - P["stowed_stub"] - 0.4, 3),
        post_clearance_to_tape_edge_mm=round(5.8 - 1.1 - P["width"] / 2, 3),
        tape_length_conserved_mm=[tape_info[k]["total_length"] for k in ("stowed", "half", "deployed")],
        deploy_axis="+Z (world), out of the top plate; tape leaves the cap at x=%.1f mm, y=0" % P["exit_x"],
        deployed_tip_z_mm=Z_TOP + P["top_z"] + P["deployed_extension"],
    )
    return out


# --------------------------------------------------------------------- main ---
_C = None
_MIN = None
_ALIGN = None


def _init_align():
    global _C, _MIN, _ALIGN
    from build123d import Align
    _C, _MIN = Align.CENTER, Align.MIN
    _ALIGN = (Align.CENTER, Align.CENTER, Align.MIN)


def main():
    t0 = time.time()
    _init_align()
    orig = build_originals()
    print("originals placed", round(time.time() - t0, 1), "s")
    rec, aux = build_reconstructed()
    print("reconstructed built", round(time.time() - t0, 1), "s")
    wires = nichrome_meshes(aux["cord_z"])
    nodes = collect_nodes(orig, rec, wires)
    tapes, _ = tape_solids()
    glb = export_glb(nodes)
    stl = export_stl(nodes, tapes)
    print("glb", round(os.path.getsize(glb) / 1e6, 2), "MB; nodes", len(nodes), "tris", sum(len(n["mesh"].faces) for n in nodes))

    tape_info = TP.reference_values()
    val = validate(nodes, orig, rec, tape_info)
    val["glb_mb"] = round(os.path.getsize(glb) / 1e6, 2)
    val["triangles"] = sum(len(n["mesh"].faces) for n in nodes)
    val["stl_faces_mb"] = stl

    all_b = np.array([n["mesh"].bounds for n in nodes])
    gb = {}
    for n in nodes:
        b = n["mesh"].bounds
        lo, hi = gb.get(n["group"], (b[0], b[1]))
        gb[n["group"]] = (np.minimum(lo, b[0]), np.maximum(hi, b[1]))
    val["group_bounds_mm"] = {g: dict(min=lo.round(1).tolist(), max=hi.round(1).tolist()) for g, (lo, hi) in gb.items()}
    val["assembly_bounds_mm"] = dict(min=all_b[:, 0].min(0).round(1).tolist(), max=all_b[:, 1].max(0).round(1).tolist())

    manifest = dict(
        units="metres, Y up, origin at the centre of the 100 mm cube (CAD: millimetres, Z up; the antenna deploys along CAD +Z = glTF +Y)",
        groups={g: dict(label=GROUP_LABELS[g], source=GROUP_SOURCE[g], nodes=[n["name"] for n in nodes if n["group"] == g]) for g in GROUP_LABELS},
        sources={
            "original": "3d models/cubesat/madhav/ffpcb.stp (Creo export of fpcb_asm_1.asm): flex-PCB base, Arduino Nano, MPU6050, "
                        "MOSFET, transmitter module, battery holder, 18650 cell, spring. Placement is mine; the STEP leaves them unmated.",
            "reconstructed": "frame, standoffs, antenna cassette, burn-wire hardware, tape antenna: modelled here; no original geometry exists in a readable form.",
        },
        antenna=dict(
            kind="steel tape-spring antenna (the case study says 'steel tape antenna'); stored energy is the coiled tape's elastic strain",
            tape=P, reference=tape_info,
            cassette_origin_mm=[0.0, 0.0, Z_TOP], axis_mm=[0.0, 1.0, 0.0],
            axis_note="reel axis is the cassette's Y; the straight tape leaves at x=exit_x, directed +Z; all x/z values are relative to the cassette origin",
            restraint=dict(cord_z=aux["cord_z"], cord_radius=0.4, cord_y=[-5.8, 5.8], cord_x=P["exit_x"], posts_y=[-5.8, 5.8],
                           nichrome=dict(wire_radius=0.16, helix_radius=0.62, turns=4.5, y=[-1.4, 1.4])),
            sequence_s_illustrative=dict(heat=1.1, deploy=2.0, settle=2.2,
                                         note="timing is a depiction, not a measured or specified value"),
        ),
        labels={"frame": "Frame", "antenna_cassette": "Antenna tape", "burn_wire": "Burn wire", "arduino_nano": "Arduino Nano",
                "imu": "MPU6050 IMU", "battery": "18650 cell", "mosfet": "MOSFET"},
        assumptions=[
            "Frame: 100 mm cube with 2.5 mm walls. The original Creo frame is unreadable; the 94.8 x 94.0 mm flex-PCB board in the source fits a 95 mm cavity. "
            "Window pattern: hexagonal opening, ribs and four screw holes per face are modelled on the Fusion study screenshots, not measured.",
            "Top and bottom plates: ring of wedge slots modelled on the study screenshot of the top plate; the bottom plate is assumed to match.",
            "Component layout: the STEP leaves every component at its own origin (duplicates coincide), so positions inside the frame are my arrangement.",
            "Antenna: tape 8 x 0.4 mm, 190 mm long, transverse curvature 1.4 mm, 150 mm deployed. None of these is from the source; the source has no antenna geometry.",
            "Release: a nylon-style restraint cord across the tape's exit, severed by heated nichrome wire. The case study names a burn-wire mechanism; its geometry is not in the source.",
            "The source's spring (9.3 x 7.3 mm, thin wire) is shown as an original part. Its role in the real design is not documented and it is not animated.",
            "Timing and speed of release and deployment are illustrative.",
        ],
    )
    with open(os.path.join(OUT, "cubesat.manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    with open(os.path.join(OUT, "validation.json"), "w") as f:
        json.dump(val, f, indent=1, default=lambda o: o.tolist() if hasattr(o, "tolist") else str(o))

    if os.environ.get("CUBESAT_STEP", "1") == "1":
        step = export_step(orig, rec, tapes)
        val["step_mb"] = round(os.path.getsize(step) / 1e6, 1)
        with open(os.path.join(OUT, "validation.json"), "w") as f:
            json.dump(val, f, indent=1, default=lambda o: o.tolist() if hasattr(o, "tolist") else str(o))
        print("step", val["step_mb"], "MB")
    print(json.dumps({k: val[k] for k in ("hierarchy", "interior_extent_mm", "antenna", "assembly_bounds_mm")}, indent=1, default=str))
    print("interference > 0.5 mm3:", val["interference"]["overlaps_over_0p5_mm3"] or "none",
          "| pairs boolean-checked", val["interference"]["pairs_boolean_checked"],
          "| unchecked", len(val["interference"]["pairs_with_overlapping_boxes_not_boolean_checked"]))
    print("touching/tiny:", [(t["a"], t["b"], t["overlap_mm3"]) for t in val["interference"]["contacts_or_tiny"]])
    for u in val["interference"]["pairs_with_overlapping_boxes_not_boolean_checked"]:
        if not u["same_part"]:
            print("  sampled:", u["a"], "x", u["b"], "min dist", u["min_surface_distance_mm"], "inside", u["sampled_points_inside_a_closed_partner"])
    print("time", round(time.time() - t0, 1), "s")


if __name__ == "__main__":
    main()
