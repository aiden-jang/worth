import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
export function RestTimer({ workoutId }: { workoutId: string }) {
  const owner = useQueryClient().getQueryData<{ user?: { id: string } }>(['me'])?.user?.id;
  const key = `worth:rest:${owner}:${workoutId}`;
  const [end, setEnd] = useState(() => {
    try {
      return Number(localStorage.getItem(key)) || 0;
    } catch {
      return 0;
    }
  });
  useEffect(() => {
    const sync = () => {
      try {
        setEnd(Number(localStorage.getItem(key)) || 0);
      } catch {}
    };
    window.addEventListener('storage', sync);
    window.addEventListener('worth:rest-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('worth:rest-changed', sync);
    };
  }, [key]);
  const [now, setNow] = useState(Date.now());
  const [seconds, setSeconds] = useState(60);
  useEffect(() => {
    if (!end) return;
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [end]);
  const remaining = Math.max(0, Math.ceil((end - now) / 1000));
  function change(value: number) {
    setEnd(value);
    setNow(Date.now());
    try {
      if (value) localStorage.setItem(key, String(value));
      else localStorage.removeItem(key);
    } catch {}
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
          {[30, 60, 90, 120, 180].map((n) => (
            <option value={n} key={n}>
              {n < 60 ? `${n}s` : `${n / 60} min`}
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
