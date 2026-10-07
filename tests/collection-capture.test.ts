import { describe, expect, it } from 'vitest';
import { batchCaptureLimit, batchCaptureTitles } from '../src/shared/collection-capture';

describe('batch collection capture', () => {
  it('keeps one trimmed title per line and quietly drops duplicate or blank lines', () => {
    expect(batchCaptureTitles('A good drink\n\n  A good film  \nA GOOD DRINK\n')).toEqual([
      'A good drink',
      'A good film',
    ]);
  });

  it('caps a batch at a deliberately small, predictable size', () => {
    expect(batchCaptureLimit).toBe(30);
  });
});
