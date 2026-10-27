import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

function savedDeadline(key: string) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 && value <= 8640000000000000 ? value : 0;
  } catch {
    return 0;
  }
}
export function RestTimer({
  workoutId,
  plannedSeconds,
}: {
  workoutId: string;
  plannedSeconds?: number | null;
}) {
  const owner = useQueryClient().getQueryData<{ user?: { id: string } }>(['me'])?.user?.id;
  const key = `worth:rest:${owner}:${workoutId}`;
  const [end, setEnd] = useState(() => savedDeadline(key));
  useEffect(() => {
    const sync = () => {
      setEnd(savedDeadline(key));
    };
    window.addEventListener('storage', sync);
    window.addEventListener('worth:rest-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('worth:rest-changed', sync);
    };
  }, [key]);
  const [now, setNow] = useState(Date.now());
  const [seconds, setSeconds] = useState(plannedSeconds ?? 60);
  const running = end > now;
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [end, running]);
  const remaining = Math.max(0, Math.ceil((end - now) / 1000));
  function change(value: number) {
    setEnd(value);
    setNow(Date.now());
    try {
      if (value) localStorage.setItem(key, String(value));
      else localStorage.removeItem(key);
    } catch {
      /* Device storage may be unavailable or blocked. */
    }
    window.dispatchEvent(new Event('worth:rest-changed'));
  }
  return (
    <div className="rest-timer" aria-label="Rest timer">
      <label>
        Rest{' '}
        <select
          aria-label="Rest duration"
          value={seconds}
          disabled={remaining > 0}
          onChange={(e) => setSeconds(Number(e.target.value))}
        >
          {[
            ...new Set([
              30,
              60,
              90,
              120,
              180,
              ...(plannedSeconds === undefined || plannedSeconds === null ? [] : [plannedSeconds]),
            ]),
          ]
            .sort((a, b) => a - b)
            .map((n) => (
              <option value={n} key={n}>
                {n < 60 || n % 60 ? `${n}s` : `${n / 60} min`}
                {n === plannedSeconds ? ' · planned' : ''}
              </option>
            ))}
        </select>
      </label>
      <span className="rest-time" aria-label={`${remaining} seconds remaining`}>
        {end ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : '—'}
      </span>
      <button
        type="button"
        className="button button-outline"
        onClick={() => change(remaining > 0 ? 0 : Date.now() + seconds * 1000)}
      >
        {remaining > 0 ? 'Cancel timer' : 'Start rest'}
      </button>
      {end > 0 && remaining === 0 && <span role="status">Rest complete.</span>}
    </div>
  );
}
