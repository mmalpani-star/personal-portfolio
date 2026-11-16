'use client';

import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import styles from './ShotArc.module.css';

type Geometry = {
  width: number;
  height: number;
  /** Launch point, target point and launch angle in degrees. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  angle: number;
  /** Length of the velocity vector, in viewBox units. */
  vector: number;
};

const wide: Geometry = { width: 1200, height: 280, x0: 120, y0: 226, x1: 1040, y1: 146, angle: 32, vector: 104 };
const narrow: Geometry = { width: 360, height: 204, x0: 34, y0: 186, x1: 304, y1: 118, angle: 46, vector: 56 };

/**
 * A projectile's path is a parabola, and a quadratic Bézier whose control
 * point sits where the launch and landing tangents meet is that same parabola.
 * Its parameter t also advances x linearly, i.e. constant horizontal velocity.
 */
function Diagram({ g, className }: { g: Geometry; className: string }) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const t = useMotionValue(reduceMotion ? 1 : 0);

  const rad = (g.angle * Math.PI) / 180;
  const dx = g.x1 - g.x0;
  const cx = g.x0 + dx / 2;
  const cy = g.y0 - (Math.tan(rad) * dx) / 2;
  const at = (v: number, a: number, c: number, b: number) => (1 - v) * (1 - v) * a + 2 * v * (1 - v) * c + v * v * b;

  const apexT = (cy - g.y0) / (2 * cy - g.y0 - g.y1);
  const apexX = at(apexT, g.x0, cx, g.x1);
  const apexY = at(apexT, g.y0, cy, g.y1);
  const tipX = g.x0 + Math.cos(rad) * g.vector;
  const tipY = g.y0 - Math.sin(rad) * g.vector;
  const arcR = g.vector * 0.42;
  const small = g.width < 600;
  const rim = small ? 26 : 54;

  const ballX = useTransform(t, (v) => at(v, g.x0, cx, g.x1));
  const ballY = useTransform(t, (v) => at(v, g.y0, cy, g.y1));
  const apexOpacity = useTransform(t, [apexT - 0.08, apexT], [0, 1]);

  useEffect(() => {
    if (!inView || reduceMotion) return;
    const controls = animate(t, 1, { duration: 1.9, ease: 'linear', delay: 0.2 });
    return () => controls.stop();
  }, [inView, reduceMotion, t]);

  return (
    <svg ref={ref} viewBox={`0 0 ${g.width} ${g.height}`} className={`${styles.svg} ${className}`} aria-hidden="true">
      <defs>
        <marker id={`arrow-${g.width}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0.5 8 4 0 7.5" className={styles.arrowHead} />
        </marker>
      </defs>

      {/* Ground line with range ticks */}
      <path className={styles.axis} d={`M${g.x0 - 30} ${g.y0}H${g.x1 + rim + 30}`} />
      {Array.from({ length: 9 }, (_, i) => g.x0 + (dx * i) / 8).map((x) => (
        <path key={x} className={styles.axis} d={`M${x} ${g.y0}v6`} />
      ))}

      {/* Launch: velocity vector and angle */}
      <path className={styles.vector} d={`M${g.x0} ${g.y0}L${tipX} ${tipY}`} markerEnd={`url(#arrow-${g.width})`} />
      <path
        className={styles.thin}
        d={`M${g.x0 + arcR} ${g.y0}A${arcR} ${arcR} 0 0 0 ${g.x0 + Math.cos(rad) * arcR} ${g.y0 - Math.sin(rad) * arcR}`}
      />
      <text className={styles.text} x={tipX - 6} y={tipY - 12} textAnchor="end">
        v₀
      </text>
      <text className={styles.text} x={g.x0 + arcR + 8} y={g.y0 - 8}>
        θ = {g.angle}°
      </text>

      {/* Flight path */}
      <path className={styles.ghost} d={`M${g.x0} ${g.y0}Q${cx} ${cy} ${g.x1} ${g.y1}`} />
      <motion.path
        className={styles.path}
        d={`M${g.x0} ${g.y0}Q${cx} ${cy} ${g.x1} ${g.y1}`}
        style={{ pathLength: t }}
      />

      {/* Apex */}
      <motion.g style={{ opacity: apexOpacity }}>
        <path className={styles.dashed} d={`M${apexX} ${apexY}V${g.y0}`} />
        <circle className={styles.node} cx={apexX} cy={apexY} r={small ? 2.5 : 3.5} />
        <text className={styles.text} x={apexX + 10} y={apexY - 10}>
          APEX
        </text>
        <text
          className={styles.textDim}
          x={small ? apexX + 8 : apexX + 10}
          y={small ? g.y0 - 8 : apexY + 24}
        >
          h = v₀² sin²θ / 2g
        </text>
      </motion.g>

      {/* Target */}
      <path className={styles.target} d={`M${g.x1 - rim / 2} ${g.y1}h${rim}`} />
      <path className={styles.thin} d={`M${g.x1 + rim / 2} ${g.y1 - rim * 0.75}v${rim * 0.95}`} />
      <path
        className={styles.thin}
        d={`M${g.x1 - rim / 2 + 3} ${g.y1}l${rim * 0.14} ${rim * 0.4}M${g.x1} ${g.y1}v${rim * 0.4}M${g.x1 + rim / 2 - 3} ${g.y1}l-${rim * 0.14} ${rim * 0.4}`}
      />
      <text
        className={styles.text}
        x={small ? g.x1 + rim / 2 : g.x1 + rim / 2 + 10}
        y={small ? g.y1 - rim * 0.75 - 8 : g.y1 - rim * 0.75 + 4}
        textAnchor={small ? 'end' : 'start'}
      >
        TARGET
      </text>

      {/* Gravity */}
      <path
        className={styles.thin}
        d={`M${g.x0 + dx * 0.86} ${g.y0 - (small ? 44 : 64)}v${small ? 22 : 30}`}
        markerEnd={`url(#arrow-${g.width})`}
      />
      <text className={styles.textDim} x={g.x0 + dx * 0.86 + 8} y={g.y0 - (small ? 30 : 44)}>
        g
      </text>

      <motion.circle className={styles.ball} r={small ? 5 : 7} style={{ cx: ballX, cy: ballY }} />
    </svg>
  );
}

/** Section transition: a shot arc drawn as a kinematics figure, linked to the quadruped project. */
export function ShotArc() {
  return (
    <figure className={styles.figure}>
      <div className="page-shell">
        <Diagram g={wide} className={styles.wide} />
        <Diagram g={narrow} className={styles.narrow} />
        <figcaption className={styles.caption}>
          <span>
            <span className={styles.fig}>FIG. 02</span>
            Projectile kinematics. Different robot, same maths: pick a target, solve for the angle.
          </span>
          <Link href="/projects/quadruped-leg-kinematics" className={styles.link}>
            Quadruped leg kinematics
            <Icon name="arrow-right" size={13} />
          </Link>
        </figcaption>
      </div>
    </figure>
  );
}
