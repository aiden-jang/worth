import type { ItemDecision } from './models';

export const personalCalls: { value: ItemDecision; label: string }[] = [
  { value: 'favorite', label: 'Favorite' },
  { value: 'meh', label: 'Meh' },
  { value: 'would_not_again', label: 'Not again' },
];

export function decisionLabel(value: ItemDecision | null): string {
  return personalCalls.find((call) => call.value === value)?.label ?? '';
}

export const callAsides: Record<ItemDecision, string> = {
  favorite: 'Yes, again.',
  meh: 'It was a thing.',
  would_not_again: 'Once was plenty.',
};
