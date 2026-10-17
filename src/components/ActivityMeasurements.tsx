import type { LogInput } from '../api';
import type { Log } from '../shared/models';

type Measurements = Pick<LogInput, 'amount' | 'unit' | 'sets' | 'reps'>;

export function ActivityMeasurements({
  form,
  setForm,
  log,
  exerciseMode,
}: {
  form: Measurements;
  setForm: (value: Measurements) => void;
  log: Pick<Log, 'amount' | 'unit' | 'sets' | 'reps'> | null;
  exerciseMode: boolean;
}) {
  return (
    <details
      className="record-extras"
      open={Boolean(
        (log?.amount !== null && log?.amount !== undefined) || log?.unit || log?.sets || log?.reps,
      )}
    >
      <summary>
        {exerciseMode ? 'Other measurements' : 'Measurements'} <span>optional</span>
      </summary>
      <div className="metric-row">
        <label>
          Amount <span className="optional">optional</span>
          <input
            type="number"
            min="0"
            step="any"
            value={form.amount ?? ''}
            onChange={(event) =>
              setForm({
                ...form,
                amount: event.target.value === '' ? null : Number(event.target.value),
              })
            }
            placeholder="5.2"
          />
        </label>
        <label>
          Unit
          <input
            maxLength={24}
            value={form.unit}
            onChange={(event) => setForm({ ...form, unit: event.target.value })}
            placeholder="mi, lb, km…"
          />
        </label>
      </div>
      <div className="metric-row">
        <label>
          Sets <span className="optional">optional</span>
          <input
            type="number"
            min="1"
            step="1"
            value={form.sets ?? ''}
            onChange={(event) =>
              setForm({ ...form, sets: event.target.value === '' ? null : Number(event.target.value) })
            }
          />
        </label>
        <label>
          Reps <span className="optional">optional</span>
          <input
            type="number"
            min="1"
            step="1"
            value={form.reps ?? ''}
            onChange={(event) =>
              setForm({ ...form, reps: event.target.value === '' ? null : Number(event.target.value) })
            }
          />
        </label>
      </div>
    </details>
  );
}
