// main.js — Electron main process for PetDesk
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, Notification } from 'electron';
import Store from 'electron-store';
import scheduler from './scheduler.mjs';
import { loadCharacters } from './src/utils/CharacterLoader.mjs';
import TaskManager from './src/tasks/TaskManager.mjs';
import FocusSession from './src/focus/FocusSession.mjs';
import FocusSessionStore from './src/focus/FocusSessionStore.mjs';
import AccountabilityPolicy from './src/accountability/AccountabilityPolicy.mjs';
import PetCoach from './src/accountability/PetCoach.mjs';
import { WindowsForegroundAdapter, ActivityMonitor } from './src/activity/WindowsForegroundAdapter.mjs';
import { NativeNotifier, parseActionUrl } from './src/notifications/NativeNotifier.mjs';
import { PROTOCOL, isHiddenLaunch, loginItemOptions, findProtocolUrl } from './src/system/startup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ID = 'com.petdesk.app';

// Toasts are attributed to (and activated through) this AppUserModelID; it must match build.appId
app.setAppUserModelId(APP_ID);

// One pet per desktop. A second launch (shortcut double-click, toast button) is forwarded to the first.
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();

// Load characters configuration
const charactersList = Object.values(loadCharacters(__dirname));

const store = new Store({
  defaults: {
    character: 'pikachu',
    scale: 100,
    opacity: 1.0,
    messageFrequency: 'sometimes', // never / rarely / sometimes / often
    launchOnStartup: false,
    nativeNotifications: true,
    toastToken: '',
    doNotDisturb: false,
    alwaysOnTop: true,
    deadlines: [],
    focusSessions: [],
    focusSettings: {
      activityAwareness: false,
      personality: 'gentle',
      cooldownMs: 120000,
    },
    petPosition: { x: 100, y: null }, // null y = bottom of screen
  }
});

let petWindow = null;
let settingsWindow = null;
let tray = null;
let rebuildTrayMenu = () => {};
const launchedHidden = isHiddenLaunch();

// Secret baked into toast button URLs so only our own toasts can trigger petdesk:// actions
if (!store.get('toastToken')) store.set('toastToken', crypto.randomBytes(16).toString('hex'));

const notifier = new NativeNotifier({
  Notification,
  token: store.get('toastToken'),
  isEnabled: () => store.get('nativeNotifications') !== false,
  getPetEmoji: () => charactersList.find(char => char.id === store.get('character'))?.emoji || '🐾',
});
const taskManager = new TaskManager(store);
const focusStore = new FocusSessionStore(store);
let activeSession = null;
let focusTimer = null;
let activityMonitor = null;
let activityAdapter = null;
let accountabilityPolicy = null;
let petCoach = null;

// ─── Pet Window ────────────────────────────────────────────────────────────────

function createPetWindow() {
  const { width, height } = screen.getPrimaryDisplay().bounds;

  petWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: store.get('alwaysOnTop'),
    skipTaskbar: true,
    hasShadow: false,
    show: !launchedHidden,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
  });

  petWindow.loadFile('index.html');

  // Start click-through by default
  petWindow.setIgnoreMouseEvents(true, { forward: true });

  petWindow.webContents.on('did-finish-load', () => {
    const primaryDisplay = screen.getPrimaryDisplay();
    petWindow.webContents.send('init', {
      character: store.get('character'),
      scale: store.get('scale'),
      opacity: store.get('opacity'),
      doNotDisturb: store.get('doNotDisturb'),
      screenWidth: primaryDisplay.bounds.width,
      screenHeight: primaryDisplay.bounds.height,
      workArea: primaryDisplay.workArea,
      charactersList: charactersList
    });
    scheduler.start(store, petWindow, { notifier });
  });

  petWindow.webContents.on('render-process-gone', () => {
    stopActivityMonitoring();
  });
}

// Electron already runs per-monitor DPI aware (v2) on Windows and reports display bounds in DIPs,
// so no scale-factor switches are needed. What the overlay does need is to follow the primary
// display when its resolution, scaling or arrangement changes.
function syncPetWindowToDisplay() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const primaryDisplay = screen.getPrimaryDisplay();
  petWindow.setBounds(primaryDisplay.bounds);
  sendToPet('display-changed', {
    screenWidth: primaryDisplay.bounds.width,
    screenHeight: primaryDisplay.bounds.height,
    workArea: primaryDisplay.workArea,
  });
}

function showPet() {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (!petWindow.isVisible()) petWindow.showInactive();
  if (store.get('alwaysOnTop')) petWindow.moveTop();
  rebuildTrayMenu();
}

// ─── Settings Window ───────────────────────────────────────────────────────────

function settingsPayload(deadlines = store.get('deadlines')) {
  return {
    deadlines,
    character: store.get('character'),
    scale: store.get('scale'),
    opacity: store.get('opacity'),
    messageFrequency: store.get('messageFrequency'),
    doNotDisturb: store.get('doNotDisturb'),
    alwaysOnTop: store.get('alwaysOnTop'),
    launchOnStartup: isLaunchOnStartupEnabled(),
    nativeNotifications: store.get('nativeNotifications'),
  };
}

function createSettingsWindow() {
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 680,
    height: 780,
    title: 'PetDesk Settings',
    resizable: false,
    autoHideMenuBar: true,
    frame: false, // the page header is the title bar (drag region + its own window buttons)
    backgroundColor: '#0f0f1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  settingsWindow.loadFile('settings.html');

  settingsWindow.webContents.on('did-finish-load', () => {
    settingsWindow.webContents.send('load-data', settingsPayload());
  });

  settingsWindow.on('closed', () => { settingsWindow = null; });
}

// ─── Launch at Login ───────────────────────────────────────────────────────────

function startupOptions(enabled) {
  return loginItemOptions({
    enabled,
    isPackaged: app.isPackaged,
    execPath: process.execPath,
    appPath: app.getAppPath(),
    portableExecutable: process.env.PORTABLE_EXECUTABLE_FILE,
  });
}

function applyLaunchOnStartup(enabled) {
  if (process.platform === 'linux') return; // setLoginItemSettings is Windows/macOS only
  app.setLoginItemSettings(startupOptions(enabled));
}

// Ask the OS rather than the store, so the toggle reflects Task Manager → Startup apps
function isLaunchOnStartupEnabled() {
  if (process.platform === 'linux') return false;
  const { path: exePath, args } = startupOptions(true);
  return app.getLoginItemSettings({ path: exePath, args }).openAtLogin;
}

// ─── System Tray ───────────────────────────────────────────────────────────────

function createTray() {
  // Fallback: use empty nativeImage if no icon found
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray-icon.png'));

  tray = new Tray(icon);
  tray.setToolTip('PetDesk');

  const buildMenu = () => Menu.buildFromTemplate([
    { label: '🐾 PetDesk', enabled: false },
    { type: 'separator' },
    { label: '➕ Add Deadline', click: () => { createSettingsWindow(); } },
    { label: '⚙️  Settings', click: () => { createSettingsWindow(); } },
    { type: 'separator' },
    {
      label: petWindow?.isVisible() ? '🙈 Hide Pet' : '🐾 Show Pet',
      click: () => {
        if (petWindow?.isVisible()) petWindow.hide();
        else showPet();
        tray.setContextMenu(buildMenu());
      }
    },
    {
      label: store.get('doNotDisturb') ? '🔔 Resume Notifications' : '🔕 Do Not Disturb',
      click: () => {
        const current = store.get('doNotDisturb');
        store.set('doNotDisturb', !current);
        petWindow?.webContents.send('dnd-changed', !current);
        tray.setContextMenu(buildMenu());
      }
    },
    {
      label: store.get('alwaysOnTop') ? '📌 Unpin from Top' : '📌 Always on Top',
      click: () => {
        const current = store.get('alwaysOnTop');
        store.set('alwaysOnTop', !current);
        petWindow?.setAlwaysOnTop(!current);
        tray.setContextMenu(buildMenu());
      }
    },
    { type: 'separator' },
    { label: '❌ Quit PetDesk', click: () => app.quit() },
  ]);

  rebuildTrayMenu = () => tray.setContextMenu(buildMenu());
  rebuildTrayMenu();
  tray.on('double-click', () => createSettingsWindow());
}

function sendToPet(channel, payload) {
  if (petWindow && !petWindow.isDestroyed() && !petWindow.webContents.isCrashed()) {
    petWindow.webContents.send(channel, payload);
  }
}

async function stopActivityMonitoring() {
  if (focusTimer) {
    clearInterval(focusTimer);
    focusTimer = null;
  }
  if (activityMonitor) {
    await activityMonitor.stop();
    activityMonitor = null;
  }
  activityAdapter = null;
  sendToPet('activity-status', { enabled: false, available: process.platform === 'win32' });
}

function persistCompletedSession(snapshot) {
  if (snapshot.status === 'completed') {
    focusStore.saveSummary(snapshot);
  }
}

function handleSessionEvent(event) {
  sendToPet('focus-state', event.snapshot);
  if (['session-completed', 'session-stopped'].includes(event.type)) {
    persistCompletedSession(event.snapshot);
    stopActivityMonitoring();
    if (event.type === 'session-completed') notifier.focusCompleted(event.snapshot);
    sendToPet(event.type === 'session-completed' ? 'focus-completed' : 'focus-stopped', event.snapshot);
  }
}

async function startFocusSession(options) {
  if (activeSession && ['running', 'paused'].includes(activeSession.snapshot().status)) {
    return activeSession.snapshot();
  }

  const settings = focusStore.getSettings();
  const personality = options.personality || settings.personality;
  accountabilityPolicy = new AccountabilityPolicy({ cooldownMs: settings.cooldownMs });
  petCoach = new PetCoach({ personality });
  activeSession = new FocusSession({ onEvent: handleSessionEvent });
  const snapshot = activeSession.start({
    taskId: options.taskId,
    durationMs: options.durationMs,
    allowedApps: options.allowedApps,
    activityAwareness: Boolean(options.activityAwareness && settings.activityAwareness),
  });

  focusTimer = setInterval(() => {
    if (!activeSession) return;
    activeSession.tick();
    if (['completed', 'cancelled'].includes(activeSession.snapshot().status)) {
      stopActivityMonitoring();
    }
  }, 1000);

  if (snapshot.activityAwareness && process.platform === 'win32') {
    activityAdapter = new WindowsForegroundAdapter();
    activityMonitor = new ActivityMonitor({ adapter: activityAdapter });
    activityMonitor.on('observation', observation => {
      if (!activeSession || activeSession.snapshot().status !== 'running') return;
      const decision = accountabilityPolicy.evaluate({ session: activeSession.snapshot(), observation });
      const coaching = petCoach.messageFor(decision, observation);
      if (coaching) sendToPet('coaching-prompt', { ...coaching, reason: decision.reason, appId: decision.appId });
    });
    activityMonitor.on('error', error => {
      sendToPet('activity-status', { enabled: false, available: false, error: error.message });
    });
    await activityMonitor.start();
    sendToPet('activity-status', { enabled: activityMonitor.isRunning(), available: true });
  } else {
    sendToPet('activity-status', { enabled: false, available: process.platform === 'win32' });
  }

  sendToPet('focus-state', snapshot);
  return snapshot;
}

async function pauseFocusSession() {
  if (!activeSession) return null;
  const snapshot = activeSession.pause();
  if (snapshot) await stopActivityMonitoring();
  return snapshot;
}

async function resumeFocusSession() {
  if (!activeSession) return null;
  const snapshot = activeSession.resume();
  if (snapshot && snapshot.activityAwareness && process.platform === 'win32') {
    activityAdapter = new WindowsForegroundAdapter();
    activityMonitor = new ActivityMonitor({ adapter: activityAdapter });
    activityMonitor.on('observation', observation => {
      if (!activeSession || activeSession.snapshot().status !== 'running') return;
      const decision = accountabilityPolicy.evaluate({ session: activeSession.snapshot(), observation });
      const coaching = petCoach.messageFor(decision, observation);
      if (coaching) sendToPet('coaching-prompt', { ...coaching, reason: decision.reason, appId: decision.appId });
    });
    activityMonitor.on('error', error => sendToPet('activity-status', { enabled: false, available: false, error: error.message }));
    await activityMonitor.start();
    sendToPet('activity-status', { enabled: activityMonitor.isRunning(), available: true });
  }
  return snapshot;
}

// ─── IPC Handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('get-characters', () => {
  return charactersList;
});

ipcMain.handle('get-tasks', () => taskManager.list());

ipcMain.on('create-task', (_, task) => {
  taskManager.create(task);
  scheduler.refresh(store);
  settingsWindow?.webContents.send('tasks-updated', taskManager.list());
});

ipcMain.on('complete-task', (_, taskId) => {
  taskManager.complete(taskId);
  scheduler.refresh(store);
  settingsWindow?.webContents.send('tasks-updated', taskManager.list());
});

ipcMain.on('delete-task', (_, taskId) => {
  taskManager.remove(taskId);
  scheduler.refresh(store);
  settingsWindow?.webContents.send('tasks-updated', taskManager.list());
});

ipcMain.on('focus-start', async (_, options = {}) => {
  try {
    await startFocusSession({
      taskId: String(options.taskId || ''),
      durationMs: Number(options.durationMs),
      allowedApps: Array.isArray(options.allowedApps) ? options.allowedApps.map(String) : [],
      activityAwareness: Boolean(options.activityAwareness),
      personality: options.personality,
    });
  } catch (error) {
    sendToPet('focus-error', { message: error.message });
    settingsWindow?.webContents.send('focus-error', { message: error.message });
  }
});

ipcMain.on('focus-pause', async () => { await pauseFocusSession(); });
ipcMain.on('focus-resume', async () => { await resumeFocusSession(); });
ipcMain.on('focus-stop', async () => {
  if (activeSession) activeSession.stop('user-cancelled');
  await stopActivityMonitoring();
});
ipcMain.on('focus-complete', async () => {
  if (activeSession) activeSession.complete();
  await stopActivityMonitoring();
});
ipcMain.handle('focus-settings-get', () => focusStore.getSettings());
ipcMain.on('focus-settings-save', (_, settings) => {
  const saved = focusStore.saveSettings(settings);
  petCoach = new PetCoach({ personality: saved.personality });
  sendToPet('focus-settings', saved);
});
ipcMain.handle('focus-history', () => focusStore.listSummaries());
ipcMain.on('focus-history-clear', () => focusStore.clearHistory());
ipcMain.on('focus-allow-app', (_, appId) => {
  if (!activeSession || activeSession.snapshot().status !== 'running') return;
  sendToPet('focus-state', activeSession.allowApp(appId));
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});

ipcMain.on('save-deadlines', (_, deadlines) => {
  taskManager.replace(deadlines);
  scheduler.refresh(store);
});

const SAVABLE_SETTINGS = [
  'character', 'scale', 'opacity', 'messageFrequency', 'alwaysOnTop',
  'doNotDisturb', 'launchOnStartup', 'nativeNotifications',
];

ipcMain.on('save-settings', (_, incoming = {}) => {
  const settings = Object.fromEntries(Object.entries(incoming).filter(([key]) => SAVABLE_SETTINGS.includes(key)));
  const previousDnd = store.get('doNotDisturb');

  Object.entries(settings).forEach(([k, v]) => store.set(k, v));

  if ('launchOnStartup' in settings) applyLaunchOnStartup(settings.launchOnStartup);
  if ('alwaysOnTop' in settings) petWindow?.setAlwaysOnTop(Boolean(settings.alwaysOnTop));
  if ('doNotDisturb' in settings && Boolean(settings.doNotDisturb) !== Boolean(previousDnd)) {
    sendToPet('dnd-changed', Boolean(settings.doNotDisturb));
  }

  sendToPet('settings-updated', settings);
  rebuildTrayMenu();
  scheduler.refresh(store);
});

ipcMain.on('dismiss-alert', (_, deadlineId) => {
  scheduler.dismiss(deadlineId);
});

ipcMain.on('snooze-alert', (_, { deadlineId, minutes }) => {
  scheduler.snooze(deadlineId, minutes);
});

function completeDeadline(deadlineId) {
  const deadlines = taskManager.remove(deadlineId);
  sendToPet('celebrate');

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('load-data', settingsPayload(deadlines));
  }
  scheduler.refresh(store);
}

ipcMain.on('complete-deadline', (_, deadlineId) => completeDeadline(deadlineId));

ipcMain.on('open-settings', () => createSettingsWindow());

// Window buttons of the frameless Settings window
ipcMain.on('window-control', (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed() || win === petWindow) return;
  if (action === 'minimize') win.minimize();
  else if (action === 'close') win.close();
});

ipcMain.on('show-native-notification', (_, { title, body }) => {
  new Notification({ title, body }).show();
});

// ─── Toast / Protocol Activation ───────────────────────────────────────────────

// Handles petdesk:// URLs produced by toast bodies and buttons (see NativeNotifier)
function handleProtocolUrl(rawUrl) {
  const request = parseActionUrl(rawUrl, store.get('toastToken'));
  if (!request) return;

  if (request.action === 'open') {
    showPet();
    createSettingsWindow();
    return;
  }

  if (!taskManager.list().some(task => task.id === request.id)) return; // stale toast
  if (request.action === 'done') {
    completeDeadline(request.id);
  } else if (request.action === 'snooze') {
    scheduler.snooze(request.id, 30);
    sendToPet('alert-cleared', { id: request.id, snoozedMinutes: 30 });
  }
}

function registerProtocol() {
  if (app.isPackaged) app.setAsDefaultProtocolClient(PROTOCOL);
  else app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [app.getAppPath()]);
}

// ─── App Lifecycle ─────────────────────────────────────────────────────────────

app.on('second-instance', (_event, argv) => {
  const url = findProtocolUrl(argv);
  if (url) {
    handleProtocolUrl(url);
    return;
  }
  // Plain relaunch (e.g. shortcut double-click): surface the pet that is already running
  showPet();
  sendToPet('show-message', { text: "I'm already here! 🐾", category: 'checkin' });
});

app.whenReady().then(() => {
  if (!hasInstanceLock) return;

  registerProtocol();
  createPetWindow();
  createTray();

  screen.on('display-metrics-changed', syncPetWindowToDisplay);
  screen.on('display-added', syncPetWindowToDisplay);
  screen.on('display-removed', syncPetWindowToDisplay);

  // Launched by a toast button while PetDesk was not running
  const launchUrl = findProtocolUrl(process.argv);
  if (launchUrl) petWindow.webContents.once('did-finish-load', () => handleProtocolUrl(launchUrl));
});

app.on('window-all-closed', (e) => {
  // Keep app alive even when settings window is closed
  e.preventDefault();
});

app.on('before-quit', () => {
  scheduler.stop();
  stopActivityMonitoring();
});
