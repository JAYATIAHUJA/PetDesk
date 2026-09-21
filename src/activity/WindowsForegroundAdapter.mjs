import { EventEmitter } from 'node:events';
import path from 'node:path';
import { getForegroundWindow as nativeGetForegroundWindow } from './nativeForeground.mjs';

const POLL_INTERVAL_MS = 1000;

class WindowsForegroundAdapter extends EventEmitter {
  constructor({ getForegroundWindow = nativeGetForegroundWindow, intervalMs = POLL_INTERVAL_MS } = {}) {
    super();
    this.getForegroundWindow = getForegroundWindow;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.started = false;
  }

  start() {
    if (this.started) return Promise.resolve();
    // Probe once so a missing/broken native binding fails the start instead of every tick
    try {
      this.getForegroundWindow();
    } catch (error) {
      this.emitError('start-failed', error.message);
      return Promise.reject(error);
    }
    this.started = true;
    this.poll();
    this.timer = setInterval(() => this.poll(), this.intervalMs);
    return Promise.resolve();
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.started = false;
  }

  poll() {
    if (!this.started) return;
    try {
      const foreground = this.getForegroundWindow();
      if (!foreground) return; // nothing focused (lock screen, desktop switch)
      const exeName = foreground.exe ? path.win32.basename(foreground.exe) : '';
      this.emit('observation', {
        appId: exeName.toLowerCase(),
        appName: exeName ? exeName.replace(/\.exe$/i, '') : 'Unknown',
        windowTitle: String(foreground.title || ''),
        observedAt: Date.now(),
      });
    } catch (error) {
      this.emitError('poll-failed', error.message);
    }
  }

  emitError(code, message) {
    this.emit('error', { code, message });
  }
}

class ActivityMonitor extends EventEmitter {
  constructor({ adapter } = {}) {
    super();
    if (!adapter) throw new TypeError('ActivityMonitor requires an adapter');
    this.adapter = adapter;
    this.running = false;
    this.handleObservation = observation => this.emit('observation', observation);
    this.handleError = error => this.emit('error', error);
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.adapter.on('observation', this.handleObservation);
    this.adapter.on('error', this.handleError);
    try {
      await this.adapter.start();
    } catch (error) {
      this.running = false;
      this.adapter.off('observation', this.handleObservation);
      this.adapter.off('error', this.handleError);
      this.emit('error', { code: 'monitor-start-failed', message: error.message });
    }
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    this.adapter.off('observation', this.handleObservation);
    this.adapter.off('error', this.handleError);
    await this.adapter.stop();
  }

  isRunning() { return this.running; }
}

export { WindowsForegroundAdapter, ActivityMonitor };
