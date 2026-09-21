// renderer.js — Renderer entry point for PetDesk
// Runs sandboxed with contextIsolation: the main process is reached only through window.petdesk (preload.cjs)
import PetEngine from './src/engine/PetEngine.mjs';
import EmotionSystem from './src/pet/emotions/EmotionSystem.mjs';
import SpeechBubble from './src/pet/speech/SpeechBubble.mjs';
import { hydrateIcons } from './src/ui/icons.mjs';

const { petdesk } = window;
hydrateIcons();

// ─── DOM Elements ────────────────────────────────────────────────────────────
const canvas = document.getElementById('pet-canvas');
const bubbleElement = document.getElementById('bubble');
const moodBar = document.getElementById('mood-bar');
const focusHud = document.getElementById('focus-hud');
const focusTaskLabel = document.getElementById('focus-task-label');
const focusTimeLabel = document.getElementById('focus-time-label');
const focusStatusLabel = document.getElementById('focus-status-label');

// ─── Global State ─────────────────────────────────────────────────────────────
let engine = null;
let emotions = null;
let speech = null;
let charactersMap = {};
let currentAlert = null;
let dnd = false;

function escapeHtml(text) {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatFocusTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function updateFocusHud(snapshot) {
  if (!focusHud || !snapshot || snapshot.status === 'idle') return;
  focusHud.classList.toggle('visible', !['completed', 'cancelled'].includes(snapshot.status));
  focusTaskLabel.textContent = snapshot.taskId ? `Focus: ${snapshot.taskId}` : 'Focus session';
  focusTimeLabel.textContent = formatFocusTime(snapshot.remainingMs);
  focusStatusLabel.textContent = snapshot.status === 'paused' ? 'Paused' : 'Monitoring your focus';
}

petdesk.on('focus-state', (snapshot) => updateFocusHud(snapshot));
petdesk.on('activity-status', (status) => {
  if (!focusStatusLabel) return;
  if (status.enabled) focusStatusLabel.textContent = 'Activity awareness on';
  else if (status.available === false) focusStatusLabel.textContent = 'Timer only';
});
petdesk.on('focus-completed', () => {
  if (focusHud) focusHud.classList.remove('visible');
});
petdesk.on('coaching-prompt', (prompt) => {
  if (!speech || dnd) return;
  const appId = JSON.stringify(prompt.appId || '');
  const html = `<div>${prompt.text}</div><div class="bubble-actions"><button class="bubble-btn done" onclick="returnToFocus()">↩ Return</button><button class="bubble-btn snooze" onclick="pauseFocusFromPet()">Ⅱ Pause</button><button class="bubble-btn dismiss" onclick="allowFocusApp(${appId})">Allow</button></div>`;
  speech.show(html, '', prompt.durationMs || 0);
  engine?.stateMachine.setState(prompt.state || 'idle');
});

window.returnToFocus = () => speech?.hide();
window.pauseFocusFromPet = () => { petdesk.send('focus-pause'); speech?.hide(); };
window.allowFocusApp = appId => { petdesk.send('focus-allow-app', appId); speech?.hide(); };

// ─── Bootstrapping ─────────────────────────────────────────────────────────────
petdesk.on('init', (data) => {
  dnd = Boolean(data.doNotDisturb);

  // 1. Build characters map from charactersList loaded dynamically
  if (data.charactersList) {
    data.charactersList.forEach(char => {
      charactersMap[char.id] = char;
    });
  }

  const selectedCharDef = charactersMap[data.character] || charactersMap.cat;

  // 2. Initialize OOP modules
  emotions = new EmotionSystem();
  speech = new SpeechBubble(bubbleElement);
  engine = new PetEngine(
    canvas,
    selectedCharDef,
    data.scale,
    data.opacity,
    data.screenWidth,
    data.screenHeight,
    data.workArea
  );

  // 3. Register global speech helper for triggers
  window.showSpeechBubble = (text, dur = 5000, type = '') => {
    speech.show(`<div>${text}</div>`, type, dur);
  };

  // 4. Start engine loop
  engine.start();

  // 5. Welcome message on load
  setTimeout(() => {
    if (!dnd) {
      speech.show("<div>Hey! I'm here to keep you on track 🐾<br/><small>Click me to show mood and ⚙️ Settings, or double-click me to open settings directly.</small></div>", '', 6000);
    }
  }, 1500);
});

// ─── Settings Updates ─────────────────────────────────────────────────────────
petdesk.on('settings-updated', (settings) => {
  if (!engine) return;

  engine.updateSettings(settings);

  // If character changed, load the new config
  if (settings.character && charactersMap[settings.character]) {
    engine.setCharacter(charactersMap[settings.character]);
  }
});

// ─── Display Changes (resolution / DPI scaling / monitor layout) ──────────────
petdesk.on('display-changed', ({ screenWidth, screenHeight, workArea }) => {
  engine?.setScreenSize(screenWidth, screenHeight, workArea);
});

// ─── Deadline Scheduler Alerts ──────────────────────────────────────────────────
function formatTimeLeft(ms) {
  if (ms < 0) return 'overdue';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m}m left`;
  return `${h}h ${m}m left`;
}

petdesk.on('deadline-alert', (alert) => {
  if (!engine || !speech || dnd) return;

  const { id, type, timeMs } = alert;
  const name = escapeHtml(alert.name);

  // Alert dialogues matching personality triggers
  const messages = {
    overdue: `😿 "${name}" is overdue! Please don't give up, let's complete it now.`,
    urgent: `😱 URGENT: "${name}" is due in ${formatTimeLeft(timeMs)}! Run!!`,
    warning: `⚠️ Heads up! "${name}" is due in ${formatTimeLeft(timeMs)}.`,
    gentle: `📅 Quick reminder: "${name}" is due in ${formatTimeLeft(timeMs)}.`,
  };

  // State Machine reactions
  if (type === 'overdue') {
    engine.stateMachine.activeOverdueDeadline = true;
    engine.stateMachine.setState('sad');
  } else if (type === 'urgent') {
    engine.stateMachine.activeUrgentDeadline = true;
    engine.stateMachine.setState('panic');
  } else {
    engine.stateMachine.setState('idle');
  }

  // Delivered as a Windows toast: Snooze / Done live there, the pet just reacts and says it once
  if (alert.native) {
    speech.show(`<div>${messages[type]}</div>`, type, 8000);
    return;
  }

  currentAlert = alert;

  // Generate Alert Speech Bubble HTML with custom buttons
  const bubbleHtml = `
    <div>${messages[type]}</div>
    <div class="bubble-actions">
      <button class="bubble-btn snooze" onclick="snoozeAlert(${JSON.stringify(id)})">💤 Snooze</button>
      <button class="bubble-btn done" onclick="completeAlert(${JSON.stringify(id)})">✅ Done</button>
      <button class="bubble-btn dismiss" onclick="dismissAlert()">✕</button>
    </div>
  `;

  // Display alert without auto-hide (duration = 0)
  speech.show(bubbleHtml, type, 0);
});

// Global alert button actions
window.snoozeAlert = (id) => {
  petdesk.send('snooze-alert', { deadlineId: id, minutes: 30 });
  window.dismissAlert();
  speech.show('💤 Snoozed for 30 minutes!', '', 2500);
};

window.completeAlert = (id) => {
  petdesk.send('complete-deadline', id);
  window.dismissAlert();
};

window.dismissAlert = () => {
  speech.hide();
  currentAlert = null;
  if (engine) {
    engine.stateMachine.activeUrgentDeadline = false;
    engine.stateMachine.activeOverdueDeadline = false;
    engine.stateMachine.transitionToDefaultState();
  }
};

// Alert handled from its Windows toast (e.g. snoozed): calm the pet down again
petdesk.on('alert-cleared', ({ snoozedMinutes } = {}) => {
  if (!speech) return;
  window.dismissAlert();
  if (snoozedMinutes) speech.show(`💤 Snoozed for ${snoozedMinutes} minutes!`, '', 2500);
});

// ─── Random Check-ins ─────────────────────────────────────────────────────────
petdesk.on('show-message', ({ text, category }) => {
  if (currentAlert || !speech || dnd) return;

  speech.show(`<div>${text}</div>`, '', 6000);

  if (category === 'morning') {
    engine?.stateMachine.setState('happy');
  }
});

// ─── Task Completion Celebration ──────────────────────────────────────────────
petdesk.on('celebrate', () => {
  if (!engine) return;

  // The deadline may have been completed from a toast, so clear any lingering panic/sad mood
  currentAlert = null;
  engine.stateMachine.activeUrgentDeadline = false;
  engine.stateMachine.activeOverdueDeadline = false;

  // Trigger happy dance
  engine.stateMachine.setState('happy');
  speech.show('🎉 Woohoo! Task complete! You crushed it!', '', 4000);

  // Spawn visual DOM confetti effects
  spawnConfetti();
});

function spawnConfetti() {
  const colors = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b','#cc5de8'];
  const stage = document.getElementById('stage');

  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.left = `${Math.random() * window.innerWidth}px`;
      el.style.top = `${Math.random() * (window.innerHeight / 2)}px`;
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDelay = `${Math.random() * 0.3}s`;
      stage.appendChild(el);
      setTimeout(() => el.remove(), 1800);
    }, i * 40);
  }
}

// ─── Do Not Disturb (DND) ─────────────────────────────────────────────────────
petdesk.on('dnd-changed', (isDnd) => {
  dnd = isDnd;
  if (!speech) return;

  if (isDnd) {
    speech.hide();
    speech.show('🔕 Do Not Disturb on. I will walk quietly.', '', 3000);
  } else {
    speech.show('🔔 Back to watching over you! 🐾', '', 3000);
  }
});

// ─── Mood Check-ins ───────────────────────────────────────────────────────────
// Toggle mood bar on pet click
canvas.addEventListener('click', (e) => {
  if (engine && engine.interactions.isDragging) return;

  // Toggle visibility of mood bar
  moodBar.classList.toggle('visible');

  // Auto-hide after 5 seconds
  setTimeout(() => {
    moodBar.classList.remove('visible');
  }, 5000);
});

// Double click to open settings directly
canvas.addEventListener('dblclick', (e) => {
  if (engine && engine.interactions.isDragging) return;
  petdesk.send('open-settings');
  moodBar.classList.remove('visible');
});

// Mood responses dialog
const moodMessages = {
  focused: ["Let's get it! 🎯 I believe in you.", "Focus mode: ON. You're unstoppable.", "One task at a time. You've got this."],
  tired: ["It's okay to rest 💙 You're doing great.", "Even small steps count. Take a breath.", "Rest IS productive. Don't forget that."],
  anxious: ["Hey, breathe. One thing at a time 🌿", "You don't have to do everything right now.", "I'm here with you. It's going to be okay."],
  great: ["That energy! Let's goooo! ✨", "Incredible! Manifest it all today!", "YES! Keep riding that wave! 🌊"],
};

document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.id === 'settings-btn') {
      petdesk.send('open-settings');
      moodBar.classList.remove('visible');
      return;
    }
    const mood = btn.dataset.mood;
    const lines = moodMessages[mood] || [];
    const line = lines[Math.floor(Math.random() * lines.length)];

    speech.show(`<div>${line}</div>`, '', 5000);
    moodBar.classList.remove('visible');

    // Wire mood checks back to engine states
    if (mood === 'great') {
      engine?.stateMachine.setState('happy');
      emotions?.pet();
    }
    if (mood === 'tired') {
      engine?.stateMachine.setState('sleep');
    }
    if (mood === 'anxious') {
      engine?.stateMachine.setState('annoyed');
      emotions?.poke();
    }
  });
});
