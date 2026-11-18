"""
Builds public/models/sandhacks/hardware.glb from the four Parasolid mesh files in `3d models/san d hacks /`.

What this is, and is not (so it can be checked):
  ORIGINAL  Every triangle comes from the supplied files, unchanged apart from a rigid move to lay the parts out and
            a winding flip on the two parts whose triangles faced inward. Colours are the display colours stored in
            each file's colour attribute (a CAD colour, not necessarily the print colour).
  ASSEMBLED  From the owner's description of the build (stack order, bottom to top): lower jaw, upper jaw, arm root, arm
            tip, phone cradle; no servos; screws join the parts. Hole alignment fixes the rest:
              - arm root on the upper jaw's raised block: the root's end hole (12 mm) over the block's near-end hole,
                root pointing straight out. One pivot screw.
              - arm tip on the arm root: the tip's first hole over the root's far hole (both 12 mm), tip continuing
                straight out. One pivot screw.
              - phone cradle on the arm tip, its 32 mm clamp block between the tip's 2nd and 3rd holes (25 mm apart),
                cradle along the arm with the frame toward the free end.
              - lower jaw under the upper jaw, held by two screws through the upper jaw's two 6.8 mm holes (170 mm apart).
            Where the files and the description leave a choice it is flagged below as ASSUMED.
  MODELLED  Not in the supplied files, added from the description: the lower jaw (a plain cuboid, size ASSUMED to match
            the upper jaw's footprint and 22 mm thick; its two holes are not drawn because the screws fill them) and the
            screws (generic cap screws, sizes ASSUMED from the holes). They are marked `modelled` in the file.
  LAID OUT  The same parts side by side, long axis along X, resting flat. The viewer toggles between the two poses.
  NOT MODELLED  Servos (there are none), bearings, nuts, the phone.

Run:  python3 cad/sandhacks/build.py     (standard library only)
"""
import json
import math
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(__file__))
from psm_mesh import load, outward, verify  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, '3d models', 'san d hacks ')
OUT = os.path.join(ROOT, 'public', 'models', 'sandhacks')

# order = order down the page; colour = the file's own colour attribute
PARTS = [
    ('arm_root_print', 'Arm root', (0.647058823529412, 0.647058823529412, 0.647058823529412), True),
    ('arm_tip_print', 'Arm tip', (0.972549019607843, 0.529411764705882, 0.00392156862745098), True),
    ('upper_jaw_print', 'Upper jaw', (0.768627450980392, 0.886274509803922, 0.952941176470588), True),
    ('phone_cradle_print', 'Phone cradle', (0.917647058823529, 0.917647058823529, 0.917647058823529), False),
]
GAP = 16.0           # mm between parts

import collections  # noqa: E402


def circles(points, faces):
    """Round holes: closed loops of boundary edges on flat faces whose vertices all sit on a circle (mm)."""
    found = {}
    zs = sorted(set(round(p[2], 3) for p in points))
    for z in zs:
        E = collections.Counter()
        for a, b, c in faces:
            if all(abs(points[i][2] - z) < 1e-4 for i in (a, b, c)):
                for u, v in ((a, b), (b, c), (c, a)):
                    E[(u, v)] += 1
        nxt = {}
        for (u, v), n in E.items():
            if (v, u) not in E:
                nxt[u] = v
        seen = set()
        for u in list(nxt):
            if u in seen:
                continue
            loop, cur = [], u
            while cur is not None and cur not in seen:
                seen.add(cur)
                loop.append(cur)
                cur = nxt.get(cur)
            if len(loop) < 24 or cur != u:
                continue
            cx = sum(points[i][0] for i in loop) / len(loop)
            cy = sum(points[i][1] for i in loop) / len(loop)
            rs = [math.hypot(points[i][0] - cx, points[i][1] - cy) for i in loop]
            r = sum(rs) / len(rs)
            if r < 20 and max(abs(x - r) for x in rs) < 0.05:
                found[(round(cx, 1), round(cy, 1), round(r, 1))] = z
    return sorted(found)


def make_box(w, h, d):
    """Axis-aligned box centred in X/Y, from z = 0 to d. Returns (points, outward-wound triangles)."""
    x, y = w / 2, h / 2
    pts = [(-x, -y, 0), (x, -y, 0), (x, y, 0), (-x, y, 0), (-x, -y, d), (x, -y, d), (x, y, d), (-x, y, d)]
    quads = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return pts, [t for a, b, c, d_ in quads for t in ((a, b, c), (a, c, d_))]


def make_cyl(r, z0, z1, n=40):
    pts = [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n), z) for z in (z0, z1) for i in range(n)]
    f = []
    for i in range(n):
        j = (i + 1) % n
        f += [(i, j, n + j), (i, n + j, n + i)]
    pts += [(0, 0, z0), (0, 0, z1)]
    for i in range(n):
        j = (i + 1) % n
        f += [(2 * n, j, i), (2 * n + 1, n + i, n + j)]
    return pts, f


def cap_screw(shank_r, length, head_r, head_h):
    """A cap screw standing on z = 0 with its head at the bottom: shank 0..length, head below."""
    sp, sf = make_cyl(shank_r, 0, length)
    hp, hf = make_cyl(head_r, -head_h, 0)
    return sp + hp, sf + [(a + len(sp), b + len(sp), c + len(sp)) for a, b, c in hf]


def rot(a, p):
    c, s_ = math.cos(a), math.sin(a)
    return (p[0] * c - p[1] * s_, p[0] * s_ + p[1] * c)


def solve_mate(local_a, local_b, target_a, target_b):
    """2D rigid transform (angle, offset) taking local_a->target_a with local_a->local_b pointing along target_a->target_b."""
    ang = math.atan2(target_b[1] - target_a[1], target_b[0] - target_a[0]) - math.atan2(local_b[1] - local_a[1], local_b[0] - local_a[0])
    r = rot(ang, local_a)
    return ang, (target_a[0] - r[0], target_a[1] - r[1])
CREASE = math.radians(38)


def principal_angle(pts):
    n = len(pts)
    mx = sum(p[0] for p in pts) / n
    my = sum(p[1] for p in pts) / n
    sxx = sum((p[0] - mx) ** 2 for p in pts)
    syy = sum((p[1] - my) ** 2 for p in pts)
    sxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
    return 0.5 * math.atan2(2 * sxy, sxx - syy)


def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def norm(a):
    l = math.sqrt(dot(a, a)) or 1.0
    return (a[0] / l, a[1] / l, a[2] / l)


def smooth(points, faces):
    """Per-corner normals: average the adjacent faces that lie within the crease angle."""
    fn = []
    for a, b, c in faces:
        n = cross(sub(points[b], points[a]), sub(points[c], points[a]))   # length = 2 * area
        fn.append(n)
    adj = [[] for _ in points]
    for i, (a, b, c) in enumerate(faces):
        for v in (a, b, c):
            adj[v].append(i)
    cos_c = math.cos(CREASE)
    pos, nor, idx = [], [], []
    cache = {}
    for i, f in enumerate(faces):
        ni = norm(fn[i])
        for v in f:
            acc = [0.0, 0.0, 0.0]
            for j in adj[v]:
                nj = norm(fn[j])
                if dot(ni, nj) >= cos_c:
                    acc[0] += fn[j][0]; acc[1] += fn[j][1]; acc[2] += fn[j][2]
            n = norm(tuple(acc))
            key = (v, round(n[0], 3), round(n[1], 3), round(n[2], 3))
            if key not in cache:
                cache[key] = len(pos)
                pos.append(points[v])
                nor.append(n)
            idx.append(cache[key])
    return pos, nor, idx


def main():
    parts = {}
    report = {}
    for name, label, colour, rotate in PARTS:
        pts, faces = load(os.path.join(SRC, name, name + '.xmm_txt'))
        pts = [(x * 1000, y * 1000, z * 1000) for x, y, z in pts]            # metres -> mm
        metres = [(p[0] / 1000, p[1] / 1000, p[2] / 1000) for p in pts]
        report[name] = verify(metres, faces)
        faces = outward(metres, faces)
        parts[name] = dict(name=name, label=label, colour=colour, src=pts, faces=faces, holes=circles(pts, faces), rotate=rotate)

    # ---- local frame of each part: long axis along X, centred in X/Y, resting on z = 0 (this is what the GLB stores)
    for p in parts.values():
        pts = p['src']
        t = -principal_angle(pts) if p['rotate'] else 0.0
        rp = [rot(t, (q[0], q[1])) + (q[2],) for q in pts]
        xs = [q[0] for q in rp]; ys = [q[1] for q in rp]; zs = [q[2] for q in rp]
        c = ((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, min(zs))
        p.update(t=t, c=c, local=[(q[0] - c[0], q[1] - c[1], q[2] - c[2]) for q in rp],
                 w=max(xs) - min(xs), h=max(ys) - min(ys), d=max(zs) - min(zs), zmin=min(zs))
        report[p['name']].update(size_mm=[round(p['w'], 1), round(p['h'], 1), round(p['d'], 1)], holes_mm=[list(h) for h in p['holes']])

    # ---- ASSEMBLED pose (inferred, see the docstring). Everything is worked out in each part's source frame.
    def hole(name, near, tol=0.6, r=None):
        for h in parts[name]['holes']:
            if abs(h[0] - near[0]) < tol and abs(h[1] - near[1]) < tol and (r is None or abs(h[2] - r) < 0.2):
                return (h[0], h[1])
        raise SystemExit(f'no hole near {near} in {name}: {parts[name]["holes"]}')

    A = {}                                                    # name -> (angle, (dx, dy), dz) taking source -> assembled
    A['upper_jaw_print'] = (0.0, (0.0, 0.0), -parts['upper_jaw_print']['zmin'])
    jaw_h1, jaw_h2 = hole('upper_jaw_print', (106.7, 130.7), r=2.8), hole('upper_jaw_print', (124.3, 148.4), r=2.8)
    jaw_top = 22.0                                            # top of the raised block
    out = math.atan2(jaw_h2[1] - jaw_h1[1], jaw_h2[0] - jaw_h1[0])           # along the jaw, away from the plate

    def pin(name, hole_xy, far_xy, target, direction, z0):
        """Pivot the part on `target` through its hole `hole_xy`, its far hole pointing along `direction`."""
        ang = direction - math.atan2(far_xy[1] - hole_xy[1], far_xy[0] - hole_xy[0])
        r = rot(ang, hole_xy)
        A[name] = (ang, (target[0] - r[0], target[1] - r[1]), z0 - parts[name]['zmin'])

    def apply(name, q):
        a, o, dz = A[name]
        r = rot(a, q)
        return (r[0] + o[0], r[1] + o[1])

    root_h = [hole('arm_root_print', (32.7, 32.7), r=6.0), hole('arm_root_print', (133.1, 133.1), r=6.0)]
    pin('arm_root_print', root_h[0], root_h[1], jaw_h2, out, jaw_top)                 # root on the block, over the near hole
    root_top = jaw_top + parts['arm_root_print']['d']
    far = apply('arm_root_print', root_h[1])

    tip_h = [hole('arm_tip_print', (c, c), r=6.0) for c in (32.7, 50.4, 68.1)]
    pin('arm_tip_print', tip_h[0], tip_h[2], far, out, root_top)                      # tip on the root, first hole over the far hole
    tip_top = root_top + parts['arm_tip_print']['d']
    mid = tuple((apply('arm_tip_print', tip_h[1])[i] + apply('arm_tip_print', tip_h[2])[i]) / 2 for i in (0, 1))

    # cradle: along the arm, its 32 mm clamp block (centre x ~ 67, across the cradle's full width) midway between tip holes 2 and 3
    cb = (67.0, parts['phone_cradle_print']['holes'] and 44.7)
    cc = rot(out, cb)
    A['phone_cradle_print'] = (out, (mid[0] - cc[0], mid[1] - cc[1]), tip_top - parts['phone_cradle_print']['zmin'])

    # global frame: rotate so the jaw's long axis lies along X, then centre the assembly on the origin
    G = -principal_angle(parts['upper_jaw_print']['src'])
    corners = []
    for n, p in parts.items():
        for q in p['src']:
            a, o, dz = A[n]
            r = rot(a + G, (q[0], q[1])); o2 = rot(G, o)
            corners.append((r[0] + o2[0], r[1] + o2[1]))
    gx = (max(c[0] for c in corners) + min(c[0] for c in corners)) / 2
    gy = (max(c[1] for c in corners) + min(c[1] for c in corners)) / 2

    placements = {}
    for n, p in parts.items():
        a, o, dz = A[n]
        phi = a + G - p['t']                                   # local -> assembled rotation about z
        cx, cy, cz = p['c']
        # p_asm = R(a+G) R(-t) (p_local + c_xy) + R(G) o + shift ; the local frame already includes the z drop by zmin
        shift = rot(G, o)
        tr = rot(phi, (cx, cy))
        placements[n] = dict(assembled=dict(x=tr[0] + shift[0] - gx, y=tr[1] + shift[1] - gy, z=dz + cz, rot=phi))

    # ---- LAID OUT pose: side by side, nothing inferred
    total = sum(p['h'] for p in parts.values()) + GAP * (len(parts) - 1)
    y = total / 2
    for n in [x[0] for x in PARTS]:
        p = parts[n]
        y -= p['h'] / 2
        placements[n]['laid'] = dict(x=0.0, y=y, z=0.0, rot=0.0)
        y -= p['h'] / 2 + GAP

    # ---- MODELLED parts: lower jaw and screws (see the docstring)
    modelled = {}
    jaw = parts['upper_jaw_print']
    lj_w, lj_h, lj_d = jaw['w'], jaw['h'], 22.0                               # ASSUMED: same footprint, 22 mm thick
    lj = make_box(lj_w, lj_h, lj_d)
    jp = placements['upper_jaw_print']['assembled']
    modelled['lower_jaw'] = dict(label='Lower jaw (modelled)', colour=(0.55, 0.57, 0.6), geom=lj, rough=0.6, metal=0.0,
                                 assembled=dict(x=jp['x'], y=jp['y'], z=-lj_d, rot=jp['rot']),
                                 laid=dict(x=0.0, y=-(total / 2 + GAP + lj_h / 2), z=0.0, rot=0.0), size_mm=[round(lj_w, 1), round(lj_h, 1), lj_d])

    def to_world(q):                                                          # source-frame xy -> assembled world xy
        r = rot(G, q)
        return (r[0] - gx, r[1] - gy)

    jaw_pt = lambda xy: to_world(xy)
    root_far = to_world(far)
    steel = dict(colour=(0.62, 0.64, 0.68), rough=0.35, metal=0.85)
    screws = [
        # name, world xy, z of the screw's seat (head underside), shank length, shank r, head r, head h
        ('screw_jaw_1', jaw_pt(hole('upper_jaw_print', (26.7, 26.7), r=3.4)), -lj_d, lj_d + 12 + 3, 3.0, 5.0, 4.0),
        ('screw_jaw_2', jaw_pt(hole('upper_jaw_print', (147.0, 147.0), r=3.4)), -lj_d, lj_d + 12 + 3, 3.0, 5.0, 4.0),
        ('screw_pivot_jaw_root', jaw_pt(jaw_h2), 6.0, 42.0 - 6.0 + 3, 2.5, 4.5, 4.0),     # head sits in the 10 mm counterbore
        ('screw_pivot_root_tip', root_far, 62.0, -(62.0 - 22.0) - 3, 4.5, 7.5, 6.0),      # head on top of the tip, shank down
    ]
    for k, (nm, xy, z0, length, sr, hr, hh) in enumerate(screws):
        flip = length < 0
        geom = cap_screw(sr, abs(length), hr, hh)
        if flip:                                                             # head on top, shank pointing down
            geom = ([(p_[0], p_[1], -p_[2]) for p_ in geom[0]], [(a_, c_, b_) for a_, b_, c_ in geom[1]])
        modelled[nm] = dict(label='Screw (modelled)', colour=steel['colour'], geom=geom, rough=steel['rough'], metal=steel['metal'],
                            assembled=dict(x=xy[0], y=xy[1], z=z0, rot=0.0),
                            laid=dict(x=-60.0 + 40.0 * k, y=-(total / 2 + GAP * 3 + lj_h + 14.0), z=0.0 if not flip else abs(length) + hh, rot=0.0),
                            size_mm=[round(2 * hr, 1), round(2 * hr, 1), round(abs(length) + hh, 1)])

    # ---- glTF (Y up: x -> x, z -> y, -y -> z; mm -> m); geometry is stored in the local frame, placements in extras
    bin_chunks, views, accessors, meshes, nodes, materials = bytearray(), [], [], [], [], []

    def add_view(data, target):
        while len(bin_chunks) % 4:
            bin_chunks.append(0)
        views.append(dict(buffer=0, byteOffset=len(bin_chunks), byteLength=len(data), target=target))
        bin_chunks.extend(data)
        return len(views) - 1

    def gl(pl):
        return dict(t=[round(pl['x'] * 0.001, 6), round(pl['z'] * 0.001, 6), round(-pl['y'] * 0.001, 6)],
                    q=[0.0, round(math.sin(pl['rot'] / 2), 6), 0.0, round(math.cos(pl['rot'] / 2), 6)])

    for k, (n, label, colour, _) in enumerate(PARTS):
        p = parts[n]
        pos, nor, idx = smooth(p['local'], p['faces'])
        g = lambda v: (v[0] * 0.001, v[2] * 0.001, -v[1] * 0.001)
        gp = [g(v) for v in pos]
        gn = [g(v) for v in nor]
        pb = b''.join(struct.pack('<3f', *v) for v in gp)
        nb = b''.join(struct.pack('<3f', *v) for v in gn)
        ib = b''.join(struct.pack('<I', i) for i in idx)
        mn = [min(v[i] for v in gp) for i in range(3)]
        mx = [max(v[i] for v in gp) for i in range(3)]
        a0 = len(accessors)
        accessors.append(dict(bufferView=add_view(pb, 34962), componentType=5126, count=len(gp), type='VEC3', min=mn, max=mx))
        accessors.append(dict(bufferView=add_view(nb, 34962), componentType=5126, count=len(gn), type='VEC3'))
        accessors.append(dict(bufferView=add_view(ib, 34963), componentType=5125, count=len(idx), type='SCALAR'))
        materials.append(dict(name=label, pbrMetallicRoughness=dict(baseColorFactor=[*colour, 1], metallicFactor=0.0, roughnessFactor=0.55)))
        meshes.append(dict(name=label, primitives=[dict(attributes=dict(POSITION=a0, NORMAL=a0 + 1), indices=a0 + 2, material=k)]))
        asm, laid = gl(placements[n]['assembled']), gl(placements[n]['laid'])
        nodes.append(dict(name=n, mesh=k, translation=asm['t'], rotation=asm['q'],
                          extras=dict(label=label, assembled=asm, laid=laid, size_mm=report[n]['size_mm'])))

    for nm, m in modelled.items():
        k = len(materials)
        gp_, gf_ = m['geom']
        pos, nor, idx = smooth(gp_, gf_)
        g = lambda v: (v[0] * 0.001, v[2] * 0.001, -v[1] * 0.001)
        gp = [g(v) for v in pos]
        gn = [g(v) for v in nor]
        pb = b''.join(struct.pack('<3f', *v) for v in gp)
        nb = b''.join(struct.pack('<3f', *v) for v in gn)
        ib = b''.join(struct.pack('<I', i) for i in idx)
        mn = [min(v[i] for v in gp) for i in range(3)]
        mx = [max(v[i] for v in gp) for i in range(3)]
        a0 = len(accessors)
        accessors.append(dict(bufferView=add_view(pb, 34962), componentType=5126, count=len(gp), type='VEC3', min=mn, max=mx))
        accessors.append(dict(bufferView=add_view(nb, 34962), componentType=5126, count=len(gn), type='VEC3'))
        accessors.append(dict(bufferView=add_view(ib, 34963), componentType=5125, count=len(idx), type='SCALAR'))
        materials.append(dict(name=m['label'], pbrMetallicRoughness=dict(baseColorFactor=[*m['colour'], 1], metallicFactor=m['metal'], roughnessFactor=m['rough'])))
        meshes.append(dict(name=nm, primitives=[dict(attributes=dict(POSITION=a0, NORMAL=a0 + 1), indices=a0 + 2, material=k)]))
        asm, laid = gl(m['assembled']), gl(m['laid'])
        nodes.append(dict(name=nm, mesh=len(meshes) - 1, translation=asm['t'], rotation=asm['q'],
                          extras=dict(label=m['label'], modelled=True, assembled=asm, laid=laid, size_mm=m['size_mm'])))

    doc = dict(
        asset=dict(version='2.0', generator='cad/sandhacks/build.py'),
        scene=0, scenes=[dict(nodes=list(range(len(nodes))))], nodes=nodes, meshes=meshes, materials=materials,
        accessors=accessors, bufferViews=views, buffers=[dict(byteLength=len(bin_chunks))],
    )
    js = json.dumps(doc, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    bn = bytes(bin_chunks) + b'\0' * (-len(bin_chunks) % 4)
    glb = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(bn)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(bn), b'BIN\0') + bn
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'hardware.glb'), 'wb') as f:
        f.write(glb)
    report['mates'] = dict(
        root_on_jaw=dict(root_hole=list(root_h[0]), jaw_hole=list(jaw_h2), z=[jaw_top, root_top]),
        tip_on_root=dict(tip_hole=list(tip_h[0]), root_far_hole=list(far), z=[root_top, tip_top]),
        cradle_on_tip=dict(between_tip_holes=[list(tip_h[1]), list(tip_h[2])], z0=tip_top,
                           note='block centre x taken from the top view (about 67 mm); the cradle has no hole that mates the tip'),
        modelled=[k for k in modelled],
    )
    with open(os.path.join(OUT, 'validation.json'), 'w') as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report['mates'], indent=1))
    print('wrote hardware.glb', len(glb), 'bytes')


if __name__ == '__main__':
    main()
