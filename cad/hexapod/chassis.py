"""
Parametric hexapod chassis (build123d / OpenCascade B-rep).

Robot frame: millimetres, Z up, origin at the centre of the TOP surface of the
top plate. +Y is forward. Legs sit at the six hexagon vertices
(0, 60, ..., 300 degrees from +X), so the front pair is at 60 / 120 degrees.

Design intent
-------------
* Two-plate sandwich. The top plate carries the six j1 coxa cradles; the
  bottom plate carries the Arduino Mega and a power bay. Six M3 hex standoffs
  join them and make the box section that resists leg bending loads.
* Each leg mounts on a flat 60 mm "pad" cut across a hexagon vertex. The pad
  hole pattern is exactly the j1 base pattern measured from j1 version 2.stl
  (two holes at x = +-15.0, y = -2.61 and one at x = 0, y = 51.4, all dia 3.0),
  so a j1 bolts straight down with three M3 screws.
* A cable slot inboard of every j1 drops the three servo leads of that leg
  into the sandwich toward the controller.

Everything here is a design choice made for this model; see README for the
list of dimensions that must be checked against the physical robot.
"""
from math import cos, sin, radians, tan

from build123d import (Axis, Box, Color, Compound, Cylinder, Location, Polygon, Pos, Rot,
                       SlotCenterToCenter, extrude, fillet, RegularPolygon)

# ------------------------------------------------------------- parameters ---
P = dict(
    R_coxa=155.0,          # radius of the coxa (yaw) axes
    leg_angles=[0, 60, 120, 180, 240, 300],
    pad_radius=181.0,      # radial distance of the flat leg pads (R_coxa + 26)
    pad_half_width=30.0,   # j1 base is 42.6 wide -> 8.7 mm margin each side
    top_t=4.0,             # plate thickness (4 mm aluminium or 5 mm acrylic both work)
    bot_t=4.0,
    standoff=30.0,         # clear height between plates
    standoff_r=120.0,      # standoff circle (between legs)
    bot_pad_radius=150.0,
    bot_pad_half_width=26.0,
    corner_r=4.0,
    j1_shaft_y=31.86,      # coxa axis position inside j1 (rig.S1_in_j1)
)
J1_HOLES = [(-15.0, -2.61), (15.0, -2.61), (0.0, 51.4)]       # MEASURED from j1 STL

# Arduino Mega 2560 Rev3 reference design (DATASHEET - Arduino board drawing)
MEGA = dict(L=101.6, W=53.34, t=1.6,
            holes=[(13.97, 2.54), (15.24, 50.8), (66.04, 7.62), (66.04, 35.56),
                   (90.17, 50.8), (96.52, 2.54)], hole_d=3.2)


def _pad_polygon(pad_r, half_w, angles):
    """Hexagon truncated at each vertex by a flat pad perpendicular to the radius."""
    pts = []
    for a in angles:
        t = radians(a)
        c = (pad_r * cos(t), pad_r * sin(t))
        tan_v = (-sin(t), cos(t))
        pts.append((c[0] - half_w * tan_v[0], c[1] - half_w * tan_v[1]))
        pts.append((c[0] + half_w * tan_v[0], c[1] + half_w * tan_v[1]))
    return pts


def j1_location(angle_deg, p=P):
    """Placement of a j1 cradle: its +Y points radially out, coxa axis at R_coxa."""
    r0 = p["R_coxa"] - p["j1_shaft_y"]
    t = radians(angle_deg)
    return Location((r0 * cos(t), r0 * sin(t), 0), (0, 0, angle_deg - 90))


def _hole(x, y, d, z0, h):
    return Pos(x, y, z0) * Cylinder(d / 2, h, align=None)


def top_plate(p=P):
    plate = extrude(Polygon(*_pad_polygon(p["pad_radius"], p["pad_half_width"], p["leg_angles"]),
                            align=None), amount=-p["top_t"])
    plate = fillet(plate.edges().filter_by(Axis.Z), p["corner_r"])
    cut = []
    for a in p["leg_angles"]:
        loc = j1_location(a, p)
        for (x, y) in J1_HOLES:                       # j1 mounting holes, M3 clearance
            cut.append(loc * _hole(x, y, 3.4, -p["top_t"] / 2, p["top_t"] + 2))
        # cable slot inboard of the j1 base (3 servo leads per leg)
        t = radians(a); r = p["R_coxa"] - 62
        cut.append(Pos(r * cos(t), r * sin(t), -p["top_t"] / 2) * Rot(0, 0, a + 90)
                   * extrude(SlotCenterToCenter(16, 9), amount=p["top_t"] + 2, both=True))
    for i in range(6):                                # standoff holes
        t = radians(30 + 60 * i)
        cut.append(_hole(p["standoff_r"] * cos(t), p["standoff_r"] * sin(t), 3.4,
                         -p["top_t"] / 2, p["top_t"] + 2))
    # central access hatch (reach the controller without removing a plate)
    cut.append(Pos(0, 0, -p["top_t"] / 2) * extrude(
        RegularPolygon(48, 6, major_radius=True, rotation=30), amount=p["top_t"] + 2, both=True))
    for c in cut:
        plate -= c
    plate.label = "chassis_top_plate"
    return plate


def bottom_z(p=P):
    """Z of the top surface of the bottom plate."""
    return -p["top_t"] - p["standoff"]


def bottom_plate(p=P):
    z = bottom_z(p)
    plate = Pos(0, 0, z) * extrude(
        Polygon(*_pad_polygon(p["bot_pad_radius"], p["bot_pad_half_width"], p["leg_angles"]), align=None),
        amount=-p["bot_t"])
    plate = fillet(plate.edges().filter_by(Axis.Z), p["corner_r"])
    for i in range(6):
        t = radians(30 + 60 * i)
        plate -= _hole(p["standoff_r"] * cos(t), p["standoff_r"] * sin(t), 3.4, z - p["bot_t"] / 2, p["bot_t"] + 2)
    mx, my = mega_origin(p)
    for (x, y) in MEGA["holes"]:
        plate -= _hole(mx + x, my + y, 3.4, z - p["bot_t"] / 2, p["bot_t"] + 2)
    # two strap slots for a battery / power-module hold-down behind the controller
    for dx in (-35, 35):
        plate -= Pos(dx, -78, z - p["bot_t"] / 2) * extrude(SlotCenterToCenter(14, 4), amount=p["bot_t"] + 2, both=True)
    plate.label = "chassis_bottom_plate"
    return plate


def mega_origin(p=P):
    """Board corner (x, y) so the Mega sits centred, slightly forward."""
    return (-MEGA["L"] / 2, -MEGA["W"] / 2 + 18)


# ------------------------------------------------------------ hardware ----
def m3_standoff(length):
    s = extrude(RegularPolygon(5.5 / 2 / cos(radians(30)), 6), amount=length)
    return s - Pos(0, 0, length / 2) * Cylinder(1.25, length + 1)


def m3_screw(length, head=True):
    shank = Pos(0, 0, -length / 2) * Cylinder(1.5, length)
    if not head:
        return shank
    return shank + Pos(0, 0, 1.5) * Cylinder(2.75, 3.0) - Pos(0, 0, 2.6) * extrude(
        RegularPolygon(1.25, 6), amount=1.0)


def m3_nut():
    n = extrude(RegularPolygon(5.5 / 2 / cos(radians(30)), 6), amount=2.4)
    return n - Pos(0, 0, 1.2) * Cylinder(1.5, 3)


def standoffs(p=P):
    out = []
    for i in range(6):
        t = radians(30 + 60 * i)
        s = Pos(p["standoff_r"] * cos(t), p["standoff_r"] * sin(t), bottom_z(p)) * m3_standoff(p["standoff"])
        s.label = f"standoff_{i + 1}"
        out.append(s)
    return out


def chassis_fasteners(p=P):
    """Standoff screws (top and bottom) and the three M3 screws + nuts under each j1."""
    out = []
    for i in range(6):
        t = radians(30 + 60 * i); x, y = p["standoff_r"] * cos(t), p["standoff_r"] * sin(t)
        top = Pos(x, y, 0) * m3_screw(8); top.label = f"screw_standoff_top_{i + 1}"
        bot = Pos(x, y, bottom_z(p) - p["bot_t"]) * Rot(180, 0, 0) * m3_screw(8)
        bot.label = f"screw_standoff_bottom_{i + 1}"
        out += [top, bot]
    for li, a in enumerate(p["leg_angles"]):
        loc = j1_location(a, p)
        for hi, (x, y) in enumerate(J1_HOLES):
            # screw from above through j1 base flange (2.0 thick) and the plate
            s = loc * Pos(x, y, 2.0) * m3_screw(10); s.label = f"leg{li + 1}_j1_screw_{hi + 1}"
            n = loc * Pos(x, y, -p["top_t"] - 2.4) * m3_nut(); n.label = f"leg{li + 1}_j1_nut_{hi + 1}"
            out += [s, n]
    return out


def arduino_mega(p=P):
    """Arduino Mega 2560 stand-in: true board outline and hole pattern (DATASHEET),
    simplified components (APPROXIMATION)."""
    mx, my = mega_origin(p)
    z0 = bottom_z(p) + 6.0                       # on 6 mm nylon standoffs
    pcb = Pos(MEGA["L"] / 2, MEGA["W"] / 2, MEGA["t"] / 2) * Box(MEGA["L"], MEGA["W"], MEGA["t"])
    for (x, y) in MEGA["holes"]:
        pcb -= Pos(x, y, MEGA["t"] / 2) * Cylinder(1.6, 3)
    top = MEGA["t"]
    parts = {
        "pcb": pcb,
        "usb_b": Pos(-6.2 + 8, 38.1, top + 5.5) * Box(16, 12, 11),
        "dc_jack": Pos(-1.8 + 7, 7.6, top + 5.5) * Box(14, 9, 11),
        "mcu": Pos(60, 22, top + 0.6) * Rot(0, 0, 45) * Box(14, 14, 1.2),
        "header_top": Pos(66, MEGA["W"] - 1.3, top + 4.25) * Box(70, 2.5, 8.5),
        "header_bottom": Pos(60, 1.3, top + 4.25) * Box(48, 2.5, 8.5),
        "header_end": Pos(MEGA["L"] - 3.8, 26, top + 4.25) * Box(5.1, 45, 8.5),
    }
    out = []
    for name, shape in parts.items():
        s = Pos(mx, my, z0) * shape
        s.label = f"arduino_mega_{name}"
        s.color = Color(0.0, 0.42, 0.55) if name == "pcb" else Color(0.12, 0.12, 0.12)
        out.append(s)
    spacers = []
    for i, (x, y) in enumerate(MEGA["holes"]):
        s = Pos(mx + x, my + y, bottom_z(p) + 3) * (Cylinder(3.0, 6.0) - Cylinder(1.6, 7))
        s.label = f"mega_spacer_{i + 1}"
        spacers.append(s)
    return out, spacers


# ----------------------------------------------------------------- servo ---
def mg996r(name):
    """MG996R stand-in in servo frame S (origin on the shaft axis at the spline tip,
    +Z out of the shaft, +X toward the far end of the case). Main dimensions are
    DATASHEET; ear height, case top and shaft offset are ASSUMED (see rig.MG996R)."""
    from rig import MG996R as s
    zb = -s["H_total"]
    cx = s["L"] / 2 - s["shaft_from_end"]
    case = Pos(cx, 0, zb + s["case_top"] / 2) * Box(s["L"], s["W"], s["case_top"])
    case = fillet(case.edges().filter_by(Axis.Z), 1.0)
    ear = Pos(cx, 0, zb + s["ear_bottom"] + s["ear_t"] / 2) * Box(s["ear_span"], s["W"] - 1.0, s["ear_t"])
    for dx in (-s["hole_pitch_len"] / 2, s["hole_pitch_len"] / 2):
        for dy in (-s["hole_pitch_w"] / 2, s["hole_pitch_w"] / 2):
            ear -= Pos(cx + dx, dy, zb + s["ear_bottom"] + s["ear_t"] / 2) * Cylinder(1.1, 4)
    boss_h = -zb - s["case_top"] - 1.5
    boss = Pos(0, 0, zb + s["case_top"] + boss_h / 2) * Cylinder(6.0, boss_h)
    spline = Pos(0, 0, -0.75) * Cylinder(2.95, 1.5)
    body = case + ear + boss + spline
    body.label = f"{name}_mg996r_case"
    body.color = Color(0.08, 0.08, 0.09)
    horn = Pos(0, 0, 1.0 - s["horn_t"] / 2) * Cylinder(s["horn_d"] / 2, s["horn_t"])
    for i in range(4):
        a = radians(90 * i)
        horn -= Pos(8 * cos(a), 8 * sin(a), 0) * Cylinder(0.75, 5)
    horn -= Cylinder(1.5, 5)
    horn.label = f"{name}_horn"
    horn.color = Color(0.82, 0.82, 0.84)
    return body, horn
