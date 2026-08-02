// make-icons.mjs — generates the app icons with zero dependencies.
// Run once with: node tools/make-icons.mjs
//
// Draws each icon pixel-by-pixel (a bottle-green tile with three ledger
// lines in brass, cream, and sage — the app's signature motif) and
// encodes it as a real PNG using only Node's built-in zlib.
//
// Outputs into docs/icons/:
//   icon-192.png          rounded corners, transparent outside (browser UI)
//   icon-512.png          same, large
//   icon-maskable-512.png full-bleed square, art in the safe zone (Android launcher)
//   apple-touch-icon.png  180px full-bleed square (iOS rounds it itself)

import { deflateSync } from "node:zlib";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "icons");

// The app's palette (must match css/styles.css)
const GROUND = [0x12, 0x17, 0x12];
const BRASS = [0xc9, 0xa5, 0x5f];
const CREAM = [0xef, 0xea, 0xd8];
const SAGE = [0x8f, 0xba, 0x8b];

// The three ledger lines: [y, startX, endX] as fractions of the tile,
// with per-line color. Widths differ like real ledger entries.
const BARS = [
  { y: 0.36, x0: 0.24, x1: 0.78, color: BRASS },
  { y: 0.5, x0: 0.24, x1: 0.6, color: CREAM },
  { y: 0.64, x0: 0.24, x1: 0.7, color: SAGE },
];
const BAR_RADIUS = 0.028; // half the line thickness, as a fraction of size

// ---------------------------------------------------------------------------
// Tiny geometry helpers (0..1 coverage for smooth edges)
// ---------------------------------------------------------------------------

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// How much of this pixel is inside a rounded square of the full tile?
function roundedSquareCoverage(x, y, size, cornerRadius) {
  const half = size / 2;
  const ex = Math.abs(x - half) - (half - cornerRadius);
  const ey = Math.abs(y - half) - (half - cornerRadius);
  const outside = Math.hypot(Math.max(ex, 0), Math.max(ey, 0));
  const dist = outside + Math.min(Math.max(ex, ey), 0) - cornerRadius;
  return clamp01(0.5 - dist);
}

// How much of this pixel is inside a horizontal capsule (a ledger line)?
function capsuleCoverage(x, y, x0, x1, cy, radius) {
  const px = Math.max(x0, Math.min(x1, x));
  const dist = Math.hypot(x - px, y - cy) - radius;
  return clamp01(0.5 - dist);
}

// ---------------------------------------------------------------------------
// Icon drawing
// ---------------------------------------------------------------------------

// mode: "rounded" (transparent rounded tile), "square" (full bleed).
// contentScale shrinks the artwork toward the center (maskable safe zone).
function drawIcon(size, { mode, contentScale = 1 }) {
  const pixels = Buffer.alloc(size * size * 4);
  const cornerRadius = size * 0.21;

  // Precompute the bar geometry in pixels, scaled toward the center.
  const center = size / 2;
  const scalePoint = (fraction) => center + (fraction - 0.5) * size * contentScale;
  const bars = BARS.map((bar) => ({
    cy: scalePoint(bar.y),
    x0: scalePoint(bar.x0),
    x1: scalePoint(bar.x1),
    radius: BAR_RADIUS * size * contentScale,
    color: bar.color,
  }));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;

      const tile = mode === "rounded" ? roundedSquareCoverage(cx, cy, size, cornerRadius) : 1;

      // Start with the green ground, then lay each ledger line over it.
      let [r, g, b] = GROUND;
      for (const bar of bars) {
        const cover = capsuleCoverage(cx, cy, bar.x0, bar.x1, bar.cy, bar.radius);
        if (cover > 0) {
          r = r + (bar.color[0] - r) * cover;
          g = g + (bar.color[1] - g) * cover;
          b = b + (bar.color[2] - b) * cover;
        }
      }

      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(r);
      pixels[offset + 1] = Math.round(g);
      pixels[offset + 2] = Math.round(b);
      pixels[offset + 3] = Math.round(tile * 255);
    }
  }

  return pixels;
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder (8-bit RGBA, no interlace)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, dataBuffer) {
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), dataBuffer]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(dataBuffer.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(pixels, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // bytes 10-12 stay 0: compression, filter, interlace

  // Each scanline is prefixed with a filter byte (0 = none).
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Generate, then self-check every file
// ---------------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });

const ICONS = [
  { file: "icon-192.png", size: 192, options: { mode: "rounded" } },
  { file: "icon-512.png", size: 512, options: { mode: "rounded" } },
  { file: "icon-maskable-512.png", size: 512, options: { mode: "square", contentScale: 0.72 } },
  { file: "apple-touch-icon.png", size: 180, options: { mode: "square" } },
];

for (const { file, size, options } of ICONS) {
  const path = join(OUT_DIR, file);
  writeFileSync(path, encodePng(drawIcon(size, options), size));

  // Self-check: signature and declared dimensions read back correctly.
  const written = readFileSync(path);
  const signatureOk = written.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const width = written.readUInt32BE(16);
  const height = written.readUInt32BE(20);
  if (!signatureOk || width !== size || height !== size) {
    throw new Error(`${file} failed self-check (signature ${signatureOk}, ${width}x${height})`);
  }
  console.log(`${file}  ${size}x${size}  ${written.length} bytes  OK`);
}
