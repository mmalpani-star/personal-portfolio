'use client';

import { useEffect, useRef } from 'react';
import styles from './MangaPanels.module.css';

const GRAVITY = 2100; // px/s², scaled for a panel-sized court
const RESTITUTION = 0.76; // energy kept on a floor bounce
const WALL_RESTITUTION = 0.84;
const AIR_DRAG = 0.12; // per second
const ROLL_FRICTION = 0.4;
const RADIUS = 26;

type Ball = { x: number; y: number; vx: number; vy: number; spin: number; angle: number };

function serve(width: number): Ball {
  return {
    x: width * 0.62,
    y: RADIUS + 8,
    vx: 240 + Math.random() * 180,
    vy: 0,
    spin: 5 + Math.random() * 3,
    angle: 0,
  };
}

function drawBall(ctx: CanvasRenderingContext2D, ball: Ball) {
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.angle);

  ctx.fillStyle = '#ff6b5b';
  ctx.beginPath();
  ctx.arc(0, 0, RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // Seams: a vertical line, a horizontal line and two curved panels.
  ctx.strokeStyle = 'rgba(20, 33, 61, 0.85)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, -RADIUS);
  ctx.lineTo(0, RADIUS);
  ctx.moveTo(-RADIUS, 0);
  ctx.lineTo(RADIUS, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 0, RADIUS * 0.52, RADIUS, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 0, RADIUS, RADIUS * 0.52, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Rim highlight sells the sphere
  ctx.strokeStyle = 'rgba(255, 220, 200, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, RADIUS - 1, Math.PI * 1.08, Math.PI * 1.62);
  ctx.stroke();

  ctx.restore();
}

/**
 * A basketball with real physics, bouncing inside its panel. Click to throw it
 * again. The loop only runs while the panel is on screen, and reduced motion
 * gets a single resting ball instead.
 */
export function Basketball() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let ball: Ball = { x: 0, y: 0, vx: 0, vy: 0, spin: 0, angle: 0 };
    let frame = 0;
    let last = 0;
    let running = false;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      drawBall(ctx, ball);
    };

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;

      ball.vy += GRAVITY * dt;
      ball.vx *= 1 - AIR_DRAG * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.angle += ball.spin * dt;

      const floor = height - RADIUS;
      if (ball.y > floor) {
        ball.y = floor;
        ball.vy = -ball.vy * RESTITUTION;
        ball.vx *= 1 - ROLL_FRICTION * dt * 6;
        // Spin follows the surface velocity on contact.
        ball.spin = ball.vx / RADIUS;
      }
      if (ball.x < RADIUS) {
        ball.x = RADIUS;
        ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION;
        ball.spin = -ball.spin * 0.7;
      }
      if (ball.x > width - RADIUS) {
        ball.x = width - RADIUS;
        ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION;
        ball.spin = -ball.spin * 0.7;
      }

      render();

      // Settle: once it has almost no energy left, stop burning frames.
      const resting = Math.abs(ball.vy) < 26 && Math.abs(ball.vx) < 10 && ball.y > floor - 1;
      if (resting) {
        running = false;
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(step);
    };

    const start = () => {
      if (running || reduceMotion.matches) return;
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(step);
    };

    const throwBall = () => {
      if (reduceMotion.matches) return;
      ball = serve(width);
      start();
    };

    resize();
    ball = serve(width);
    if (reduceMotion.matches) {
      ball.y = height - RADIUS;
      ball.vx = 0;
      ball.vy = 0;
    }
    render();

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) throwBall();
        else {
          cancelAnimationFrame(frame);
          frame = 0;
          running = false;
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(parent);

    const resizeObserver = new ResizeObserver(() => {
      resize();
      render();
    });
    resizeObserver.observe(parent);

    parent.addEventListener('click', throwBall);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      parent.removeEventListener('click', throwBall);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.court} aria-hidden="true" />;
}
