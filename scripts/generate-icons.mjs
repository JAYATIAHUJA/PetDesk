// generate-icons.mjs — Draws the PetDesk paw icon and writes assets/icon.png, icon.ico and tray-icon.png.
// Dependency-free (hand-rolled rasterizer + PNG/ICO encoders). Run with `npm run icons`.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ASSETS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const SUPERSAMPLE = 4;

const BACKGROUND_TOP = [199, 125, 255]; // --accent
const BACKGROUND_BOTTOM = [123, 47, 255]; // --accent2
const PAW = [255, 255, 255];

// Shapes in a 0..1 unit square
const inRoundedSquare = (x, y, inset, radius) => {
  const dx = Math.max(inset + radius - x, 0, x - (1 - inset - radius));
  const dy = Math.max(inset + radius - y, 0, y - (1 - inset - radius));
  return x >= inset && x <= 1 - inset && y >= inset && y <= 1 - inset && dx * dx + dy * dy <= radius * radius;
};
const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

const PAW_PARTS = [
  [0.5, 0.64, 0.2, 0.165], // pad
  [0.255, 0.45, 0.075, 0.095], // toes
  [0.41, 0.31, 0.08, 0.105],
  [0.59, 0.31, 0.08, 0.105],
  [0.745, 0.45, 0.075, 0.095],
];

function sample(x, y) {
  if (!inRoundedSquare(x, y, 0.03, 0.22)) return null;
  if (PAW_PARTS.some(part => inEllipse(x, y, ...part))) return PAW;
  return BACKGROUND_TOP.map((top, i) => top + (BACKGROUND_BOTTOM[i] - top) * y);
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const step = 1 / (size * SUPERSAMPLE);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, covered = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const color = sample((px * SUPERSAMPLE + sx + 0.5) * step, (py * SUPERSAMPLE + sy + 0.5) * step);
          if (!color) continue;
          r += color[0]; g += color[1]; b += color[2];
          covered++;
        }
      }
      const offset = (py * size + px) * 4;
      if (covered) {
        pixels[offset] = Math.round(r / covered);
        pixels[offset + 1] = Math.round(g / covered);
        pixels[offset + 2] = Math.round(b / covered);
        pixels[offset + 3] = Math.round((covered / SUPERSAMPLE ** 2) * 255);
      }
    }
  }
  return pixels;
}

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const chunk = Buffer.alloc(body.length + 8);
  chunk.writeUInt32BE(data.length, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(zlib.crc32(body), body.length + 4);
  return chunk;
}

function encodePng(size) {
  const pixels = render(size);
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size); // each scanline is prefixed with filter type 0
  for (let y = 0; y < size; y++) pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ICO container with PNG-compressed entries (supported since Windows Vista)
function encodeIco(sizes) {
  const images = sizes.map(size => ({ size, data: encodePng(size) }));
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    header[entry] = size >= 256 ? 0 : size;
    header[entry + 1] = size >= 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4); // color planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map(image => image.data)]);
}

fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), encodePng(512));
fs.writeFileSync(path.join(ASSETS_DIR, 'tray-icon.png'), encodePng(32));
fs.writeFileSync(path.join(ASSETS_DIR, 'icon.ico'), encodeIco([16, 24, 32, 48, 64, 256]));
console.log(`Icons written to ${ASSETS_DIR}`);
