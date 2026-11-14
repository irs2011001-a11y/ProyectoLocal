'use strict';
// Genera los iconos PNG sin dependencias: node tools/gen-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');
const C1 = [15, 118, 110], C2 = [13, 148, 136]; // teal degradado
const WHITE = [255, 255, 255];

const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const t = Buffer.from(type), len = Buffer.alloc(4), cr = Buffer.alloc(4);
  len.writeUInt32BE(data.length); cr.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, cr]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Pin de mapa (proyecto local) con moneda en el centro. Coordenadas 0..1.
function inPin(x, y, s) {
  x = (x - 0.5) / s + 0.5; y = (y - 0.5) / s + 0.5;
  const dx = x - 0.5, dy = y - 0.42;
  if (dx * dx + dy * dy <= 0.25 * 0.25) return true;
  // cola triangular desde tangentes hasta la punta (0.5, 0.82)
  const t = (y - 0.5) / (0.82 - 0.5);
  return t >= 0 && t <= 1 && Math.abs(x - 0.5) <= 0.215 * (1 - t);
}
const inCoin = (x, y, s) => { x = (x - 0.5) / s + 0.5; y = (y - 0.5) / s + 0.5; return (x - 0.5) ** 2 + (y - 0.42) ** 2 <= 0.12 ** 2; };
const inCoinDot = (x, y, s) => { x = (x - 0.5) / s + 0.5; y = (y - 0.5) / s + 0.5; return (x - 0.5) ** 2 + (y - 0.42) ** 2 <= 0.06 ** 2; };
function inRound(x, y, r) { // cuadrado redondeado
  const cx = Math.min(Math.max(x, r), 1 - r), cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function render(size, { rounded, scale }) {
  const buf = Buffer.alloc(size * size * 4), SS = 3;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const x = (px + (sx + 0.5) / SS) / size, y = (py + (sy + 0.5) / SS) / size;
      if (rounded && !inRound(x, y, 0.22)) continue;
      const k = (x + y) / 2;
      let c = C1.map((v, i) => v + (C2[i] - v) * k);
      if (inPin(x, y, scale)) c = inCoin(x, y, scale) ? C1 : WHITE;
      if (inCoinDot(x, y, scale)) c = WHITE;
      r += c[0]; g += c[1]; b += c[2]; a += 255;
    }
    const n = SS * SS, i = (py * size + px) * 4;
    const cov = a / 255;
    buf[i] = cov ? r / cov : 0; buf[i + 1] = cov ? g / cov : 0; buf[i + 2] = cov ? b / cov : 0; buf[i + 3] = Math.round(a / n);
  }
  return buf;
}

fs.mkdirSync(OUT, { recursive: true });
const files = [
  ['icon-192.png', 192, { rounded: true, scale: 1 }],
  ['icon-512.png', 512, { rounded: true, scale: 1 }],
  ['icon-maskable-512.png', 512, { rounded: false, scale: 0.78 }],
  ['apple-touch-icon.png', 180, { rounded: false, scale: 0.9 }]
];
for (const [name, size, opt] of files) fs.writeFileSync(path.join(OUT, name), png(size, render(size, opt)));

fs.writeFileSync(path.join(OUT, 'icon.svg'),
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f766e"/><stop offset="1" stop-color="#0d9488"/></linearGradient></defs>
<rect width="512" height="512" rx="113" fill="url(#g)"/>
<path d="M256 123a128 128 0 0 0-128 128c0 44 26 74 62 118l66 41 66-41c36-44 62-74 62-118A128 128 0 0 0 256 123z" fill="#fff"/>
<circle cx="256" cy="215" r="61" fill="#0f766e"/><circle cx="256" cy="215" r="31" fill="#fff"/>
</svg>
`);
console.log('Iconos generados en', OUT);
