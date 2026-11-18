"""
Build, validate and export the complete hexapod.

    python cad/hexapod/build.py            # from the repository root

Outputs (cad/hexapod/export/):
    step/hexapod_chassis.step          designed parts as editable B-rep (plates, standoffs, hardware, Mega)
    step/hexapod_assembly.step         full robot at the standing pose (legs as faceted solids)
    step/chassis_top_plate.step, chassis_bottom_plate.step
    dxf/chassis_top_plate.dxf, chassis_bottom_plate.dxf   (2D profiles for laser / CNC)
    stl/chassis_top_plate.stl, chassis_bottom_plate.stl
    glb/hexapod.glb                    web model: joint hierarchy + baked tripod-gait clip
    hexapod.manifest.json              node names, stance, gait parameters, component inventory
    validation.json                    reachability, joint ranges, collision and ground-contact results
    views/*.png                        inspection renders
"""
import itertools
import json
import os
import sys
import time

import numpy as np
import trimesh

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
os.chdir(ROOT)
sys.path.insert(0, HERE)

from build123d import Color, Compound, Location, Mesher, export_step, ExportDXF, Plane, section  # noqa: E402
from OCP.gp import gp_Trsf  # noqa: E402

import chassis as C  # noqa: E402
from rig import (CONFIG, PARTS, foot_tip_local, horn_mount, ik, leg_transforms, load,  # noqa: E402
                 S1_in_j1, S2_in_j2, S3_in_j3, rz)

OUT = os.path.join(HERE, "export")
for d in ("step", "dxf", "stl", "glb", "views"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

# ---------------------------------------------------------------- params ---
GAIT = dict(
    radial=140.0,      # neutral foot distance from its coxa axis (mm); leaves ~35 mm reach margin
    ground_z=-94.0,    # ground plane relative to the top-plate top surface (mm)
    stride=50.0,       # foot travel relative to the body during one stance phase (mm)
    lift=30.0,         # swing-foot clearance (mm)
    frames=48,         # samples per gait cycle
    heading=90.0,      # direction of travel in the CAD XY plane (deg from +X)
    period=1.6,        # seconds per cycle at 1x (the website scrubs it with scroll)
)
LEGS = [  # name, angle (deg from +X), tripod group; +Y is forward
    ("middle_right", 0, "A"), ("front_right", 60, "B"), ("front_left", 120, "A"),
    ("middle_left", 180, "B"), ("rear_left", 240, "A"), ("rear_right", 300, "B"),
]
COLORS = {  # printed parts alternate the two filament colours seen on the real robot
    "blue": (0.13, 0.29, 0.86), "white": (0.93, 0.93, 0.92), "black": (0.07, 0.07, 0.08),
}


def mat_to_loc(T):
    t = gp_Trsf()
    t.SetValues(*T[0, :4], *T[1, :4], *T[2, :4])
    return Location(t)


def j1_matrix(angle):
    r0 = C.P["R_coxa"] - C.P["j1_shaft_y"]
    T = np.eye(4)
    T[:3, 3] = (r0 * np.cos(np.radians(angle)), r0 * np.sin(np.radians(angle)), 0.0)
    a = np.radians(angle - 90)
    T[:2, :2] = [[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]]
    return T


# ------------------------------------------------------------ stance/IK ---
def stance_angles():
    """Joint angles for the standing pose, solved twice: first for the tapered tip,
    then for the vertex of the tibia that is actually lowest in that pose, so the
    foot touches the ground plane exactly where the real part would."""
    import rig
    rig.FOOT_OVERRIDE = None
    first = _solve_stance()
    name = LEGS[0][0]
    T = leg_transforms(*first[name]["q"], T_j1=first[name]["T_j1"])["leg"]
    V = load("leg").vertices
    w = (T[:3, :3] @ V.T).T + T[:3, 3]
    rig.FOOT_OVERRIDE = V[np.argmin(w[:, 2])].copy()
    return _solve_stance()


def _solve_stance():
    out = {}
    for name, ang, _ in LEGS:
        Tj1 = j1_matrix(ang)
        axis = leg_transforms(0, 0, 0, T_j1=Tj1)["S1"][:3, 3]
        t = np.radians(ang)
        target = np.array([axis[0] + GAIT["radial"] * np.cos(t),
                           axis[1] + GAIT["radial"] * np.sin(t), GAIT["ground_z"]])
        best = None
        for q1 in np.radians(np.arange(-150, 151, 30)):
            q, err = ik(target, np.array([q1, np.radians(50), np.radians(40)]), T_j1=Tj1)
            if err < 1e-3 and abs(q[1]) < np.radians(100) and (best is None or abs(q[0]) < abs(best[0])):
                best = q
        if best is None:
            raise RuntimeError(f"stance unreachable for {name}")
        out[name] = dict(q=best, foot=target, T_j1=Tj1)
    return out


def gait_cycle(stance):
    """Tripod gait: group A in stance while group B swings, then swap. Returns
    per-frame joint angles (radians) for every leg and the max IK residual."""
    N, S, H = GAIT["frames"], GAIT["stride"], GAIT["lift"]
    q_prev = {n: stance[n]["q"].copy() for n in stance}
    frames, worst = [], 0.0
    for f in range(N + 1):
        ph = f / N
        row = {}
        for name, _, group in LEGS:
            p = (ph + (0.0 if group == "A" else 0.5)) % 1.0
            if p < 0.5:                              # stance: foot slides back along -Y
                u = p / 0.5
                dy, dz = S / 2 - S * u, 0.0
            else:                                    # swing: lift and bring forward
                u = (p - 0.5) / 0.5
                dy = -S / 2 + S * (0.5 - 0.5 * np.cos(np.pi * u))
                dz = H * np.sin(np.pi * u)
            h = np.radians(GAIT["heading"])
            target = stance[name]["foot"] + np.array([dy * np.cos(h), dy * np.sin(h), dz])
            q, err = ik(target, q_prev[name], T_j1=stance[name]["T_j1"])
            worst = max(worst, err)
            q_prev[name] = q
            row[name] = q
        frames.append(row)
    return frames, worst


# ------------------------------------------------------------- meshes ----
def tess(shape, tol=0.08):
    v, f = shape.tessellate(tol, 0.25)
    return trimesh.Trimesh(np.array([(p.X, p.Y, p.Z) for p in v]), np.array(f), process=True)


def colored(mesh, rgb):
    m = mesh.copy()
    m.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
        baseColorFactor=[*rgb, 1.0], metallicFactor=0.0, roughnessFactor=0.6))
    return m


def build_meshes():
    """Static meshes, each in its own local frame."""
    stl = {k: load(k) for k in PARTS}
    case, horn = C.mg996r("servo")
    return dict(
        j1=stl["j1"], j2=stl["j2"], j3=stl["j3"], leg=stl["leg"],
        servo_case=tess(case, 0.05), servo_horn=tess(horn, 0.05),
        top=tess(C.top_plate()), bottom=tess(C.bottom_plate()),
        standoffs=trimesh.util.concatenate([tess(s) for s in C.standoffs()]),
        mega=[(s.label, tess(s), s.color) for s in C.arduino_mega()[0]],
    )


def posed_leg_meshes(M, Tj1, q):
    """World-space meshes of one leg for collision tests."""
    T = leg_transforms(*q, T_j1=Tj1)
    d = {}
    for k in ("j1", "j2", "j3", "leg"):
        d[k] = M[k].copy().apply_transform(T[k])
    for s in ("S1", "S2", "S3"):
        d[s + "_case"] = M["servo_case"].copy().apply_transform(T[s])
        # horns rotate with the link they drive
        piv = {"S1": "coxa", "S2": "femur", "S3": "tibia"}[s]
        d[s + "_horn"] = M["servo_horn"].copy().apply_transform(T[piv])
    return d


# Designed contacts that are not collisions: a servo case seated in its own
# printed cradle (MG996R case 40.7 mm in a 40.0 mm pocket -> ~0.35 mm press fit
# per side), and a horn bolted to the link it drives.
ALLOWED = {("j1", "S1_case"), ("j2", "S2_case"), ("j3", "S3_case"),
           ("S1_horn", "j2"), ("S2_horn", "j3"), ("S3_horn", "leg"),
           ("S1_case", "S1_horn"), ("S2_case", "S2_horn"), ("S3_case", "S3_horn")}
PRESS_FIT_LIMIT = 260.0   # mm^3


def overlap(A, B):
    lo = np.maximum(A.bounds[0], B.bounds[0]); hi = np.minimum(A.bounds[1], B.bounds[1])
    if np.any(lo >= hi):
        return 0.0
    try:
        return float(trimesh.boolean.intersection([A, B], engine="manifold").volume)
    except Exception:
        return float("nan")


def collisions(M, stance, q_by_leg, plates):
    found = []
    legs = {n: posed_leg_meshes(M, stance[n]["T_j1"], q_by_leg[n]) for n, _, _ in LEGS}
    for n, parts in legs.items():                                 # within a leg
        for a, b in itertools.combinations(parts, 2):
            v = overlap(parts[a], parts[b])
            allowed = (a, b) in ALLOWED or (b, a) in ALLOWED
            if v > (PRESS_FIT_LIMIT if allowed else 5.0):
                found.append((n, a, b, round(v, 1)))
        for pn, pm in plates.items():                              # leg vs chassis
            for a, m in parts.items():
                v = overlap(m, pm)
                if v > 5.0 and not (a == "j1" and pn == "top"):   # j1 sits on the plate face
                    found.append((n, a, pn, round(v, 1)))
    names = [n for n, _, _ in LEGS]
    for i, n in enumerate(names):                                  # neighbouring legs
        m = names[(i + 1) % 6]
        A = trimesh.util.concatenate(list(legs[n].values())); B = trimesh.util.concatenate(list(legs[m].values()))
        v = overlap(A, B)
        if v > 5.0:
            found.append((n, "*", m, round(v, 1)))
    return found, legs


def ground_contact(legs, q_by_leg, stance):
    """Lowest point of every leg and of the chassis vs the ground plane."""
    res = {}
    for n, parts in legs.items():
        z = min(m.bounds[0][2] for m in parts.values())
        res[n] = round(z - GAIT["ground_z"], 2)
    return res


# -------------------------------------------------------------- export ---
def export_cad(stance):
    """Editable B-rep exports."""
    top, bot = C.top_plate(), C.bottom_plate()
    top.color = Color(*COLORS["black"]); bot.color = Color(*COLORS["black"])
    export_step(top, os.path.join(OUT, "step", "chassis_top_plate.step"))
    export_step(bot, os.path.join(OUT, "step", "chassis_bottom_plate.step"))
    for shape, name in ((top, "chassis_top_plate"), (bot, "chassis_bottom_plate")):
        tess(shape, 0.02).export(os.path.join(OUT, "stl", name + ".stl"))
        z = shape.bounding_box().max.Z - 0.5
        prof = section(shape, Plane.XY.offset(z))
        dxf = ExportDXF(); dxf.add_shape(prof); dxf.write(os.path.join(OUT, "dxf", name + ".dxf"))

    mega, spacers = C.arduino_mega()
    hardware = C.standoffs() + C.chassis_fasteners() + spacers
    for h in hardware:
        h.color = Color(0.6, 0.6, 0.62)
    designed = Compound(label="hexapod_chassis", children=[top, bot, Compound(label="arduino_mega_2560", children=mega),
                                                           Compound(label="hardware", children=hardware)])
    export_step(designed, os.path.join(OUT, "step", "hexapod_chassis.step"))

    # full assembly: supplied STL parts become faceted solids, servos are B-rep
    stl_solids = {}
    for k in PARTS:
        shapes = Mesher().read(os.path.join("3d models", "hexapod", PARTS[k]["file"]))
        stl_solids[k] = shapes[0]
    legs = []
    for name, ang, _ in LEGS:
        st = stance[name]
        T = leg_transforms(*st["q"], T_j1=st["T_j1"])
        idx = LEGS.index((name, ang, _))
        rgb_link = COLORS["blue"] if idx % 2 == 0 else COLORS["white"]
        rgb_alt = COLORS["white"] if idx % 2 == 0 else COLORS["blue"]
        kids = []
        for k, rgb in (("j1", rgb_alt), ("j2", rgb_link), ("j3", rgb_alt), ("leg", rgb_link)):
            s = mat_to_loc(T[k]) * stl_solids[k]
            s.label = f"{name}_{k}"; s.color = Color(*rgb); kids.append(s)
        for s, piv in (("S1", "coxa"), ("S2", "femur"), ("S3", "tibia")):
            case, horn = C.mg996r(f"{name}_{s}")
            case = mat_to_loc(T[s]) * case; case.label = f"{name}_{s}_mg996r"; case.color = Color(*COLORS["black"])
            horn = mat_to_loc(T[piv]) * horn; horn.label = f"{name}_{s}_horn"; horn.color = Color(0.82, 0.82, 0.84)
            kids += [case, horn]
        legs.append(Compound(label=f"leg_{name}", children=kids))
    full = Compound(label="hexapod", children=[designed, Compound(label="legs", children=legs)])
    export_step(full, os.path.join(OUT, "step", "hexapod_assembly.step"))


def trs(T):
    from scipy.spatial.transform import Rotation as R
    q = R.from_matrix(T[:3, :3]).as_quat()  # x, y, z, w
    return T[:3, 3].tolist(), q.tolist()


def export_glb(M, stance, frames):
    """Scene graph that mirrors the real kinematic chain, so a viewer can rotate
    each joint about its own servo shaft. Units: metres, Y up."""
    sc = trimesh.Scene()
    root = "hexapod"
    conv = np.eye(4); conv[:3, :3] = [[1, 0, 0], [0, 0, 1], [0, -1, 0]]   # Z-up -> Y-up
    conv = conv @ np.diag([0.001, 0.001, 0.001, 1])
    sc.graph.update(frame_from=sc.graph.base_frame, frame_to=root, matrix=conv)

    sc.add_geometry(colored(M["top"], COLORS["black"]), node_name="chassis_top_plate", parent_node_name=root)
    sc.add_geometry(colored(M["bottom"], COLORS["black"]), node_name="chassis_bottom_plate", parent_node_name=root)
    sc.add_geometry(colored(M["standoffs"], (0.6, 0.6, 0.62)), node_name="chassis_standoffs", parent_node_name=root)
    mega = trimesh.util.concatenate([colored(m, (0.0, 0.42, 0.55) if "pcb" in lab else (0.12, 0.12, 0.12)) for lab, m, c in M["mega"]])
    sc.add_geometry(mega, node_name="arduino_mega_2560", parent_node_name=root)

    pivots = {}
    for idx, (name, ang, _) in enumerate(LEGS):
        st = stance[name]; q = st["q"]
        link = COLORS["blue"] if idx % 2 == 0 else COLORS["white"]
        alt = COLORS["white"] if idx % 2 == 0 else COLORS["blue"]
        L = f"leg_{name}"
        sc.graph.update(frame_from=root, frame_to=L, matrix=st["T_j1"])
        sc.add_geometry(colored(M["j1"], alt), node_name=f"{L}_j1", parent_node_name=L)
        sc.add_geometry(colored(M["servo_case"], COLORS["black"]), node_name=f"{L}_coxa_servo",
                        parent_node_name=L, transform=S1_in_j1())
        chain = [("coxa", L, S1_in_j1(), q[0]),
                 ("femur", f"{L}_coxa", horn_mount("j2", "low") @ S2_in_j2(), q[1]),
                 ("tibia", f"{L}_femur", horn_mount("j3", CONFIG["c3"]) @ S3_in_j3(), q[2])]
        for joint, parent, base, q0 in chain:
            node = f"{L}_{joint}"
            sc.graph.update(frame_from=parent, frame_to=node, matrix=base @ rz(q0))
            pivots[node] = (base, q0)
            sc.add_geometry(colored(M["servo_horn"], (0.82, 0.82, 0.84)), node_name=f"{node}_horn", parent_node_name=node)
        sc.add_geometry(colored(M["j2"], link), node_name=f"{L}_j2", parent_node_name=f"{L}_coxa",
                        transform=horn_mount("j2", "low"))
        sc.add_geometry(colored(M["servo_case"], COLORS["black"]), node_name=f"{L}_femur_servo",
                        parent_node_name=f"{L}_coxa", transform=horn_mount("j2", "low") @ S2_in_j2())
        sc.add_geometry(colored(M["j3"], alt), node_name=f"{L}_j3", parent_node_name=f"{L}_femur",
                        transform=horn_mount("j3", CONFIG["c3"]))
        sc.add_geometry(colored(M["servo_case"], COLORS["black"]), node_name=f"{L}_tibia_servo",
                        parent_node_name=f"{L}_femur", transform=horn_mount("j3", CONFIG["c3"]) @ S3_in_j3())
        sc.add_geometry(colored(M["leg"], link), node_name=f"{L}_tibia_link", parent_node_name=f"{L}_tibia",
                        transform=horn_mount("leg", CONFIG["cl"]))

    path = os.path.join(OUT, "glb", "hexapod.glb")
    sc.export(path)
    add_animation(path, pivots, frames)
    return path


def add_animation(path, pivots, frames):
    """Rewrite animated nodes as TRS and attach the baked tripod-gait clip."""
    import pygltflib as G
    g = G.GLTF2().load(path)
    by_name = {n.name: i for i, n in enumerate(g.nodes)}
    blob = bytearray(g.binary_blob())

    def add_acc(arr, typ):
        arr = np.ascontiguousarray(arr, dtype=np.float32)
        while len(blob) % 4:
            blob.append(0)
        off = len(blob); blob.extend(arr.tobytes())
        g.bufferViews.append(G.BufferView(buffer=0, byteOffset=off, byteLength=arr.nbytes))
        acc = G.Accessor(bufferView=len(g.bufferViews) - 1, componentType=G.FLOAT, count=len(arr), type=typ,
                         min=arr.min(axis=0).tolist() if typ == G.SCALAR else None,
                         max=arr.max(axis=0).tolist() if typ == G.SCALAR else None)
        g.accessors.append(acc)
        return len(g.accessors) - 1

    times = np.linspace(0, GAIT["period"], len(frames)).reshape(-1, 1)
    t_acc = add_acc(times, G.SCALAR)
    anim = G.Animation(name="tripod_walk", samplers=[], channels=[])
    for node, (base, q_rest) in pivots.items():
        i = by_name[node]
        leg = node.split("_", 1)[1].rsplit("_", 1)[0]
        joint = ("coxa", "femur", "tibia").index(node.rsplit("_", 1)[1])
        quats = []
        for fr in frames:
            _, q = trs(base @ rz(fr[leg][joint])); quats.append(q)
        quats = np.array(quats)
        for k in range(1, len(quats)):                 # keep hemisphere continuity
            if np.dot(quats[k], quats[k - 1]) < 0:
                quats[k] *= -1
        # rest pose = standing pose, so a viewer that stops the clip lands on it
        tr, q0 = trs(base @ rz(q_rest))
        n = g.nodes[i]; n.matrix = None; n.translation = tr; n.rotation = q0
        anim.samplers.append(G.AnimationSampler(input=t_acc, output=add_acc(quats, G.VEC4), interpolation="LINEAR"))
        anim.channels.append(G.AnimationChannel(sampler=len(anim.samplers) - 1,
                                                target=G.AnimationChannelTarget(node=i, path="rotation")))
    g.animations = [anim]
    g.buffers[0].byteLength = len(blob)
    g.set_binary_blob(bytes(blob))
    g.save_binary(path)


# ------------------------------------------------------------- renders ---
def render_views(legs, plates, tag):
    sys.path.insert(0, os.environ.get("RENDER_HELPER", ""))
    try:
        from render import render
    except Exception:
        return
    parts = []
    for n, d in legs.items():
        for k, m in d.items():
            c = [30, 30, 30] if "case" in k else [200, 200, 205] if "horn" in k else \
                ([35, 75, 225] if k in ("j2", "leg") else [240, 240, 240])
            mm = m.copy(); mm.visual.face_colors = c + [255]; parts.append(mm)
    for m in plates.values():
        mm = m.copy(); mm.visual.face_colors = [20, 20, 22, 255]; parts.append(mm)
    whole = trimesh.util.concatenate(parts)
    render(whole, os.path.join(OUT, "views", f"{tag}.png"), tag, maxf=90000,
           views=((22, -60), (90, -90), (0, -90), (0, 0)))


# ----------------------------------------------------------------- main ---
def main():
    t0 = time.time()
    stance = stance_angles()
    frames, ik_err = gait_cycle(stance)
    M = build_meshes()
    plates = {"top": M["top"], "bottom": M["bottom"], "standoffs": M["standoffs"]}

    deltas = {n: np.degrees(np.ptp([[fr[n][j] for j in range(3)] for fr in frames], axis=0)).round(1).tolist()
              for n, _, _ in LEGS}
    checks = []
    for fi in range(0, len(frames), 6):
        found, legs = collisions(M, stance, frames[fi], plates)
        checks.append(dict(frame=fi, collisions=found, ground_clearance=ground_contact(legs, frames[fi], stance)))
        if fi == 0:
            render_views(legs, plates, "hexapod_stance")
    chassis_low = min(p.bounds[0][2] for p in plates.values()) - GAIT["ground_z"]

    validation = dict(
        ik_max_residual_mm=float(ik_err),
        stance_angles_deg={n: np.degrees(stance[n]["q"]).round(2).tolist() for n in stance},
        joint_travel_over_cycle_deg=deltas,
        chassis_ground_clearance_mm=round(float(chassis_low), 1),
        frames_checked=[c["frame"] for c in checks],
        collisions=[c for c in checks if c["collisions"]],
        min_leg_height_above_ground_by_frame={c["frame"]: c["ground_clearance"] for c in checks},
        span_mm=None,
    )
    feet = np.array([stance[n]["foot"] for n in stance])
    validation["span_mm"] = round(float(np.ptp(feet[:, 0])), 1)
    with open(os.path.join(OUT, "validation.json"), "w") as f:
        json.dump(validation, f, indent=2)

    glb = export_glb(M, stance, frames)
    export_cad(stance)

    manifest = dict(
        units="metres, Y up (CAD source is mm, Z up)",
        forward="-Z in the GLB (+Y in CAD)",
        animation=dict(name="tripod_walk", period_s=GAIT["period"],
                       body_advance_per_cycle_m=2 * GAIT["stride"] / 1000,
                       note="Body advances one stride per half cycle. Move the root by "
                            "body_advance_per_cycle_m per clip loop and the feet do not slip."),
        gait=GAIT, legs=[dict(name=n, angle_deg=a, tripod_group=g) for n, a, g in LEGS],
        joints={f"leg_{n}_{j}": dict(axis="local +Z (servo shaft)") for n, _, _ in LEGS
                for j in ("coxa", "femur", "tibia")},
        source=dict(
            supplied_stl=[PARTS[k]["file"] for k in PARTS],
            designed=["chassis_top_plate", "chassis_bottom_plate", "standoffs", "fasteners"],
            approximations=["MG996R servo (datasheet outline)", "Arduino Mega 2560 (true outline/holes, simplified parts)"],
        ),
    )
    with open(os.path.join(OUT, "hexapod.manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print(json.dumps({k: validation[k] for k in ("ik_max_residual_mm", "chassis_ground_clearance_mm", "span_mm")}))
    print("collisions:", validation["collisions"] or "none")
    print("joint travel deg:", deltas["front_left"])
    print("glb", glb, round(os.path.getsize(glb) / 1e6, 2), "MB", "time", round(time.time() - t0, 1), "s")


if __name__ == "__main__":
    main()
