// PhysicsEngine.js — Physics simulation for PetDesk
class PhysicsEngine {
  constructor(screenWidth, screenHeight, workArea = null) {
    this.screenWidth = screenWidth || 1920;
    this.screenHeight = screenHeight || 1080;
    this.workArea = workArea || { x: 0, y: 0, width: this.screenWidth, height: this.screenHeight };

    this.x = 100;
    this.y = 100;
    this.vx = 0;
    this.vy = 0;
    
    // Physics constants
    this.gravity = 0.4;          // Gravity acceleration per frame
    this.friction = 0.08;        // Sliding friction coefficient
    this.bounce = 0.25;          // Elasticity of edge collision bounce
    this.minBounceVelocity = 1.5;// Minimum vertical velocity to trigger a bounce
    
    this.width = 64;
    this.height = 64;
    
    this.isGrounded = false;
    this.isDragging = false;
    this.isSliding = false;

    // History to compute dragging velocity for throws
    this.dragHistory = [];
    this.maxHistory = 5;
  }

  setSize(w, h) {
    this.width = w;
    this.height = h;
  }

  setScreenSize(w, h, workArea = null) {
    this.screenWidth = w;
    this.screenHeight = h;
    if (workArea) {
      this.workArea = workArea;
    } else {
      this.workArea = { x: 0, y: 0, width: w, height: h };
    }
  }

  teleport(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.isGrounded = this.y >= this.getFloorY();
    this.isSliding = false;
  }

  getFloorY() {
    return this.workArea.y + this.workArea.height - this.height;
  }

  update(dt = 1) {
    if (this.isDragging) {
      return; // Dragging is controlled by cursor, bypasses physics
    }

    // 1. Apply Gravity
    if (!this.isGrounded) {
      this.vy += this.gravity * dt;
    }

    // 2. Apply Friction (on floor sliding)
    if (this.isGrounded && this.isSliding) {
      if (this.vx > 0) {
        this.vx = Math.max(0, this.vx - this.friction * dt);
      } else if (this.vx < 0) {
        this.vx = Math.min(0, this.vx + this.friction * dt);
      }
      if (this.vx === 0) {
        this.isSliding = false;
      }
    }

    // 3. Update Positions
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 4. Resolve Collisions
    this.resolveCollisions();
  }

  resolveCollisions() {
    const floorY = this.getFloorY();

    // Floor collision
    if (this.y >= floorY) {
      this.y = floorY;
      
      if (this.vy > this.minBounceVelocity) {
        // Bounce
        this.vy = -this.vy * this.bounce;
        this.vx *= 0.8; // Lose some horizontal speed on bounce
      } else {
        // Landed
        this.vy = 0;
        this.isGrounded = true;
        if (Math.abs(this.vx) > 0.5) {
          this.isSliding = true;
        } else {
          this.isSliding = false;
          this.vx = 0;
        }
      }
    } else {
      this.isGrounded = false;
    }

    // Left wall collision
    if (this.x <= this.workArea.x) {
      this.x = this.workArea.x;
      this.vx = -this.vx * this.bounce;
    }

    // Right wall collision
    const maxRight = this.workArea.x + this.workArea.width - this.width;
    if (this.x >= maxRight) {
      this.x = maxRight;
      this.vx = -this.vx * this.bounce;
    }

    // Ceiling collision (optional, keep pet on screen)
    if (this.y <= this.workArea.y) {
      this.y = this.workArea.y;
      this.vy = 0;
    }
  }

  // ─── Drag & Throw Momentum logic ───

  startDrag(mouseX, mouseY) {
    this.isDragging = true;
    this.isGrounded = false;
    this.isSliding = false;
    this.vx = 0;
    this.vy = 0;
    this.dragHistory = [];
    this.recordDragPosition(mouseX, mouseY);
  }

  dragTo(mouseX, mouseY) {
    this.recordDragPosition(mouseX, mouseY);
    this.x = mouseX - this.width / 2;
    this.y = mouseY - this.height / 2;
    
    // Clamp to work area bounds during drag
    this.x = Math.max(this.workArea.x, Math.min(this.workArea.x + this.workArea.width - this.width, this.x));
    this.y = Math.max(this.workArea.y, Math.min(this.workArea.y + this.workArea.height - this.height, this.y));
  }

  recordDragPosition(x, y) {
    const time = Date.now();
    this.dragHistory.push({ x, y, time });
    if (this.dragHistory.length > this.maxHistory) {
      this.dragHistory.shift();
    }
  }

  endDragAndRelease() {
    this.isDragging = false;
    
    if (this.dragHistory.length < 2) {
      this.vx = 0;
      this.vy = 0;
      return;
    }

    // Calculate velocity based on drag history
    const first = this.dragHistory[0];
    const last = this.dragHistory[this.dragHistory.length - 1];
    const dt = (last.time - first.time) || 1; // ms
    
    // Convert ms velocity to frame velocity (assuming 60fps, i.e. 16.67ms per frame)
    const frameDuration = 16.67;
    const rawVx = ((last.x - first.x) / dt) * frameDuration;
    const rawVy = ((last.y - first.y) / dt) * frameDuration;
    
    // Clamp throwing velocity to prevent insane launching speeds
    const maxThrowVelocity = 25;
    this.vx = Math.max(-maxThrowVelocity, Math.min(maxThrowVelocity, rawVx));
    this.vy = Math.max(-maxThrowVelocity, Math.min(maxThrowVelocity, rawVy));

    this.dragHistory = [];
  }
}

export default PhysicsEngine;
