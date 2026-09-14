// A small spring, in Apple's two designer parameters:
//   response  - seconds to approach the target (not a duration; settle time emerges)
//   damping   - 1 = no overshoot, < 1 = bounce
// Starts from the current value and velocity, so it can be re-targeted or
// grabbed mid-flight without a jump. Returns a handle with stop() and current().
export function spring({ from, to, velocity = 0, response = 0.35, damping = 1, onUpdate, onDone }) {
  const stiffness = (2 * Math.PI / response) ** 2;
  const dampingCoef = 2 * damping * Math.sqrt(stiffness);
  let x = from;
  let v = velocity;
  let last = null;
  let frame = 0;

  function step(now) {
    const dt = last === null ? 1 / 60 : Math.min((now - last) / 1000, 1 / 30);
    last = now;
    // Semi-implicit Euler is stable enough at these stiffnesses and frame rates.
    const accel = -stiffness * (x - to) - dampingCoef * v;
    v += accel * dt;
    x += v * dt;
    if (Math.abs(x - to) < 0.3 && Math.abs(v) < 8) {
      x = to;
      onUpdate(x);
      onDone?.();
      return;
    }
    onUpdate(x);
    frame = requestAnimationFrame(step);
  }

  frame = requestAnimationFrame(step);
  return {
    stop: () => cancelAnimationFrame(frame),
    current: () => ({ value: x, velocity: v }),
  };
}

// Where a flick would come to rest on its own (UIScrollView's deceleration curve).
export function project(velocity, decelerationRate = 0.998) {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

// Soft resistance past a boundary: the further past it, the less it follows.
export function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
