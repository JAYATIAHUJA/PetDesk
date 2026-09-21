import crypto from 'node:crypto';

class TaskManager {
  constructor(store) {
    if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') {
      throw new TypeError('TaskManager requires a store with get and set methods');
    }
    this.store = store;
  }

  list() {
    const tasks = this.store.get('deadlines');
    return Array.isArray(tasks) ? tasks.map(task => ({ ...task })) : [];
  }

  create({ name, date = '', time = '', note = '' } = {}) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new TypeError('Task name must be a non-empty string');
    }

    const task = {
      id: `dl_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      name: name.trim(),
      date,
      time,
      note: typeof note === 'string' ? note.trim() : '',
      completed: false,
      created: new Date().toISOString(),
    };

    return this.replace([...this.list(), task]).at(-1);
  }

  complete(id) {
    return this.replace(this.list().map(task => (
      task.id === id ? { ...task, completed: true } : task
    )));
  }

  remove(id) {
    return this.replace(this.list().filter(task => task.id !== id));
  }

  replace(tasks) {
    if (!Array.isArray(tasks)) throw new TypeError('Tasks must be an array');
    const cloned = tasks.map(task => ({ ...task }));
    this.store.set('deadlines', cloned);
    return cloned.map(task => ({ ...task }));
  }
}

export default TaskManager;
