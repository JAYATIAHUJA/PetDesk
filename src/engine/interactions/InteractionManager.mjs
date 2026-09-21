// InteractionManager.js — Coordinates mouse inputs and play reactions for PetDesk
// Main-process calls go through the window.petdesk bridge exposed by preload.cjs

class InteractionManager {
  constructor(canvas, physics, stateMachine, renderer) {
    this.canvas = canvas;
    this.physics = physics;
    this.stateMachine = stateMachine;
    this.renderer = renderer;

    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    // click tracking for petting vs poking
    this.lastClickTime = 0;
    this.clickStreak = 0;
    this.streakResetTimer = null;

    this.setupListeners();
  }

  setupListeners() {
    // Canvas mouse events
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));

    // Track mouse move and mouse up globally on document
    // to handle drag releases outside canvas bounds
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mouseup', (e) => this.onMouseUp(e));

    // Right-click context menu opens Settings
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      window.petdesk.send('open-settings');
    });

    // Hover hit test listener
    document.addEventListener('mousemove', (e) => this.handleHitTest(e), { passive: true });
  }

  // Hit test determines if mouse cursor is over visible pet or speech bubble.
  // We send a set-ignore-mouse-events IPC message to Electron main process.
  handleHitTest(e) {
    if (this.isDragging) {
      // Don't modify ignore state while dragging
      return;
    }

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const insidePet =
      mouseX >= this.physics.x &&
      mouseX <= this.physics.x + this.physics.width &&
      mouseY >= this.physics.y &&
      mouseY <= this.physics.y + this.physics.height;

    // Check if mouse is inside speech bubble
    const bubble = document.getElementById('bubble');
    let insideBubble = false;
    if (bubble && bubble.classList.contains('visible')) {
      const rect = bubble.getBoundingClientRect();
      insideBubble =
        mouseX >= rect.left &&
        mouseX <= rect.right &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom;
    }

    // Check if mouse is inside mood selector bar
    const moodBar = document.getElementById('mood-bar');
    let insideMood = false;
    if (moodBar && moodBar.classList.contains('visible')) {
      const rect = moodBar.getBoundingClientRect();
      insideMood =
        mouseX >= rect.left &&
        mouseX <= rect.right &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom;
    }

    const isInteractive = insidePet || insideBubble || insideMood;

    // Send ignore-mouse-events state
    if (isInteractive) {
      window.petdesk.send('set-ignore-mouse-events', false);
    } else {
      window.petdesk.send('set-ignore-mouse-events', true, { forward: true });
    }
  }

  onMouseDown(e) {
    if (e.button !== 0) return; // Only allow left clicks

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // Verify mousedown is actually within pet boundaries
    const insidePet =
      mouseX >= this.physics.x &&
      mouseX <= this.physics.x + this.physics.width &&
      mouseY >= this.physics.y &&
      mouseY <= this.physics.y + this.physics.height;

    if (!insidePet) return;

    e.preventDefault();
    this.isDragging = true;

    // Wakes up pet if it's sleeping
    if (this.stateMachine.state === 'sleep') {
      this.stateMachine.setState('idle');
      this.stateMachine.facingRight = true;
      if (window.showSpeechBubble) {
        window.showSpeechBubble('🥱 Yawwn... morning!', 2500);
      }
    }

    this.dragOffsetX = mouseX - this.physics.x;
    this.dragOffsetY = mouseY - this.physics.y;

    this.physics.startDrag(mouseX, mouseY);
    this.stateMachine.setState('drag');
    this.canvas.style.cursor = 'grabbing';

    // Ensure window registers input during drag
    window.petdesk.send('set-ignore-mouse-events', false);
  }

  onMouseMove(e) {
    if (!this.isDragging) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    this.physics.dragTo(mouseX, mouseY);
  }

  onMouseUp(e) {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.canvas.style.cursor = 'grab';

    const wasThrown = Math.abs(this.physics.vx) > 3 || Math.abs(this.physics.vy) > 3;

    this.physics.endDragAndRelease();

    if (wasThrown) {
      this.stateMachine.setState('fall');
      if (window.showSpeechBubble) {
        const panics = ['Aaaaaah! 😱', 'Catch me! 🙀', 'Wheee! 🌪️', 'Whoa! 🚀'];
        window.showSpeechBubble(panics[Math.floor(Math.random() * panics.length)], 2000);
      }
    } else {
      // Normal drop: trigger happy or landing depending on distance to floor
      if (this.physics.isGrounded) {
        this.stateMachine.setState('idle');
        this.handleClick(); // Normal clicks trigger petting reaction
      } else {
        this.stateMachine.setState('fall');
      }
    }
  }

  handleClick() {
    const now = Date.now();

    // Reset streak if too much time passed
    if (now - this.lastClickTime > 400) {
      this.clickStreak = 1;
    } else {
      this.clickStreak++;
    }

    this.lastClickTime = now;

    if (this.clickStreak >= 4) {
      // Poke annoyance
      this.clickStreak = 0;
      this.stateMachine.setState('annoyed');
      if (window.showSpeechBubble) {
        const annoyedLines = ['Hey, stop that! 😡', 'Ow! Stop poking! 👿', 'Leave me alone! 😾', 'Hmph! 😤'];
        window.showSpeechBubble(annoyedLines[Math.floor(Math.random() * annoyedLines.length)], 3000);
      }
    } else {
      // Normal petting / happy click
      this.stateMachine.setState('happy');

      // Spawn particles around the pet center
      const petCenterX = this.physics.x + this.physics.width / 2;
      const petCenterY = this.physics.y + this.physics.height / 2;

      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          this.renderer.spawnHappyParticle(petCenterX, petCenterY);
        }, i * 150);
      }

      if (window.showSpeechBubble) {
        const happyLines = ['Hehehe, tickles! ❤️', 'Purrr... ✨', 'You are so nice! 🥰', 'Yay! 🌸'];
        window.showSpeechBubble(happyLines[Math.floor(Math.random() * happyLines.length)], 3000);
      }
    }
  }
}

export default InteractionManager;
