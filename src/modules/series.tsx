import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Series } from '../core/model';
export function SeriesFields({
  value,
  onChange,
  required = false,
}: {
  value: Series;
  onChange: (v: Series) => void;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="series-fields">
      <div className="series-check">
        <Checkbox
          id={id}
          checked={value.enabled}
          onCheckedChange={(enabled) =>
            onChange({ ...value, enabled: !!enabled })
          }
        />
        <label htmlFor={id}>Dieses Buch gehört zu einer Buchreihe</label>
      </div>
      {value.enabled && (
        <div className="series-grid">
          <label className="field-label">
            TITEL DER REIHE
            <input
              required={required}
              value={value.title}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
              placeholder="z. B. Die Flusschroniken"
            />
          </label>
          <label className="field-label">
            BAND
            <input
              required={required}
              value={value.volume}
              onChange={(e) => onChange({ ...value, volume: e.target.value })}
              placeholder="z. B. 1 oder Vorgeschichte"
            />
          </label>
        </div>
      )}
    </div>
  );
}
export const seriesLabel = (s: Series) =>
  s.enabled
    ? [s.title, s.volume ? 'Band ' + s.volume : ''].filter(Boolean).join(' · ')
    : '';
