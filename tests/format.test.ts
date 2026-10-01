import { describe, expect, it } from 'vitest';
import { formatElapsedDays } from '../src/format';

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
