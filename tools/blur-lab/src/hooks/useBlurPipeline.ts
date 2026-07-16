import { useMemo, useState } from 'react';
import { gaussianKernel1D } from '../math/kernel';
import { convolve1DAxis } from '../math/convolution';
import { PixelGrid } from '../math/types';
import { PRESETS } from '../data/presets';

export interface BlurPipelineState {
  radius: number;
  setRadius: (r: number) => void;
  activePresetId: string;
  setActivePresetId: (id: string) => void;
  sourceGrid: PixelGrid;
  kernel: number[];
  verticalPassGrid: PixelGrid;
  horizontalPassGrid: PixelGrid;
}

export function useBlurPipeline(initialPresetId?: string): BlurPipelineState {
  // Default radius is deliberately high enough that the blur is obvious on
  // first load, without requiring the user to touch the slider first.
  const [radius, setRadius] = useState(4);
  const [activePresetId, setActivePresetId] = useState(
    initialPresetId ?? PRESETS[0].id
  );

  const sourceGrid = useMemo(
    () => PRESETS.find((p) => p.id === activePresetId)?.grid ?? PRESETS[0].grid,
    [activePresetId]
  );

  const kernel = useMemo(() => gaussianKernel1D(radius), [radius]);

  // Always exactly two passes — vertical then horizontal — only the kernel
  // (derived from radius) ever changes.
  const verticalPassGrid = useMemo(
    () => convolve1DAxis(sourceGrid, kernel, 'vertical'),
    [sourceGrid, kernel]
  );

  const horizontalPassGrid = useMemo(
    () => convolve1DAxis(verticalPassGrid, kernel, 'horizontal'),
    [verticalPassGrid, kernel]
  );

  return {
    radius,
    setRadius,
    activePresetId,
    setActivePresetId,
    sourceGrid,
    kernel,
    verticalPassGrid,
    horizontalPassGrid,
  };
}
