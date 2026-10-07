import { describe, expect, it } from 'vitest';
import { preferredQuickCaptureList } from '../src/shared/quick-capture';
import type { ListSummary } from '../src/shared/models';

const lists: ListSummary[] = [
  {
    id: 'drinks',
    name: 'Drinks',
    kind: 'collection',
    description: '',
    itemCount: 0,
    logCount: 0,
    rankedCount: 0,
    favoriteCount: 0,
    hasCoverPhoto: false,
    updatedAt: 0,
  },
  {
    id: 'runs',
    name: 'Runs',
    kind: 'activity',
    description: '',
    itemCount: 0,
    logCount: 0,
    rankedCount: 0,
    favoriteCount: 0,
    hasCoverPhoto: false,
    updatedAt: 0,
  },
];

describe('preferredQuickCaptureList', () => {
  it('uses the open list before the remembered list', () => {
    expect(preferredQuickCaptureList('/lists/runs', 'drinks', lists)?.id).toBe('runs');
    expect(preferredQuickCaptureList('/search', 'drinks', lists)?.id).toBe('drinks');
  });

  it('does not reuse a list that no longer exists', () => {
    expect(preferredQuickCaptureList('/search', 'missing', lists)).toBeNull();
  });
});
