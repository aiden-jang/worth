import { blankRoutineTarget, exerciseKey, targetSummary, type RoutineTarget } from '../shared/activity-plans';
export function RoutineTargetsEditor({
  exercises,
  value,
  onChange,
  disabled = false,
}: {
  exercises: string[];
  value: RoutineTarget[];
  onChange: (value: RoutineTarget[]) => void;
  disabled?: boolean;
}) {
  const names = [...new Map(exercises.map((name) => [exerciseKey(name), name])).values()].filter((name) =>
    name.trim(),
  );
  const orphaned = value.filter(
    (target) => !names.some((name) => exerciseKey(name) === exerciseKey(target.exercise)),
  );
  function change(exercise: string, patch: Partial<RoutineTarget>) {
    const found = value.find((target) => exerciseKey(target.exercise) === exerciseKey(exercise));
    const next = { ...(found ?? blankRoutineTarget(exercise)), ...patch };
    onChange(found ? value.map((target) => (target === found ? next : target)) : [...value, next]);
  }
  return (
    <details className="record-extras routine-target-editor" open={value.length > 0}>
      <summary>
        Target plans <span>optional</span>
      </summary>
      <p className="exercise-helper">
        Plans are references, never recorded results. Future workouts get a copy. Each target keeps its
        entered unit.
      </p>
      {names.map((exercise) => {
        const target = value.find((target) => exerciseKey(target.exercise) === exerciseKey(exercise));
        return (
          <section className="routine-target-card" key={exerciseKey(exercise)}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                disabled={disabled || (!target && value.length >= 40)}
                checked={!!target}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, blankRoutineTarget(exercise)]
                      : value.filter((t) => t !== target),
                  )
                }
              />
              Plan for {exercise}
            </label>
            {target && (
              <>
                <p className="exercise-helper">{targetSummary(target) || 'No numeric target entered.'}</p>
                <div className="routine-target-fields">
                  {(
                    [
                      ['sets', 'Sets', 1, 100, 1],
                      ['reps', 'Reps', 1, 10000, 1],
                      ['weight', 'Weight', 0, 100000, 'any'],
                      ['restSeconds', 'Rest seconds', 0, 86400, 1],
                      ['durationSeconds', 'Duration seconds', 0, 86400, 'any'],
                      ['distance', 'Distance', 0, 1000000, 'any'],
                    ] as const
                  ).map(([key, label, min, max, step]) => (
                    <label key={key}>
                      {label}
                      <input
                        aria-label={`${exercise} planned ${label.toLowerCase()}`}
                        disabled={disabled}
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={target[key] ?? ''}
                        onChange={(e) =>
                          change(exercise, { [key]: e.target.value === '' ? null : Number(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                  <label>
                    Weight unit
                    <select
                      disabled={disabled}
                      aria-label={`${exercise} planned weight unit`}
                      value={target.weightUnit}
                      onChange={(e) => change(exercise, { weightUnit: e.target.value as 'kg' | 'lb' })}
                    >
                      <option>kg</option>
                      <option>lb</option>
                    </select>
                  </label>
                  <label>
                    Distance unit
                    <select
                      disabled={disabled}
                      aria-label={`${exercise} planned distance unit`}
                      value={target.distanceUnit}
                      onChange={(e) =>
                        change(exercise, { distanceUnit: e.target.value as 'm' | 'km' | 'mi' })
                      }
                    >
                      <option>m</option>
                      <option>km</option>
                      <option>mi</option>
                    </select>
                  </label>
                </div>
                <label>
                  Plan note for {exercise}
                  <textarea
                    disabled={disabled}
                    maxLength={300}
                    value={target.note}
                    onChange={(e) => change(exercise, { note: e.target.value })}
                  />
                </label>
              </>
            )}
          </section>
        );
      })}
      {orphaned.map((target) => (
        <div className="error-banner" key={target.exercise}>
          <p>
            The plan for {target.exercise} has no matching exercise. Restore that name or remove its plan
            before saving.
          </p>
          <button
            type="button"
            className="button button-outline"
            disabled={disabled}
            onClick={() => onChange(value.filter((t) => t !== target))}
          >
            Remove unmatched plan for {target.exercise}
          </button>
        </div>
      ))}
    </details>
  );
}
