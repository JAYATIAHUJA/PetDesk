// settings.mjs — Settings window logic. Talks to the main process through window.petdesk (preload.cjs)
import { icon, hydrateIcons } from './src/ui/icons.mjs';

const { petdesk } = window;
hydrateIcons();

document.getElementById('window-minimize').addEventListener('click', () => petdesk.send('window-control', 'minimize'));
document.getElementById('window-close').addEventListener('click', () => petdesk.send('window-control', 'close'));

// ─── State ────────────────────────────────────────────────────────────────────
let deadlines = [];
let selectedChar = 'cat';
const freqLabels = ['Never', 'Rarely', 'Sometimes', 'Often'];
const freqValues = ['never', 'rarely', 'sometimes', 'often'];
let focusTasks = [];
let focusSnapshot = null;

// ─── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

// ─── Deadline Helpers ─────────────────────────────────────────────────────────
function timeUntilLabel(dateStr, timeStr) {
  const dt = new Date(`${dateStr}T${timeStr || '09:00'}:00`);
  const ms = dt.getTime() - Date.now();
  if (ms < 0) return { label: 'Overdue', cls: 'overdue' };
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (h < 1) return { label: `< 1h`, cls: 'urgent' };
  if (h < 24) return { label: `${h}h left`, cls: 'urgent' };
  return { label: `${d}d left`, cls: 'ok' };
}

function renderDeadlines() {
  const list = document.getElementById('deadline-list');
  const active = deadlines.filter(d => !d.completed);
  const done = deadlines.filter(d => d.completed);
  const sorted = [...active.sort((a,b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`)), ...done];

  if (sorted.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="icon">${icon('party', 44)}</div><p>No deadlines yet! Add one above.</p></div>`;
    return;
  }

  list.innerHTML = sorted.map(d => {
    const { label, cls } = d.completed ? { label: 'Done', cls: 'ok' } : timeUntilLabel(d.date, d.time);
    return `
      <div class="deadline-card ${cls} ${d.completed ? 'completed' : ''}">
        <div class="deadline-info">
          <div class="deadline-name">${escHtml(d.name)}</div>
          <div class="deadline-time">${d.date} ${d.time ? '@ ' + d.time : ''}${d.note ? ' · ' + escHtml(d.note) : ''}</div>
        </div>
        <span class="deadline-badge ${cls}">${label}</span>
        <div class="deadline-actions">
          ${!d.completed ? `<button class="icon-btn done" data-id="${d.id}" title="Mark done">${icon('check', 16)}</button>` : ''}
          <button class="icon-btn delete" data-id="${d.id}" title="Delete">${icon('trash', 16)}</button>
        </div>
      </div>
    `;
  }).join('');

  // Bind actions
  list.querySelectorAll('.icon-btn.done').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      deadlines = deadlines.filter(d => d.id !== id);
      petdesk.send('complete-deadline', id);
      renderDeadlines();
      saveDeadlines();
    });
  });

  list.querySelectorAll('.icon-btn.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      deadlines = deadlines.filter(d => d.id !== btn.dataset.id);
      renderDeadlines();
      saveDeadlines();
    });
  });
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function saveDeadlines() {
  petdesk.send('save-deadlines', deadlines);
}

// ─── Add Deadline ─────────────────────────────────────────────────────────────
// Set default date to today
document.getElementById('new-date').valueAsDate = new Date();

document.getElementById('btn-add-deadline').addEventListener('click', () => {
  const name = document.getElementById('new-name').value.trim();
  const date = document.getElementById('new-date').value;
  const time = document.getElementById('new-time').value;
  const note = document.getElementById('new-note').value.trim();

  if (!name || !date) { alert('Please enter a task name and date.'); return; }

  deadlines.push({
    id: `dl_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    name, date, time, note,
    completed: false,
    created: new Date().toISOString(),
  });

  document.getElementById('new-name').value = '';
  document.getElementById('new-note').value = '';
  document.getElementById('new-date').valueAsDate = new Date();

  renderDeadlines();
  saveDeadlines();
});

// ─── Character Picker ─────────────────────────────────────────────────────────
// Sprite characters show their own idle frame; emoji-only characters get a hand-drawn stand-in
function characterThumb(char) {
  if (char.useImages && char.imagePath) {
    return `<img class="char-thumb" src="${escHtml(char.imagePath)}/shime1.png" alt="" draggable="false" />`;
  }
  return icon(char.id === 'cat' ? 'cat' : 'paw', 44);
}

// Load characters dynamically from main process
petdesk.invoke('get-characters').then(chars => {
  const grid = document.getElementById('char-grid');
  grid.innerHTML = chars.map(char => {
    return `
      <div class="char-card" data-char="${char.id}" title="${char.name}">
        ${characterThumb(char)}
        <span class="char-name">${char.name}</span>
      </div>
    `;
  }).join('');

  // Re-bind click event listeners to new cards
  document.querySelectorAll('.char-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedChar = card.dataset.char;
    });
  });

  // Apply initial selected character if already loaded
  document.querySelectorAll('.char-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.char === selectedChar);
  });
});

// ─── Sliders ─────────────────────────────────────────────────────────────────
const scaleSlider = document.getElementById('scale-slider');
const scaleValue = document.getElementById('scale-value');
scaleSlider.addEventListener('input', () => { scaleValue.textContent = scaleSlider.value + '%'; });

const opacitySlider = document.getElementById('opacity-slider');
const opacityValue = document.getElementById('opacity-value');
opacitySlider.addEventListener('input', () => { opacityValue.textContent = opacitySlider.value + '%'; });

const freqSlider = document.getElementById('freq-slider');
const freqValue = document.getElementById('freq-value');
freqSlider.addEventListener('input', () => { freqValue.textContent = freqLabels[freqSlider.value]; });

// ─── Save Settings ────────────────────────────────────────────────────────────
document.getElementById('btn-save').addEventListener('click', () => {
  const settings = {
    character: selectedChar,
    scale: parseInt(scaleSlider.value),
    opacity: parseInt(opacitySlider.value) / 100,
    messageFrequency: freqValues[freqSlider.value],
    alwaysOnTop: document.getElementById('toggle-ontop').checked,
    doNotDisturb: document.getElementById('toggle-dnd').checked,
    launchOnStartup: document.getElementById('toggle-startup').checked,
    nativeNotifications: document.getElementById('toggle-toasts').checked,
  };
  petdesk.send('save-settings', settings);
  const btn = document.getElementById('btn-save');
  btn.innerHTML = `${icon('check')}&nbsp; Saved!`;
  setTimeout(() => { btn.innerHTML = `<span data-icon="save">${icon('save')}</span>Save Settings`; }, 2000);
});

// ─── Load Data from Main ──────────────────────────────────────────────────────
petdesk.on('load-data', (data) => {
  deadlines = data.deadlines || [];

  // Character
  selectedChar = data.character || 'cat';
  document.querySelectorAll('.char-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.char === selectedChar);
  });

  // Sliders
  scaleSlider.value = data.scale || 100;
  scaleValue.textContent = scaleSlider.value + '%';

  opacitySlider.value = Math.round((data.opacity || 1) * 100);
  opacityValue.textContent = opacitySlider.value + '%';

  const freqIdx = freqValues.indexOf(data.messageFrequency || 'sometimes');
  freqSlider.value = freqIdx >= 0 ? freqIdx : 2;
  freqValue.textContent = freqLabels[freqSlider.value];

  // Toggles
  document.getElementById('toggle-ontop').checked = data.alwaysOnTop !== false;
  document.getElementById('toggle-dnd').checked = !!data.doNotDisturb;
  document.getElementById('toggle-startup').checked = !!data.launchOnStartup;
  document.getElementById('toggle-toasts').checked = data.nativeNotifications !== false;

  renderDeadlines();
});

function renderFocusTasks() {
  const select = document.getElementById('focus-task');
  if (!select) return;
  const active = focusTasks.filter(task => !task.completed);
  select.innerHTML = active.length
    ? active.map(task => `<option value="${escHtml(task.id)}">${escHtml(task.name)}</option>`).join('')
    : '<option value="adhoc">Ad-hoc focus session</option>';
}

function renderFocusHistory(sessions = []) {
  const target = document.getElementById('focus-history');
  if (!target) return;
  target.innerHTML = sessions.length
    ? sessions.slice().reverse().map(session => `<div class="session-row"><span>${escHtml(session.taskId)}</span><span>${Math.round(session.elapsedMs / 60000)} min · ${session.status}</span></div>`).join('')
    : '<div class="empty-state"><p>No sessions yet.</p></div>';
}

petdesk.invoke('get-tasks').then(tasks => { focusTasks = tasks; renderFocusTasks(); });
petdesk.invoke('focus-settings-get').then(settings => {
  document.getElementById('focus-monitoring').checked = settings.activityAwareness;
  document.getElementById('focus-personality').value = settings.personality;
});
petdesk.invoke('focus-history').then(renderFocusHistory);

document.getElementById('focus-start').addEventListener('click', () => {
  const allowedApps = document.getElementById('focus-apps').value.split(',').map(value => value.trim()).filter(Boolean);
  const activityAwareness = document.getElementById('focus-monitoring').checked;
  const personality = document.getElementById('focus-personality').value;
  petdesk.send('focus-settings-save', { activityAwareness, personality });
  petdesk.send('focus-start', {
    taskId: document.getElementById('focus-task').value,
    durationMs: Number(document.getElementById('focus-duration').value) * 60 * 1000,
    allowedApps,
    activityAwareness,
    personality,
  });
});
document.getElementById('focus-pause').addEventListener('click', () => {
  if (focusSnapshot?.status === 'paused') petdesk.send('focus-resume');
  else petdesk.send('focus-pause');
});
document.getElementById('focus-stop').addEventListener('click', () => petdesk.send('focus-stop'));
petdesk.on('focus-state', (snapshot) => {
  focusSnapshot = snapshot;
  document.getElementById('focus-status').textContent = `${snapshot.status} · ${Math.ceil(snapshot.remainingMs / 60000)} min remaining`;
  document.getElementById('focus-pause').textContent = snapshot.status === 'paused' ? 'Resume' : 'Pause';
});
petdesk.on('activity-status', (status) => {
  document.getElementById('focus-status').textContent = status.enabled ? 'Activity awareness is active.' : (status.available ? 'Timer is active; app awareness is off.' : 'Timer is active; Windows app awareness is unavailable.');
});
petdesk.on('focus-completed', (snapshot) => {
  focusSnapshot = snapshot;
  petdesk.invoke('focus-history').then(renderFocusHistory);
});
petdesk.on('focus-error', (error) => { document.getElementById('focus-status').textContent = `Focus error: ${error.message}`; });
