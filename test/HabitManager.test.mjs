import test from 'node:test';
import assert from 'node:assert/strict';
import HabitManager from '../src/habits/HabitManager.mjs';

function fakeStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get(key) { return values.get(key); },
    set(key, value) { values.set(key, value); },
  };
}

test('HabitManager creates a daily habit with the default XP reward', () => {
  const manager = new HabitManager(fakeStore(), { today: () => '2026-08-09' });
  const habit = manager.create({ name: 'Read', emoji: '📚' });

  assert.match(habit.id, /^habit_/);
  assert.equal(habit.name, 'Read');
  assert.equal(habit.emoji, '📚');
  assert.equal(habit.xpReward, 10);
  assert.equal(habit.streak, 0);
  assert.deepEqual(habit.completedDates, []);
});

test('HabitManager completes a habit once and returns its XP reward', () => {
  const manager = new HabitManager(fakeStore(), { today: () => '2026-08-09' });
  const habit = manager.create({ name: 'Read' });

  const result = manager.complete(habit.id);

  assert.equal(result.completed, true);
  assert.equal(result.xpAwarded, 10);
  assert.equal(result.habit.streak, 1);
  assert.deepEqual(result.habit.completedDates, ['2026-08-09']);
});

test('HabitManager does not award XP twice on the same local date', () => {
  const manager = new HabitManager(fakeStore(), { today: () => '2026-08-09' });
  const habit = manager.create({ name: 'Read' });
  manager.complete(habit.id);

  const result = manager.complete(habit.id);

  assert.equal(result.completed, false);
  assert.equal(result.xpAwarded, 0);
  assert.equal(result.habit.streak, 1);
  assert.deepEqual(result.habit.completedDates, ['2026-08-09']);
});

test('HabitManager continues a streak only on consecutive local days', () => {
  let day = '2026-08-09';
  const manager = new HabitManager(fakeStore(), { today: () => day });
  const habit = manager.create({ name: 'Read' });
  manager.complete(habit.id);

  day = '2026-08-10';
  assert.equal(manager.complete(habit.id).habit.streak, 2);

  day = '2026-08-12';
  assert.equal(manager.complete(habit.id).habit.streak, 1);
});

test('HabitManager deletes only the selected habit', () => {
  const manager = new HabitManager(fakeStore(), { today: () => '2026-08-09' });
  const first = manager.create({ name: 'Read' });
  const second = manager.create({ name: 'Walk' });

  assert.deepEqual(manager.remove(first.id).map(habit => habit.name), ['Walk']);
  assert.equal(manager.list()[0].id, second.id);
});

