import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    for (let j = 0; j < 8; j++) {
      const bit = (byte ^ crc) & 1;
      crc = (crc >>> 1) ^ (bit ? 0xedb88320 : 0);
      byte >>>= 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(size) {
  const width = size;
  const height = size;
  const rows = [];

  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // No filter

    for (let x = 0; x < width; x++) {
      const offset = 1 + x * 4;
      const nx = (x / (width - 1)) * 2 - 1;
      const ny = (y / (height - 1)) * 2 - 1;
      const r = Math.hypot(nx, ny);

      // Squircle background: corner radius ~ 0.25
      const cornerR = 0.22;
      const dX = Math.max(0, Math.abs(nx) - (1 - cornerR * 2));
      const dY = Math.max(0, Math.abs(ny) - (1 - cornerR * 2));
      const dist = Math.hypot(dX, dY);

      if (dist > cornerR * 2) {
        // Transparent outside squircle
        row[offset] = 0;
        row[offset + 1] = 0;
        row[offset + 2] = 0;
        row[offset + 3] = 0;
        continue;
      }

      // Background color: warm terracotta / brass (#b4532a -> #8a3d1f)
      const grad = (y / height);
      let red = Math.round(180 - grad * 42);
      let green = Math.round(83 - grad * 22);
      let blue = Math.round(42 - grad * 11);

      // Inner card 1 (back tab card)
      const inBackCard = (nx > -0.55 && nx < 0.35 && ny > -0.65 && ny < 0.35);
      // Inner card 2 (front tab card)
      const inFrontCard = (nx > -0.35 && nx < 0.55 && ny > -0.35 && ny < 0.65);

      if (inFrontCard) {
        // Front tab card: warm creamy paper (#faf5ec)
        red = 250;
        green = 245;
        blue = 236;
        // subtle header line
        if (ny > -0.35 && ny < -0.15) {
          red = 220;
          green = 205;
          blue = 185;
        }
      } else if (inBackCard) {
        // Back tab card: muted paper (#dfd3be)
        red = 223;
        green = 211;
        blue = 190;
      }

      // Border antialiasing
      let alpha = 255;
      const edge = cornerR * 2 - dist;
      if (edge < 0.08) {
        alpha = Math.max(0, Math.min(255, Math.round((edge / 0.08) * 255)));
      }

      row[offset] = red;
      row[offset + 1] = green;
      row[offset + 2] = blue;
      row[offset + 3] = alpha;
    }
    rows.push(row);
  }

  const rawData = Buffer.concat(rows);
  const compressed = zlib.deflateSync(rawData);

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk("IHDR", ihdr);
  const idatChunk = makeChunk("IDAT", compressed);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.resolve("apps/extension/icons");
fs.mkdirSync(iconsDir, { recursive: true });

fs.writeFileSync(path.join(iconsDir, "icon16.png"), createPng(16));
fs.writeFileSync(path.join(iconsDir, "icon48.png"), createPng(48));
fs.writeFileSync(path.join(iconsDir, "icon128.png"), createPng(128));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
  <rect width="128" height="128" rx="28" fill="url(#brandGrad)" />
  <rect x="24" y="22" width="60" height="68" rx="8" fill="#e8ded0" opacity="0.85" />
  <rect x="44" y="38" width="60" height="68" rx="8" fill="#faf5ec" />
  <rect x="52" y="48" width="28" height="6" rx="3" fill="#b4532a" />
  <rect x="52" y="60" width="44" height="4" rx="2" fill="#d4c8b4" />
  <rect x="52" y="70" width="36" height="4" rx="2" fill="#d4c8b4" />
  <defs>
    <linearGradient id="brandGrad" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
      <stop stop-color="#c85a2e" />
      <stop offset="1" stop-color="#8a3d1f" />
    </linearGradient>
  </defs>
</svg>`;

fs.writeFileSync(path.join(iconsDir, "icon.svg"), svg, "utf8");
console.log("Icons generated successfully!");
