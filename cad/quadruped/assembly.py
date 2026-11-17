"""
Quadruped assembly, kinematics, validation and export.

    python cad/quadruped/features.py      # measure the interfaces (writes export/features.json)
    python cad/quadruped/assembly.py      # build, validate, export

Every joint position below comes from a measured hole or face in the supplied
STLs (3d models/quadruped). features.py reports them; INTERFACES records them
with the evidence. The only geometry not taken from the STLs is the SG90 servo
stand-in (no servo model was supplied), whose interface dimensions (ear-hole
pitch and shaft offset) are themselves measured from the printed parts.

Frames
------
Body mesh frame: the frame body_u / body_d were exported in (they are already
stacked). Robot frame: origin at the body centre on the coxa-axis plane,
+X forward, +Y left, +Z up (= body mesh rotated 180 deg about Z).

Leg chain (one left leg, in coxa_l mesh coordinates, zero angles):
  coxa joint  : Z line through (161.86, 24.40)          coxa pin hole + horn hole
  femur joint : X line through (y -3.09, z 19.65)       s_hold pin = servo shaft
  knee joint  : 55.00 mm further out, parallel           femur pivot spacing
  foot        : lowest point of the tibia spike
Right legs are the mirror image, built with coxa_r and tibia_r.
"""
import itertools
import json
import os
import sys
import time

import numpy as np
import trimesh
from scipy.optimize import least_squares

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from features import PARTS, SRC, load  # noqa: E402

OUT = os.path.join(HERE, "export")
for d in ("step", "stl", "glb", "views"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

# ------------------------------------------------------------ interfaces ---
# MEASURED (features.py, mm, in each part's own mesh coordinates).
I = dict(
    coxa_axis_xy=(161.86, 24.40),       # coxa_l: Ø5.97 pin hole (bottom flange) + Ø7.48 horn hole (top), coaxial
    coxa_bottom_z=-3.20,                # coxa_l: underside of the bottom flange
    femur_axis_yz=(-3.09, 19.65),       # coxa_l: s_hold pin line; = ear-hole centreline y, ear centre z + 5.25
    coxa_ear_face_x=167.86,             # coxa_l / tibia_l: face the SG90 ears seat on (Ø2.0 holes, 28.0 pitch)
    coxa_ear_z=(0.40, 28.40),           # coxa_l ear-hole centres
    coxa_tab_yz=(5.15, 19.65),          # coxa_l: s_hold screw-hole pair centre (Ø1.59, 6.0 apart)
    femur_prox_yz=(178.01, 19.63),      # femur_1: proximal pivot (Ø7.48 horn hole / Ø5.97 pin hole)
    femur_dist_yz=(233.01, 19.63),      # femur_1: distal pivot, 55.00 mm away
    femur_pin_arm_face_x=190.84,        # femur_1: pin arm face that bears on the s_hold plate
    femur_horn_arm_face_x=220.34,       # femur_1: horn arm inner face (faces the servo horn)
    knee_axis_yz=(-58.03, 19.62),       # tibia_l: same ear / tab pattern as coxa_l
    tibia_tab_yz=(-66.27, 19.62),       # tibia_l: s_hold screw-hole pair centre
    shold_pin_yz=(177.63, 19.62),       # s_hold: Ø5.77 pin
    shold_holes_yz=(185.87, 19.62),     # s_hold: screw holes, 8.24 mm from the pin
    shold_plate_face_x=149.80,          # s_hold: plate face the pin stands on (section area step 26 -> 134 mm²)
    shold_tab_face_x=151.60,            # s_hold: face that seats on the coxa / tibia tab
    body_coxa_bosses=[(21.0, 92.43), (92.0, 92.43), (21.0, 163.43), (92.0, 163.43)],  # body_d Ø5.57 bosses
    body_center_xy=(56.5, 127.93),      # body plate bounding-box centre
    body_tongue_top_z=56.67,            # body_d: surface the coxa bottom flange rests on (boss starts here)
    body_u_top_z=77.28,                 # body_u: top face, where the coxa-servo ears seat (Ø1.59 holes, 28.0 pitch)
    coxa_r_mirror_y=59.80,              # coxa_r == coxa_l mirrored about y = 59.80 (max deviation 0.004 mm)
    tibia_r_ear_face_x=15.27,           # tibia_r: ear face (mirror-image variant, 1.6 mm pilot holes)
    tibia_r_ear_yz=(10.0, 74.74),       # tibia_r: ear-hole pair centre
    tibia_l_ear_yz=(-58.03, 14.38),     # tibia_l: ear-hole pair centre
)

# SG90 stand-in. Interface values MEASURED from the printed parts, the rest
# DATASHEET (housing 22.2-23.1 x 11.8-12.2 mm across sources) or ASSUMED.
SG90 = dict(
    L=22.5, W=11.8,          # DATASHEET range
    case_h=22.7,             # DATASHEET
    ear_bottom=15.9,         # ASSUMED (varies between clones)
    ear_t=2.5, ear_span=32.2,
    hole_pitch=28.0,         # MEASURED: body_u, coxa_l and tibia_l ear holes
    shaft_offset=5.25,       # MEASURED: body_d boss vs body_u ear-pair centre; femur axis vs coxa ear centre
    tip=26.7,                # ASSUMED: case bottom -> spline tip
    mass_g=9.0,              # DATASHEET
)
PLA = 1.24e-3               # g/mm³; printed-part masses assume 100 % infill (APPROXIMATE)

COLORS = dict(print_l=(0.55, 0.86, 0.82), print_r=(0.55, 0.86, 0.82), body=(0.95, 0.95, 0.94),
              servo=(0.16, 0.32, 0.78), horn=(0.95, 0.95, 0.95), shold=(0.95, 0.95, 0.95))

# Which corner uses which handed parts. Option "names": legs on the robot's
# left use the _l parts, legs on the right the _r parts (the file names).
# Option "diagonal": diagonal pairs share parts (the MuJoCo model's choice).
# Both are checked in validation; "names" is used.
HANDEDNESS = os.environ.get("QUAD_HANDEDNESS", "names")


# ------------------------------------------------------------- helpers ----
def T_translate(v):
    T = np.eye(4); T[:3, 3] = v; return T


def T_rot(axis, deg, about=(0, 0, 0)):
    a = np.radians(deg); c, s = np.cos(a), np.sin(a)
    R = {"x": [[1, 0, 0], [0, c, -s], [0, s, c]], "y": [[c, 0, s], [0, 1, 0], [-s, 0, c]],
         "z": [[c, -s, 0], [s, c, 0], [0, 0, 1]]}[axis]
    T = np.eye(4); T[:3, :3] = R
    return T_translate(about) @ T @ T_translate(-np.asarray(about, float))


def T_mirror(axis, c=0.0):
    T = np.eye(4); T[axis, axis] = -1; T[axis, 3] = 2 * c; return T


def rz(q):
    c, s = np.cos(q), np.sin(q); T = np.eye(4); T[:2, :2] = [[c, -s], [s, c]]; return T


def frame(origin, x, z):
    x = np.asarray(x, float) / np.linalg.norm(x); z = np.asarray(z, float) / np.linalg.norm(z)
    T = np.eye(4); T[:3, 0] = x; T[:3, 1] = np.cross(z, x); T[:3, 2] = z; T[:3, 3] = origin; return T


# ------------------------------------------------------- the left leg ----
# Coordinates: "C" = coxa_l mesh coordinates, the reference for one leg.
CX, CY = I["coxa_axis_xy"]
FY, FZ = I["femur_axis_yz"]

# Coxa joint frame J0 in C: on the coxa axis, at the femur-axis height, +Z up.
J0_in_C = frame((CX, CY, FZ), (1, 0, 0), (0, 0, 1))
# Femur joint frame J1 in C: on the femur axis in the leg plane (x = CX),
# +Z along the femur servo shaft (+X), +X pointing out along the leg (-Y).
J1_in_C = frame((CX, FY, FZ), (0, -1, 0), (1, 0, 0))
FEMUR_LEN = I["femur_dist_yz"][0] - I["femur_prox_yz"][0]          # 55.00
# Knee frame J2: FEMUR_LEN further out along J1 +X, same orientation.
J2_in_J1 = T_translate((FEMUR_LEN, 0, 0))

# s_hold on the coxa tab: its screw holes onto the tab holes (no rotation).
SHOLD_ON_COXA = T_translate((0, I["coxa_tab_yz"][0] - I["shold_holes_yz"][0],
                             I["coxa_tab_yz"][1] - I["shold_holes_yz"][1]))
# Femur mesh -> C at zero angle: rotated 180 deg about its pivot line (so its
# +Y points out along the leg) and slid along X until its pin arm bears on the
# s_hold plate face.
FEMUR_X_SHIFT = I["shold_plate_face_x"] - I["femur_pin_arm_face_x"]
_fp = np.array([0.0, *I["femur_prox_yz"]])
FEMUR_IN_C = (T_translate((FEMUR_X_SHIFT, FY - _fp[1], FZ - _fp[2])) @ T_rot("x", 180, about=_fp))
# Tibia mesh -> C at zero angle: same X frame as the coxa (both servos seat on
# x = 167.86); knee axis onto the femur's distal pivot.
KY, KZ = I["knee_axis_yz"]
TIBIA_IN_C = T_translate((0, (FY - FEMUR_LEN) - KY, FZ - KZ))
# s_hold on the tibia tab: the tab is on the other side of the axis, so the
# s_hold turns 180 deg about its own pin line, then its pin lands on the knee axis.
_sp = np.array([0.0, *I["shold_pin_yz"]])
SHOLD_ON_TIBIA = T_translate((0, KY - _sp[1], KZ - _sp[2])) @ T_rot("x", 180, about=_sp)

# Servo frames (origin on the shaft at the spline tip, +Z out of the shaft,
# +X toward the case centre). The femur servo seats on the coxa ear face and
# the knee servo on the tibia ear face, shaft along +X.
_tip_above_ear = SG90["tip"] - SG90["ear_bottom"]
FEMUR_SERVO_IN_C = frame((I["coxa_ear_face_x"] + _tip_above_ear, FY, FZ), (0, 0, -1), (1, 0, 0))
KNEE_SERVO_IN_TIBIA = frame((I["coxa_ear_face_x"] + _tip_above_ear, KY, KZ), (0, 0, -1), (1, 0, 0))

# Coxa mesh sits on the body: bottom flange on the body_d tongue.
COXA_LIFT = I["body_tongue_top_z"] - I["coxa_bottom_z"]           # C z -> body z


def left_leg_frames(q):
    """Transforms (in the J0 frame, i.e. relative to the coxa joint at zero yaw)
    of every rigid body of one left leg for joint angles q = (coxa, femur, knee)."""
    C_to_J0 = np.linalg.inv(J0_in_C)
    T = {}
    T["coxa_joint"] = rz(q[0])
    T["coxa"] = T["coxa_joint"] @ C_to_J0                                # coxa mesh placement (C -> J0)
    T["femur_joint"] = T["coxa"] @ J1_in_C @ rz(q[1])
    C_in_J1 = np.linalg.inv(J1_in_C)
    T["femur"] = T["femur_joint"] @ C_in_J1 @ FEMUR_IN_C
    T["knee_joint"] = T["femur_joint"] @ J2_in_J1 @ rz(q[2])
    J2_in_C = J1_in_C @ J2_in_J1
    T["tibia"] = T["knee_joint"] @ np.linalg.inv(J2_in_C) @ TIBIA_IN_C
    T["shold_coxa"] = T["coxa"] @ SHOLD_ON_COXA
    T["shold_tibia"] = T["tibia"] @ SHOLD_ON_TIBIA
    T["femur_servo"] = T["coxa"] @ FEMUR_SERVO_IN_C
    T["knee_servo"] = T["tibia"] @ KNEE_SERVO_IN_TIBIA
    # horns turn with the link they drive: femur horn with the femur, knee horn with the femur too
    # (the knee servo sits in the tibia; its horn is screwed to the femur's distal horn arm)
    T["femur_horn"] = T["femur_joint"] @ C_in_J1 @ FEMUR_SERVO_IN_C
    # knee horn: screwed to the femur's distal horn arm, so it moves with the femur
    T["knee_horn"] = T["femur_joint"] @ J2_in_J1 @ np.linalg.inv(J2_in_C) @ TIBIA_IN_C @ KNEE_SERVO_IN_TIBIA
    return T


_tibia_l = None


def foot_local():
    """Foot contact point in tibia_l mesh coordinates: lowest point of the spike."""
    global _tibia_l
    if _tibia_l is None:
        _tibia_l = load("tibia_l")
    v = _tibia_l.vertices
    return v[np.argmin(v[:, 2])].copy()


# ------------------------------------------------------------ the body ----
BODY_TO_ROBOT = T_rot("z", 180) @ T_translate((-I["body_center_xy"][0], -I["body_center_xy"][1],
                                              -(FZ + COXA_LIFT)))
# Mirrors in the BODY mesh frame
M_SAGITTAL = T_mirror(1, I["body_center_xy"][1])    # left <-> right (robot left is body y = 92.43)
M_FRONTAL = T_mirror(0, I["body_center_xy"][0])     # front <-> rear  (robot front is body x = 21.0)

LEG_NAMES = {(21.0, 92.43): "front_left", (92.0, 92.43): "rear_left",
             (21.0, 163.43): "front_right", (92.0, 163.43): "rear_right"}


def leg_specs(handedness=HANDEDNESS):
    """Each leg = a LEFT-leg chain placed at a base corner, then (optionally)
    reflected by a body mirror. A reflected leg uses the _r printed parts."""
    fl = (21.0, 92.43); rl = (92.0, 92.43)
    if handedness == "names":
        legs = [("front_left", fl, np.eye(4)), ("rear_left", rl, np.eye(4)),
                ("front_right", fl, M_SAGITTAL), ("rear_right", rl, M_SAGITTAL)]
    else:  # diagonal
        legs = [("front_left", fl, np.eye(4)), ("rear_left", fl, M_FRONTAL),
                ("front_right", fl, M_SAGITTAL), ("rear_right", fl, M_FRONTAL @ M_SAGITTAL)]
    out = []
    for name, corner, M in legs:
        cx, cy = I["body_center_xy"]
        d = np.array([corner[0] - cx, corner[1] - cy]); d /= np.linalg.norm(d)
        yaw = np.degrees(np.arctan2(-d[0], d[1])) + 180.0   # coxa mesh -Y -> outward diagonal
        J0_body = T_translate((corner[0], corner[1], FZ + COXA_LIFT)) @ T_rot("z", yaw)
        out.append(dict(name=name, M=M, mirrored=bool(np.linalg.det(M[:3, :3]) < 0), J0_body=J0_body))
    return out


def leg_world(spec, q):
    """Robot-frame transforms of a leg's bodies (left-leg chain, then mirrored)."""
    F = left_leg_frames(q)
    return {k: BODY_TO_ROBOT @ spec["M"] @ spec["J0_body"] @ v for k, v in F.items()}


def foot_world(spec, q):
    T = leg_world(spec, q)["tibia"]
    return (T @ np.r_[foot_local(), 1.0])[:3]


def ik(spec, target, q0, lim=np.radians(170)):
    r = least_squares(lambda q: foot_world(spec, q) - target, q0,
                      bounds=(-lim * np.ones(3), lim * np.ones(3)), xtol=1e-12, ftol=1e-12)
    return r.x, float(np.linalg.norm(r.fun))


# ------------------------------------------------------------- meshes ----
def sg90_mesh():
    """SG90 stand-in in servo frame S (origin at the spline tip, +Z out of the shaft)."""
    s = SG90
    zb = -s["tip"]
    cx = s["shaft_offset"]
    case = trimesh.creation.box((s["L"], s["W"], s["case_h"]))
    case.apply_translation((cx, 0, zb + s["case_h"] / 2))
    ear = trimesh.creation.box((s["ear_span"], s["W"] - 0.6, s["ear_t"]))
    ear.apply_translation((cx, 0, zb + s["ear_bottom"] + s["ear_t"] / 2))
    tower_h = -zb - s["case_h"] - 0.6
    tower = trimesh.creation.cylinder(radius=s["W"] / 2 - 0.4, height=tower_h, sections=40)
    tower.apply_translation((0, 0, zb + s["case_h"] + tower_h / 2))
    spline = trimesh.creation.cylinder(radius=2.4, height=0.6, sections=24)
    spline.apply_translation((0, 0, -0.3))
    return trimesh.util.concatenate([case, ear, tower, spline])


def horn_mesh(length=0.6):
    """Horn hub between the spline and the link it is screwed to (detail not modelled)."""
    h = trimesh.creation.cylinder(radius=3.4, height=length, sections=32)
    h.apply_translation((0, 0, length / 2))
    return h


def meshes():
    M = {k: load(k) for k in PARTS}
    M["sg90"] = sg90_mesh()
    return M


# mirror relations used to place the right-hand parts with proper rotations
COXA_L_FROM_R = T_mirror(1, I["coxa_r_mirror_y"])        # coxa_l = this @ coxa_r
_ty = I["tibia_l_ear_yz"][0] - I["tibia_r_ear_yz"][0]
_tz = I["tibia_l_ear_yz"][1] - I["tibia_r_ear_yz"][1]
TIBIA_L_FROM_R = T_translate((0, _ty, _tz)) @ T_mirror(0, (I["coxa_ear_face_x"] + I["tibia_r_ear_face_x"]) / 2)
SELF_MIRROR = {  # a mirror that maps the part onto itself (verified in validation)
    "femur": T_mirror(2, I["femur_prox_yz"][1]),
    "s_hold": T_mirror(2, I["shold_pin_yz"][1]),
    "sg90": T_mirror(1, 0.0),
}
PLACEMENT = {  # rigid body -> mesh key for left legs
    "coxa": "coxa_l", "femur": "femur", "tibia": "tibia_l", "shold_coxa": "s_hold",
    "shold_tibia": "s_hold", "femur_servo": "sg90", "knee_servo": "sg90",
}


def posed_parts(spec, q, M):
    """World-space meshes for one leg. Right legs use coxa_r / tibia_r placed
    with proper rotations; parts with no right-hand file use their self-symmetry."""
    W = leg_world(spec, q)
    out = {}
    for body, key in PLACEMENT.items():
        T = W[body]
        mesh_key = key
        if spec["mirrored"]:
            if key == "coxa_l":
                mesh_key, T = "coxa_r", T @ COXA_L_FROM_R
            elif key == "tibia_l":
                mesh_key, T = "tibia_r", T @ TIBIA_L_FROM_R
            else:
                T = T @ SELF_MIRROR[key]
        assert np.linalg.det(T[:3, :3]) > 0, (spec["name"], body)
        out[body] = M[mesh_key].copy().apply_transform(T)
    return out


def body_parts(M):
    out = {"body_d": M["body_d"].copy().apply_transform(BODY_TO_ROBOT),
           "body_u": M["body_u"].copy().apply_transform(BODY_TO_ROBOT)}
    # coxa servos: ears on the body_u top face, shaft up on the coxa axis,
    # case toward the body centre (body_u ear-pair centre is 5.25 mm inboard)
    for (bx, by), name in LEG_NAMES.items():
        cx, cy = I["body_center_xy"]
        inboard = np.array([np.sign(cx - bx), 0.0, 0.0])
        T = frame((bx, by, I["body_u_top_z"] + _tip_above_ear), inboard, (0, 0, 1))
        out[f"{name}_coxa_servo"] = M["sg90"].copy().apply_transform(BODY_TO_ROBOT @ T)
    return out


# --------------------------------------------------------------- checks ---
ALLOWED = {  # designed contacts: seated / screwed / pinned interfaces
    ("coxa", "femur_servo"), ("tibia", "knee_servo"), ("coxa", "shold_coxa"), ("tibia", "shold_tibia"),
    ("femur", "shold_coxa"), ("femur", "shold_tibia"), ("femur", "femur_servo"), ("femur", "knee_servo"),
    ("body_d", "coxa"), ("body_u", "coxa_servo"), ("body_d", "coxa_servo"), ("coxa", "coxa_servo"),
}
FIT_LIMIT = 40.0   # mm³; a seated servo / pin may overlap its seat by a fraction of a mm


def overlap(A, B):
    lo = np.maximum(A.bounds[0], B.bounds[0]); hi = np.minimum(A.bounds[1], B.bounds[1])
    if np.any(lo >= hi):
        return 0.0
    try:
        v = trimesh.boolean.intersection([A, B], engine="manifold").volume
        return float(abs(v))
    except Exception:
        return float("nan")


def collisions(specs, qs, M, body=None):
    body = body or body_parts(M)
    legs = {s["name"]: posed_parts(s, qs[s["name"]], M) for s in specs}
    found = []
    for n, parts in legs.items():
        for a, b in itertools.combinations(parts, 2):
            v = overlap(parts[a], parts[b])
            allowed = (a, b) in ALLOWED or (b, a) in ALLOWED
            if v > (FIT_LIMIT if allowed else 1.0):
                found.append((n, a, b, round(v, 2)))
        for bn, bm in body.items():
            own_servo = bn == f"{n}_coxa_servo"
            for a, m in parts.items():
                key = (bn if not bn.endswith("_coxa_servo") else "coxa_servo", a)
                allowed = (key in ALLOWED or key[::-1] in ALLOWED) and (own_servo or not bn.endswith("coxa_servo"))
                v = overlap(m, bm)
                if v > (FIT_LIMIT if allowed else 1.0):
                    found.append((n, a, bn, round(v, 2)))
    names = list(legs)
    for a, b in itertools.combinations(names, 2):
        A = trimesh.util.concatenate(list(legs[a].values())); B = trimesh.util.concatenate(list(legs[b].values()))
        v = overlap(A, B)
        if v > 1.0:
            found.append((a, "*", b, round(v, 2)))
    return found, legs, body


# ----------------------------------------------------------------- gait ---
GAIT = dict(
    foot_radius=125.0,      # neutral foot distance from the body centre along each leg diagonal (mm)
    ground_z=-72.0,         # ground plane below the femur-axis plane (mm)
    step=40.0,              # world step length per foot = body advance per cycle (mm)
    lift=20.0,              # swing height (mm)
    swing=0.16,             # fraction of the cycle each foot is in the air (duty factor 0.84)
    sway=26.0,              # lateral body shift toward the supporting legs (mm): 13.6 mm stability margin
    frames=144,
    period=3.6,             # s per cycle at 1x (the site scrubs it with scroll)
    order=["rear_left", "front_left", "rear_right", "front_right"],   # lateral-sequence crawl
)


def smoothstep(x):
    x = min(1.0, max(0.0, x)); return x * x * (3 - 2 * x)


def body_sway(t):
    """Smoothed square wave: lean right (-y) while the left legs step (first half
    of the cycle), left (+y) while the right legs step. Each transition fits
    inside a four-foot-support gap, so the body never shifts toward a raised leg."""
    A = GAIT["sway"]
    g = (0.25 - GAIT["swing"]) / 2          # half-width of the gap around t = 0, 0.5
    def edge(x):                            # 0 -> 1 across [-g, g]
        return smoothstep((x + g) / (2 * g))
    if t <= 0.25:
        return A - 2 * A * edge(t)                       # ends at -A (right)
    if t <= 0.75:
        return -A + 2 * A * edge(t - 0.5)                # crosses to +A around t = 0.5
    return A - 2 * A * edge(t - 1.0) if t > 1 - g else A


def foot_phase(t, i):
    """(planted?, x offset relative to the body, z) for leg slot i at cycle time t."""
    S, H, d = GAIT["step"], GAIT["lift"], GAIT["swing"]
    start = i * 0.25 + (0.25 - d) / 2
    ph = (t - start) % 1.0
    travel = S * (1 - d)                  # how far a planted foot slides back relative to the body
    if ph < d:                            # swing: from the back of its range to the front
        w = ph / d
        return False, -travel / 2 + travel * (0.5 - 0.5 * np.cos(np.pi * w)), H * np.sin(np.pi * w)
    w = (ph - d) / (1 - d)
    return True, travel / 2 - travel * w, 0.0


def stance(specs):
    feet, qs = {}, {}
    for s in specs:
        W0 = leg_world(s, np.zeros(3))
        axis = W0["coxa_joint"][:3, 3]
        d = axis[:2] / np.linalg.norm(axis[:2])
        target = np.array([*(d * GAIT["foot_radius"]), GAIT["ground_z"]])
        best = None
        for q0 in ([0, 0.5, -0.8], [0, 0.3, -1.2], [0, 0.8, -0.4], [0, -0.2, 0.3]):
            q, err = ik(s, target, np.array(q0))
            if err < 1e-6 and (best is None or abs(q[0]) < abs(best[0])):
                best = q
        if best is None:
            raise RuntimeError(f"stance unreachable for {s['name']}")
        feet[s["name"]], qs[s["name"]] = target, best
    return feet, qs


def crawl(specs, feet, q_stance):
    N = GAIT["frames"]
    q_prev = dict(q_stance)
    frames, worst = [], 0.0
    for f in range(N + 1):
        t = f / N
        y = body_sway(t)
        row = {"_t": t, "_body": np.array([GAIT["step"] * t, y, 0.0]), "_down": []}
        for s in specs:
            n = s["name"]
            down, fx, fz = foot_phase(t, GAIT["order"].index(n))
            target = feet[n] + np.array([fx, -y, fz])        # body frame: planted feet do not slip
            q, err = ik(s, target, q_prev[n])
            worst = max(worst, err); q_prev[n] = q
            row[n] = q
            if down:
                row["_down"].append(n)
        frames.append(row)
    return frames, worst


def com(legs, body, M):
    """Approximate centre of mass: printed parts as solid PLA (100 % infill),
    9 g per SG90. Non-watertight meshes use their bounding-box centre."""
    tot, acc = 0.0, np.zeros(3)
    for parts in [body] + list(legs.values()):
        for k, m in parts.items():
            g = SG90["mass_g"] if "servo" in k else abs(m.volume) * PLA
            c = m.center_mass if m.is_watertight else m.bounds.mean(0)
            tot += g; acc += g * c
    return acc / tot, tot


def support_margin(p, feet):
    """Distance from p (xy) to the nearest edge of the support polygon; negative = outside."""
    from scipy.spatial import ConvexHull
    pts = np.array(feet)[:, :2]
    if len(pts) < 3:
        return -1e9
    hull = ConvexHull(pts)
    return float(min(-(e[:2] @ p[:2] + e[2]) for e in hull.equations))


# -------------------------------------------------------------- reports ---
def joint_sweep(spec, q_st, M, body):
    """Collision-free range of each joint about the standing pose, others held."""
    out = {}
    for j, name in enumerate(("coxa", "femur", "knee")):
        ok = []
        for deg in range(-90, 91, 10):
            q = q_st.copy(); q[j] += np.radians(deg)
            parts = posed_parts(spec, q, M)
            hit = False
            for a, b in itertools.combinations(parts, 2):
                allowed = (a, b) in ALLOWED or (b, a) in ALLOWED
                if overlap(parts[a], parts[b]) > (FIT_LIMIT if allowed else 1.0):
                    hit = True; break
            if not hit:
                for bn, bm in body.items():
                    if bn.endswith("coxa_servo") and not bn.startswith(spec["name"]):
                        continue
                    for a, m in parts.items():
                        key = ("coxa_servo" if bn.endswith("coxa_servo") else bn, a)
                        allowed = key in ALLOWED or key[::-1] in ALLOWED
                        if overlap(m, bm) > (FIT_LIMIT if allowed else 1.0):
                            hit = True; break
                    if hit:
                        break
            ok.append((deg, not hit))
        # contiguous free interval containing 0
        free = [d for d, k in ok if k]
        lo = hi = 0
        while lo - 10 in free:
            lo -= 10
        while hi + 10 in free:
            hi += 10
        out[name] = [lo, hi]
    return out


# --------------------------------------------------------------- export ---
def trs(T):
    from scipy.spatial.transform import Rotation as R
    return T[:3, 3].tolist(), R.from_matrix(T[:3, :3]).as_quat().tolist()


D_LOCAL = np.diag([1.0, 1.0, -1.0, 1.0])


def node_worlds(specs, qs, body_offset=np.zeros(3)):
    """Proper (det +1) world transforms of every scene node for one pose."""
    trunk = T_translate(body_offset)
    out = {"trunk": trunk}
    for s in specs:
        W = leg_world(s, qs[s["name"]])
        D = D_LOCAL if s["mirrored"] else np.eye(4)
        L = f"leg_{s['name']}"
        base = BODY_TO_ROBOT @ s["M"] @ s["J0_body"] @ D
        out[L] = trunk @ base
        out[f"{L}_coxa"] = trunk @ W["coxa_joint"] @ D
        out[f"{L}_femur"] = trunk @ W["femur_joint"] @ D
        out[f"{L}_knee"] = trunk @ W["knee_joint"] @ D
    return out


PARENT_OF_PART = {"coxa": "coxa", "shold_coxa": "coxa", "femur_servo": "coxa",
                  "femur": "femur", "tibia": "knee", "shold_tibia": "knee", "knee_servo": "knee"}


def export_glb(specs, q_st, frames, M):
    import pygltflib as G
    sc = trimesh.Scene()
    conv = np.eye(4); conv[:3, :3] = [[1, 0, 0], [0, 0, 1], [0, -1, 0]]
    sc.graph.update(frame_from=sc.graph.base_frame, frame_to="quadruped",
                    matrix=conv @ np.diag([0.001, 0.001, 0.001, 1]))
    rest = node_worlds(specs, q_st)

    def mat(rgb, metal=0.0, rough=0.6):
        return trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
            baseColorFactor=[*rgb, 1.0], metallicFactor=metal, roughnessFactor=rough))

    sc.graph.update(frame_from="quadruped", frame_to="trunk", matrix=rest["trunk"])
    body = body_parts(M)
    for k, m in body.items():
        m = m.copy(); m.visual = mat(COLORS["servo"] if "servo" in k else COLORS["body"])
        sc.add_geometry(m, node_name=k, geom_name=k, parent_node_name="trunk")
    for s in specs:
        L = f"leg_{s['name']}"
        parents = {"": "trunk", "_coxa": L, "_femur": f"{L}_coxa", "_knee": f"{L}_femur"}
        for suf, par in parents.items():
            sc.graph.update(frame_from=par, frame_to=f"{L}{suf}",
                            matrix=np.linalg.inv(rest[par]) @ rest[f"{L}{suf}"])
        parts = posed_parts(s, q_st[s["name"]], M)
        for k, m in parts.items():
            node = f"{L}_{PARENT_OF_PART[k]}"
            local = m.copy().apply_transform(np.linalg.inv(rest[node]))
            col = COLORS["servo"] if "servo" in k else COLORS["shold"] if "shold" in k else COLORS["print_l"]
            local.visual = mat(col)
            sc.add_geometry(local, node_name=f"{L}_{k}_mesh", geom_name=f"{L}_{k}_mesh", parent_node_name=node)
    path = os.path.join(OUT, "glb", "quadruped.glb")
    sc.export(path)

    # ---- bake the crawl clip (pivot rotations + trunk sway), rest pose = stance
    g = G.GLTF2().load(path)
    idx = {n.name: i for i, n in enumerate(g.nodes)}
    blob = bytearray(g.binary_blob())

    def acc(arr, typ):
        arr = np.ascontiguousarray(arr, dtype=np.float32)
        while len(blob) % 4:
            blob.append(0)
        off = len(blob); blob.extend(arr.tobytes())
        g.bufferViews.append(G.BufferView(buffer=0, byteOffset=off, byteLength=arr.nbytes))
        g.accessors.append(G.Accessor(bufferView=len(g.bufferViews) - 1, componentType=G.FLOAT, count=len(arr),
                                      type=typ, min=arr.min(0).tolist() if typ == G.SCALAR else None,
                                      max=arr.max(0).tolist() if typ == G.SCALAR else None))
        return len(g.accessors) - 1

    times = acc(np.linspace(0, GAIT["period"], len(frames)).reshape(-1, 1), G.SCALAR)
    anim = G.Animation(name="crawl", samplers=[], channels=[])
    worlds = [node_worlds(specs, {n: fr[n] for n in q_st}, fr["_body"] * np.array([0, 1, 0])) for fr in frames]
    animated = ["trunk"] + [f"leg_{s['name']}{suf}" for s in specs for suf in ("_coxa", "_femur", "_knee")]
    parent = {"trunk": "quadruped"}
    for s in specs:
        L = f"leg_{s['name']}"
        parent.update({f"{L}_coxa": L, f"{L}_femur": f"{L}_coxa", f"{L}_knee": f"{L}_femur"})
    for name in animated:
        i = idx[name]
        locs = []
        for w in worlds:
            P = np.eye(4) if parent[name] == "quadruped" else w[parent[name]]
            locs.append(np.linalg.inv(P) @ w[name])
        tr0, q0 = trs(np.linalg.inv(np.eye(4) if parent[name] == "quadruped" else rest[parent[name]]) @ rest[name])
        n = g.nodes[i]; n.matrix = None; n.translation = tr0; n.rotation = q0
        if name == "trunk":
            out = acc(np.array([L_[:3, 3] for L_ in locs]), G.VEC3); path_ = "translation"
        else:
            qs = np.array([trs(L_)[1] for L_ in locs])
            for k in range(1, len(qs)):
                if np.dot(qs[k], qs[k - 1]) < 0:
                    qs[k] *= -1
            out = acc(qs, G.VEC4); path_ = "rotation"
        anim.samplers.append(G.AnimationSampler(input=times, output=out, interpolation="LINEAR"))
        anim.channels.append(G.AnimationChannel(sampler=len(anim.samplers) - 1,
                                                target=G.AnimationChannelTarget(node=i, path=path_)))
    g.animations = [anim]
    g.buffers[0].byteLength = len(blob)
    g.set_binary_blob(bytes(blob))
    g.save_binary(path)
    return path


def export_cad(specs, q_st, M):
    from build123d import Box, Color, Compound, Cylinder, Location, Mesher, Pos, export_step
    from OCP.gp import gp_Trsf

    def loc(T):
        t = gp_Trsf(); t.SetValues(*T[0, :4], *T[1, :4], *T[2, :4]); return Location(t)

    s = SG90
    sg = (Pos(s["shaft_offset"], 0, -s["tip"] + s["case_h"] / 2) * Box(s["L"], s["W"], s["case_h"])
          + Pos(s["shaft_offset"], 0, -s["tip"] + s["ear_bottom"] + s["ear_t"] / 2) * Box(s["ear_span"], s["W"] - 0.6, s["ear_t"])
          + Pos(0, 0, -s["tip"] + s["case_h"] + (s["tip"] - s["case_h"] - 0.6) / 2) * Cylinder(s["W"] / 2 - 0.4, s["tip"] - s["case_h"] - 0.6)
          + Pos(0, 0, -0.3) * Cylinder(2.4, 0.6))
    for dx in (-s["hole_pitch"] / 2, s["hole_pitch"] / 2):
        sg -= Pos(s["shaft_offset"] + dx, 0, -s["tip"] + s["ear_bottom"]) * Cylinder(1.0, 6)
    sg.label = "sg90_standin"; sg.color = Color(*COLORS["servo"])
    export_step(sg, os.path.join(OUT, "step", "sg90_standin.step"))
    trimesh.Trimesh(*[np.array(a) for a in (lambda v, f: ([(p.X, p.Y, p.Z) for p in v], f))(*sg.tessellate(0.02))]
                    ).export(os.path.join(OUT, "stl", "sg90_standin.stl"))

    # the supplied STLs are ASCII; the STEP reader needs binary, so read binary copies
    import tempfile
    tmp = tempfile.mkdtemp(prefix="quad_stl_")
    solids = {}
    for k in PARTS:
        p = os.path.join(tmp, f"{k}.stl")
        load(k).export(p, file_type="stl")
        solids[k] = Mesher().read(p)[0]
    kids = []
    body = body_parts(M)
    for k in ("body_d", "body_u"):
        b = loc(BODY_TO_ROBOT) * solids[k]; b.label = k; b.color = Color(*COLORS["body"]); kids.append(b)
    for (bx, by), name in LEG_NAMES.items():
        cx, _ = I["body_center_xy"]
        T = BODY_TO_ROBOT @ frame((bx, by, I["body_u_top_z"] + _tip_above_ear), (np.sign(cx - bx), 0, 0), (0, 0, 1))
        sv = loc(T) * sg; sv.label = f"{name}_coxa_sg90"; sv.color = Color(*COLORS["servo"]); kids.append(sv)
    for spec in specs:
        W = leg_world(spec, q_st[spec["name"]])
        leg = []
        for bodyname, key in PLACEMENT.items():
            T = W[bodyname]; mk = key
            if spec["mirrored"]:
                if key == "coxa_l":
                    mk, T = "coxa_r", T @ COXA_L_FROM_R
                elif key == "tibia_l":
                    mk, T = "tibia_r", T @ TIBIA_L_FROM_R
                else:
                    T = T @ SELF_MIRROR[key]
            shape = loc(T) * (sg if key == "sg90" else solids[mk])
            shape.label = f"{spec['name']}_{bodyname}"
            shape.color = Color(*(COLORS["servo"] if key == "sg90" else COLORS["shold"] if key == "s_hold" else COLORS["print_l"]))
            leg.append(shape)
        kids.append(Compound(label=f"leg_{spec['name']}", children=leg))
    export_step(Compound(label="quadruped", children=kids), os.path.join(OUT, "step", "quadruped_assembly.step"))
    whole = trimesh.util.concatenate(list(body.values()) + [m for s_ in specs for m in posed_parts(s_, q_st[s_["name"]], M).values()])
    whole.export(os.path.join(OUT, "stl", "quadruped_assembly_standing.stl"))


# ----------------------------------------------------------------- main ---
def main():
    t0 = time.time()
    M = meshes()
    report = {}

    # handedness: check both part arrangements at zero and at a swept pose
    hand = {}
    for h in ("names", "diagonal"):
        sp = leg_specs(h)
        hits = []
        for q in (np.zeros(3), np.radians([35, 30, -40]), np.radians([-35, -20, 30])):
            f, _, _ = collisions(sp, {s["name"]: q for s in sp}, M)
            hits += f
        hand[h] = sorted(set((a, b, c) for a, b, c, _ in hits))
    report["handedness_collisions"] = hand

    specs = leg_specs(HANDEDNESS)
    feet, q_st = stance(specs)
    found, legs, body = collisions(specs, q_st, M)
    report["stance"] = dict(
        angles_deg={n: np.degrees(q).round(2).tolist() for n, q in q_st.items()},
        collisions=found,
        lowest_point_above_ground_mm={n: round(min(m.bounds[0][2] for m in p.values()) - GAIT["ground_z"], 2)
                                      for n, p in legs.items()},
        body_clearance_mm=round(min(m.bounds[0][2] for m in body.values()) - GAIT["ground_z"], 2),
    )
    c, mass = com(legs, body, M)
    report["mass_g_approx"] = round(mass, 1)
    report["com_robot_frame_mm"] = np.round(c, 1).tolist()

    report["joint_free_range_about_stance_deg"] = {s["name"]: joint_sweep(s, q_st[s["name"]], M, body) for s in specs}

    frames, err = crawl(specs, feet, q_st)
    report["gait"] = dict(ik_max_residual_mm=err, frames=len(frames))
    margins, hits = [], []
    travel = {s["name"]: np.degrees(np.ptp([fr[s["name"]] for fr in frames], axis=0)).round(1).tolist() for s in specs}
    for k, fr in enumerate(frames):
        qs = {s["name"]: fr[s["name"]] for s in specs}
        if k % 6 == 0:
            f, lg, bd = collisions(specs, qs, M)
            hits += [(k, *x) for x in f]
        else:
            lg = {s["name"]: posed_parts(s, qs[s["name"]], M) for s in specs}
            bd = body_parts(M)
        cc, _ = com(lg, bd, M)
        cc = cc + fr["_body"] * np.array([0, 1, 0])
        down_feet = [foot_world(s, fr[s["name"]]) + fr["_body"] * np.array([0, 1, 0]) for s in specs if s["name"] in fr["_down"]]
        margins.append(support_margin(cc, down_feet))
    report["gait"].update(joint_travel_deg=travel, collisions=hits,
                          min_static_stability_margin_mm=round(float(min(margins)), 2),
                          body_advance_per_cycle_mm=GAIT["step"])
    with open(os.path.join(OUT, "validation.json"), "w") as f:
        json.dump(report, f, indent=2, default=lambda o: o.tolist() if hasattr(o, "tolist") else str(o))

    glb = export_glb(specs, q_st, frames, M)
    export_cad(specs, q_st, M)
    manifest = dict(
        units="metres, Y up (CAD: mm, Z up, +X forward)", forward="+X in CAD = +X in the GLB",
        animation=dict(name="crawl", period_s=GAIT["period"], body_advance_per_cycle_m=GAIT["step"] / 1000,
                       note="Move the root by body_advance_per_cycle_m per clip loop and planted feet do not slip. "
                            "The clip moves the trunk sideways (sway) itself."),
        gait=GAIT, handedness=HANDEDNESS,
        legs=[dict(name=s["name"], mirrored=s["mirrored"]) for s in specs],
    )
    with open(os.path.join(OUT, "quadruped.manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print(json.dumps({k: report[k] for k in ("handedness_collisions", "mass_g_approx")}, indent=1))
    print("stance", report["stance"])
    print("joint ranges", report["joint_free_range_about_stance_deg"])
    print("gait", {k: v for k, v in report["gait"].items() if k != "joint_travel_deg"})
    print("travel", travel)
    print("glb", round(os.path.getsize(glb) / 1e6, 2), "MB", "time", round(time.time() - t0, 1), "s")


if __name__ == "__main__":
    main()
