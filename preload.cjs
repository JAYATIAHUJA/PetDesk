// preload.cjs — contextBridge API for PetDesk renderers (sandboxed preloads must be CommonJS).
// Renderers get no Node/Electron access; only these allow-listed IPC channels.
const { contextBridge, ipcRenderer } = require('electron');

const SEND_CHANNELS = new Set([
  'create-task', 'complete-task', 'delete-task',
  'save-deadlines', 'save-settings', 'open-settings',
  'dismiss-alert', 'snooze-alert', 'complete-deadline',
  'focus-start', 'focus-pause', 'focus-resume', 'focus-stop', 'focus-complete',
  'focus-settings-save', 'focus-history-clear', 'focus-allow-app',
  'set-ignore-mouse-events', 'show-native-notification', 'window-control',
]);

const INVOKE_CHANNELS = new Set(['get-characters', 'get-tasks', 'focus-settings-get', 'focus-history']);

const RECEIVE_CHANNELS = new Set([
  'init', 'load-data', 'settings-updated', 'tasks-updated', 'display-changed',
  'deadline-alert', 'alert-cleared', 'show-message', 'celebrate', 'dnd-changed',
  'focus-state', 'focus-settings', 'focus-completed', 'focus-stopped', 'focus-error',
  'activity-status', 'coaching-prompt',
]);

function assertAllowed(channels, channel) {
  if (!channels.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
}

contextBridge.exposeInMainWorld('petdesk', {
  send(channel, ...args) {
    assertAllowed(SEND_CHANNELS, channel);
    ipcRenderer.send(channel, ...args);
  },
  invoke(channel, ...args) {
    assertAllowed(INVOKE_CHANNELS, channel);
    return ipcRenderer.invoke(channel, ...args);
  },
  // Listeners receive the payload only (never the IpcRendererEvent). Returns an unsubscribe function.
  on(channel, listener) {
    assertAllowed(RECEIVE_CHANNELS, channel);
    const wrapped = (_event, ...args) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});
