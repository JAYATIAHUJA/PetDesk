// CharacterLoader.js — Utility to load character configs dynamically
import fs from 'node:fs';
import path from 'node:path';

// Built-in character configurations with emojis and defaults.
// If a subdirectory exists in characters/, its config.json will override these values.
const BUILT_IN_CHARACTERS = {
  cat: {
    id: 'cat',
    name: 'Cat',
    emoji: '🐱',
    color: '#f4a261',
    useImages: false,
    animations: {
      walk:  { fps: 8,  frames: [[0,0],[1,0],[2,0],[3,0]] },
      idle:  { fps: 6,  frames: [[0,1],[1,1],[2,1]] },
      happy: { fps: 12, frames: [[0,2],[1,2],[2,2],[3,2]] },
      panic: { fps: 14, frames: [[0,3],[1,3],[2,3],[3,3]] },
      sad:   { fps: 4,  frames: [[0,4],[1,4]] }
    }
  },
  dog: {
    id: 'dog',
    name: 'Dog',
    emoji: '🐶',
    color: '#a0522d',
    useImages: false,
    animations: {
      walk:  { fps: 9,  frames: [[0,0],[1,0],[2,0],[3,0]] },
      idle:  { fps: 5,  frames: [[0,1],[1,1]] },
      happy: { fps: 14, frames: [[0,2],[1,2],[2,2],[3,2]] },
      panic: { fps: 12, frames: [[0,3],[1,3],[2,3]] },
      sad:   { fps: 4,  frames: [[0,4],[1,4]] }
    }
  },
  pikachu: {
    id: 'pikachu',
    name: 'Pikachu',
    emoji: '⚡',
    color: '#f9c527',
    useImages: true,
    imagePath: 'characters/PIKACHU',
    animations: {
      idle:    { fps: 3,  frames: ['shime1.png'] },
      walk:    { fps: 6,  frames: ['shime1.png', 'shime2.png', 'shime1.png', 'shime3.png'] },
      run:     { fps: 12, frames: ['shime1.png', 'shime2.png', 'shime1.png', 'shime3.png'] },
      sit:     { fps: 3,  frames: ['shime11.png', 'shime26.png', 'shime11.png'] },
      sleep:   { fps: 2,  frames: ['shime20.png', 'shime21.png'] },
      drag:    { fps: 8,  frames: ['shime5.png', 'shime6.png'] },
      fall:    { fps: 4,  frames: ['shime4.png'] },
      happy:   { fps: 6,  frames: ['shime31.png', 'shime32.png', 'shime31.png', 'shime33.png'] },
      panic:   { fps: 12, frames: ['shime18.png', 'shime19.png'] },
      sad:     { fps: 3,  frames: ['shime35.png'] },
      annoyed: { fps: 4,  frames: ['shime18.png', 'shime19.png'] }
    }
  },
  bunny: {
    id: 'bunny',
    name: 'Bunny',
    emoji: '🐰',
    color: '#e5c1cd',
    useImages: false,
    animations: {
      walk:  { fps: 7,  frames: [[0,0],[1,0]] },
      idle:  { fps: 4,  frames: [[0,0]] },
      happy: { fps: 10, frames: [[0,0]] },
      panic: { fps: 12, frames: [[0,0]] },
      sad:   { fps: 3,  frames: [[0,0]] }
    }
  },
  ghost: {
    id: 'ghost',
    name: 'Ghost',
    emoji: '👻',
    color: '#e2e8f0',
    useImages: false,
    animations: {
      walk:  { fps: 6,  frames: [[0,0],[1,0]] },
      idle:  { fps: 3,  frames: [[0,0]] },
      happy: { fps: 9,  frames: [[0,0]] },
      panic: { fps: 12, frames: [[0,0]] },
      sad:   { fps: 4,  frames: [[0,0]] }
    }
  },
  anime: {
    id: 'anime',
    name: 'Chibi',
    emoji: '🧝',
    color: '#fbc4ab',
    useImages: false,
    animations: {
      walk:  { fps: 8,  frames: [[0,0],[1,0]] },
      idle:  { fps: 4,  frames: [[0,0]] },
      happy: { fps: 11, frames: [[0,0]] },
      panic: { fps: 13, frames: [[0,0]] },
      sad:   { fps: 4,  frames: [[0,0]] }
    }
  },
  dragon: {
    id: 'dragon',
    name: 'Dragon',
    emoji: '🐲',
    color: '#70e000',
    useImages: false,
    animations: {
      walk:  { fps: 7,  frames: [[0,0],[1,0]] },
      idle:  { fps: 4,  frames: [[0,0]] },
      happy: { fps: 10, frames: [[0,0]] },
      panic: { fps: 14, frames: [[0,0]] },
      sad:   { fps: 3,  frames: [[0,0]] }
    }
  },
  robot: {
    id: 'robot',
    name: 'Robot',
    emoji: '🤖',
    color: '#8ecae6',
    useImages: false,
    animations: {
      walk:  { fps: 6,  frames: [[0,0],[1,0]] },
      idle:  { fps: 5,  frames: [[0,0]] },
      happy: { fps: 12, frames: [[0,0]] },
      panic: { fps: 12, frames: [[0,0]] },
      sad:   { fps: 4,  frames: [[0,0]] }
    }
  },
  fox: {
    id: 'fox',
    name: 'Fox',
    emoji: '🦊',
    color: '#f77f00',
    useImages: false,
    animations: {
      walk:  { fps: 8,  frames: [[0,0],[1,0]] },
      idle:  { fps: 4,  frames: [[0,0]] },
      happy: { fps: 12, frames: [[0,0]] },
      panic: { fps: 12, frames: [[0,0]] },
      sad:   { fps: 4,  frames: [[0,0]] }
    }
  }
};

const SHIMEJI_ANIMATION_TEMPLATE = {
  idle:    { fps: 3,  frames: ['shime1.png'] },
  walk:    { fps: 6,  frames: ['shime1.png', 'shime2.png', 'shime1.png', 'shime3.png'] },
  run:     { fps: 12, frames: ['shime1.png', 'shime2.png', 'shime1.png', 'shime3.png'] },
  sit:     { fps: 3,  frames: ['shime11.png', 'shime26.png', 'shime11.png'] },
  sleep:   { fps: 2,  frames: ['shime20.png', 'shime21.png'] },
  drag:    { fps: 8,  frames: ['shime5.png', 'shime6.png'] },
  fall:    { fps: 4,  frames: ['shime4.png'] },
  happy:   { fps: 6,  frames: ['shime31.png', 'shime32.png', 'shime31.png', 'shime33.png'] },
  panic:   { fps: 12, frames: ['shime18.png', 'shime19.png'] },
  sad:     { fps: 3,  frames: ['shime35.png'] },
  annoyed: { fps: 4,  frames: ['shime18.png', 'shime19.png'] }
};

const SHIMEJI_METADATA = {
  pikachu: { name: 'Pikachu', emoji: '⚡', color: '#f9c527' },
  kuroshimeji: { name: 'KuroShimeji', emoji: '🐈‍⬛', color: '#4a4e69' },
  shimeji: { name: 'Shimeji', emoji: '🎒', color: '#ff85a2' },
  doremon: { name: 'Doraemon', emoji: '🐱‍🚀', color: '#3a86ff' },
  pataman: { name: 'Patamon', emoji: '🦇', color: '#fb5607' }
};

function loadCharacters(baseDir) {
  const characters = {};

  try {
    const charsPath = path.join(baseDir, 'characters');
    if (fs.existsSync(charsPath)) {
      const dirs = fs.readdirSync(charsPath);
      for (const dirName of dirs) {
        const fullDir = path.join(charsPath, dirName);
        if (fs.statSync(fullDir).isDirectory()) {
          const characterId = dirName.toLowerCase();
          const isBuiltInSpritesheet = characterId === 'cat' || characterId === 'dog';
          
          if (isBuiltInSpritesheet) {
            const configJsonPath = path.join(fullDir, 'config.json');
            if (fs.existsSync(configJsonPath)) {
              try {
                const rawData = fs.readFileSync(configJsonPath, 'utf8');
                const parsed = JSON.parse(rawData);
                characters[characterId] = {
                  ...parsed,
                  id: characterId,
                  name: parsed.name || dirName,
                  emoji: parsed.emoji || '🐾',
                  color: parsed.color || '#e2e8f0',
                  useImages: false,
                  spriteSheetPath: `characters/${dirName}/${parsed.spriteSheet}`
                };
              } catch (err) {
                console.error(`Error loading spritesheet character ${dirName}:`, err);
              }
            }
          } else {
            // Verify it has shime1.png before adding as a Shimeji image-based character
            const hasShimejiImage = fs.existsSync(path.join(fullDir, 'shime1.png'));
            if (hasShimejiImage) {
              const meta = SHIMEJI_METADATA[characterId] || { name: dirName, emoji: '🐾', color: '#e2e8f0' };
              characters[characterId] = {
                id: characterId,
                name: meta.name,
                emoji: meta.emoji,
                color: meta.color,
                useImages: true,
                imagePath: `characters/${dirName}`,
                animations: SHIMEJI_ANIMATION_TEMPLATE
              };
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error scanning characters folder:', err);
  }

  // Fallback: If no characters loaded, ensure pikachu is defined
  if (Object.keys(characters).length === 0) {
    characters.pikachu = BUILT_IN_CHARACTERS.pikachu;
  }

  return characters;
}

export {
  loadCharacters,
  BUILT_IN_CHARACTERS
};
