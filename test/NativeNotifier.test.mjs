import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { NativeNotifier, buildToastXml, parseActionUrl, actionUrl, isStreakMilestone } from '../src/notifications/NativeNotifier.mjs';

const TOKEN = 'secret-token';

function fakeNotificationClass({ supported = true } = {}) {
  class FakeNotification extends EventEmitter {
    static instances = [];
    static isSupported() { return supported; }
    constructor(options) {
      super();
      this.options = options;
      FakeNotification.instances.push(this);
    }
    show() { this.shown = true; }
  }
  return FakeNotification;
}

function createNotifier(overrides = {}) {
  const Notification = overrides.Notification || fakeNotificationClass();
  const notifier = new NativeNotifier({ Notification, token: TOKEN, platform: 'win32', getPetEmoji: () => '⚡', ...overrides });
  return { notifier, Notification };
}

test('buildToastXml escapes user text and wires protocol-activated buttons', () => {
  const xml = buildToastXml({
    title: 'Due <soon>',
    body: '"Ship & test"',
    launch: actionUrl('open', TOKEN),
    actions: [{ label: 'Done', url: actionUrl('done', TOKEN, { id: 'dl_1' }) }],
    sticky: true,
  });
  assert.match(xml, /<text>Due &lt;soon&gt;<\/text>/);
  assert.match(xml, /<text>&quot;Ship &amp; test&quot;<\/text>/);
  assert.match(xml, /scenario="reminder"/);
  assert.match(xml, /<action content="Done" activationType="protocol" arguments="petdesk:\/\/done\?id=dl_1&amp;token=secret-token"\/>/);
});

test('parseActionUrl accepts only known actions carrying the install token', () => {
  assert.deepEqual(parseActionUrl(actionUrl('done', TOKEN, { id: 'dl_1' }), TOKEN), { action: 'done', id: 'dl_1' });
  assert.deepEqual(parseActionUrl(`petdesk://snooze/?id=dl%202&token=${TOKEN}`, TOKEN), { action: 'snooze', id: 'dl 2' });
  assert.deepEqual(parseActionUrl(actionUrl('open', TOKEN), TOKEN), { action: 'open', id: '' });
  assert.equal(parseActionUrl(actionUrl('done', 'wrong', { id: 'dl_1' }), TOKEN), null);
  assert.equal(parseActionUrl('petdesk://done?id=dl_1', TOKEN), null);
  assert.equal(parseActionUrl(actionUrl('delete-everything', TOKEN), TOKEN), null);
  assert.equal(parseActionUrl(`https://done?token=${TOKEN}`, TOKEN), null);
  assert.equal(parseActionUrl('not a url', TOKEN), null);
  assert.equal(parseActionUrl(actionUrl('done', '', { id: 'dl_1' }), ''), null);
});

test('deadlineAlert shows a toast with Snooze and Done for actionable alert types', () => {
  const { notifier, Notification } = createNotifier();
  assert.equal(notifier.deadlineAlert({ id: 'dl_1', name: 'Report', type: 'urgent', timeMs: 25 * 60000 }), true);
  const [toast] = Notification.instances;
  assert.equal(toast.shown, true);
  assert.match(toast.options.toastXml, /⚡ Due in 25m!/);
  assert.match(toast.options.toastXml, /petdesk:\/\/snooze\?id=dl_1/);
  assert.match(toast.options.toastXml, /petdesk:\/\/done\?id=dl_1/);
  assert.equal(notifier.deadlineAlert({ id: 'dl_1', name: 'Report', type: 'gentle', timeMs: 1 }), false);
});

test('NativeNotifier stays silent when disabled, unsupported or off Windows', () => {
  assert.equal(createNotifier({ isEnabled: () => false }).notifier.focusCompleted({ elapsedMs: 60000 }), false);
  assert.equal(createNotifier({ Notification: fakeNotificationClass({ supported: false }) }).notifier.available(), false);
  assert.equal(createNotifier({ platform: 'darwin' }).notifier.available(), false);
});

test('a toast rejected by Windows triggers the fallback callback', () => {
  const { notifier, Notification } = createNotifier();
  let fellBack = false;
  notifier.deadlineAlert({ id: 'dl_1', name: 'Report', type: 'overdue', timeMs: -1 }, { onFailed: () => { fellBack = true; } });
  Notification.instances[0].emit('failed', {}, 'no shortcut');
  assert.equal(fellBack, true);
  assert.equal(notifier.live.size, 0);
});

test('habitMilestone only celebrates milestone streaks', () => {
  const { notifier, Notification } = createNotifier();
  assert.equal(isStreakMilestone(7), true);
  assert.equal(isStreakMilestone(8), false);
  assert.equal(notifier.habitMilestone({ name: 'Read', emoji: '📚', streak: 8 }), false);
  assert.equal(notifier.habitMilestone({ name: 'Read', emoji: '📚', streak: 7 }), true);
  assert.match(Notification.instances[0].options.toastXml, /7-day streak!/);
});
