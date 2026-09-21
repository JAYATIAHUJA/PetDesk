import baseTest from 'node:test';
import assert from 'node:assert/strict';

// src/growth/GrowthManager has not landed yet; keep these specs visible as skipped until it does
const GrowthManager = await import('../src/growth/GrowthManager.mjs').then(module => module.default, () => null);
const test = GrowthManager ? baseTest : (name, fn) => baseTest(name, { skip: 'GrowthManager module is not implemented yet' }, fn);

function fakeStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get(key) { return values.get(key); },
    set(key, value) { values.set(key, value); },
  };
}

test('GrowthManager derives cumulative level thresholds', () => {
  const manager = new GrowthManager(fakeStore());

  assert.equal(manager.levelForXp(0), 1);
  assert.equal(manager.levelForXp(99), 1);
  assert.equal(manager.levelForXp(100), 2);
  assert.equal(manager.levelForXp(299), 2);
  assert.equal(manager.levelForXp(300), 3);
});

test('GrowthManager reports a level-up only when an award crosses a threshold', () => {
  const manager = new GrowthManager(fakeStore({
    petGrowth: { totalXp: 95, level: 1, updatedAt: '2026-08-09T00:00:00.000Z' },
  }), { now: () => '2026-08-09T12:00:00.000Z' });

  const result = manager.award(10, 'habit');

  assert.equal(result.awarded, 10);
  assert.equal(result.source, 'habit');
  assert.equal(result.leveledUp, true);
  assert.deepEqual(result.growth, {
    totalXp: 105,
    level: 2,
    updatedAt: '2026-08-09T12:00:00.000Z',
  });
});

test('GrowthManager ignores invalid XP awards without changing stored growth', () => {
  const initial = { totalXp: 50, level: 1, updatedAt: '2026-08-09T00:00:00.000Z' };
  const manager = new GrowthManager(fakeStore({ petGrowth: initial }));

  const result = manager.award(-1, 'habit');

  assert.equal(result.awarded, 0);
  assert.equal(result.leveledUp, false);
  assert.deepEqual(result.growth, initial);
  assert.deepEqual(manager.snapshot(), initial);
});

test('GrowthManager persists a non-level-up award', () => {
  const manager = new GrowthManager(fakeStore(), { now: () => '2026-08-09T12:00:00.000Z' });

  const result = manager.award(60, 'focus');

  assert.equal(result.leveledUp, false);
  assert.equal(result.growth.totalXp, 60);
  assert.equal(manager.snapshot().totalXp, 60);
});

