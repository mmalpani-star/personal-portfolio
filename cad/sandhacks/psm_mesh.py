"""
Reader for the Parasolid "PSM mesh" text files (`*.xmm_txt`) that Onshape writes for mesh parts.

These files are not B-reps: they hold a triangle mesh in two compressed-looking but plain-text pools.
What was worked out from the supplied files (SanD Hacks parts) and checked on all four:

  * Each comb record in the schema lists its teeth: `teeth192 1 T16 <node> 1 <n_vectors> <max> <shift> <tooth ids...>`
    for the position pool and `teeth190 1 T16 <node> 1 <n_integers> <max> <bits> <shift> <tooth ids...>` for the
    triangle-index pool.
  * Every tooth is `<type> <count> <node-id> <values...>`; type 192 carries floats (x y z, metres), type 190 carries
    integers. The first tooth of each kind has its schema name written out in front of its values.
  * Indices are 1-based. 3 indices per triangle.

Validation (done by `verify`): every index is in range, every edge is shared by exactly two triangles in opposite
directions (a closed manifold), and the volume is non-zero. Two of the four parts come out with inward-facing
triangles; they are flipped.
"""
import collections
import re


def load(path):
    s = open(path, 'rb').read().decode('latin1')
    toks = [t for t in s[s.find('T47 : MESH'):].replace('\n', '').split(' ') if t]

    def comb(tag):
        j = toks.index(tag)
        assert toks[j + 2] == 'T16', toks[j:j + 6]
        return int(toks[j + 5])

    n_vec, n_int = comb('teeth192'), comb('teeth190')

    m = next(j for j, t in enumerate(toks) if re.fullmatch(r'fT\d+', t))
    c = int(toks[m][2:])
    vecs = [float(x) for x in toks[m + 2:m + 2 + c]]
    e = m + 2 + c
    while toks[e] == '192':
        c = int(toks[e + 1])
        vecs += [float(x) for x in toks[e + 3:e + 3 + c]]
        e += 3 + c

    d = next(j for j, t in enumerate(toks) if re.fullmatch(r'dT\d+', t))
    c = int(toks[d][2:])
    ints = [int(x) for x in toks[d + 2:d + 2 + c]]
    e = d + 2 + c
    while toks[e] == '190':
        c = int(toks[e + 1])
        ints += [int(x) for x in toks[e + 3:e + 3 + c]]
        e += 3 + c

    points = [tuple(vecs[3 * i:3 * i + 3]) for i in range(n_vec)]
    index = [v - 1 for v in ints[:n_int]]
    faces = [tuple(index[i:i + 3]) for i in range(0, len(index), 3)]
    return points, faces


def volume(points, faces):
    v = 0.0
    for a, b, c in faces:
        A, B, C = points[a], points[b], points[c]
        v += (A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6
    return v


def verify(points, faces):
    edges = collections.Counter()
    for a, b, c in faces:
        for u, w in ((a, b), (b, c), (c, a)):
            edges[(u, w)] += 1
    open_edges = sum(1 for (u, w), n in edges.items() if edges.get((w, u), 0) != n)
    idx = [i for f in faces for i in f]
    return dict(vertices=len(points), triangles=len(faces), index_range=(min(idx), max(idx)),
                open_edges=open_edges, volume_mm3=volume(points, faces) * 1e9)


def outward(points, faces):
    """Return the faces with outward-facing winding (flipped if the signed volume is negative)."""
    return faces if volume(points, faces) >= 0 else [(a, c, b) for a, b, c in faces]
