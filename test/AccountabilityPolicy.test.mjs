import test from 'node:test';
import assert from 'node:assert/strict';
import AccountabilityPolicy from '../src/accountability/AccountabilityPolicy.mjs';
import PetCoach from '../src/accountability/PetCoach.mjs';

const runningSession = (allowedApps = ['code.exe']) => ({ status: 'running', allowedApps });

test('allowed applications remain silent', () => {
  const policy = new AccountabilityPolicy();
  assert.equal(policy.evaluate({ session: runningSession(), observation: { appId: 'Code.exe' } }).type, 'silent');
});

test('empty allowlist provides encouragement and never labels an app distracting', () => {
  const policy = new AccountabilityPolicy();
  const decision = policy.evaluate({ session: runningSession([]), observation: { appId: 'youtube.exe' } });
  assert.equal(decision.type, 'encourage');
});

test('outside applications produce a distraction prompt', () => {
  const clock = { value: 1000 };
  const policy = new AccountabilityPolicy({ clock: () => clock.value, cooldownMs: 100 });
  const decision = policy.evaluate({ session: runningSession(), observation: { appId: 'youtube.exe' } });
  assert.equal(decision.type, 'ask-distraction');
  assert.equal(decision.reason, 'outside-allowlist');
});

test('repeated prompts are suppressed during cooldown', () => {
  const clock = { value: 1000 };
  const policy = new AccountabilityPolicy({ clock: () => clock.value, cooldownMs: 100 });
  const input = { session: runningSession(), observation: { appId: 'youtube.exe' } };
  assert.equal(policy.evaluate(input).type, 'ask-distraction');
  assert.equal(policy.evaluate(input).type, 'silent');
  clock.value += 101;
  assert.equal(policy.evaluate(input).type, 'ask-distraction');
});

test('inactive sessions and unknown observations remain silent', () => {
  const policy = new AccountabilityPolicy();
  assert.equal(policy.evaluate({ session: { status: 'paused' }, observation: { appId: 'x' } }).type, 'silent');
  assert.equal(policy.evaluate({ session: runningSession(), observation: {} }).type, 'silent');
});

test('PetCoach escapes application names in prompts', () => {
  const coach = new PetCoach({ personality: 'gentle' });
  const message = coach.messageFor({ type: 'ask-distraction', appId: 'x' }, { appName: '<unsafe>' });
  assert.match(message.text, /&lt;unsafe&gt;/);
  assert.equal(message.state, 'annoyed');
});
