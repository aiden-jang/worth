import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ActivityEditor } from '../src/components/ActivityEditor';
import { api } from '../src/api';
import type { Log } from '../src/shared/models';

const dialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
};
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const [name, descriptor] of Object.entries(dialogMethods)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

test('editing exercise sets preserves the rest of the activity draft when saving', async () => {
  const record: Log = {
    id: 'log-1',
    listId: 'list-1',
    itemId: null,
    workoutId: null,
    title: 'Bench press',
    happenedOn: '2026-10-10',
    note: 'Keep my note',
    amount: 2,
    unit: 'minutes',
    sets: 3,
    reps: 8,
    exerciseSets: [{ reps: 10, weight: null }],
    weightUnit: 'kg',
    hasPhoto: false,
    createdAt: 1,
    updatedAt: 1,
  };
  const update = vi.spyOn(api, 'updateLog').mockResolvedValue({ log: record });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <ActivityEditor
        listId={record.listId}
        log={record}
        repeatLog={null}
        existingTitles={[]}
        logs={[record]}
        workouts={[]}
        initialWorkout={null}
        initialExercise=""
        workoutsLoading={false}
        onClose={() => {}}
        onNext={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('Weight unit'), { target: { value: 'lb' } });
  fireEvent.change(screen.getByLabelText('Set 1 weight in lb'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Duplicate last set' }));
  fireEvent.change(screen.getByLabelText('Set 2 reps'), { target: { value: '6' } });
  fireEvent.change(screen.getByLabelText('Set 2 weight in lb'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith(
      record.id,
      expect.objectContaining({
        title: record.title,
        happenedOn: record.happenedOn,
        note: record.note,
        amount: 4,
        unit: 'minutes',
        sets: 3,
        reps: 8,
        weightUnit: 'lb',
        exerciseSets: [
          { reps: 10, weight: 0 },
          { reps: 6, weight: null },
        ],
      }),
    ),
  );
});
