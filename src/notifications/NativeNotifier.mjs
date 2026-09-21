// NativeNotifier.mjs — Windows toast notifications (Action Center) for system-level alerts.
// Toast buttons use protocol activation (petdesk://...), so they keep working from the
// Action Center even after the toast object is gone or PetDesk was restarted.
import { PROTOCOL } from '../system/startup.mjs';

const TOAST_ACTIONS = ['open', 'snooze', 'done'];
const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];
const MAX_LIVE_TOASTS = 20;

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function actionUrl(action, token, params = {}) {
  const query = new URLSearchParams({ ...params, token });
  return `${PROTOCOL}://${action}?${query}`;
}

// Parses a petdesk:// activation. Returns null unless the action is known and the token matches,
// so other apps/web pages cannot complete or snooze deadlines by guessing URLs.
function parseActionUrl(rawUrl, token) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== `${PROTOCOL}:`) return null;
  const action = (url.hostname || url.pathname.replace(/^\/+/, '')).replace(/\/+$/, '').toLowerCase();
  if (!TOAST_ACTIONS.includes(action)) return null;
  if (!token || url.searchParams.get('token') !== token) return null;
  return { action, id: url.searchParams.get('id') || '' };
}

function buildToastXml({ title, body, launch, actions = [], sticky = false }) {
  const actionXml = actions.map(action =>
    `<action content="${escapeXml(action.label)}" activationType="protocol" arguments="${escapeXml(action.url)}"/>`
  ).join('');
  return [
    `<toast activationType="protocol" launch="${escapeXml(launch)}"${sticky ? ' scenario="reminder"' : ''}>`,
    '<visual><binding template="ToastGeneric">',
    `<text>${escapeXml(title)}</text>`,
    `<text>${escapeXml(body)}</text>`,
    '</binding></visual>',
    actionXml ? `<actions>${actionXml}</actions>` : '',
    '</toast>',
  ].join('');
}

function formatTimeLeft(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return hours === 0 ? `${minutes}m` : `${hours}h ${minutes}m`;
}

function isStreakMilestone(streak) {
  return STREAK_MILESTONES.includes(streak);
}

class NativeNotifier {
  constructor({ Notification, token, isEnabled = () => true, getPetEmoji = () => '🐾', platform = process.platform } = {}) {
    if (!Notification) throw new TypeError('NativeNotifier requires the Electron Notification class');
    this.Notification = Notification;
    this.token = token;
    this.isEnabled = isEnabled;
    this.getPetEmoji = getPetEmoji;
    this.platform = platform;
    this.live = new Set(); // keep references so toasts are not garbage-collected before they fire events
  }

  available() {
    return this.platform === 'win32' && this.Notification.isSupported() && Boolean(this.isEnabled());
  }

  // Returns true when the toast was handed to Windows. onFailed fires if Windows rejects it later.
  show(toast, { onFailed } = {}) {
    if (!this.available()) return false;
    try {
      const notification = new this.Notification({ toastXml: buildToastXml(toast) });
      const release = () => this.live.delete(notification);
      notification.on('failed', (_event, error) => {
        release();
        console.warn('Toast failed:', error);
        onFailed?.(error);
      });
      notification.on('close', release);
      this.live.add(notification);
      if (this.live.size > MAX_LIVE_TOASTS) this.live.delete(this.live.values().next().value);
      notification.show();
      return true;
    } catch (error) {
      console.warn('Toast failed:', error.message);
      return false;
    }
  }

  deadlineAlert({ id, name, type, timeMs }, options) {
    const pet = this.getPetEmoji();
    const copy = {
      overdue: { title: `${pet} Deadline overdue`, body: `"${name}" is overdue. Don't give up — let's finish it now.` },
      urgent: { title: `${pet} Due in ${formatTimeLeft(timeMs)}!`, body: `"${name}" is almost due. Run!!` },
      warning: { title: `${pet} Heads up`, body: `"${name}" is due in ${formatTimeLeft(timeMs)}.` },
    }[type];
    if (!copy) return false;

    return this.show({
      ...copy,
      sticky: type !== 'warning',
      launch: actionUrl('open', this.token),
      actions: [
        { label: '💤 Snooze 30m', url: actionUrl('snooze', this.token, { id }) },
        { label: '✅ Done', url: actionUrl('done', this.token, { id }) },
      ],
    }, options);
  }

  focusCompleted(snapshot = {}) {
    const minutes = Math.max(1, Math.round((snapshot.elapsedMs || snapshot.durationMs || 0) / 60000));
    return this.show({
      title: `${this.getPetEmoji()} Focus session complete`,
      body: `${minutes} focused minute${minutes === 1 ? '' : 's'} done. Time for a stretch!`,
      launch: actionUrl('open', this.token),
    });
  }

  habitMilestone(habit = {}) {
    if (!isStreakMilestone(habit.streak)) return false;
    return this.show({
      title: `${this.getPetEmoji()} ${habit.streak}-day streak!`,
      body: `${habit.emoji ? `${habit.emoji} ` : ''}"${habit.name}" — ${habit.streak} days in a row. Keep it going!`,
      launch: actionUrl('open', this.token),
    });
  }
}

export { NativeNotifier, buildToastXml, parseActionUrl, actionUrl, escapeXml, isStreakMilestone, STREAK_MILESTONES };
