// scheduler.js — Deadline checker and check-in timer for PetDesk
import fs from 'node:fs';
import cron from 'node-cron';

let checkTask = null;
let checkinTimer = null;
let morningTask = null;
let snoozedAlerts = {}; // { deadlineId: snoozeUntil (ms) }
let dismissedAlerts = new Set();
let petWindow = null;
let storeRef = null;
let notifier = null;
let notifiedAlerts = new Map(); // deadlineId -> { type, at } for alerts delivered as native toasts

const CHECKIN_MESSAGES = JSON.parse(fs.readFileSync(new URL('./messages/lines.json', import.meta.url), 'utf8'));

// Deadline alert types that are delivered as Windows toasts; 'gentle' stays a pet speech bubble
const NATIVE_ALERT_TYPES = ['overdue', 'urgent', 'warning'];
const RENOTIFY_MS = 30 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msUntil(dateStr, timeStr) {
  const dt = new Date(`${dateStr}T${timeStr || '09:00'}:00`);
  return dt.getTime() - Date.now();
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getFrequencyMs(freq) {
  return {
    never: Infinity,
    rarely: randomBetween(60, 90) * 60 * 1000,
    sometimes: randomBetween(20, 45) * 60 * 1000,
    often: randomBetween(10, 20) * 60 * 1000,
  }[freq] ?? randomBetween(20, 45) * 60 * 1000;
}

// A toast lives on in the Action Center, so unlike the speech bubble it must not be re-sent every
// minute. Notify again only when the alert escalates (warning → urgent → overdue) or after a while.
function shouldNotify(previous, type, now) {
  if (!previous) return true;
  if (previous.type !== type) return true;
  return now - previous.at >= RENOTIFY_MS;
}

// ─── Deadline Checker ─────────────────────────────────────────────────────────

function checkDeadlines() {
  if (!storeRef || !petWindow) return;

  const dnd = storeRef.get('doNotDisturb');
  if (dnd) return;

  const deadlines = storeRef.get('deadlines').filter(d => !d.completed);
  const now = Date.now();

  const activeIds = new Set(deadlines.map(d => d.id));
  for (const id of notifiedAlerts.keys()) {
    if (!activeIds.has(id)) notifiedAlerts.delete(id);
  }

  for (const deadline of deadlines) {
    if (dismissedAlerts.has(deadline.id)) continue;

    const snoozeUntil = snoozedAlerts[deadline.id];
    if (snoozeUntil && now < snoozeUntil) continue;

    const ms = msUntil(deadline.date, deadline.time);

    let alertType = null;
    if (ms < 0) alertType = 'overdue';
    else if (ms < 60 * 60 * 1000) alertType = 'urgent';       // < 1h
    else if (ms < 24 * 60 * 60 * 1000) alertType = 'warning'; // < 24h
    else if (ms < 48 * 60 * 60 * 1000) alertType = 'gentle';  // < 48h

    if (alertType) {
      const alert = { id: deadline.id, name: deadline.name, type: alertType, timeMs: ms };
      const sendBubble = () => petWindow?.webContents.send('deadline-alert', alert);

      if (NATIVE_ALERT_TYPES.includes(alertType) && notifier?.available()) {
        // Already in the Action Center: let the next deadline have its turn
        if (!shouldNotify(notifiedAlerts.get(deadline.id), alertType, now)) continue;
        if (notifier.deadlineAlert(alert, { onFailed: sendBubble })) {
          notifiedAlerts.set(deadline.id, { type: alertType, at: now });
          // The pet still reacts (mood + short bubble); the actionable buttons live on the toast
          petWindow.webContents.send('deadline-alert', { ...alert, native: true });
          break;
        }
      }

      sendBubble();
      // Only fire one alert at a time
      break;
    }
  }
}

// ─── Random Check-in ─────────────────────────────────────────────────────────

function scheduleNextCheckin() {
  if (!storeRef || !petWindow) return;

  const freq = storeRef.get('messageFrequency');
  const delay = getFrequencyMs(freq);

  if (delay === Infinity) return;

  checkinTimer = setTimeout(() => {
    const dnd = storeRef.get('doNotDisturb');
    if (!dnd && petWindow) {
      const category = pickRandom(['motivational', 'funny', 'chaotic', 'checkin', 'manifesting']);
      const lines = CHECKIN_MESSAGES[category] || CHECKIN_MESSAGES.motivational;
      const line = pickRandom(lines);

      petWindow.webContents.send('show-message', { text: line, category });
    }
    scheduleNextCheckin(); // reschedule
  }, delay);
}

// ─── Morning Summary ──────────────────────────────────────────────────────────

function sendMorningSummary() {
  if (!storeRef || !petWindow) return;
  const dnd = storeRef.get('doNotDisturb');
  if (dnd) return;

  const today = new Date().toISOString().split('T')[0];
  const todayDeadlines = storeRef.get('deadlines').filter(d =>
    !d.completed && d.date === today
  );

  const msg = todayDeadlines.length === 0
    ? "Good morning! No deadlines today 🎉 Let's make it count."
    : `Good morning! You have ${todayDeadlines.length} deadline${todayDeadlines.length > 1 ? 's' : ''} today. Let's go! 💪`;

  petWindow.webContents.send('show-message', { text: msg, category: 'morning' });
}

// ─── Public API ───────────────────────────────────────────────────────────────

function start(store, win, options = {}) {
  stop(); // the pet window can reload; never stack cron jobs
  storeRef = store;
  petWindow = win;
  notifier = options.notifier || null;

  // Check deadlines every 60 seconds
  checkTask = cron.schedule('* * * * *', checkDeadlines);

  // Morning summary at 8:30 AM
  morningTask = cron.schedule('30 8 * * *', sendMorningSummary);

  // Start random check-ins
  scheduleNextCheckin();
}

function refresh(store) {
  storeRef = store;
  dismissedAlerts.clear();
}

function stop() {
  checkTask?.stop();
  morningTask?.stop();
  clearTimeout(checkinTimer);
}

function dismiss(deadlineId) {
  dismissedAlerts.add(deadlineId);
}

function snooze(deadlineId, minutes) {
  snoozedAlerts[deadlineId] = Date.now() + minutes * 60 * 1000;
  notifiedAlerts.delete(deadlineId); // remind again once the snooze runs out
}

export { shouldNotify, RENOTIFY_MS };
export default { start, refresh, stop, dismiss, snooze };
