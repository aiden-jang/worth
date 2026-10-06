import { describe, expect, it } from 'vitest';
import { formatElapsedDays, formatRelativeTimestamp } from '../src/format';

describe('formatElapsedDays', () => {
  it('keeps relative dates short and deterministic', () => {
    expect(formatElapsedDays('2026-10-01', '2026-10-01')).toBe('Today');
    expect(formatElapsedDays('2026-09-30', '2026-10-01')).toBe('Yesterday');
    expect(formatElapsedDays('2026-09-27', '2026-10-01')).toBe('4 days ago');
    expect(formatElapsedDays('2026-09-17', '2026-10-01')).toBe('2 weeks ago');
    expect(formatElapsedDays('2026-07-01', '2026-10-01')).toBe('3 months ago');
    expect(formatElapsedDays('2024-10-01', '2026-10-01')).toBe('2 years ago');
  });
});

describe('formatRelativeTimestamp', () => {
  const reference = Date.UTC(2026, 9, 5, 12, 0, 0);

  it('keeps collection recency concise and stable', () => {
    expect(formatRelativeTimestamp(reference, reference)).toBe('Just now');
    expect(formatRelativeTimestamp(reference - 45 * 60 * 1000, reference)).toBe('45m ago');
    expect(formatRelativeTimestamp(reference - 5 * 60 * 60 * 1000, reference)).toBe('5h ago');
    expect(formatRelativeTimestamp(reference - 24 * 60 * 60 * 1000, reference)).toBe('Yesterday');
    expect(formatRelativeTimestamp(reference - 5 * 24 * 60 * 60 * 1000, reference)).toBe('5 days ago');
    expect(formatRelativeTimestamp(reference - 40 * 24 * 60 * 60 * 1000, reference)).toBe('1mo ago');
    expect(formatRelativeTimestamp(reference + 60 * 60 * 1000, reference)).toBe('Just now');
  });
});
