import type { CSSProperties } from 'react';
import { PixelGrid } from '../math/types';

export interface SourceGridProps {
  grid: PixelGrid;
  cellSize?: number;
  highlightWeights?: Map<string, number>;
  onCellHover?: (row: number, col: number) => void;
  className?: string;
  style?: CSSProperties;
}

function toRgbString(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

export function SourceGrid({
  grid,
  cellSize = 20,
  highlightWeights,
  onCellHover,
  className,
  style,
}: SourceGridProps) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const width = cols * cellSize;
  const height = rows * cellSize;
  const maxWeight = highlightWeights
    ? Math.max(1e-6, ...Array.from(highlightWeights.values()))
    : 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      shapeRendering="crispEdges"
      // width:100%/height:auto (rather than fixed width/height attributes)
      // lets the grid shrink to fit narrow/mobile containers while the
      // viewBox keeps its aspect ratio correct; maxWidth caps it at its
      // intended intrinsic size on wide viewports.
      style={{ width: '100%', height: 'auto', maxWidth: `${width}px`, ...style }}
    >
      {grid.map((rowPixels, row) =>
        rowPixels.map((pixel, col) => {
          const key = `${row},${col}`;
          const weight = highlightWeights?.get(key);
          return (
            <g key={key}>
              <rect
                x={col * cellSize}
                y={row * cellSize}
                width={cellSize}
                height={cellSize}
                fill={toRgbString(pixel[0], pixel[1], pixel[2])}
                className="transition-[fill] duration-300 ease-out"
                onMouseEnter={() => onCellHover?.(row, col)}
              />
              {weight !== undefined && (
                <rect
                  x={col * cellSize}
                  y={row * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill="white"
                  opacity={(weight / maxWeight) * 0.55}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })
      )}
    </svg>
  );
}
