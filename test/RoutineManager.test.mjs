import test from 'node:test';
import assert from 'node:assert/strict';
import RoutineManager from '../src/routines/RoutineManager.mjs';

function fakeStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get(key) { return values.get(key); },
    set(key, value) { values.set(key, value); },
  };
}

test('RoutineManager creates a normalized focus configuration', () => {
  const manager = new RoutineManager(fakeStore());
  const routine = manager.create({
    name: 'Deep work',
    durationMinutes: '50',
    allowedApps: ['Code.exe', '', 'code.exe'],
    activityAwareness: true,
    personality: 'coach',
    taskId: 'task_1',
  });

  assert.match(routine.id, /^routine_/);
  assert.equal(routine.durationMinutes, 50);
  assert.deepEqual(routine.allowedApps, ['code.exe']);
  assert.equal(routine.activityAwareness, true);
  assert.equal(routine.personality, 'coach');
  assert.equal(routine.taskId, 'task_1');
});

test('RoutineManager rejects blank names and out-of-range durations', () => {
  const manager = new RoutineManager(fakeStore());

  assert.throws(() => manager.create({ name: ' ', durationMinutes: 25 }), /Routine name/);
  assert.throws(() => manager.create({ name: 'Study', durationMinutes: 0 }), /between 1 and 240/);
  assert.throws(() => manager.create({ name: 'Study', durationMinutes: 241 }), /between 1 and 240/);
});

test('RoutineManager falls back to an ad-hoc gentle routine for omitted values', () => {
  const manager = new RoutineManager(fakeStore());
  const routine = manager.create({ name: 'Quick session', durationMinutes: 25, personality: 'unknown' });

  assert.equal(routine.taskId, 'adhoc');
  assert.equal(routine.personality, 'gentle');
  assert.deepEqual(routine.allowedApps, []);
  assert.equal(routine.activityAwareness, false);
});

test('RoutineManager updates values without changing identity or created time', () => {
  const manager = new RoutineManager(fakeStore());
  const created = manager.create({ name: 'Study', durationMinutes: 25 });
  const updated = manager.update(created.id, { name: 'Coding', durationMinutes: 50, personality: 'playful' });

  assert.equal(updated.id, created.id);
  assert.equal(updated.createdAt, created.createdAt);
  assert.equal(updated.name, 'Coding');
  assert.equal(updated.durationMinutes, 50);
  assert.equal(updated.personality, 'playful');
});

test('RoutineManager deletes only the selected routine', () => {
  const manager = new RoutineManager(fakeStore());
  const first = manager.create({ name: 'Study', durationMinutes: 25 });
  const second = manager.create({ name: 'Workout', durationMinutes: 30 });

  assert.deepEqual(manager.remove(first.id).map(routine => routine.name), ['Workout']);
  assert.equal(manager.list()[0].id, second.id);
});

