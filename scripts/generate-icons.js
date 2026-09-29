import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const PUBLIC_DIR = path.resolve('public');
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// 1. Create a beautiful SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0ea5e9;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="#f1f5f9"/>
  <circle cx="256" cy="256" r="180" fill="url(#grad)" filter="drop-shadow(4px 4px 10px rgba(0,0,0,0.15))" />
  <path d="M256 120 V256 L340 300" stroke="#ffffff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="256" cy="256" r="18" fill="#ffffff" />
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

function writePng(width, height, r, g, b) {
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
  // Each row requires 1 filter byte (0) followed by RGB pixels
  const rowSize = width * 3 + 1;
  const rawPixels = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawPixels[rowOffset] = 0; // Filter byte: 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      
      // Paint a beautiful circular gradient inside the icon box
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxRadius = width * 0.45;

      if (dist < maxRadius) {
        // Linear gradient look (indigo to teal)
        const factor = (x + y) / (width + height);
        rawPixels[pixelOffset] = Math.round(99 + factor * 14);     // R (indigo-sky)
        rawPixels[pixelOffset + 1] = Math.round(102 + factor * 63); // G
        rawPixels[pixelOffset + 2] = Math.round(241 - factor * 9);  // B
      } else {
        // Outer light slate background
        rawPixels[pixelOffset] = 241;     // R: #f1f5f9
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

// Write PWA compliant icons with correct internal dimensions
fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-192x192.png'), writePng(192, 192, 99, 102, 241));
fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-512x512.png'), writePng(512, 512, 99, 102, 241));
fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-maskable-512x512.png'), writePng(512, 512, 99, 102, 241));
fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), writePng(180, 180, 99, 102, 241));

console.log('Programmatic PWA PNG assets generated with exact dimensions.');
