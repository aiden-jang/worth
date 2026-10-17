import { Plus, X } from '@phosphor-icons/react';
import type { LogInput } from '../api';
import type { Log } from '../shared/models';

type SetFields = Pick<LogInput, 'exerciseSets' | 'weightUnit'>;

export function ExerciseSetFields({
  form,
  setForm,
  previous,
}: {
  form: SetFields;
  setForm: (value: SetFields) => void;
  previous: Pick<Log, 'exerciseSets' | 'weightUnit'> | null;
}) {
  return (
    <fieldset className="exercise-sets">
      <legend>Exercise sets</legend>
      <p className="exercise-helper">Leave weight blank for bodyweight sets.</p>
      <label>
        Weight unit
        <select
          value={form.weightUnit ?? 'kg'}
          onChange={(event) => setForm({ ...form, weightUnit: event.target.value as 'kg' | 'lb' })}
        >
          <option value="kg">kg</option>
          <option value="lb">lb</option>
        </select>
      </label>
      {(form.exerciseSets ?? []).map((set, index) => (
        <div className="exercise-set-row" key={index}>
          <span className="set-number" aria-label={`Set ${index + 1}`}>
            {index + 1}
          </span>
          <label>
            Reps
            <input
              aria-label={`Set ${index + 1} reps`}
              type="number"
              required
              min="1"
              max="10000"
              step="1"
              value={set.reps ?? ''}
              onChange={(event) =>
                setForm({
                  ...form,
                  exerciseSets: form.exerciseSets?.map((entry, i) =>
                    i === index
                      ? {
                          ...entry,
                          reps: event.target.value === '' ? null : Number(event.target.value),
                        }
                      : entry,
                  ),
                })
              }
            />
          </label>
          <label>
            Weight
            <input
              aria-label={`Set ${index + 1} weight in ${form.weightUnit ?? 'kg'}`}
              type="number"
              min="0"
              max="100000"
              step="any"
              placeholder="—"
              value={set.weight ?? ''}
              onChange={(event) =>
                setForm({
                  ...form,
                  exerciseSets: form.exerciseSets?.map((entry, i) =>
                    i === index
                      ? {
                          ...entry,
                          weight: event.target.value === '' ? null : Number(event.target.value),
                        }
                      : entry,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label={`Remove set ${index + 1}`}
            onClick={() =>
              setForm({ ...form, exerciseSets: form.exerciseSets?.filter((_, i) => i !== index) })
            }
          >
            <X size={18} />
          </button>
          {previous?.exerciseSets?.[index] && (
            <p className="set-previous">
              Last: {previous.exerciseSets[index].reps} reps ·{' '}
              {previous.exerciseSets[index].weight === null
                ? 'bodyweight'
                : `${previous.exerciseSets[index].weight} ${previous.weightUnit ?? 'kg'}`}
            </p>
          )}
        </div>
      ))}
      <button
        type="button"
        className="button button-outline"
        disabled={(form.exerciseSets?.length ?? 0) >= 100}
        onClick={() => {
          const previous = form.exerciseSets?.at(-1);
          setForm({
            ...form,
            exerciseSets: [
              ...(form.exerciseSets ?? []),
              previous ? { ...previous } : { reps: null, weight: null },
            ],
          });
        }}
      >
        <Plus size={16} /> {form.exerciseSets?.at(-1)?.reps ? 'Duplicate last set' : 'Add set'}
      </button>
      <p className="exercise-total">
        {form.exerciseSets?.length ?? 0} {form.exerciseSets?.length === 1 ? 'set' : 'sets'} ·{' '}
        {(form.exerciseSets ?? []).reduce((sum, set) => sum + (set.reps ?? 0), 0)} reps
      </p>
    </fieldset>
  );
}
