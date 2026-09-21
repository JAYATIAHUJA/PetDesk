class FocusSessionStore {
  constructor(store) {
    if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') {
      throw new TypeError('FocusSessionStore requires a store with get and set methods');
    }
    this.store = store;
  }

  listSummaries() {
    const sessions = this.store.get('focusSessions');
    return Array.isArray(sessions) ? sessions.map(session => ({ ...session })) : [];
  }

  saveSummary(summary) {
    const safeSummary = {
      id: summary.id,
      taskId: summary.taskId,
      status: summary.status,
      durationMs: summary.durationMs,
      elapsedMs: summary.elapsedMs,
      startedAt: summary.startedAt,
      endedAt: summary.endedAt,
      endReason: summary.endReason,
    };
    this.store.set('focusSessions', [...this.listSummaries(), safeSummary]);
    return { ...safeSummary };
  }

  getSettings() {
    return {
      activityAwareness: this.store.get('focusSettings.activityAwareness') === true,
      personality: this.store.get('focusSettings.personality') || 'gentle',
      cooldownMs: this.store.get('focusSettings.cooldownMs') || 120000,
    };
  }

  saveSettings(settings = {}) {
    const next = {
      activityAwareness: Boolean(settings.activityAwareness),
      personality: ['gentle', 'coach', 'playful'].includes(settings.personality)
        ? settings.personality
        : 'gentle',
      cooldownMs: Number.isFinite(settings.cooldownMs) && settings.cooldownMs >= 0
        ? settings.cooldownMs
        : 120000,
    };
    this.store.set('focusSettings', next);
    return { ...next };
  }

  clearHistory() {
    this.store.set('focusSessions', []);
  }
}

export default FocusSessionStore;
