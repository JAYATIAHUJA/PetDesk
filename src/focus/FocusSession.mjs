import crypto from 'node:crypto';

class FocusSession {
  constructor({ clock = Date.now, onEvent = () => {} } = {}) {
    this.clock = clock;
    this.onEvent = onEvent;
    this.state = {
      id: null,
      taskId: null,
      status: 'idle',
      durationMs: 0,
      elapsedMs: 0,
      remainingMs: 0,
      allowedApps: [],
      activityAwareness: false,
      startedAt: null,
      pausedAt: null,
      endedAt: null,
      endReason: null,
    };
    this.lastRunningAt = null;
  }

  start({ taskId, durationMs, allowedApps = [], activityAwareness = false } = {}) {
    if (this.state.status !== 'idle') return null;
    if (!taskId || !Number.isFinite(durationMs) || durationMs <= 0) {
      throw new TypeError('A task ID and positive duration are required');
    }

    const now = this.clock();
    this.state = {
      ...this.state,
      id: `focus_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      taskId,
      status: 'running',
      durationMs,
      elapsedMs: 0,
      remainingMs: durationMs,
      allowedApps: Array.isArray(allowedApps) ? [...allowedApps] : [],
      activityAwareness: Boolean(activityAwareness),
      startedAt: now,
      pausedAt: null,
      endedAt: null,
      endReason: null,
    };
    this.lastRunningAt = now;
    this.emit('session-started');
    return this.snapshot();
  }

  pause() {
    if (this.state.status !== 'running') return null;
    this.updateElapsed();
    this.state.status = 'paused';
    this.state.pausedAt = this.clock();
    this.lastRunningAt = null;
    this.emit('session-paused');
    return this.snapshot();
  }

  resume() {
    if (this.state.status !== 'paused') return null;
    const now = this.clock();
    this.state.status = 'running';
    this.state.pausedAt = null;
    this.lastRunningAt = now;
    this.emit('session-resumed');
    return this.snapshot();
  }

  stop(reason = 'cancelled') {
    if (!['running', 'paused'].includes(this.state.status)) return null;
    if (this.state.status === 'running') this.updateElapsed();
    this.finish('cancelled', reason, 'session-stopped');
    return this.snapshot();
  }

  complete() {
    if (!['running', 'paused'].includes(this.state.status)) return null;
    if (this.state.status === 'running') this.updateElapsed();
    this.state.elapsedMs = this.state.durationMs;
    this.state.remainingMs = 0;
    this.finish('completed', 'manual-complete', 'session-completed');
    return this.snapshot();
  }

  tick() {
    if (this.state.status !== 'running') return this.snapshot();
    this.updateElapsed();
    if (this.state.elapsedMs >= this.state.durationMs) {
      this.state.elapsedMs = this.state.durationMs;
      this.state.remainingMs = 0;
      this.finish('completed', 'duration-complete', 'session-completed');
    } else {
      this.emit('session-tick');
    }
    return this.snapshot();
  }

  snapshot() {
    return {
      ...this.state,
      allowedApps: [...this.state.allowedApps],
    };
  }

  allowApp(appId) {
    if (!appId || !['running', 'paused'].includes(this.state.status)) return this.snapshot();
    this.state.allowedApps = [...new Set([...this.state.allowedApps, String(appId).toLowerCase()])];
    return this.snapshot();
  }

  updateElapsed() {
    if (this.state.status !== 'running' || this.lastRunningAt === null) return;
    const now = this.clock();
    this.state.elapsedMs += Math.max(0, now - this.lastRunningAt);
    this.state.remainingMs = Math.max(0, this.state.durationMs - this.state.elapsedMs);
    this.lastRunningAt = now;
  }

  finish(status, reason, eventType) {
    this.state.status = status;
    this.state.endedAt = this.clock();
    this.state.endReason = reason;
    this.state.remainingMs = Math.max(0, this.state.durationMs - this.state.elapsedMs);
    this.lastRunningAt = null;
    this.emit(eventType);
  }

  emit(type) {
    this.onEvent({ type, snapshot: this.snapshot() });
  }
}

export default FocusSession;
