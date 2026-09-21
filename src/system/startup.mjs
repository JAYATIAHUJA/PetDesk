// startup.mjs — Launch-at-login, hidden launch and petdesk:// argv helpers
const HIDDEN_FLAG = '--hidden';
const PROTOCOL = 'petdesk';

function isHiddenLaunch(argv = process.argv) {
  return argv.includes(HIDDEN_FLAG);
}

// Options for app.setLoginItemSettings(). In development the executable is electron.exe,
// so the app path has to be passed along or Windows would launch a bare Electron shell.
function loginItemOptions({ enabled, isPackaged, execPath, appPath, portableExecutable }) {
  return {
    openAtLogin: Boolean(enabled),
    // Portable builds run from a temp extraction dir; register the real .exe instead
    path: portableExecutable || execPath,
    args: isPackaged ? [HIDDEN_FLAG] : [appPath, HIDDEN_FLAG],
  };
}

function findProtocolUrl(argv = []) {
  return argv.find(arg => typeof arg === 'string' && arg.toLowerCase().startsWith(`${PROTOCOL}://`)) || null;
}

export { HIDDEN_FLAG, PROTOCOL, isHiddenLaunch, loginItemOptions, findProtocolUrl };
