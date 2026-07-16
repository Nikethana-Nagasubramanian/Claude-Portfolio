export interface BlurSliderProps {
  radius: number;
  min: number;
  max: number;
  onChange: (radius: number) => void;
}

export function BlurSlider({ radius, min, max, onChange }: BlurSliderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.1em] text-muted">
        <span>Blur radius</span>
        <span className="text-accent">{radius}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={radius}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-rule accent-accent"
      />
    </div>
  );
}
