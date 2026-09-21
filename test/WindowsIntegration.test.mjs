import test from 'node:test';
import assert from 'node:assert/strict';
import { isHiddenLaunch, loginItemOptions, findProtocolUrl } from '../src/system/startup.mjs';
import { shouldNotify, RENOTIFY_MS } from '../scheduler.mjs';

test('isHiddenLaunch detects the --hidden flag', () => {
  assert.equal(isHiddenLaunch(['PetDesk.exe', '--hidden']), true);
  assert.equal(isHiddenLaunch(['PetDesk.exe']), false);
});

test('loginItemOptions registers the packaged exe to start hidden', () => {
  assert.deepEqual(
    loginItemOptions({ enabled: true, isPackaged: true, execPath: 'C:\\Apps\\PetDesk.exe', appPath: 'C:\\Apps\\resources\\app.asar' }),
    { openAtLogin: true, path: 'C:\\Apps\\PetDesk.exe', args: ['--hidden'] },
  );
});

test('loginItemOptions passes the app path in development and prefers the portable exe', () => {
  const dev = loginItemOptions({ enabled: false, isPackaged: false, execPath: 'electron.exe', appPath: 'C:\\src\\petdesk' });
  assert.deepEqual(dev, { openAtLogin: false, path: 'electron.exe', args: ['C:\\src\\petdesk', '--hidden'] });

  const portable = loginItemOptions({ enabled: true, isPackaged: true, execPath: 'C:\\Temp\\x\\PetDesk.exe', portableExecutable: 'D:\\PetDesk-portable.exe' });
  assert.equal(portable.path, 'D:\\PetDesk-portable.exe');
});

test('findProtocolUrl picks the petdesk:// argument out of argv', () => {
  assert.equal(findProtocolUrl(['PetDesk.exe', '--flag', 'PetDesk://done?id=1']), 'PetDesk://done?id=1');
  assert.equal(findProtocolUrl(['PetDesk.exe', '--hidden']), null);
});

test('shouldNotify re-sends a toast only on escalation or after the renotify window', () => {
  const now = 1_000_000;
  assert.equal(shouldNotify(undefined, 'warning', now), true);
  assert.equal(shouldNotify({ type: 'warning', at: now - 60000 }, 'warning', now), false);
  assert.equal(shouldNotify({ type: 'warning', at: now - 60000 }, 'urgent', now), true);
  assert.equal(shouldNotify({ type: 'urgent', at: now - RENOTIFY_MS }, 'urgent', now), true);
});
