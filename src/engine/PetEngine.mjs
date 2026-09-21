// PetEngine.js — Core engine coordinator for PetDesk
import PhysicsEngine from './physics/PhysicsEngine.mjs';
import CanvasRenderer from './rendering/CanvasRenderer.mjs';
import AnimationSystem from './animation/AnimationSystem.mjs';
import StateMachine from './stateMachine/StateMachine.mjs';
import InteractionManager from './interactions/InteractionManager.mjs';

class PetEngine {
  constructor(canvas, characterConfig, scale = 100, opacity = 1.0, screenWidth = 1920, screenHeight = 1080, workArea = null) {
    this.canvas = canvas;
    this.characterConfig = characterConfig;
    this.scale = scale;
    this.opacity = opacity;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.workArea = workArea || { x: 0, y: 0, width: screenWidth, height: screenHeight };

    // 1. Initialize Sub-Systems
    this.physics = new PhysicsEngine(screenWidth, screenHeight, this.workArea);
    this.renderer = new CanvasRenderer(canvas);
    this.animation = new AnimationSystem();
    this.stateMachine = new StateMachine(this.physics, this.animation);
    this.interactions = new InteractionManager(canvas, this.physics, this.stateMachine, this.renderer);

    // 2. Set Initial Size
    this.updateDimensions();

    // Teleport to initial position centered in work area
    this.physics.teleport(this.workArea.x + this.workArea.width / 2 - this.physics.width / 2, this.physics.getFloorY());

    // 3. Heartbeat frame ticker state
    this.isRunning = false;
    this.lastTime = 0;
  }

  updateDimensions() {
    this.renderer.resize(this.screenWidth, this.screenHeight);

    // Default Shimeji frames are 128x128
    const scaleFactor = this.scale / 100;
    const baseW = this.characterConfig.frameWidth || 128;
    const baseH = this.characterConfig.frameHeight || 128;

    const petW = Math.round(baseW * scaleFactor);
    const petH = Math.round(baseH * scaleFactor);

    this.physics.setSize(petW, petH);
  }

  // Primary display changed (resolution, DPI scaling, monitor layout)
  setScreenSize(screenWidth, screenHeight, workArea = null) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.workArea = workArea || { x: 0, y: 0, width: screenWidth, height: screenHeight };
    this.physics.setScreenSize(screenWidth, screenHeight, this.workArea);
    this.renderer.resize(screenWidth, screenHeight);
  }

  setCharacter(config) {
    this.characterConfig = config;
    this.updateDimensions();
    this.animation.setAnim('idle');
  }

  updateSettings(settings) {
    if (settings.scale !== undefined) this.scale = settings.scale;
    if (settings.opacity !== undefined) this.opacity = settings.opacity;
    this.updateDimensions();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  }

  stop() {
    this.isRunning = false;
  }

  tick(time) {
    if (!this.isRunning) return;

    // Calculate Delta Time in frames (target 60fps)
    const elapsed = time - this.lastTime;
    this.lastTime = time;
    const dt = Math.min(3, elapsed / 16.67); // Clamp dt to prevent massive teleportations on lag spikes

    // 1. Update systems
    this.stateMachine.update(dt);
    this.physics.update(dt);

    // 2. Animate Sprite
    const animInfo = this.animation.tick(this.characterConfig);

    // 3. Render Canvas
    this.renderer.clear();
    this.renderer.drawPet(
      this.characterConfig,
      animInfo.resolvedName,
      animInfo.frameIndex,
      this.physics.x,
      this.physics.y,
      this.physics.width,
      this.physics.height,
      this.stateMachine.facingRight,
      this.opacity
    );

    this.renderer.updateAndDrawParticles();

    // 4. Update UI Bubble and Mood bar positions to follow pet
    this.updateUIPositions();

    // Loop
    requestAnimationFrame((t) => this.tick(t));
  }

  updateUIPositions() {
    const bubble = document.getElementById('bubble');
    if (bubble && bubble.classList.contains('visible')) {
      const bubbleW = bubble.offsetWidth || 150;
      const bubbleH = bubble.offsetHeight || 50;

      // Center bubble horizontally above pet
      let left = this.physics.x + this.physics.width / 2 - bubbleW / 2;
      // Clamp to screen bounds to avoid text clipping
      left = Math.max(10, Math.min(this.screenWidth - bubbleW - 10, left));

      const top = this.physics.y - bubbleH - 18;

      bubble.style.left = `${left}px`;
      bubble.style.top = `${top}px`;
    }

    const moodBar = document.getElementById('mood-bar');
    if (moodBar && moodBar.classList.contains('visible')) {
      const moodW = moodBar.offsetWidth || 132;
      const moodH = moodBar.offsetHeight || 32;

      let left = this.physics.x + this.physics.width / 2 - moodW / 2;
      left = Math.max(10, Math.min(this.screenWidth - moodW - 10, left));

      const top = this.physics.y - moodH - 10;

      moodBar.style.left = `${left}px`;
      moodBar.style.top = `${top}px`;
    }
  }
}

export default PetEngine;
