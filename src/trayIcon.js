'use strict';

const zlib = require('node:zlib');
const { nativeImage } = require('electron');

const COLORS = {
  good: [32, 145, 93, 255],
  warn: [203, 130, 30, 255],
  danger: [204, 55, 62, 255],
  muted: [86, 99, 118, 255],
  ink: [19, 25, 31, 255],
  white: [250, 253, 255, 255]
};

function createQuotaTrayImage(percent, status) {
  const size = 32;
  const pixels = Buffer.alloc(size * size * 4);
  const accent = COLORS[status] || COLORS.good;
  const fillRatio = clamp(percent, 0, 100) / 100;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const cx = x + 0.5 - size / 2;
      const cy = y + 0.5 - size / 2;
      const radius = Math.sqrt(cx * cx + cy * cy);

      if (radius <= 15.2) {
        setPixel(pixels, size, x, y, COLORS.ink);
      }

      if (radius >= 11.4 && radius <= 15.2) {
        const angle = (Math.atan2(cy, cx) + Math.PI * 2.5) % (Math.PI * 2);
        const active = angle <= Math.PI * 2 * fillRatio;
        setPixel(pixels, size, x, y, active ? accent : COLORS.muted);
      }

      if (radius <= 9.2) {
        setPixel(pixels, size, x, y, [23, 30, 37, 255]);
      }
    }
  }

  drawGlyphC(pixels, size, 11, 10, COLORS.white);
  return nativeImage.createFromBuffer(encodePng(size, size, pixels));
}

function drawGlyphC(pixels, size, startX, startY, color) {
  const glyph = [
    '01110',
    '10001',
    '10000',
    '10000',
    '10000',
    '10001',
    '01110'
  ];

  for (let y = 0; y < glyph.length; y += 1) {
    for (let x = 0; x < glyph[y].length; x += 1) {
      if (glyph[y][x] === '1') {
        drawBlock(pixels, size, startX + x * 2, startY + y * 2, 2, color);
      }
    }
  }
}

function drawBlock(pixels, size, x, y, blockSize, color) {
  for (let by = 0; by < blockSize; by += 1) {
    for (let bx = 0; bx < blockSize; bx += 1) {
      setPixel(pixels, size, x + bx, y + by, color);
    }
  }
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const index = (y * size + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ]);
  const scanlines = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    scanlines[rowStart] = 0;
    rgba.copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', Buffer.concat([
      uint32(width),
      uint32(height),
      Buffer.from([8, 6, 0, 0, 0])
    ])),
    chunk('IDAT', zlib.deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  return Buffer.concat([
    uint32(data.length),
    typeBuffer,
    data,
    uint32(crc32(Buffer.concat([typeBuffer, data])))
  ]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

module.exports = {
  createQuotaTrayImage
};
