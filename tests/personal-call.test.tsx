import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { CallChoices } from '../src/components/PersonalCall';
import type { ItemDecision } from '../src/shared/models';

afterEach(cleanup);

test('no call stays distinct from Meh and selecting a pressed call clears it', () => {
  function Editor() {
    const [value, setValue] = useState<ItemDecision | null>(null);
    return <CallChoices value={value} onChange={setValue} />;
  }
  render(<Editor />);
  const meh = screen.getByRole('button', { name: 'Meh' });
  expect(meh).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(meh);
  expect(meh).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Favorite' })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(meh);
  for (const button of screen.getAllByRole('button')) expect(button).toHaveAttribute('aria-pressed', 'false');
});
