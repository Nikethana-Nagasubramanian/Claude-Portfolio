/**
 * Generates a normalized 1D Gaussian kernel for a given blur radius.
 *
 * kernel_size = 2*radius + 1 (radius taps on each side of center).
 * sigma = radius / 2, the standard deviation controlling the falloff.
 *
 * radius 0 is special-cased to [1] (identity) since sigma would be 0,
 * making the Gaussian formula divide by zero.
 */
export function gaussianKernel1D(radius: number): number[] {
  if (radius <= 0) return [1];

  const sigma = radius / 2;
  const twoSigmaSq = 2 * sigma * sigma;
  const weights: number[] = [];

  for (let i = -radius; i <= radius; i++) {
    weights.push(Math.exp(-(i * i) / twoSigmaSq));
  }

  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / sum);
}
