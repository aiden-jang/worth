export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function today(): string {
  const local = new Date();
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatElapsedDays(value: string, reference = today()): string {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const elapsed = Math.floor(
    (Date.parse(`${reference}T00:00:00Z`) - Date.parse(`${value}T00:00:00Z`)) / millisecondsPerDay,
  );
  if (elapsed <= 0) return 'Today';
  if (elapsed === 1) return 'Yesterday';
  if (elapsed < 7) return `${elapsed} days ago`;
  if (elapsed < 30)
    return `${Math.floor(elapsed / 7)} ${Math.floor(elapsed / 7) === 1 ? 'week' : 'weeks'} ago`;
  if (elapsed < 365)
    return `${Math.floor(elapsed / 30)} ${Math.floor(elapsed / 30) === 1 ? 'month' : 'months'} ago`;
  return `${Math.floor(elapsed / 365)} ${Math.floor(elapsed / 365) === 1 ? 'year' : 'years'} ago`;
}
