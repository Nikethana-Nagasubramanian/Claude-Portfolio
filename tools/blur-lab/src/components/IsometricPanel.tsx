import { PixelGrid } from '../math/types';
import { SourceGrid } from './SourceGrid';

export interface IsometricPanelProps {
  grid: PixelGrid;
  label: string;
  cellSize?: number;
  onCellHover?: (row: number, col: number) => void;
  /**
   * Renders this panel as a continuous, non-pixelated image instead of
   * crisp flat-color cells — for the "final image" panel specifically,
   * where the point is showing what the blurred photo actually looks like,
   * not the per-cell mechanism (that's what the vertical/horizontal panels
   * are for). Applied as a plain CSS blur on top of the already-correct
   * per-pixel convolution output — the math already ran; this only changes
   * how the resulting discrete samples are displayed.
   */
  smooth?: boolean;
}

// skewY tilts the horizontal lines up; scaleX corrects the resulting
// aspect-ratio squeeze so the plane doesn't read as squished.
const ISO_TRANSFORM = 'skewY(-22deg) scaleX(0.85)';

export function IsometricPanel({
  grid,
  label,
  cellSize = 14,
  onCellHover,
  smooth = false,
}: IsometricPanelProps) {
  return (
    <div className="flex flex-col items-center gap-9">
      {/*
        relative + z-10: `transform` on the panel below promotes it into the
        "positioned" paint layer, which paints after all plain in-flow
        content regardless of DOM order — without this, the tilted plane
        could render on top of this label. Giving the label its own
        stacking context restores normal DOM-order stacking.
      */}
      <div className="relative z-10 -rotate-2 font-mono text-xs uppercase tracking-[0.1em] text-muted">
        {label}
      </div>
      <div
        className="inline-block overflow-hidden"
        style={{
          transform: ISO_TRANSFORM,
          backfaceVisibility: 'hidden',
          transformStyle: 'flat',
          boxShadow: '-5px 10px 20px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* overflow-hidden clips the smooth blur below to the panel's own
            bounds, instead of letting it bleed past the edge into the
            surrounding page. box-shadow isn't clipped by this element's
            own overflow (shadows always paint outside the border box). */}
        <SourceGrid
          grid={grid}
          cellSize={cellSize}
          onCellHover={onCellHover}
          style={smooth ? { filter: `blur(${Math.max(2, cellSize * 0.3)}px)` } : undefined}
        />
      </div>
    </div>
  );
}
