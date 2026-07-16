import { PixelGrid, RGB } from '../math/types';

export const GRID_SIZE = 14;

// A limited, vibrant palette so diffusion between passes stays legible.
export const PALETTE = {
  sun: [245, 194, 75] as RGB,
  moss: [107, 158, 120] as RGB,
  navy: [31, 58, 95] as RGB,
  teal: [47, 143, 143] as RGB,
  clay: [194, 120, 92] as RGB,
  cream: [237, 230, 214] as RGB,
};

export interface Preset {
  id: string;
  name: string;
  grid: PixelGrid;
}

function makeGrid(
  size: number,
  colorAt: (row: number, col: number) => RGB
): PixelGrid {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => colorAt(row, col))
  );
}

function makeSingleBrightPixel(
  size: number,
  background: RGB,
  bright: RGB,
  at?: { row: number; col: number }
): PixelGrid {
  const center = at ?? { row: Math.floor(size / 2), col: Math.floor(size / 2) };
  return makeGrid(size, (row, col) =>
    row === center.row && col === center.col ? bright : background
  );
}

function clampChannel(v: number): number {
  return Math.max(0, Math.min(255, v));
}

function lerpColor(a: RGB, b: RGB, t: number): RGB {
  const ct = Math.max(0, Math.min(1, t));
  return [
    clampChannel(a[0] + (b[0] - a[0]) * ct),
    clampChannel(a[1] + (b[1] - a[1]) * ct),
    clampChannel(a[2] + (b[2] - a[2]) * ct),
  ];
}

// Hand-authored synthetic landscapes, not downsampled photos — this keeps
// everything baked into the code with no runtime image fetching/processing,
// while still giving large smooth gradient regions (great for showing
// blur clearly) plus enough local contrast (ridge lines, foam band) that
// the effect stays visible instead of flattening into a uniform wash.
function makeMountains(size: number): PixelGrid {
  const skyTop: RGB = [138, 188, 224];
  const skyHorizon: RGB = [230, 222, 197];
  const snow: RGB = [246, 242, 230];
  const ridgeNear: RGB = [42, 55, 74];
  const ridgeFar: RGB = [93, 106, 121];

  const peakRowAt = (col: number) => {
    const base = size * 0.56;
    const ridge = Math.sin((col / size) * Math.PI * 2.3) * (size * 0.22);
    return Math.round(base - ridge);
  };

  return makeGrid(size, (row, col) => {
    const peak = peakRowAt(col);
    if (row < peak - 1) {
      const t = row / Math.max(1, peak - 2);
      return lerpColor(skyTop, skyHorizon, t);
    }
    if (row === peak - 1 || row === peak) {
      return snow;
    }
    const farBand = Math.sin((col / size) * Math.PI * 1.3) > 0.15;
    return farBand ? ridgeFar : ridgeNear;
  });
}

function makeOcean(size: number): PixelGrid {
  const deep: RGB = [16, 58, 84];
  const midSea: RGB = [40, 120, 140];
  const shallow: RGB = [122, 200, 195];
  const foam: RGB = [235, 245, 240];
  const sand: RGB = [221, 198, 150];

  const foamRow = Math.round(size * 0.78);
  const sandRow = Math.round(size * 0.9);

  return makeGrid(size, (row, col) => {
    if (row >= sandRow) return sand;
    if (row === foamRow || row === foamRow + 1) {
      return Math.sin(col * 1.7) > 0 ? foam : lerpColor(foam, shallow, 0.35);
    }
    if (row > foamRow) {
      const t = (row - foamRow) / Math.max(1, sandRow - foamRow);
      return lerpColor(shallow, sand, t * 0.4);
    }
    const t = row / foamRow;
    const base = lerpColor(deep, midSea, t);
    const wave = Math.sin(row * 0.9 + col * 0.5) * 6;
    return [
      clampChannel(base[0] + wave),
      clampChannel(base[1] + wave),
      clampChannel(base[2] + wave),
    ];
  });
}

// A soft diagonal S-curve wave, like a calm app-icon wallpaper — two sine
// boundaries (same technique as makeMountains' ridge line) split the grid
// into three flowing bands. Boundaries are hard edges, not blended, so the
// un-blurred source still reads as crisp pixel art rather than pre-blurred;
// the pastel palette + gentle curve is what gives it the soft "wave" look.
function makeSoftWave(size: number, colors: [RGB, RGB, RGB]): PixelGrid {
  const boundary1 = (row: number) =>
    size * 0.38 + Math.sin((row / size) * Math.PI * 1.6) * (size * 0.22);
  const boundary2 = (row: number) =>
    size * 0.68 + Math.sin((row / size) * Math.PI * 1.6 + 0.6) * (size * 0.22);

  return makeGrid(size, (row, col) => {
    if (col < boundary1(row)) return colors[0];
    if (col < boundary2(row)) return colors[1];
    return colors[2];
  });
}

// macOS Monterey-style layered waves — N diagonal sine-curved boundaries
// stack the palette top-right to bottom-left. Hard edges between layers
// keep the source crisp at radius 0.
function makeLayeredWaves(size: number, colors: RGB[]): PixelGrid {
  const n = colors.length;
  return makeGrid(size, (row, col) => {
    // diagonal position: 0 at top-right, 1 at bottom-left
    const t = (row + (size - col)) / (2 * size);
    const wobble = Math.sin(row * 0.7 + col * 0.35) * 0.06;
    const idx = Math.min(n - 1, Math.max(0, Math.floor((t + wobble) * n)));
    return colors[idx];
  });
}

// macOS Sequoia-style light rays — near-vertical color bands fanning out
// slightly from a point above the top edge, alternating blue and warm tones.
function makeRays(size: number, colors: RGB[]): PixelGrid {
  const n = colors.length;
  return makeGrid(size, (row, col) => {
    // fan: columns spread apart as row increases, anchored above top-center
    const spread = 1 + (row / size) * 0.6;
    const x = (col - size * 0.55) / spread + size * 0.55;
    const idx = Math.min(n - 1, Math.max(0, Math.floor((x / size) * n)));
    return colors[idx];
  });
}

export const PRESETS: Preset[] = [
  {
    id: 'mountains',
    name: 'Mountains',
    grid: makeMountains(GRID_SIZE),
  },
  {
    id: 'ocean',
    name: 'Ocean',
    grid: makeOcean(GRID_SIZE),
  },
  {
    id: 'wave-dusk',
    name: 'Wave — Dusk',
    grid: makeSoftWave(GRID_SIZE, [
      [186, 216, 249],
      [244, 247, 252],
      [200, 175, 234],
    ]),
  },
  {
    id: 'wave-monterey',
    name: 'Wave — Monterey',
    grid: makeLayeredWaves(GRID_SIZE, [
      [228, 222, 236],
      [235, 137, 158],
      [214, 44, 178],
      [168, 40, 213],
      [124, 42, 233],
      [77, 34, 200],
      [46, 28, 158],
    ]),
  },
  {
    id: 'rays-sequoia',
    name: 'Rays — Sequoia',
    grid: makeRays(GRID_SIZE, [
      [28, 44, 138],
      [37, 84, 196],
      [95, 130, 222],
      [168, 140, 195],
      [240, 150, 92],
      [250, 200, 130],
      [252, 232, 180],
      [244, 168, 100],
    ]),
  },
  {
    id: 'impulse',
    name: 'Single pixel',
    grid: makeSingleBrightPixel(GRID_SIZE, PALETTE.navy, PALETTE.sun),
  },
];
