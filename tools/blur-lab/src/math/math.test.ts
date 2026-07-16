import { describe, it, expect } from 'vitest';
import { gaussianKernel1D } from './kernel';
import { convolve1DAxis, runTwoPassGaussianBlur } from './convolution';
import { computeContributionWeights } from './contribution';
import { PixelGrid, RGB } from './types';

function makeUniformGrid(size: number, color: RGB): PixelGrid {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => [...color] as RGB)
  );
}

function expectRGBClose(actual: RGB, expected: RGB, precision = 6) {
  expect(actual[0]).toBeCloseTo(expected[0], precision);
  expect(actual[1]).toBeCloseTo(expected[1], precision);
  expect(actual[2]).toBeCloseTo(expected[2], precision);
}

describe('gaussianKernel1D', () => {
  it('sums to 1 within 1e-9, for radius 0..10', () => {
    for (let radius = 0; radius <= 10; radius++) {
      const kernel = gaussianKernel1D(radius);
      const sum = kernel.reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
    }
  });

  it('has length 2*radius + 1', () => {
    for (let radius = 0; radius <= 10; radius++) {
      expect(gaussianKernel1D(radius).length).toBe(2 * radius + 1);
    }
  });

  it('is symmetric around the center', () => {
    for (let radius = 1; radius <= 10; radius++) {
      const kernel = gaussianKernel1D(radius);
      for (let i = 0; i < kernel.length; i++) {
        expect(kernel[i]).toBeCloseTo(kernel[kernel.length - 1 - i], 12);
      }
    }
  });

  it('radius 0 is the identity kernel [1]', () => {
    expect(gaussianKernel1D(0)).toEqual([1]);
  });
});

describe('runTwoPassGaussianBlur — uniform input', () => {
  it('a uniform-color grid stays unchanged at every radius 0..10', () => {
    const color: RGB = [100, 150, 200];
    const grid = makeUniformGrid(8, color);
    for (let radius = 0; radius <= 10; radius++) {
      const { horizontal } = runTwoPassGaussianBlur(grid, radius);
      for (const row of horizontal) {
        for (const pixel of row) {
          expectRGBClose(pixel, color, 9);
        }
      }
    }
  });
});

describe('runTwoPassGaussianBlur — radius 0 identity', () => {
  it('produces output byte-identical to a non-uniform source', () => {
    const grid: PixelGrid = [
      [
        [10, 20, 30],
        [200, 100, 50],
      ],
      [
        [0, 0, 0],
        [255, 255, 255],
      ],
    ];
    const { horizontal } = runTwoPassGaussianBlur(grid, 0);
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[0].length; c++) {
        expectRGBClose(horizontal[r][c], grid[r][c], 9);
      }
    }
  });
});

describe('convolve1DAxis — impulse response matches kernel weights', () => {
  it('spreads a single bright pixel according to the normalized kernel', () => {
    const width = 41;
    const impulseCol = 20;
    const dark: RGB = [0, 0, 0];
    const bright: RGB = [255, 255, 255];
    const row: RGB[] = Array.from({ length: width }, () => [...dark] as RGB);
    row[impulseCol] = [...bright];
    const grid: PixelGrid = [row];

    for (let radius = 1; radius <= 5; radius++) {
      const kernel = gaussianKernel1D(radius);
      const center = Math.floor(kernel.length / 2);
      const result = convolve1DAxis(grid, kernel, 'horizontal');

      for (let c = 0; c < width; c++) {
        const k = center + (impulseCol - c);
        const expectedWeight = k >= 0 && k < kernel.length ? kernel[k] : 0;
        expectRGBClose(result[0][c], [
          expectedWeight * 255,
          expectedWeight * 255,
          expectedWeight * 255,
        ]);
      }
    }
  });
});

describe('convolve1DAxis — boundary handling', () => {
  it('does not throw or produce NaN when kernel size exceeds grid dimensions', () => {
    const grid = makeUniformGrid(3, [50, 60, 70]);
    const kernel = gaussianKernel1D(10); // 21 taps on a 3x3 grid
    expect(() => {
      const vertical = convolve1DAxis(grid, kernel, 'vertical');
      const horizontal = convolve1DAxis(vertical, kernel, 'horizontal');
      for (const row of horizontal) {
        for (const pixel of row) {
          for (const channel of pixel) {
            expect(Number.isFinite(channel)).toBe(true);
          }
        }
      }
    }).not.toThrow();
  });

  it('clamps to edge rather than wrapping or zero-padding by default', () => {
    // A single bright corner pixel with a huge radius should stay bright-ish
    // near that corner (clamped edge repeats it) rather than fading to black
    // (zero-pad) or picking up the opposite corner's color (wrap).
    const size = 5;
    const grid = makeUniformGrid(size, [0, 0, 0]);
    grid[0][0] = [255, 255, 255];
    const kernel = gaussianKernel1D(8);
    const vertical = convolve1DAxis(grid, kernel, 'vertical');
    const horizontal = convolve1DAxis(vertical, kernel, 'horizontal');
    // the corner should retain more brightness than the far corner
    expect(horizontal[0][0][0]).toBeGreaterThan(horizontal[size - 1][size - 1][0]);
  });
});

describe('computeContributionWeights', () => {
  it('sums to ~1 for an interior pixel, away from clamped edges', () => {
    const rows = 20;
    const cols = 20;
    for (let radius = 1; radius <= 5; radius++) {
      const kernel = gaussianKernel1D(radius);
      const weights = computeContributionWeights(10, 10, radius, kernel, rows, cols);
      const sum = Array.from(weights.values()).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 9);
    }
  });
});

describe('regression: blur is visibly strong at moderate radius (not a no-op)', () => {
  // A 2x2-quadrant grid varies in both row and column, so both the vertical
  // and horizontal passes each have real work to do — unlike a pure
  // horizontal-stripe image, where a horizontal pass is legitimately a
  // no-op (every pixel in a row is already identical, so blending it with
  // its row-neighbors changes nothing; that's correct math, not a bug).
  function colorDistance(a: RGB, b: RGB): number {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  }

  function makeQuadrants(size: number): PixelGrid {
    const half = Math.floor(size / 2);
    const colors: [RGB, RGB, RGB, RGB] = [
      [245, 194, 75],
      [31, 58, 95],
      [47, 143, 143],
      [194, 120, 92],
    ];
    return Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => {
        const quadrant = (row < half ? 0 : 1) + (col < half ? 0 : 2);
        return [...colors[quadrant]] as RGB;
      })
    );
  }

  it('vertical pass meaningfully changes pixels near a horizontal quadrant boundary, away from grid edges', () => {
    const grid = makeQuadrants(14);
    const kernel = gaussianKernel1D(3);
    const vertical = convolve1DAxis(grid, kernel, 'vertical');
    // row 7 sits right at the quadrant boundary, comfortably interior (not
    // edge-clamped), so this isolates real blur strength from the "edge
    // rows blur less under clamp" effect.
    const dist = colorDistance(grid[7][2], vertical[7][2]);
    expect(dist).toBeGreaterThan(20);
  });

  it('horizontal pass meaningfully changes pixels near a vertical quadrant boundary, taking the vertical pass as input', () => {
    const grid = makeQuadrants(14);
    const kernel = gaussianKernel1D(3);
    const vertical = convolve1DAxis(grid, kernel, 'vertical');
    const horizontal = convolve1DAxis(vertical, kernel, 'horizontal');
    // col 7 sits at the quadrant boundary; compare against the vertical
    // pass (its actual input), not the original source.
    const dist = colorDistance(vertical[2][7], horizontal[2][7]);
    expect(dist).toBeGreaterThan(20);
  });

  it('runTwoPassGaussianBlur final output matches manually chaining the two passes', () => {
    const grid = makeQuadrants(14);
    const radius = 3;
    const kernel = gaussianKernel1D(radius);
    const manualVertical = convolve1DAxis(grid, kernel, 'vertical');
    const manualHorizontal = convolve1DAxis(manualVertical, kernel, 'horizontal');
    const { vertical, horizontal } = runTwoPassGaussianBlur(grid, radius);
    for (let r = 0; r < 14; r++) {
      for (let c = 0; c < 14; c++) {
        expectRGBClose(vertical[r][c], manualVertical[r][c], 9);
        expectRGBClose(horizontal[r][c], manualHorizontal[r][c], 9);
      }
    }
  });
});

describe('separable blur pass-order commutativity', () => {
  it('vertical-then-horizontal matches horizontal-then-vertical', () => {
    const grid: PixelGrid = [
      [
        [10, 200, 30],
        [220, 40, 90],
        [15, 15, 200],
      ],
      [
        [90, 90, 10],
        [5, 250, 250],
        [128, 64, 32],
      ],
      [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
      ],
    ];
    const radius = 2;
    const kernel = gaussianKernel1D(radius);

    const { horizontal: vThenH } = runTwoPassGaussianBlur(grid, radius);

    const hFirst = convolve1DAxis(grid, kernel, 'horizontal');
    const hThenV = convolve1DAxis(hFirst, kernel, 'vertical');

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[0].length; c++) {
        expectRGBClose(vThenH[r][c], hThenV[r][c], 6);
      }
    }
  });
});
