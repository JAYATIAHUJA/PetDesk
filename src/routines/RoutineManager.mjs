import crypto from 'node:crypto';

const PERSONALITIES = new Set(['gentle', 'coach', 'playful']);

function cloneRoutine(routine) {
  return {
    ...routine,
    allowedApps: Array.isArray(routine.allowedApps) ? [...routine.allowedApps] : [],
  };
}

function normalizeDuration(value) {
  const duration = Number(value);
  if (!Number.isInteger(duration) || duration < 1 || duration > 240) {
    throw new RangeError('Routine duration must be between 1 and 240 minutes');
  }
  return duration;
}

function normalizeAllowedApps(value) {
  const apps = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(apps.map(app => String(app).trim().toLowerCase()).filter(Boolean))];
}

function normalizeRoutine(input = {}) {
  if (typeof input.name !== 'string' || !input.name.trim()) {
    throw new TypeError('Routine name must be a non-empty string');
  }

  return {
    name: input.name.trim(),
    taskId: typeof input.taskId === 'string' && input.taskId.trim() ? input.taskId.trim() : 'adhoc',
    durationMinutes: normalizeDuration(input.durationMinutes),
    allowedApps: normalizeAllowedApps(input.allowedApps),
    activityAwareness: input.activityAwareness === true,
    personality: PERSONALITIES.has(input.personality) ? input.personality : 'gentle',
  };
}

class RoutineManager {
  constructor(store) {
    if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') {
      throw new TypeError('RoutineManager requires a store with get and set methods');
    }
    this.store = store;
  }

  list() {
    const routines = this.store.get('focusRoutines');
    return Array.isArray(routines) ? routines.map(cloneRoutine) : [];
  }

  create(input) {
    const routine = {
      id: `routine_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      ...normalizeRoutine(input),
      createdAt: new Date().toISOString(),
    };
    this.save([...this.list(), routine]);
    return cloneRoutine(routine);
  }

  update(id, input) {
    const routines = this.list();
    const index = routines.findIndex(routine => routine.id === id);
    if (index === -1) throw new Error('Routine not found');

    const updated = {
      id: routines[index].id,
      createdAt: routines[index].createdAt,
      ...normalizeRoutine(input),
    };
    routines[index] = updated;
    this.save(routines);
    return cloneRoutine(updated);
  }

  remove(id) {
    const remaining = this.list().filter(routine => routine.id !== id);
    this.save(remaining);
    return remaining.map(cloneRoutine);
  }

  save(routines) {
    this.store.set('focusRoutines', routines.map(cloneRoutine));
  }
}

export default RoutineManager;
