import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { WindowsForegroundAdapter, ActivityMonitor } from '../src/activity/WindowsForegroundAdapter.mjs';

test('WindowsForegroundAdapter maps the native foreground window to an observation', async () => {
  const adapter = new WindowsForegroundAdapter({
    getForegroundWindow: () => ({ pid: 42, exe: 'C:\\Apps\\Code.exe', title: 'file.js', hwnd: 1 }),
    intervalMs: 60000,
  });
  const observations = [];
  adapter.on('observation', value => observations.push(value));
  await adapter.start();
  await adapter.stop();
  assert.equal(observations.length, 1);
  assert.equal(typeof observations[0].observedAt, 'number');
  assert.deepEqual({ ...observations[0], observedAt: 0 }, { appId: 'code.exe', appName: 'Code', windowTitle: 'file.js', observedAt: 0 });
});

test('WindowsForegroundAdapter reports protected processes as Unknown and skips empty focus', async () => {
  const results = [{ pid: 4, exe: '', title: '', hwnd: 2 }, null];
  const adapter = new WindowsForegroundAdapter({ getForegroundWindow: () => results[0], intervalMs: 60000 });
  const observations = [];
  adapter.on('observation', value => observations.push(value));
  await adapter.start();
  results.shift();
  adapter.poll();
  await adapter.stop();
  assert.equal(observations.length, 1);
  assert.equal(observations[0].appId, '');
  assert.equal(observations[0].appName, 'Unknown');
});

test('WindowsForegroundAdapter rejects start when the native binding is unavailable', async () => {
  const adapter = new WindowsForegroundAdapter({ getForegroundWindow: () => { throw new Error('no binding'); } });
  const errors = [];
  adapter.on('error', error => errors.push(error));
  await assert.rejects(adapter.start(), /no binding/);
  assert.equal(errors[0].code, 'start-failed');
  assert.equal(adapter.started, false);
});

test('WindowsForegroundAdapter reports poll failures without crashing and stops polling on stop', async () => {
  let calls = 0;
  const adapter = new WindowsForegroundAdapter({
    getForegroundWindow: () => { calls += 1; if (calls === 2) throw new Error('boom'); return null; },
    intervalMs: 60000,
  });
  const errors = [];
  adapter.on('error', error => errors.push(error));
  await adapter.start(); // probe (1) + first poll (2, throws)
  assert.equal(errors[0].code, 'poll-failed');
  await adapter.stop();
  adapter.poll();
  assert.equal(calls, 2);
});

test('ActivityMonitor starts and stops the adapter once', async () => {
  const adapter = new EventEmitter();
  adapter.start = async () => { adapter.started = (adapter.started || 0) + 1; };
  adapter.stop = async () => { adapter.stopped = (adapter.stopped || 0) + 1; };
  const monitor = new ActivityMonitor({ adapter });
  await monitor.start();
  await monitor.start();
  assert.equal(monitor.isRunning(), true);
  await monitor.stop();
  await monitor.stop();
  assert.equal(adapter.started, 1);
  assert.equal(adapter.stopped, 1);
  assert.equal(monitor.isRunning(), false);
});
