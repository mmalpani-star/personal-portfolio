"""
Walking (trot) and jump clips for the quadruped, solved with the same inverse kinematics as the crawl in assembly.py.

    .cadenv/bin/python cad/quadruped/gait2.py       # then: sh cad/sync-web.sh

Why this exists: the first clip was a lateral-sequence crawl (3.6 s per cycle, 40 mm steps, a 26 mm sideways lurch of
the whole body). That is the safest gait for a statically stable robot, but on screen it reads as a slow, lurching
shuffle. This script adds

  * "trot"  diagonal pairs (front-left + rear-right, front-right + rear-left) swing together; 0.9 s per cycle, 100 mm per
            cycle. Swing feet follow a cubic Hermite path whose velocity at lift-off and touch-down equals the planted
            feet's backward speed, so nothing snaps; the foot lifts on a sin^2 curve (zero speed at both ends). The body
            bobs a few millimetres and does not sway sideways. Planted feet do not slip.
  * "jump"  crouch, push, ballistic flight, tuck, landing and recovery, in place. The flight is a real parabola under 1 g.

and keeps "crawl" in the file.

What it is NOT: a dynamics simulation. A trot is not statically stable (the crawl's 13.7 mm margin is gone), and the jump's
height is a design choice for the animation (set to 110 mm, the figure the project's MuJoCo twin reports), not a result
computed from the servos' torque or the real robot's mass. Every pose IS checked here: IK residual, joint angles against
the free ranges found in validation.json, and part-to-part collisions on a sample of frames.
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import assembly as A  # noqa: E402

G_MM = 9810.0                    # mm/s^2

TROT = dict(
    period=0.9,                  # s per cycle
    stride=100.0,                # mm the body advances per cycle (= stride length of each foot)
    swing=0.44,                  # fraction of the cycle each foot is in the air (a brief four-foot overlap)
    lift=28.0,                   # mm
    bob=2.5,                     # mm body bob, twice per cycle
    frames=120,
    pairs=[["front_left", "rear_right"], ["front_right", "rear_left"]],
)
JUMP = dict(
    period=2.0,                  # s for the whole move
    crouch=44.0,                 # mm the body sinks before the push
    push_top=38.0,               # mm above standing at lift-off (legs fully extended)
    apex=110.0,                  # mm above standing at the top of the flight
    tuck=62.0,                   # mm the feet are drawn up in flight, relative to lift-off
    settle=34.0,                 # mm the body sinks on landing before it recovers
    frames=200,
)


def hermite(p0, p1, m0, m1, w):
    h00 = 2 * w ** 3 - 3 * w ** 2 + 1
    h10 = w ** 3 - 2 * w ** 2 + w
    h01 = -2 * w ** 3 + 3 * w ** 2
    h11 = w ** 3 - w ** 2
    return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * x * (x * (6 * x - 15) + 10)      # quintic: zero velocity and acceleration at both ends


def trot_frames(specs, feet, q_st):
    P = TROT
    S, d, H = P["stride"], P["swing"], P["lift"]
    travel = S * (1 - d)                        # how far a planted foot slides back, relative to the body
    slot = {n: (0.0 if n in P["pairs"][0] else 0.5) for pair in P["pairs"] for n in pair}
    q_prev = dict(q_st)
    frames, worst = [], 0.0
    N = P["frames"]
    for f in range(N + 1):
        t = f / N
        bz = P["bob"] * np.sin(4 * np.pi * t + np.pi / 2) - 0.0       # body height above standing (mm)
        row = {"_t": t, "_offset": np.array([0.0, 0.0, bz]), "_down": []}
        for s in specs:
            n = s["name"]
            ph = (t - slot[n]) % 1.0
            if ph < d:                                  # swing
                w = ph / d
                x = hermite(-travel / 2, travel / 2, -S * d, -S * d, w)
                z = H * np.sin(np.pi * w) ** 2
                down = False
            else:                                       # stance: slides back at the body's speed
                w = (ph - d) / (1 - d)
                x = travel / 2 - travel * w
                z = 0.0
                down = True
            target = feet[n] + np.array([x, 0.0, z - bz])           # body frame: a planted foot stays put in the world
            q, err = A.ik(s, target, q_prev[n])
            worst = max(worst, err)
            q_prev[n] = q
            row[n] = q
            if down:
                row["_down"].append(n)
        frames.append(row)
    return frames, worst


def jump_frames(specs, feet, q_st):
    J = JUMP
    N, T = J["frames"], J["period"]
    g = G_MM
    v0 = np.sqrt(2 * g * (J["apex"] - J["push_top"]))             # lift-off speed for the chosen apex (mm/s)
    t_air = 2 * v0 / g
    # timeline (seconds)
    t_crouch, t_hold, t_push = 0.50, 0.12, 0.13
    t_lift = t_crouch + t_hold + t_push
    t_land = t_lift + t_air
    t_settle, t_rise = 0.20, 0.45
    assert t_land + t_settle + t_rise <= T + 1e-9, (t_land + t_settle + t_rise)
    q_prev = dict(q_st)
    frames, worst = [], 0.0
    for f in range(N + 1):
        t = f * T / N
        planted = True
        if t < t_crouch:                                          # sink, slowly at first
            z = -J["crouch"] * smooth(t / t_crouch)
            foot_dz = -z
        elif t < t_crouch + t_hold:
            z = -J["crouch"]
            foot_dz = -z
        elif t < t_lift:                                          # push: accelerate up to lift-off height
            w = (t - t_crouch - t_hold) / t_push
            e = w * w * (3 - 2 * w)
            z = -J["crouch"] + (J["crouch"] + J["push_top"]) * e
            foot_dz = -z
        elif t < t_land:                                          # flight: a parabola; feet tuck, then reach for the ground
            planted = False
            u = t - t_lift
            z = J["push_top"] + v0 * u - 0.5 * g * u * u
            w = u / t_air
            tuck = J["tuck"] * np.sin(np.pi * min(1.0, w * 1.0)) ** 2 if w < 1 else 0.0
            # feet draw up fast after lift-off and are fully extended again just before touch-down
            tuck = J["tuck"] * smooth(min(1, w / 0.35)) * (1 - smooth(max(0, (w - 0.65) / 0.35)))
            foot_dz = -J["push_top"] + tuck
        elif t < t_land + t_settle:                               # touch-down: compress
            w = (t - t_land) / t_settle
            z = J["push_top"] + (-J["settle"] - J["push_top"]) * smooth(w)
            foot_dz = -z
        else:                                                     # recover to standing
            w = min(1.0, (t - t_land - t_settle) / t_rise)
            z = -J["settle"] * (1 - smooth(w))
            foot_dz = -z
        row = {"_t": t / T, "_offset": np.array([0.0, 0.0, z]), "_down": [] if not planted else [s["name"] for s in specs]}
        for s in specs:
            n = s["name"]
            q, err = A.ik(s, feet[n] + np.array([0.0, 0.0, foot_dz]), q_prev[n])
            worst = max(worst, err)
            q_prev[n] = q
            row[n] = q
        frames.append(row)
    return frames, worst, dict(v0_mm_s=v0, air_time_s=t_air, lift_off_s=t_lift, land_s=t_land)


def report_for(frames, specs, M, tag, ranges, sample=6):
    deg = {s["name"]: np.degrees(np.array([fr[s["name"]] for fr in frames])) for s in specs}
    over = []
    for s in specs:
        rg = ranges[s["name"]]
        for j, jn in enumerate(("coxa", "femur", "knee")):
            lo, hi = rg[jn]
            lo_, hi_ = deg[s["name"]][:, j].min(), deg[s["name"]][:, j].max()
            if lo_ < lo - 0.5 or hi_ > hi + 0.5:
                over.append((s["name"], jn, round(float(lo_), 1), round(float(hi_), 1), (lo, hi)))
    hits = []
    for k in range(0, len(frames), sample):
        qs = {s["name"]: frames[k][s["name"]] for s in specs}
        f, _, _ = A.collisions(specs, qs, M)
        hits += [(k, *x) for x in f]
    travel = {n: np.ptp(a, axis=0).round(1).tolist() for n, a in deg.items()}
    return dict(joint_travel_deg=travel, outside_free_range=over, collisions=hits)


def main():
    M = A.meshes()
    specs = A.leg_specs(A.HANDEDNESS)
    feet, q_st = A.stance(specs)
    val = json.load(open(os.path.join(A.OUT, "validation.json")))
    ranges = val["joint_free_range_about_stance_deg"]

    # the crawl clip is kept as it was
    crawl, _ = A.crawl(specs, feet, q_st)
    clips = [("crawl", crawl, A.GAIT["period"])]

    trot, e1 = trot_frames(specs, feet, q_st)
    jump, e2, jinfo = jump_frames(specs, feet, q_st)
    clips = [("trot", trot, TROT["period"]), ("jump", jump, JUMP["period"])] + clips

    out = dict(
        trot=dict(params=TROT, ik_max_residual_mm=round(e1, 5), **report_for(trot, specs, M, "trot", ranges)),
        jump=dict(params=JUMP, ik_max_residual_mm=round(e2, 5), flight=jinfo,
                  body_height_mm=dict(min=round(min(f["_offset"][2] for f in jump), 1), max=round(max(f["_offset"][2] for f in jump), 1)),
                  **report_for(jump, specs, M, "jump", ranges)),
        note="Kinematic animation: reach, joint range and collisions are checked; dynamics, torque and balance are not.",
    )
    with open(os.path.join(A.OUT, "gait2_validation.json"), "w") as f:
        json.dump(out, f, indent=2, default=lambda o: o.tolist() if hasattr(o, "tolist") else str(o))

    glb = A.export_glb(specs, q_st, clips, M)

    man_path = os.path.join(A.OUT, "quadruped.manifest.json")
    man = json.load(open(man_path))
    man["animation"] = dict(name="trot", period_s=TROT["period"], body_advance_per_cycle_m=TROT["stride"] / 1000,
                            note="Move the root by body_advance_per_cycle_m per clip loop and planted feet do not slip. "
                                 "The clip bobs the trunk a few millimetres; no sideways sway.")
    man["jump"] = dict(name="jump", period_s=JUMP["period"], apex_mm=JUMP["apex"], in_place=True,
                       note="In place. The body height follows a parabola under 1 g between lift-off and touch-down.")
    man["crawl"] = dict(name="crawl", period_s=A.GAIT["period"], body_advance_per_cycle_m=A.GAIT["step"] / 1000)
    man["gait_trot"] = TROT
    man["gait_jump"] = JUMP
    with open(man_path, "w") as f:
        json.dump(man, f, indent=2)

    t = out["trot"]; j = out["jump"]
    print("trot  IK residual", t["ik_max_residual_mm"], "mm | outside free range:", t["outside_free_range"], "| collisions:", t["collisions"][:6])
    print("jump  IK residual", j["ik_max_residual_mm"], "mm | outside free range:", j["outside_free_range"], "| collisions:", j["collisions"][:6])
    print("jump  flight", {k: round(float(v), 3) for k, v in jinfo.items()}, "| body height", j["body_height_mm"])
    print("trot travel", t["joint_travel_deg"]["front_left"], " jump travel", j["joint_travel_deg"]["front_left"])
    print("glb", round(os.path.getsize(glb) / 1e6, 2), "MB")


if __name__ == "__main__":
    main()
