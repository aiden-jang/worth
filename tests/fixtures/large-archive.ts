import { today } from '../../src/format';
import { archiveFile } from '../../src/shared/portability';

const id = (n: number) =>
  n === 1
    ? '11111111-1111-4111-8111-111111111111'
    : `11111111-1111-4111-8111-${n.toString(16).padStart(12, '0')}`;

// Disposable test data shared by the browser journeys and real database round-trip.
export function largeArchive() {
  const end = Date.parse(`${today()}T12:00:00Z`);
  const time = (daysAgo: number) => end - daysAgo * 86400000;
  const day = (daysAgo: number) => new Date(time(daysAgo)).toISOString().slice(0, 10);
  const lists = Array.from({ length: 24 }, (_, index) => ({
    id: id(index + 1),
    name: index === 0 ? 'Places' : `Neighborhood ${index + 1}`,
    kind: 'collection',
    description: '',
    archived: index === 23,
    rankedIds: [],
    updatedAt: time(1),
  }));
  const gym = { id: id(25), name: 'Gym', kind: 'activity', description: '', rankedIds: [], updatedAt: end };
  const items = Array.from({ length: 360 }, (_, index) => ({
    id: id(1000 + index),
    listId: lists[Math.floor(index / 15)].id,
    title:
      index === 0
        ? 'Cafe by the old cinema'
        : `${['Cafe', 'Bookshop', 'Ramen shop', 'Market'][Math.floor(index / 90)]} ${index + 1}`,
    type: 'Place',
    note: index === 0 ? 'The quiet upstairs table.' : '',
    decision: (['favorite', 'meh', 'would_not_again', null] as const)[index % 4],
    createdAt: time(360 - index),
    updatedAt: time(360 - index),
  }));
  const visits = items.map((item, index) => ({
    id: id(2000 + index),
    listId: item.listId,
    itemId: item.id,
    title: item.title,
    happenedOn: day(360 - index),
    note: index === 0 ? 'Went after the film.' : '',
    context: { location: 'Brooklyn', reaction: index % 3 === 0 ? 'favorite' : null },
    createdAt: time(360 - index),
    updatedAt: time(360 - index),
  }));
  const workouts = Array.from({ length: 96 }, (_, index) => ({
    id: id(3000 + index),
    listId: gym.id,
    title: `Training ${index + 1}`,
    happenedOn: day((96 - index) * 2),
    status: 'finished',
    plannedExercises: ['Bench press', 'Squat', 'Row'],
    skippedExercises: [],
    targets: [],
    createdAt: time((96 - index) * 2),
    updatedAt: time((96 - index) * 2),
  }));
  const exercises = workouts.flatMap((workout, index) =>
    workout.plannedExercises.map((title, exerciseIndex) => ({
      id: id(4000 + index * 3 + exerciseIndex),
      listId: gym.id,
      workoutId: workout.id,
      title,
      exercise: true,
      happenedOn: workout.happenedOn,
      exerciseSets: [{ reps: 8 + (index % 3), weight: 40 + Math.floor(index / 12) * 2.5 }],
      weightUnit: index % 10 === 0 ? 'lb' : 'kg',
      createdAt: workout.createdAt + exerciseIndex,
      updatedAt: workout.updatedAt + exerciseIndex,
    })),
  );
  return archiveFile.parse({
    schemaVersion: 11,
    exportedAt: new Date(end).toISOString(),
    photosExcluded: true,
    lists: [...lists, gym],
    items,
    logs: [
      ...visits,
      ...exercises,
      ...Array.from({ length: 45 }, (_, index) => ({
        id: id(4500 + index),
        listId: gym.id,
        title: `Bench setup note ${index + 1}`,
        happenedOn: day(0),
        createdAt: end + index,
        updatedAt: end + index,
      })),
      {
        id: id(4600),
        listId: gym.id,
        title: 'Bench breathing',
        exercise: true,
        measurements: [{ name: 'Duration', value: 60, unit: 'seconds' }],
        happenedOn: day(3),
        createdAt: time(3),
        updatedAt: time(3),
      },
    ].map((log) => ({ note: '', unit: '', ...log })),
    workoutSessions: [
      ...workouts,
      {
        id: id(3100),
        listId: gym.id,
        title: 'Today’s workout',
        happenedOn: day(0),
        status: 'active',
        plannedExercises: ['Bench press', 'Squat', 'Row'],
        skippedExercises: [],
        targets: [],
        createdAt: end,
        updatedAt: end,
      },
    ],
    inbox: Array.from({ length: 12 }, (_, index) => ({
      id: id(5000 + index),
      title: `A place to remember ${index + 1}`,
      revision: 0,
      createdAt: time(index),
      updatedAt: time(index),
    })),
  });
}
