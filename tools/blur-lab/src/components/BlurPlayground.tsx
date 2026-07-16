import { useMemo, useState } from 'react';
import { useBlurPipeline } from '../hooks/useBlurPipeline';
import { PRESETS, GRID_SIZE } from '../data/presets';
import { computeContributionWeights } from '../math/contribution';
import { SourceGrid } from './SourceGrid';
import { ThumbnailRow } from './ThumbnailRow';
import { BlurSlider } from './BlurSlider';
import { RadiusExplainer } from './RadiusExplainer';
import { KernelDisplay } from './KernelDisplay';
import { IsometricPanel } from './IsometricPanel';

const MAIN_CELL_SIZE = 26;
const PANEL_CELL_SIZE = 13;

export function BlurPlayground() {
  const {
    radius,
    setRadius,
    activePresetId,
    setActivePresetId,
    sourceGrid,
    kernel,
    verticalPassGrid,
    horizontalPassGrid,
  } = useBlurPipeline();

  const [hoveredFinalCell, setHoveredFinalCell] = useState<
    { row: number; col: number } | null
  >(null);

  const highlightWeights = useMemo(() => {
    if (!hoveredFinalCell) return undefined;
    return computeContributionWeights(
      hoveredFinalCell.row,
      hoveredFinalCell.col,
      radius,
      kernel,
      GRID_SIZE,
      GRID_SIZE
    );
  }, [hoveredFinalCell, radius, kernel]);

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 px-6 py-14 sm:px-8 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
      {/* Left column */}
      <div className="flex flex-col gap-6">
        <SourceGrid
          grid={sourceGrid}
          cellSize={MAIN_CELL_SIZE}
          highlightWeights={highlightWeights}
          className="rounded-lg border border-rule shadow-sm"
        />

        <ThumbnailRow
          presets={PRESETS}
          activePresetId={activePresetId}
          onSelect={setActivePresetId}
        />

        <div className="flex flex-col gap-3 rounded-xl border border-rule bg-white p-4">
          <BlurSlider radius={radius} min={0} max={10} onChange={setRadius} />
          <RadiusExplainer radius={radius} kernelSize={kernel.length} />
        </div>
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-14">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-2.5">
          <IsometricPanel
            grid={verticalPassGrid}
            label="Vertical pass"
            cellSize={PANEL_CELL_SIZE}
          />
          <IsometricPanel
            grid={horizontalPassGrid}
            label="Horizontal pass"
            cellSize={PANEL_CELL_SIZE}
          />
          <IsometricPanel
            grid={horizontalPassGrid}
            label="Final image"
            cellSize={PANEL_CELL_SIZE}
            smooth={radius > 0}
            onCellHover={(row, col) => setHoveredFinalCell({ row, col })}
          />
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            What happens in each pass
          </h2>
          <p className="max-w-lg text-sm leading-relaxed text-muted">
            {radius === 0
              ? 'At radius 0 the kernel is a single weight of 1.00 — every pixel keeps its own value, and both passes change nothing.'
              : `Both passes use this same bell-curve kernel — once down each column, then once across each row. Each pixel counts ${radius} neighbor${radius === 1 ? '' : 's'} on each side of the center point (px), weighted by the values below.`}
          </p>
          <KernelDisplay
            weights={kernel}
            label={`Kernel weights · ${kernel.length} tap${kernel.length === 1 ? '' : 's'}`}
          />
        </div>
      </div>
    </div>
  );
}
