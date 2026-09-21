const MESSAGES = {
  gentle: {
    encourage: ['You are doing well. Keep going.', 'Nice progress. One small step at a time.'],
    ask: app => `Is ${app} part of your task? You can return, pause, or allow it for this session.`,
    complete: 'You did it. I am proud of that progress.',
  },
  coach: {
    encourage: ['Good work. Stay with it for one more minute.', 'You chose this task. Keep your promise to yourself.'],
    ask: app => `${app} is outside this session. Return to the task, pause, or allow it temporarily.`,
    complete: 'Session complete. That was disciplined work.',
  },
  playful: {
    encourage: ['Tiny focus points collected. Keep the streak alive.', 'Your future self just sent a high five.'],
    ask: app => `A wild ${app} appeared. Is it part of the mission?`,
    complete: 'Quest complete. Excellent work, human.',
  },
};

class PetCoach {
  constructor({ personality = 'gentle', random = Math.random } = {}) {
    this.personality = MESSAGES[personality] ? personality : 'gentle';
    this.random = random;
  }

  messageFor(decision, context = {}) {
    if (!decision || decision.type === 'silent') return null;
    const messages = MESSAGES[this.personality];
    if (decision.type === 'ask-distraction') {
      const app = escapeHtml(context.appName || decision.appId || 'that app');
      return { text: messages.ask(app), state: 'annoyed', durationMs: 0 };
    }
    if (decision.type === 'encourage') {
      const lines = messages.encourage;
      return { text: lines[Math.floor(this.random() * lines.length)], state: 'happy', durationMs: 3500 };
    }
    if (decision.type === 'break-reminder') {
      return { text: 'You have been focused for a while. Take a short break if you need one.', state: 'idle', durationMs: 4500 };
    }
    if (decision.type === 'completed') {
      return { text: messages.complete, state: 'happy', durationMs: 4500 };
    }
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default PetCoach;
