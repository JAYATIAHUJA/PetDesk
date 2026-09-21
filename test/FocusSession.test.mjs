import test from 'node:test';
import assert from 'node:assert/strict';
import FocusSession from '../src/focus/FocusSession.mjs';

function fakeClock(start = 1000) {
  return {
    now: start,
    current() { return this.now; },
    advance(ms) { this.now += ms; },
  };
}

test('FocusSession tracks active time and ignores pauses', () => {
  const clock = fakeClock();
  const session = new FocusSession({ clock: () => clock.current() });

  session.start({ taskId: 'task-1', durationMs: 10_000, allowedApps: ['code'], activityAwareness: true });
  clock.advance(2_000);
  session.tick();
  session.pause();
  clock.advance(5_000);
  session.tick();

  assert.equal(session.snapshot().status, 'paused');
  assert.equal(session.snapshot().elapsedMs, 2_000);

  session.resume();
  clock.advance(3_000);
  session.tick();
  assert.equal(session.snapshot().elapsedMs, 5_000);
  assert.equal(session.snapshot().remainingMs, 5_000);
});

test('FocusSession completes when duration is reached', () => {
  const clock = fakeClock();
  const session = new FocusSession({ clock: () => clock.current() });

  session.start({ taskId: 'task-1', durationMs: 5_000 });
  clock.advance(5_000);
  session.tick();

  assert.equal(session.snapshot().status, 'completed');
  assert.equal(session.snapshot().elapsedMs, 5_000);
  assert.equal(session.snapshot().endReason, 'duration-complete');
});

test('FocusSession rejects invalid transitions', () => {
  const clock = fakeClock();
  const session = new FocusSession({ clock: () => clock.current() });

  assert.equal(session.pause(), null);
  session.start({ taskId: 'task-1', durationMs: 5_000 });
  const paused = session.pause();
  assert.equal(session.pause(), null);
  assert.deepEqual(session.snapshot(), paused);
});

test('FocusSession can be cancelled and emits domain events', () => {
  const clock = fakeClock();
  const events = [];
  const session = new FocusSession({ clock: () => clock.current(), onEvent: event => events.push(event.type) });

  session.start({ taskId: 'task-1', durationMs: 5_000 });
  session.stop('user-cancelled');

  assert.equal(session.snapshot().status, 'cancelled');
  assert.equal(session.snapshot().endReason, 'user-cancelled');
  assert.deepEqual(events, ['session-started', 'session-stopped']);
});
