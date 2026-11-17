"""
Hexapod leg rig: measured joint frames for the four supplied STL parts
(3d models/hexapod/*.stl) plus a dimensioned MG996R stand-in.

Every number tagged MEASURED was taken from the supplied STL geometry
(cross-sections / hole fits, see README). Numbers tagged DATASHEET come from
published MG996R figures; numbers tagged ASSUMED are provisional choices.
"""
import numpy as np
import trimesh

SRC = "3d models/hexapod"

# ---------------------------------------------------------------- MG996R ----
# Servo frame S: origin on the output-shaft axis at the spline tip,
# +Z = shaft direction, +X = from shaft toward the far end of the case.
MG996R = dict(
    L=40.7, W=19.7,            # DATASHEET case length / width
    H_total=42.9,              # DATASHEET case bottom -> spline tip
    ear_span=54.0,             # DATASHEET overall length across ears
    ear_bottom=26.6,           # ASSUMED  case bottom -> underside of ears
    ear_t=2.5,                 # ASSUMED  ear thickness
    case_top=36.5,             # ASSUMED  case bottom -> top of case
    shaft_from_end=10.2,       # ASSUMED  shaft axis -> near end of case
    hole_pitch_len=48.7,       # MEASURED ear-hole pitch along length (j3: 48.71, j2: 49.24)
    hole_pitch_w=9.7,          # MEASURED ear-hole pitch across (j3: 9.70, j2: 9.70)
    horn_d=20.0, horn_t=2.5,   # ASSUMED  round horn
)
def servo_local():
    """Return dict name->mesh in servo frame S (origin at spline tip)."""
    s = MG996R
    zb = -s["H_total"]                      # case bottom
    cx = s["L"] / 2 - s["shaft_from_end"]   # case centre along X (10.15)
    parts = {}
    case = trimesh.creation.box((s["L"], s["W"], s["case_top"]))
    case.apply_translation((cx, 0, zb + s["case_top"] / 2))
    ear = trimesh.creation.box((s["ear_span"], s["W"], s["ear_t"]))
    ear.apply_translation((cx, 0, zb + s["ear_bottom"] + s["ear_t"] / 2))
    boss = trimesh.creation.cylinder(radius=6.0, height=zb * -1 - s["case_top"] - 1.5, sections=40)
    boss.apply_translation((0, 0, zb + s["case_top"] + (-zb - s["case_top"] - 1.5) / 2))
    parts["servo_case"] = trimesh.util.concatenate([case, ear, boss])
    horn = trimesh.creation.cylinder(radius=s["horn_d"] / 2, height=s["horn_t"], sections=48)
    horn.apply_translation((0, 0, 1.0 - s["horn_t"] / 2))   # horn top face 1.0 mm above spline tip
    parts["servo_horn"] = horn
    return parts
HORN_TOP = 1.0

def frame(origin, x, z):
    x = np.asarray(x, float); z = np.asarray(z, float)
    x /= np.linalg.norm(x); z /= np.linalg.norm(z)
    y = np.cross(z, x)
    T = np.eye(4); T[:3, 0] = x; T[:3, 1] = y; T[:3, 2] = z; T[:3, 3] = origin
    return T

def servo_in_bracket(hole_centre, length_dir, ear_normal, ear_face, shaft_sign):
    """Pose of servo frame S inside a bracket.
    hole_centre: midpoint of the four ear holes (in the ear plane)
    length_dir:  unit vector along the hole rows
    ear_normal:  unit normal pointing from case bottom to shaft
    ear_face:    scalar position (along ear_normal) of the flange face the ears rest on
    shaft_sign:  +1/-1, which end of the case the shaft sits at"""
    u = np.asarray(length_dir, float); n = np.asarray(ear_normal, float)
    c = np.asarray(hole_centre, float).copy()
    c = c - n * (c @ n) + n * ear_face            # project centre onto ear face
    s = MG996R
    off = s["L"] / 2 - s["shaft_from_end"]
    shaft_on_face = c + shaft_sign * off * u
    tip = shaft_on_face + n * (s["H_total"] - s["ear_bottom"])
    return frame(tip, -shaft_sign * u, n)

# --------------------------------------------------- measured part frames ----
# Each link: horn (centre, axis) where it is driven, the face that sits on the
# horn, and (if it carries the next servo) its ear-hole pattern.  All MEASURED.
PARTS = {
    "j1": dict(file="j1 version 2.stl"),                    # coxa servo cradle, bolts to chassis
    "j2": dict(file="j2.stl", horn=(9.46, 44.5), plate=(15.8, 20.9)),   # coxa link, horn axis Y
    "j3": dict(file="j3.stl", horn=(0.0, 64.79), plate=(30.04, 35.09)), # femur link, horn axis Y
    "leg": dict(file="leg.stl", horn=(-3.17, 23.02), plate=(31.63, 36.79)),  # tibia, horn axis Y
}
# j1: walls x=+-10 (20.0 gap for the 19.7 case), wall tops z=29.0, nose ear holes (+-4.82, 46.12).
J1_CHASSIS_HOLES = [(-15.0, -2.61), (15.0, -2.61), (0.0, 51.4)]   # MEASURED, dia 3.0
def load(name):
    return trimesh.load(f"{SRC}/{PARTS[name]['file']}", force="mesh")

def horn_mount(name, contact):
    """Transform from part frame into the driving servo frame S, joint angle 0.
    contact='low' -> the plate face with smaller Y sits on the horn."""
    hx, hz = PARTS[name]["horn"]; y0, y1 = PARTS[name]["plate"]
    if contact == "low":
        face = y0; zdir = (0, 1, 0)       # part +Y points away from the servo
    else:
        face = y1; zdir = (0, -1, 0)
    # part frame -> S: part point (hx, face, hz) to S (0,0,HORN_TOP), part zdir -> S +Z
    F = frame((hx, face, hz), (1, 0, 0) if contact == "low" else (-1, 0, 0), zdir)
    T = np.linalg.inv(F); T[2, 3] += HORN_TOP
    return T

def rz(q):
    c, s = np.cos(q), np.sin(q); T = np.eye(4); T[:2, :2] = [[c, -s], [s, c]]; return T

# ------------------------------------------------------------- the leg ----
# Orientation choices inside the cradles cannot be read from the STLs alone.
# They were chosen by search over all 64 combinations (see README, "How the
# leg was assembled"). The selected set is the only one that (a) has no part
# collisions across a sweep of joint angles, (b) lets the tapered foot tip be
# the first point to touch the ground at a realistic stance, and (c) puts the
# foot within ~11 mm of the coxa axis plane.
CONFIG = dict(
    s1=+1,           # coxa servo shaft at the nose end of j1 (case runs inboard)
    n2=+1, s2=-1,    # femur servo in j2: ears on the outer flange face, shaft outboard
    n3=-1, s3=-1,    # tibia servo in j3: ears on the inner flange face (57.7 mm femur)
    c3="low", cl="high",
)
def S1_in_j1(c=CONFIG):
    # ears rest on the wall tops (z = 29.0); hole rows along j1 +Y
    return servo_in_bracket((0, 21.71, 0), (0, 1, 0), (0, 0, 1), 29.0, c["s1"])
def S2_in_j2(c=CONFIG):
    return servo_in_bracket((0, -2.1, -6.74), (0, 0, 1), (c["n2"], 0, 0),
                            44.73 if c["n2"] > 0 else -30.25, c["s2"])
def S3_in_j3(c=CONFIG):
    return servo_in_bracket((-0.1, 0, 17.27), (0, 0, 1), (0, c["n3"], 0),
                            48.89 if c["n3"] > 0 else -30.04, c["s3"])

def leg_transforms(q1, q2, q3, T_j1=np.eye(4), c=CONFIG):
    """World transforms of every leg body for joint angles (rad, about each shaft)."""
    T = {"j1": T_j1}
    T["S1"] = T_j1 @ S1_in_j1(c)
    T["coxa"] = T["S1"] @ rz(q1)                      # coxa pivot
    T["j2"] = T["coxa"] @ horn_mount("j2", "low")
    T["S2"] = T["j2"] @ S2_in_j2(c)
    T["femur"] = T["S2"] @ rz(q2)
    T["j3"] = T["femur"] @ horn_mount("j3", c["c3"])
    T["S3"] = T["j3"] @ S3_in_j3(c)
    T["tibia"] = T["S3"] @ rz(q3)
    T["leg"] = T["tibia"] @ horn_mount("leg", c["cl"])
    return T

_leg_mesh = None
FOOT_OVERRIDE = None   # set by build.py to the true lowest point of the foot at stance
def foot_tip_local():
    """Foot contact point in the tibia (leg.stl) frame: centre of the tapered tip,
    unless build.py has replaced it with the lowest vertex at the standing pose."""
    global _leg_mesh
    if FOOT_OVERRIDE is not None:
        return FOOT_OVERRIDE
    if _leg_mesh is None: _leg_mesh = load("leg")
    v = _leg_mesh.vertices
    tip = v[v[:, 0] > v[:, 0].max() - 1.0]
    return tip.mean(axis=0)

# ------------------------------------------------------------------ IK ----
from scipy.optimize import least_squares
def foot_world(q, T_j1=np.eye(4), c=CONFIG):
    T = leg_transforms(*q, T_j1=T_j1, c=c)
    return (T["leg"] @ np.r_[foot_tip_local(), 1])[:3]
def ik(target, q0, T_j1=np.eye(4), c=CONFIG, limits=np.radians(150)):
    r = least_squares(lambda q: foot_world(q, T_j1, c) - target, q0,
                      bounds=(-limits * np.ones(3), limits * np.ones(3)), xtol=1e-10, ftol=1e-10)
    return r.x, np.linalg.norm(r.fun)
