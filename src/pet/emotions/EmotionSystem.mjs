// EmotionSystem.js — Emotional simulation for PetDesk
class EmotionSystem {
  constructor() {
    this.affection = 50;  // 0 - 100 (increases with petting)
    this.stress = 0;       // 0 - 100 (increases with closer deadlines)
    this.energy = 80;      // 0 - 100 (decreases with time, increases with sleep)
  }

  pet() {
    this.affection = Math.min(100, this.affection + 10);
    this.stress = Math.max(0, this.stress - 15);
    this.energy = Math.max(0, this.energy - 2); // Petting takes a little energy
  }

  poke() {
    this.affection = Math.max(0, this.affection - 15);
    this.stress = Math.min(100, this.stress + 20);
  }

  sleepTick(dt) {
    this.energy = Math.min(100, this.energy + 0.1 * dt);
    this.stress = Math.max(0, this.stress - 0.05 * dt);
  }

  update(dt, state, activeDeadlines = []) {
    // 1. Decay energy over time when active
    if (state !== 'sleep') {
      this.energy = Math.max(0, this.energy - 0.005 * dt);
    } else {
      this.sleepTick(dt);
    }

    // 2. Compute stress based on deadlines
    let totalStress = 0;
    const now = Date.now();
    for (const d of activeDeadlines) {
      if (d.completed) continue;
      const targetTime = new Date(`${d.date}T${d.time || '09:00'}:00`).getTime();
      const msLeft = targetTime - now;

      if (msLeft < 0) {
        totalStress += 35; // Overdue task stress!
      } else if (msLeft < 60 * 60 * 1000) {
        totalStress += 50; // Due in less than an hour!
      } else if (msLeft < 4 * 60 * 60 * 1000) {
        totalStress += 20; // Due in less than 4 hours
      } else if (msLeft < 24 * 60 * 60 * 1000) {
        totalStress += 10; // Due today
      }
    }
    
    // Smoothly interpolate stress towards total stress
    this.stress = this.stress * 0.95 + Math.min(100, totalStress) * 0.05;
  }

  getMoodState() {
    if (this.stress > 45) return 'anxious';
    if (this.energy < 20) return 'tired';
    if (this.affection > 75) return 'great';
    return 'focused'; // Normal/Productive companion state
  }
}

export default EmotionSystem;
