import { Preset } from '../data/presets';
import { SourceGrid } from './SourceGrid';

export interface ThumbnailRowProps {
  presets: Preset[];
  activePresetId: string;
  onSelect: (id: string) => void;
}

export function ThumbnailRow({ presets, activePresetId, onSelect }: ThumbnailRowProps) {
  return (
    <div className="flex gap-3">
      {presets.map((preset) => {
        const isActive = preset.id === activePresetId;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset.id)}
            title={preset.name}
            className={`rounded-lg border p-1 transition-colors ${
              isActive
                ? 'border-accent ring-2 ring-accent/25'
                : 'border-rule hover:border-faint'
            }`}
          >
            <SourceGrid grid={preset.grid} cellSize={4} />
          </button>
        );
      })}
    </div>
  );
}
