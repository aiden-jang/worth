import type { MeasurementDraft } from '../shared/activity-plans';
export function ActivityMeasurements({
  value,
  onChange,
  disabled = false,
}: {
  value: MeasurementDraft[];
  onChange: (value: MeasurementDraft[]) => void;
  disabled?: boolean;
}) {
  function patch(index: number, next: Partial<MeasurementDraft>) {
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...next } : entry)));
  }
  return (
    <details className="record-extras" open={value.length > 0}>
      <summary>
        Named measurements <span>optional</span>
      </summary>
      <p className="exercise-helper">
        Name exactly what you measured, its value and unit. Blank is not zero. Up to 12; units stay as
        entered.
      </p>
      {value.map((entry, index) => (
        <fieldset className="measurement-card" key={index}>
          <legend>Measurement {index + 1}</legend>
          <label>
            Name
            <input
              disabled={disabled}
              required
              maxLength={40}
              aria-label={`Measurement ${index + 1} name`}
              value={entry.name}
              placeholder="Duration, distance, pace…"
              onChange={(e) => patch(index, { name: e.target.value })}
            />
          </label>
          <div className="metric-row">
            <label>
              Value
              <input
                required
                disabled={disabled}
                type="number"
                step="any"
                min={-1000000000}
                max={1000000000}
                aria-label={`Measurement ${index + 1} value`}
                value={entry.value ?? ''}
                onChange={(e) =>
                  patch(index, { value: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </label>
            <label>
              Unit
              <input
                disabled={disabled}
                maxLength={24}
                aria-label={`Measurement ${index + 1} unit`}
                value={entry.unit}
                placeholder="seconds, km…"
                onChange={(e) => patch(index, { unit: e.target.value })}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={disabled}
            className="button button-outline"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            Remove measurement {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="button button-outline"
        disabled={disabled || value.length >= 12}
        onClick={() => onChange([...value, { name: '', value: null, unit: '' }])}
      >
        Add named measurement
      </button>
    </details>
  );
}
