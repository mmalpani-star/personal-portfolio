"""Reader for the Parasolid *mesh* file (.xmm_txt) that Onshape exports next to a .x_t.

The file is a text transmit file. Only five node types matter for geometry:
    PSM_MESH (189), INTEGER_TOOTH (190), INTEGER_COMB (191),
    VECTOR_TOOTH (192), VECTOR_COMB (193)
A "comb" is a list of "teeth" (blocks of 2**shift entries). Vector teeth hold
plain doubles (x y z), integer teeth hold plain integers.
"""
import re, sys, json
import numpy as np

DESC = [
    (re.compile(r'189 8 8 PSM_MESH8 PSM Mesh9 precision0 0 1 u5 owner201 0 13 position_pool193 0 11 normal_pool193 0 16 position_indices191 0 11 normal_type0 0 1 u14 normal_indices191 0 5 combs1042 1 T(\d+)'), 189),
    (re.compile(r'193 5 11 VECTOR_COMB11 Vector Comb8 encoding0 0 1 u9 n_vectors0 0 1 d13 n_max_vectors0 0 1 d5 shift0 0 1 d5 teeth192 1 T(\d+)'), 193),
    (re.compile(r'191 6 12 INTEGER_COMB12 Integer Comb8 encoding0 0 1 u10 n_integers0 0 1 d14 n_max_integers0 0 1 d18 n_bits_per_integer0 0 1 d5 shift0 0 1 d5 teeth190 1 T(\d+)'), 191),
    (re.compile(r'190 1 13 INTEGER_TOOTH13 Integer Tooth6 values0 1 1 dT(\d+)'), 190),
    (re.compile(r'192 1 12 VECTOR_TOOTH12 Vector Tooth6 values0 1 1 fT(\d+)'), 192),
]


def parse(path):
    raw = open(path, 'rb').read().decode('latin1')
    i = raw.index('**END_OF_HEADER')
    t = raw[i:].replace('\n', '')
    # swap descriptors for a marker "@<type> <count>" so the rest tokenises on spaces
    for rx, ty in DESC:
        t = rx.sub(lambda m: ' @%d %s ' % (ty, m.group(1)), t)
    head, _, body = t.partition(' @189 ')
    tok = (' @189 ' + body).split()
    pos = 0
    nodes = {}
    order = []
    first_after_desc = None
    # field layouts after [count] idx
    def read_record(ty, count, first):
        nonlocal pos
        idx = int(tok[pos]); pos += 1
        if ty == 189:
            f = [int(x) for x in tok[pos:pos + 7]]; pos += 7
            # precision, owner, position_pool, normal_pool, position_indices, normal_type, normal_indices
            rec = dict(ty=ty, idx=idx, precision=f[0], owner=f[1], pos_pool=f[2], nrm_pool=f[3], pos_idx=f[4], nrm_type=f[5], nrm_idx=f[6])
        elif ty == 193:
            f = [int(x) for x in tok[pos:pos + 4]]; pos += 4
            teeth = [int(x) for x in tok[pos:pos + count]]; pos += count
            rec = dict(ty=ty, idx=idx, enc=f[0], n=f[1], nmax=f[2], shift=f[3], teeth=teeth)
        elif ty == 191:
            f = [int(x) for x in tok[pos:pos + 5]]; pos += 5
            teeth = [int(x) for x in tok[pos:pos + count]]; pos += count
            rec = dict(ty=ty, idx=idx, enc=f[0], n=f[1], nmax=f[2], bits=f[3], shift=f[4], teeth=teeth)
        elif ty == 190:
            vals = np.array(tok[pos:pos + count], dtype=np.int64); pos += count
            rec = dict(ty=ty, idx=idx, values=vals)
        elif ty == 192:
            vals = np.array(tok[pos:pos + count], dtype=np.float64); pos += count
            rec = dict(ty=ty, idx=idx, values=vals)
        else:
            raise ValueError(ty)
        nodes[idx] = rec
        order.append((ty, idx))

    while pos < len(tok):
        t0 = tok[pos]
        if t0.startswith('@'):
            ty = int(t0[1:]); count = int(tok[pos + 1]); pos += 2
            read_record(ty, count, True)
            continue
        if t0 in ('189', '190', '191', '192', '193'):
            ty = int(t0); count = int(tok[pos + 1]); pos += 2
            read_record(ty, count, False)
            continue
        break  # trailing padding
    return nodes, order, tok[pos:pos + 5]


def comb_vectors(nodes, comb):
    parts = [nodes[i]['values'].reshape(-1, 3) for i in comb['teeth'] if i]
    return np.concatenate(parts)[:comb['n']]


def comb_ints(nodes, comb):
    parts = [nodes[i]['values'] for i in comb['teeth'] if i]
    return np.concatenate(parts)[:comb['n']]


def meshes(path):
    nodes, order, rest = parse(path)
    out = []
    for idx in sorted(k for k, v in nodes.items() if v['ty'] == 189):
        m = nodes[idx]
        P = comb_vectors(nodes, nodes[m['pos_pool']])
        I = comb_ints(nodes, nodes[m['pos_idx']])
        out.append(dict(idx=idx, P=P, I=I))
    return out


if __name__ == '__main__':
    nodes, order, rest = parse(sys.argv[1])
    from collections import Counter
    print(Counter(t for t, _ in order), 'rest tokens:', rest, 'nodes', len(nodes))
    print(order[:20])
