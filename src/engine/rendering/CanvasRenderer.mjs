// CanvasRenderer.js — HTML5 Canvas rendering engine for PetDesk
class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    this.imageCache = {};
    this.particles = [];
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  resize(width, height) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }
  }

  // Draw the character
  drawPet(charDef, animName, frameIndex, x, y, width, height, facingRight, opacity = 1.0) {
    this.ctx.save();
    this.ctx.globalAlpha = opacity;

    // Flip horizontal if moving left
    if (!facingRight) {
      this.ctx.translate(x + width / 2, y + height / 2);
      this.ctx.scale(-1, 1);
      this.ctx.translate(-(x + width / 2), -(y + height / 2));
    }

    if (charDef.useImages) {
      // Individual frames
      const animDef = charDef.animations[animName] || charDef.animations.idle;
      const frameName = animDef.frames[frameIndex] || animDef.frames[0];
      const src = `${charDef.imagePath}/${frameName}`;

      const img = this.loadImage(src);
      if (img && img.complete && img.naturalWidth !== 0) {
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(img, x, y, width, height);
      } else {
        // Draw emoji fallback while loading
        this.drawEmoji(charDef.emoji || '🐱', x, y, width, height);
      }
    } else {
      // Sprite sheet or Emoji fallback
      const hasSpriteSheet = charDef.spriteSheetPath;
      if (hasSpriteSheet) {
        const img = this.loadImage(charDef.spriteSheetPath);
        if (img && img.complete && img.naturalWidth !== 0) {
          const animDef = charDef.animations[animName] || charDef.animations.idle;
          const frameCoord = animDef.frames[frameIndex] || animDef.frames[0];
          const col = frameCoord[0];
          const row = frameCoord[1];
          const fw = charDef.frameWidth || 64;
          const fh = charDef.frameHeight || 64;

          this.ctx.imageSmoothingEnabled = false;
          this.ctx.drawImage(
            img,
            col * fw,
            row * fh,
            fw,
            fh,
            x,
            y,
            width,
            height
          );
        } else {
          this.drawEmoji(charDef.emoji || '🐱', x, y, width, height);
        }
      } else {
        this.drawEmoji(charDef.emoji || '🐱', x, y, width, height);
      }
    }

    this.ctx.restore();
  }

  // Draw text emoji fallback
  drawEmoji(emoji, x, y, width, height) {
    this.ctx.font = `${Math.round(height * 0.8)}px serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(emoji, x + width / 2, y + height / 2);
  }

  // Load and cache image
  loadImage(src) {
    if (!this.imageCache[src]) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        // Force redraw trigger when image loads
      };
      this.imageCache[src] = img;
    }
    return this.imageCache[src];
  }

  // ─── Particle Effects System (Petting feedback) ───

  spawnHappyParticle(x, y) {
    const symbols = ['❤️', '✨', '🌸', '💫', '💖'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    
    this.particles.push({
      x: x + (Math.random() - 0.5) * 40,
      y: y - 10,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -1.5 - Math.random() * 2,
      alpha: 1.0,
      decay: 0.015 + Math.random() * 0.015,
      scale: 0.8 + Math.random() * 0.6,
      text: symbol
    });
  }

  updateAndDrawParticles() {
    this.ctx.save();
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.globalAlpha = p.alpha;
      this.ctx.font = `${Math.round(20 * p.scale)}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(p.text, p.x, p.y);
    }

    this.ctx.restore();
  }
}

export default CanvasRenderer;
