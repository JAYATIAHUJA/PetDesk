import test from 'node:test';
import assert from 'node:assert/strict';
import TaskManager from '../src/tasks/TaskManager.mjs';

function fakeStore(initial = []) {
  const values = new Map([['deadlines', initial]]);
  return {
    get(key) { return values.get(key); },
    set(key, value) { values.set(key, value); },
  };
}

test('TaskManager returns an empty list when storage is empty', () => {
  const manager = new TaskManager(fakeStore());
  assert.deepEqual(manager.list(), []);
});

test('TaskManager creates a task with an id and timestamp', () => {
  const manager = new TaskManager(fakeStore());
  const task = manager.create({ name: 'Study', date: '2026-08-08', time: '09:00', note: 'React' });

  assert.match(task.id, /^dl_/);
  assert.equal(task.name, 'Study');
  assert.equal(task.completed, false);
  assert.ok(task.created);
  assert.equal(manager.list().length, 1);
});

test('TaskManager completes and removes only the requested task', () => {
  const first = { id: 'a', name: 'A', completed: false };
  const second = { id: 'b', name: 'B', completed: false };
  const manager = new TaskManager(fakeStore([first, second]));

  const remaining = manager.complete('a');

  assert.deepEqual(remaining, [{ ...first, completed: true }, second]);
  assert.deepEqual(manager.list(), [{ ...first, completed: true }, second]);
});

test('TaskManager removes only the requested task', () => {
  const manager = new TaskManager(fakeStore([
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
  ]));

  assert.deepEqual(manager.remove('a'), [{ id: 'b', name: 'B' }]);
});

test('TaskManager rejects an empty task name', () => {
  const manager = new TaskManager(fakeStore());
  assert.throws(() => manager.create({ name: '  ' }), /Task name/);
});
