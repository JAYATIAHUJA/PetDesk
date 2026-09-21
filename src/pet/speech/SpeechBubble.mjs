// SpeechBubble.js — Dialogue manager for PetDesk
class SpeechBubble {
  constructor(bubbleElement) {
    this.bubble = bubbleElement;
    this.timeout = null;
    this.currentText = '';
  }

  show(htmlContent, type = '', durationMs = 5000) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    this.bubble.innerHTML = htmlContent;
    
    // Add visual theme class
    this.bubble.className = `visible ${type}`.trim();
    this.currentText = htmlContent;

    if (durationMs > 0) {
      this.timeout = setTimeout(() => {
        this.hide();
      }, durationMs);
    }
  }

  hide() {
    this.bubble.classList.remove('visible');
    // Maintain active classes for transit duration, then clear
    setTimeout(() => {
      if (!this.bubble.classList.contains('visible')) {
        this.bubble.className = '';
      }
    }, 200);
    
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.currentText = '';
  }

  isShowing() {
    return this.bubble.classList.contains('visible');
  }
}

export default SpeechBubble;
