import { Axis, EdgeMode, PixelGrid, RGB } from './types';
import { gaussianKernel1D } from './kernel';

function resolveIndex(i: number, length: number, edgeMode: EdgeMode): number {
  if (edgeMode === 'clamp') {
    if (i < 0) return 0;
    if (i >= length) return length - 1;
    return i;
  }
  if (edgeMode === 'wrap') {
    return ((i % length) + length) % length;
  }
  // 'zero': signal out-of-bounds with -1; caller treats it as [0,0,0]
  return i < 0 || i >= length ? -1 : i;
}

function samplePixel(
  grid: PixelGrid,
  row: number,
  col: number,
  edgeMode: EdgeMode
): RGB {
  const rows = grid.length;
  const cols = grid[0].length;
  const r = resolveIndex(row, rows, edgeMode);
  const c = resolveIndex(col, cols, edgeMode);
  if (r === -1 || c === -1) return [0, 0, 0];
  return grid[r][c];
}

/**
 * Convolves a pixel grid with a 1D kernel along a single axis.
 * This is one of the two passes of a separable Gaussian blur — the caller
 * is responsible for running it twice (vertical then horizontal) to produce
 * a full 2D blur; this function only ever does one direction.
 */
export function convolve1DAxis(
  grid: PixelGrid,
  kernel: number[],
  axis: Axis,
  edgeMode: EdgeMode = 'clamp'
): PixelGrid {
  const rows = grid.length;
  const cols = grid[0].length;
  const center = Math.floor(kernel.length / 2);

  const out: PixelGrid = [];
  for (let row = 0; row < rows; row++) {
    const outRow: RGB[] = [];
    for (let col = 0; col < cols; col++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < kernel.length; k++) {
        const offset = k - center;
        const sample =
          axis === 'vertical'
            ? samplePixel(grid, row + offset, col, edgeMode)
            : samplePixel(grid, row, col + offset, edgeMode);
        const weight = kernel[k];
        r += sample[0] * weight;
        g += sample[1] * weight;
        b += sample[2] * weight;
      }
      outRow.push([r, g, b]);
    }
    out.push(outRow);
  }
  return out;
}

export interface BlurPassResult {
  vertical: PixelGrid;
  horizontal: PixelGrid; // the final blurred image
}

/**
 * Runs the two-pass separable Gaussian blur. There are always exactly two
 * convolution passes — vertical then horizontal — regardless of radius.
 * Only the kernel (its size and weights) changes with radius.
 */
export function runTwoPassGaussianBlur(
  source: PixelGrid,
  radius: number,
  edgeMode: EdgeMode = 'clamp'
): BlurPassResult {
  const kernel = gaussianKernel1D(radius);
  const vertical = convolve1DAxis(source, kernel, 'vertical', edgeMode);
  const horizontal = convolve1DAxis(vertical, kernel, 'horizontal', edgeMode);
  return { vertical, horizontal };
}
