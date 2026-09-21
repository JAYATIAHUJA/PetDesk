import crypto from 'node:crypto';

function cloneHabit(habit) {
  return {
    ...habit,
    completedDates: Array.isArray(habit.completedDates) ? [...habit.completedDates] : [],
  };
}

function formatLocalDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function yesterdayOf(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function normalizeXpReward(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 100 ? number : 10;
}

class HabitManager {
  constructor(store, { today = () => formatLocalDate() } = {}) {
    if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') {
      throw new TypeError('HabitManager requires a store with get and set methods');
    }

    this.store = store;
    this.today = today;
  }

  list() {
    const habits = this.store.get('habits');
    return Array.isArray(habits) ? habits.map(cloneHabit) : [];
  }

  create({ name, emoji = '', xpReward } = {}) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new TypeError('Habit name must be a non-empty string');
    }

    const habit = {
      id: `habit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      name: name.trim(),
      emoji: typeof emoji === 'string' ? emoji.trim().slice(0, 8) : '',
      xpReward: normalizeXpReward(xpReward),
      completedDates: [],
      streak: 0,
      lastCompletedDate: null,
      createdAt: new Date().toISOString(),
    };

    this.save([...this.list(), habit]);
    return cloneHabit(habit);
  }

  complete(id) {
    const today = this.today();
    const habits = this.list();
    const index = habits.findIndex(habit => habit.id === id);
    if (index === -1) throw new Error('Habit not found');

    const habit = habits[index];
    if (habit.lastCompletedDate === today) {
      return { habit: cloneHabit(habit), completed: false, xpAwarded: 0 };
    }

    const updated = {
      ...habit,
      completedDates: [...habit.completedDates, today],
      streak: habit.lastCompletedDate === yesterdayOf(today) ? habit.streak + 1 : 1,
      lastCompletedDate: today,
    };
    habits[index] = updated;
    this.save(habits);

    return { habit: cloneHabit(updated), completed: true, xpAwarded: updated.xpReward };
  }

  remove(id) {
    const remaining = this.list().filter(habit => habit.id !== id);
    this.save(remaining);
    return remaining.map(cloneHabit);
  }

  save(habits) {
    this.store.set('habits', habits.map(cloneHabit));
  }
}

export default HabitManager;
