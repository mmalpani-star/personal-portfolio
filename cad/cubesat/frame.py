"""Reconstructed 1U CubeSat lattice frame.

The original frame (`frame.prt`, `top.prt`, `bottomxx.prt`, `hol2.prt`, `holdb1.prt` in the Creo folder) is a
parametric Creo model that cannot be read without Creo. What is known about it comes from the Fusion study
report (`CubeSat (S) 2025-07-02.pdf`): a PLA cube, a hexagonal opening in the middle of each side face, a
lattice of triangular and arched windows around it, four small screw holes per face, and a top plate with a
ring of wedge slots. The pattern below reproduces that character; it is NOT the original geometry and no
window position or size is measured.
"""
import math

import numpy as np
import shapely.geometry as sg
import shapely.ops as so
from shapely import affinity

# --- assumed envelope (see README): 100 mm cube, 2.5 mm printed walls --------------------------------
SIDE = 100.0
WALL = 2.5
H = SIDE / 2
CAVITY = SIDE - 2 * WALL      # 95.0 mm; the original flex-PCB board (94.8 x 94.0 mm) just fits


def _rect(h):
    return sg.box(-h, -h, h, h)


def side_windows():
    """Windows of one side face in face coordinates (u, v), mm."""
    inner = _rect(H - 8.0)                                              # 8 mm border all round
    hexa = sg.Polygon([(23.0 * math.cos(math.radians(60 * k)), 23.0 * math.sin(math.radians(60 * k))) for k in range(6)])
    ring = inner.difference(hexa.buffer(4.2, join_style=2))             # rib around the hexagonal opening
    ribs = []
    far = 80.0
    for k in range(6):                                                  # six ribs from the hexagon corners
        a = math.radians(60 * k)
        ribs.append(sg.LineString([(23 * math.cos(a), 23 * math.sin(a)), (far * math.cos(a), far * math.sin(a))]))
    for k in range(4):                                                  # four corner diagonals
        a = math.radians(45 + 90 * k)
        ribs.append(sg.LineString([(20 * math.cos(a), 20 * math.sin(a)), (far * math.cos(a), far * math.sin(a))]))
    ribbed = so.unary_union([r.buffer(1.7, cap_style=2) for r in ribs])
    corners = so.unary_union([sg.Point(sx * (H - 4.5), sy * (H - 4.5)).buffer(5.0) for sx in (-1, 1) for sy in (-1, 1)])
    win = ring.difference(ribbed).difference(corners)
    out = []
    for g in (win.geoms if hasattr(win, "geoms") else [win]):
        g = g.buffer(-1.0, join_style=1).buffer(1.0, join_style=1)      # soften the corners
        for p in (g.geoms if hasattr(g, "geoms") else [g]):
            if p.area > 25.0:
                out.append(p.simplify(0.04))
    return [hexa.buffer(0.0)] + out


def screw_holes():
    return [(sx * (H - 4.5), sy * (H - 4.5), 1.25) for sx in (-1, 1) for sy in (-1, 1)]


def radial_slots(rot_deg=15.0, r0=22.0, r1=42.0, n=12):
    """Tapered wedge slots in a ring (the top plate in the study report)."""
    out = []
    for k in range(n):
        a = math.radians(rot_deg + 360.0 / n * k)
        da0, da1 = math.radians(3.2), math.radians(5.2)                 # half-angles at the inner / outer radius
        pts = [(r0 * math.cos(a - da0), r0 * math.sin(a - da0)), (r1 * math.cos(a - da1), r1 * math.sin(a - da1)),
               (r1 * math.cos(a + da1), r1 * math.sin(a + da1)), (r0 * math.cos(a + da0), r0 * math.sin(a + da0))]
        out.append(sg.Polygon(pts))
    return out


# face frames: columns u, v, w (outward normal); position of the face's outer plane is w * H
FACES = {
    "+Z": np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1]]).T,
    "-Z": np.array([[1, 0, 0], [0, -1, 0], [0, 0, -1]]).T,
    "+X": np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0]]).T,
    "-X": np.array([[0, -1, 0], [0, 0, 1], [-1, 0, 0]]).T,
    "+Y": np.array([[-1, 0, 0], [0, 0, 1], [0, 1, 0]]).T,
    "-Y": np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]]).T,
}


def face_cutouts(name):
    """(polygons, circles) of the through-cuts of one face, face coordinates."""
    if name == "+Z":
        return radial_slots(15.0), screw_holes()
    if name == "-Z":
        return radial_slots(0.0), screw_holes()
    return side_windows(), screw_holes()


def build_frame():
    """Hollow cube with every face cut through. Returns a build123d Solid."""
    from build123d import Box, Cylinder, Face, Location, Solid, Vector, Wire, Compound

    def prism(poly, name):
        R = FACES[name]
        ext = poly.exterior.coords[:-1]
        w0 = H - WALL - 1.0
        pts = [Vector(*(R @ np.array([x, y, w0]))) for x, y in ext]
        face = Face(Wire.make_polygon(pts, close=True))
        sol = Solid.extrude(face, Vector(*(R @ np.array([0, 0, WALL + 2.0]))))
        for hole in poly.interiors:                                      # windows with islands (not produced today)
            raise ValueError("window with a hole")
        return sol

    def cyl(x, y, r, name):
        R = FACES[name]
        c = R @ np.array([x, y, H - WALL - 1.0])
        z = R @ np.array([0, 0, 1.0])
        from build123d import Plane
        return Solid.make_cylinder(r, WALL + 2.0, Plane(origin=Vector(*c), z_dir=Vector(*z)))

    shell = Box(SIDE, SIDE, SIDE) - Box(CAVITY, CAVITY, CAVITY)
    tools = []
    for name in FACES:
        polys, circles = face_cutouts(name)
        tools += [prism(p, name) for p in polys]
        tools += [cyl(x, y, r, name) for x, y, r in circles]
    return shell - Compound(tools)


if __name__ == "__main__":
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, axs = plt.subplots(1, 3, figsize=(15, 5))
    for ax, name in zip(axs, ("+X", "+Z", "-Z")):
        polys, circles = face_cutouts(name)
        ax.add_patch(plt.Rectangle((-H, -H), SIDE, SIDE, fc="#bbbbbb", ec="k"))
        for p in polys:
            ax.fill(*p.exterior.xy, fc="white", ec="k", lw=0.6)
        for x, y, r in circles:
            ax.add_patch(plt.Circle((x, y), r, fc="white", ec="k"))
        ax.set_aspect("equal"); ax.set_title(f"face {name}: {len(polys)} windows")
        ax.set_xlim(-H, H); ax.set_ylim(-H, H)
    fig.savefig(sys.argv[1] if len(__import__("sys").argv) > 1 else "frame_preview.png", dpi=70)
