// AnimationSystem.js — State-driven sprite frame tickers for PetDesk
class AnimationSystem {
  constructor() {
    this.currentAnim = 'idle';
    this.frameIndex = 0;
    this.frameTick = 0;

    // Animation locks (for temporary reactions like landing, petting)
    this.isLocked = false;
    this.lockTimer = null;
    this.lockEndCallback = null;
  }

  setAnim(name, durationMs = 0, onComplete = null) {
    if (this.isLocked && durationMs === 0) {
      return; // Ignore default loops if currently locked in a reaction
    }

    if (this.currentAnim === name && !durationMs) {
      return;
    }

    this.currentAnim = name;
    this.frameIndex = 0;
    this.frameTick = 0;

    // Handle lock transitions
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }

    if (durationMs > 0) {
      this.isLocked = true;
      this.lockEndCallback = onComplete;
      this.lockTimer = setTimeout(() => {
        this.isLocked = false;
        this.lockTimer = null;
        if (this.lockEndCallback) {
          this.lockEndCallback();
        } else {
          this.setAnim('idle');
        }
      }, durationMs);
    }
  }

  // Resolve the actual animation definition with safety fallbacks
  resolveAnimation(charDef, animName) {
    if (charDef.animations && charDef.animations[animName]) {
      return { name: animName, def: charDef.animations[animName] };
    }

    const fallbacks = {
      sleep: 'idle',
      sit: 'idle',
      fall: 'panic',
      slide: 'walk',
      land: 'idle',
      happy: 'idle',
      panic: 'walk',
      sad: 'idle',
      run: 'walk',
      annoyed: 'sad'
    };

    const fbName = fallbacks[animName] || 'idle';
    if (charDef.animations && charDef.animations[fbName]) {
      return { name: fbName, def: charDef.animations[fbName] };
    }

    // Final safety fallback
    const keys = Object.keys(charDef.animations || {});
    if (keys.length > 0) {
      return { name: keys[0], def: charDef.animations[keys[0]] };
    }

    // Bare minimum fallback grid coordinate
    return { name: 'idle', def: { fps: 6, frames: [[0, 0]] } };
  }

  tick(charDef) {
    const resolved = this.resolveAnimation(charDef, this.currentAnim);
    const animDef = resolved.def;
    const targetFps = animDef.fps || 6;
    
    // Calculate ticks per frame assuming 60fps canvas tick
    const ticksPerFrame = Math.max(1, Math.round(60 / targetFps));

    this.frameTick++;
    if (this.frameTick >= ticksPerFrame) {
      this.frameTick = 0;
      this.frameIndex = (this.frameIndex + 1) % animDef.frames.length;
    }

    return {
      resolvedName: resolved.name,
      frameIndex: this.frameIndex
    };
  }
}

export default AnimationSystem;
