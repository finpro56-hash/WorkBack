import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const PUBLIC_DIR = path.resolve('public');
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// 1. Create a beautiful SVG icon with a bold white "W" inside the circular gradient
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0ea5e9;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="#f1f5f9"/>
  <circle cx="256" cy="256" r="180" fill="url(#grad)" filter="drop-shadow(4px 4px 10px rgba(0,0,0,0.15))" />
  <!-- Elegant thick white 'W' in center -->
  <path d="M179 195 L215 317 L256 235 L297 317 L333 195" stroke="#ffffff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.svg'), svgContent);

// 2. Pure Node.js Programmatic PNG Generator
// Generates valid PNG images with EXACT dimensions, color channels, and CRC chunks
// using only standard built-in libraries (zlib).

// CRC32 implementation
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function calculateCrc(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Distance from point (px, py) to line segment (ax, ay) -> (bx, by)
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    const qx = px - ax;
    const qy = py - ay;
    return Math.sqrt(qx * qx + qy * qy);
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t)); // Clamp to segment boundaries
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const rx = px - projX;
  const ry = py - projY;
  return Math.sqrt(rx * rx + ry * ry);
}

function writePng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8 bits/channel
  ihdrData[9] = 2; // Color type: 2 (RGB)
  ihdrData[10] = 0; // Compression method: 0 (deflate)
  ihdrData[11] = 0; // Filter method: 0 (standard)
  ihdrData[12] = 0; // Interlace method: 0 (no interlace)

  const createChunk = (typeStr, data) => {
    const typeBuf = Buffer.from(typeStr, 'ascii');
    const lengthBuf = Buffer.alloc(4);
    lengthBuf.writeUInt32BE(data.length, 0);

    const crcBuf = Buffer.alloc(4);
    const contentToCrc = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(calculateCrc(contentToCrc), 0);

    return Buffer.concat([lengthBuf, typeBuf, data, crcBuf]);
  };

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT Chunk (RGB data)
  const rowSize = width * 3 + 1;
  const rawPixels = Buffer.alloc(rowSize * height);

  // Vertices of the 'W' letter in normalized/relative coordinates
  const p0 = { x: width * 0.35, y: height * 0.38 };
  const p1 = { x: width * 0.42, y: height * 0.62 };
  const p2 = { x: width * 0.50, y: height * 0.46 };
  const p3 = { x: width * 0.58, y: height * 0.62 };
  const p4 = { x: width * 0.65, y: height * 0.38 };

  const strokeWidth = width * 0.045; // Proportional thickness for the "W" stroke

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawPixels[rowOffset] = 0; // Filter byte: 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxRadius = width * 0.35; // Size of the circular logo

      if (dist < maxRadius) {
        // We are inside the circular gradient. Check if we should paint the letter "W"
        const d1 = distanceToSegment(x, y, p0.x, p0.y, p1.x, p1.y);
        const d2 = distanceToSegment(x, y, p1.x, p1.y, p2.x, p2.y);
        const d3 = distanceToSegment(x, y, p2.x, p2.y, p3.x, p3.y);
        const d4 = distanceToSegment(x, y, p3.x, p3.y, p4.x, p4.y);
        const minDistance = Math.min(d1, d2, d3, d4);

        if (minDistance < strokeWidth) {
          // White letter "W" (With simple 1px anti-aliasing approximation)
          const ratio = Math.min(1, Math.max(0, (strokeWidth - minDistance)));
          const factor = (x + y) / (width + height);
          const bgR = Math.round(99 + factor * 14);
          const bgG = Math.round(102 + factor * 63);
          const bgB = Math.round(241 - factor * 9);

          rawPixels[pixelOffset] = Math.round(bgR + (255 - bgR) * ratio);
          rawPixels[pixelOffset + 1] = Math.round(bgG + (255 - bgG) * ratio);
          rawPixels[pixelOffset + 2] = Math.round(bgB + (255 - bgB) * ratio);
        } else {
          // Circular linear gradient (indigo to sky-blue)
          const factor = (x + y) / (width + height);
          rawPixels[pixelOffset] = Math.round(99 + factor * 14);     // R: #6366f1
          rawPixels[pixelOffset + 1] = Math.round(102 + factor * 63); // G: #0ea5e9
          rawPixels[pixelOffset + 2] = Math.round(241 - factor * 9);  // B
        }
      } else {
        // Outer light slate background matching app style (#f1f5f9)
        rawPixels[pixelOffset] = 241;     // R
        rawPixels[pixelOffset + 1] = 245; // G
        rawPixels[pixelOffset + 2] = 249; // B
      }
    }
  }

  const compressedData = zlib.deflateSync(rawPixels);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Write PWA compliant icons with correct dimensions and white W logo
fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-192x192.png'), writePng(192, 192));
fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-512x512.png'), writePng(512, 512));
fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-maskable-512x512.png'), writePng(512, 512));
fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), writePng(180, 180));

console.log('Branded PWA icons with "W" logo successfully generated.');
