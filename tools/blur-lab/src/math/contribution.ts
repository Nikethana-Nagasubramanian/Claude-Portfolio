/**
 * Closed-form contribution weights of every source pixel to one output
 * pixel of a two-pass separable blur. Because both passes use the same 1D
 * kernel, the combined 2D contribution of source pixel (row+dr, col+dc) is
 * the outer product kernel[dr] * kernel[dc] — no need to re-run the passes.
 *
 * Indices are clamped to the grid bounds to mirror convolve1DAxis's default
 * clamp-to-edge behavior: multiple out-of-bounds offsets that clamp to the
 * same edge pixel have their weights summed rather than overwritten.
 */
export function computeContributionWeights(
  row: number,
  col: number,
  radius: number,
  kernel: number[],
  rows: number,
  cols: number
): Map<string, number> {
  const center = Math.floor(kernel.length / 2);
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));
  const weights = new Map<string, number>();

  for (let dr = -radius; dr <= radius; dr++) {
    const kr = kernel[center + dr];
    if (kr === undefined) continue;
    const r = clamp(row + dr, rows);
    for (let dc = -radius; dc <= radius; dc++) {
      const kc = kernel[center + dc];
      if (kc === undefined) continue;
      const c = clamp(col + dc, cols);
      const key = `${r},${c}`;
      weights.set(key, (weights.get(key) ?? 0) + kr * kc);
    }
  }
  return weights;
}
