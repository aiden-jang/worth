import { useState } from 'react';
import { targetSummary, type RoutineTarget } from '../shared/activity-plans';
import { ConfirmDialog } from './ConfirmDialog';
type Plan = {
  title: string;
  exercises: string;
  happenedOn: string;
  targets: RoutineTarget[];
  revision: number;
  frozen: boolean;
};
function copy(plan: Plan) {
  return [
    plan.title,
    plan.happenedOn,
    plan.exercises,
    ...plan.targets.map(
      (target) => `${target.exercise}: ${targetSummary(target)}${target.note ? `\n${target.note}` : ''}`,
    ),
  ]
    .filter(Boolean)
    .join('\n');
}
export function SavedPlanReview({
  current,
  read,
  onUse,
  disabled,
}: {
  current: Plan;
  read: () => Promise<Plan>;
  onUse: (value: Plan) => void;
  disabled: boolean;
}) {
  const [saved, setSaved] = useState<Plan | null>(null),
    [previous, setPrevious] = useState<Plan | null>(null),
    [reading, setReading] = useState(false),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState(false);
  async function check() {
    setReading(true);
    setError('');
    try {
      setSaved(await read());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not read the saved plan.');
    } finally {
      setReading(false);
    }
  }
  return (
    <section className="saved-plan-review" aria-label="Saved plan review">
      <button
        type="button"
        className="button button-outline"
        disabled={disabled || reading}
        onClick={() => void check()}
      >
        {reading ? 'Reading…' : 'Check saved plan'}
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {saved && (
        <section className="previous-exercise">
          <h3>Saved plan to compare</h3>
          <pre className="plan-draft-copy">{copy(saved)}</pre>
          <button
            type="button"
            disabled={disabled}
            className="button button-outline"
            onClick={() => setConfirm(true)}
          >
            Use saved plan
          </button>
        </section>
      )}
      {previous && (
        <details className="record-extras">
          <summary>Previous draft kept for copying</summary>
          <pre className="plan-draft-copy">{copy(previous)}</pre>
        </details>
      )}
      {confirm && saved && (
        <ConfirmDialog
          eyebrow="USE SAVED PLAN"
          title="Replace this draft with the saved plan?"
          description="Your previous draft remains available for copying in this editor. Existing logged results stay intact."
          confirmLabel="Use saved plan"
          cancelLabel="Keep my draft"
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            setPrevious(current);
            onUse(saved);
            setSaved(null);
            setConfirm(false);
          }}
        />
      )}
    </section>
  );
}
