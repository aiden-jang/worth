export function ExerciseLineup({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const names = value
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean);
  function move(index: number, offset: number) {
    const next = [...names];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next.join('\n'));
  }
  return names.length > 1 ? (
    <ol className="lineup-order" aria-label="Exercise order">
      {names.map((name, index) => (
        <li key={index}>
          <span>
            {index + 1}. {name}
          </span>
          <button
            type="button"
            className="button button-outline"
            aria-label={`Move ${name} up`}
            disabled={index === 0}
            onClick={() => move(index, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="button button-outline"
            aria-label={`Move ${name} down`}
            disabled={index === names.length - 1}
            onClick={() => move(index, 1)}
          >
            ↓
          </button>
        </li>
      ))}
    </ol>
  ) : null;
}
