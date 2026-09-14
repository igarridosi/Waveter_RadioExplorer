import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spring, project, rubberband } from './spring.js';

// Drive requestAnimationFrame by hand at 60 fps.
let queue, now;
beforeEach(() => {
  queue = [];
  now = 0;
  vi.stubGlobal('requestAnimationFrame', cb => { queue.push(cb); return queue.length; });
  vi.stubGlobal('cancelAnimationFrame', () => { queue = []; });
});
afterEach(() => vi.unstubAllGlobals());

function tick(frames) {
  for (let i = 0; i < frames && queue.length; i++) {
    now += 1000 / 60;
    const cb = queue.shift();
    cb(now);
  }
}

describe('spring', () => {
  it('settles on the target without overshoot when critically damped', () => {
    const values = [];
    const done = vi.fn();
    spring({ from: 400, to: 0, response: 0.35, damping: 1, onUpdate: v => values.push(v), onDone: done });
    tick(120);
    expect(done).toHaveBeenCalled();
    expect(values.at(-1)).toBe(0);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(values.every((v, i) => i === 0 || v <= values[i - 1] + 1e-9)).toBe(true); // monotonic approach
  });

  it('approaches faster with a shorter response', () => {
    const fast = [], slow = [];
    spring({ from: 400, to: 0, response: 0.2, onUpdate: v => fast.push(v) });
    const q1 = queue.slice(); queue = [];
    spring({ from: 400, to: 0, response: 0.5, onUpdate: v => slow.push(v) });
    const q2 = queue.slice();
    queue = q1; tick(20);
    queue = q2; tick(20);
    expect(fast[19]).toBeLessThan(slow[19]);
  });

  it('carries an initial velocity away from the target before turning back', () => {
    const values = [];
    spring({ from: 100, to: 0, velocity: 2500, onUpdate: v => values.push(v) });
    tick(3);
    expect(values[0]).toBeGreaterThan(100); // still moving the way the finger was
    tick(150);
    expect(values.at(-1)).toBe(0);
  });

  it('can be stopped mid-flight and reports its live value and velocity', () => {
    const handle = spring({ from: 400, to: 0, onUpdate: () => {} });
    tick(5);
    handle.stop();
    const { value, velocity } = handle.current();
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(400);
    expect(velocity).toBeLessThan(0);
    tick(50);
    expect(handle.current().value).toBe(value); // nothing moves after stop
  });
});

describe('project', () => {
  it('projects a flick forward and scales with velocity', () => {
    expect(project(0)).toBe(0);
    expect(project(1000)).toBeCloseTo(499, 0);
    expect(project(-500)).toBeCloseTo(-249.5, 0);
  });
});

describe('rubberband', () => {
  it('resists progressively and never exceeds the dimension', () => {
    expect(rubberband(0, 600)).toBe(0);
    expect(rubberband(-50, 600)).toBeGreaterThan(-50);
    expect(rubberband(-50, 600)).toBeLessThan(0);
    expect(Math.abs(rubberband(-100000, 600))).toBeLessThan(600);
  });
});
