// StateMachine.js — Finite State Machine for PetDesk
class StateMachine {
  constructor(physics, animation, systemTray) {
    this.physics = physics;
    this.animation = animation;
    
    this.state = 'idle'; // Core states: idle, walk, sit, sleep, drag, fall, slide, land, happy, annoyed, panic, sad
    this.stateTime = 0;
    this.stateDuration = 0;
    
    this.facingRight = true;
    this.isDead = false;
    
    this.annoyanceTimeout = null;
    this.sleepyWeight = 0.1; // Probability weight to sleep from idle
  }

  setState(newState, durationMs = 0) {
    if (this.state === newState) return;
    
    // Clean up old state if necessary
    if (this.state === 'drag' && newState !== 'drag') {
      // Released
    }

    this.state = newState;
    this.stateTime = 0;
    
    // Map states to animations
    const animMap = {
      idle: 'idle',
      walk: 'walk',
      run: 'run',
      sit: 'sit',
      sleep: 'sleep',
      drag: 'drag',
      fall: 'fall',
      slide: 'slide',
      land: 'land',
      happy: 'happy',
      annoyed: 'annoyed',
      panic: 'panic',
      sad: 'sad'
    };

    const animName = animMap[newState] || 'idle';
    
    if (newState === 'happy') {
      this.animation.setAnim('happy', 3000, () => this.transitionToDefaultState());
    } else if (newState === 'annoyed') {
      this.animation.setAnim('annoyed', 2000, () => this.transitionToDefaultState());
    } else if (newState === 'land') {
      this.animation.setAnim('land', 1000, () => this.transitionToDefaultState());
    } else {
      this.animation.setAnim(animName);
    }
  }

  transitionToDefaultState() {
    // If there is an urgent/overdue reminder active, return to sad or panic
    if (this.activeUrgentDeadline) {
      this.setState('panic');
    } else if (this.activeOverdueDeadline) {
      this.setState('sad');
    } else {
      this.setState('idle');
    }
  }

  update(dt = 1) {
    this.stateTime += dt;
    
    // Synchronize physics flags with states
    if (this.physics.isDragging) {
      this.setState('drag');
    } else if (!this.physics.isGrounded && this.state !== 'drag') {
      this.setState('fall');
    } else if (this.physics.isSliding && this.state !== 'drag' && this.state !== 'fall') {
      this.setState('slide');
    }

    // State Specific Updates
    switch (this.state) {
      case 'idle':
        this.physics.vx = 0;
        this.physics.vy = 0;
        
        // Random transition out of idle
        if (this.stateTime > this.getRandomDuration(120, 240)) {
          const rand = Math.random();
          if (rand < 0.22) {
            this.setState('walk');
          } else if (rand < 0.44) {
            this.setState('run');
          } else if (rand < 0.58) {
            this.setState('sit');
          } else if (rand < 0.72) {
            this.setState('sleep');
          } else if (rand < 0.82) {
            this.setState('happy'); // Random happy dance / wag legs
          } else if (rand < 0.91) {
            this.setState('annoyed'); // Random frantic wiggle / annoyed shake
          } else {
            this.setState('sad'); // Random sad look
          }
        }
        break;

      case 'walk':
        // Move horizontal
        const speed = 1.2;
        this.physics.vx = this.facingRight ? speed : -speed;
        
        // Face boundaries check
        if (this.physics.x <= this.physics.workArea.x) {
          this.facingRight = true;
        } else if (this.physics.x >= this.physics.workArea.x + this.physics.workArea.width - this.physics.width) {
          this.facingRight = false;
        }

        // Randomly return to idle
        if (this.stateTime > this.getRandomDuration(180, 360)) {
          this.setState('idle');
        }
        break;

      case 'run':
        // Move horizontal fast
        const runSpeed = 2.4;
        this.physics.vx = this.facingRight ? runSpeed : -runSpeed;
        
        // Face boundaries check
        if (this.physics.x <= this.physics.workArea.x) {
          this.facingRight = true;
        } else if (this.physics.x >= this.physics.workArea.x + this.physics.workArea.width - this.physics.width) {
          this.facingRight = false;
        }

        // Randomly return to idle
        if (this.stateTime > this.getRandomDuration(100, 200)) {
          this.setState('idle');
        }
        break;

      case 'sit':
        this.physics.vx = 0;
        if (this.stateTime > this.getRandomDuration(100, 200)) {
          this.setState('idle');
        }
        break;

      case 'sleep':
        this.physics.vx = 0;
        this.physics.vy = 0;
        // Sleeps for a while, then wakes up randomly (300-600 frames = ~5-10 seconds)
        if (this.stateTime > this.getRandomDuration(300, 600)) {
          this.setState('idle');
        }
        break;

      case 'drag':
        // Position is handled by InteractionManager, velocities are zeroed in physics update
        break;

      case 'fall':
        // Physics update applies gravity
        break;

      case 'slide':
        // Physics update applies friction, wait until vx is 0
        if (!this.physics.isSliding) {
          this.setState('land');
        }
        break;

      case 'land':
        this.physics.vx = 0;
        // Animation lock handles returning to default
        break;

      case 'happy':
        this.physics.vx = 0;
        // Animation lock handles returning to default
        break;

      case 'annoyed':
        this.physics.vx = 0;
        // Animation lock handles returning to default
        break;

      case 'panic':
        // Run back and forth rapidly
        const panicSpeed = 3.2;
        this.physics.vx = this.facingRight ? panicSpeed : -panicSpeed;
        
        if (this.physics.x <= this.physics.workArea.x) {
          this.facingRight = true;
        } else if (this.physics.x >= this.physics.workArea.x + this.physics.workArea.width - this.physics.width) {
          this.facingRight = false;
        }

        // Return to idle after a while if not locked by an urgent deadline
        if (!this.activeUrgentDeadline && this.stateTime > this.getRandomDuration(180, 360)) {
          this.setState('idle');
        } else if (this.stateTime > 300) {
          // Pause run briefly to catch breath
          this.stateTime = 0;
          this.physics.vx = 0;
        }
        break;

      case 'sad':
        // Walk extremely slowly or stop
        this.physics.vx = 0;
        this.physics.vy = 0;
        // Return to idle after a while if not locked by an overdue deadline
        if (!this.activeOverdueDeadline && this.stateTime > this.getRandomDuration(120, 240)) {
          this.setState('idle');
        }
        break;
    }
  }

  getRandomDuration(minFrames, maxFrames) {
    return Math.floor(Math.random() * (maxFrames - minFrames + 1)) + minFrames;
  }
}

export default StateMachine;
