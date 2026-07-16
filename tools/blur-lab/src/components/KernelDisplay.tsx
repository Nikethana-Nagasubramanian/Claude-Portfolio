import { useEffect, useRef, useState } from 'react';

export interface KernelDisplayProps {
  weights: number[];
  label: string;
}

type Phase = 'entering' | 'idle' | 'exiting';
interface Cell {
  offset: number;
  weight: number;
  phase: Phase;
}

const EXIT_DURATION_MS = 220;
const STAGGER_MS = 18;

/**
 * Tracks kernel cells across radius changes so growing/shrinking the kernel
 * animates as a ripple from the center outward, instead of just remounting
 * a differently-sized list. Cells are keyed by offset-from-center (stable
 * across radius changes) so React reuses the DOM node and CSS transitions
 * actually have something to animate between.
 */
function useRippleCells(weights: number[]): Cell[] {
  const center = Math.floor(weights.length / 2);
  const currentOffsets = weights.map((_, i) => i - center);

  const [cells, setCells] = useState<Cell[]>(() =>
    currentOffsets.map((offset, i) => ({ offset, weight: weights[i], phase: 'idle' }))
  );
  const prevOffsetsRef = useRef<number[]>(currentOffsets);

  useEffect(() => {
    const prevOffsets = prevOffsetsRef.current;
    const prevSet = new Set(prevOffsets);
    const nextSet = new Set(currentOffsets);

    setCells((prev) => {
      const kept = currentOffsets.map((offset, i) => ({
        offset,
        weight: weights[i],
        phase: (prevSet.has(offset) ? 'idle' : 'entering') as Phase,
      }));
      const removed = prevOffsets
        .filter((offset) => !nextSet.has(offset))
        .map((offset) => {
          const prevCell = prev.find((c) => c.offset === offset);
          return { offset, weight: prevCell?.weight ?? 0, phase: 'exiting' as Phase };
        });
      return [...removed, ...kept].sort((a, b) => a.offset - b.offset);
    });

    prevOffsetsRef.current = currentOffsets;

    // Newly entering cells start in a "shrunk" style; flip them to idle one
    // frame later so the transition to full size actually plays.
    const enterFrame = requestAnimationFrame(() => {
      setCells((prev) =>
        prev.map((c) => (c.phase === 'entering' ? { ...c, phase: 'idle' } : c))
      );
    });

    // Give exiting cells time to animate out before dropping them for real.
    const exitTimer = setTimeout(() => {
      setCells((prev) => prev.filter((c) => c.phase !== 'exiting'));
    }, EXIT_DURATION_MS + 40);

    return () => {
      cancelAnimationFrame(enterFrame);
      clearTimeout(exitTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weights]);

  return cells;
}

export function KernelDisplay({ weights, label }: KernelDisplayProps) {
  const cells = useRippleCells(weights);
  const maxWeight = Math.max(...weights, 1e-6);

  return (
    <div className="flex flex-col gap-3">
      <div className="font-mono text-xs uppercase tracking-[0.1em] text-muted">
        {label}
      </div>
      <div className="flex flex-wrap items-end gap-x-2 gap-y-4">
        {cells.map((cell) => {
          const isVisible = cell.phase === 'idle';
          const isCenter = cell.offset === 0;
          const heightPx = 10 + (cell.weight / maxWeight) * 56;
          return (
            <div
              key={cell.offset}
              style={{ transitionDelay: `${Math.abs(cell.offset) * STAGGER_MS}ms` }}
              className={`flex w-9 flex-col items-center gap-1.5 transition-all duration-200 ease-out ${
                isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
              }`}
            >
              <div
                style={{ height: `${heightPx}px` }}
                className={`w-full self-end rounded-md border transition-[height] duration-200 ${
                  isCenter
                    ? 'border-accent bg-accent/80'
                    : 'border-accent/25 bg-accent/10'
                }`}
              />
              <span
                className={`font-mono text-[10px] ${
                  isCenter ? 'font-semibold text-accent' : 'text-muted'
                }`}
              >
                {cell.weight.toFixed(2)}
              </span>
              <span className="font-mono text-[9px] text-faint">
                {cell.offset === 0 ? 'px' : cell.offset > 0 ? `+${cell.offset}` : cell.offset}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
