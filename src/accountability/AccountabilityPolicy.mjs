class AccountabilityPolicy {
  constructor({ clock = Date.now, cooldownMs = 120000 } = {}) {
    this.clock = clock;
    this.cooldownMs = cooldownMs;
    this.lastPromptByApp = new Map();
  }

  evaluate({ session, observation } = {}) {
    if (!session || session.status !== 'running') return { type: 'silent', reason: 'session-inactive' };
    if (!observation || (!observation.appId && !observation.appName)) return { type: 'silent', reason: 'unknown-app' };

    const allowedApps = Array.isArray(session.allowedApps) ? session.allowedApps : [];
    if (allowedApps.length === 0) {
      return { type: 'encourage', reason: 'encouragement-only' };
    }

    const appId = normalize(observation.appId);
    const appName = normalize(observation.appName);
    const allowed = allowedApps.some(value => {
      const candidate = normalize(value);
      return candidate === appId || candidate === appName;
    });

    if (allowed) return { type: 'silent', reason: 'allowed-app', appId };

    const now = this.clock();
    const lastPrompt = this.lastPromptByApp.get(appId || appName) || 0;
    if (now < lastPrompt + this.cooldownMs) {
      return { type: 'silent', reason: 'cooldown', appId };
    }

    const nextAllowedAt = now + this.cooldownMs;
    this.lastPromptByApp.set(appId || appName, now);
    return { type: 'ask-distraction', reason: 'outside-allowlist', appId, nextAllowedAt };
  }
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export default AccountabilityPolicy;
