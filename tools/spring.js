// Spring — the one piece of physics shared by every demo on this page.
// A value drifts toward a target with damped momentum: nudge it, release it,
// it overshoots a little and settles. The mesh grid uses one spring per axis
// per point (target = home position). The carousel uses one spring for the
// track offset (target = the resting position of the current slide). Same
// three lines of math, two different shapes.

export function stepSpring(x, px, target, damping, pull) {
  const v = (x - px) * damping;
  const prevX = x;
  let nx = x + v;
  nx += (target - nx) * pull;
  return [nx, prevX];
}
