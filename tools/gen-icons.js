// Generates icon-192.png and icon-512.png from the same drawing as icon.svg.
const zlib = require("zlib");
const fs = require("fs");

function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------- drawing (coordinates in 512 space) ---------- */
const BG = [13, 20, 32];
const BLUE = [56, 189, 248];
const GREEN = [47, 212, 138];

function inRoundRect(x, y, x0, y0, w, h, r) {
  if (x < x0 || x > x0 + w || y < y0 || y > y0 + h) return false;
  const cx = Math.max(x0 + r, Math.min(x, x0 + w - r));
  const cy = Math.max(y0 + r, Math.min(y, y0 + h - r));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inTriangle(px, py, a, b, c) {
  const s1 = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
  const s2 = (c[0] - b[0]) * (py - b[1]) - (c[1] - b[1]) * (px - b[0]);
  const s3 = (a[0] - c[0]) * (py - c[1]) - (a[1] - c[1]) * (px - c[0]);
  const neg = s1 < 0 || s2 < 0 || s3 < 0;
  const pos = s1 > 0 || s2 > 0 || s3 > 0;
  return !(neg && pos);
}

function colorAt(x, y) { // x,y in 0..512
  if (!inRoundRect(x, y, 0, 0, 512, 512, 110)) return null;
  // green (drawn first, bottom)
  if (inRoundRect(x, y, 162, 314, 240, 56, 12) ||
      inTriangle(x, y, [162, 284], [88, 342], [162, 400])) return GREEN;
  // blue (top)
  if (inRoundRect(x, y, 110, 142, 240, 56, 12) ||
      inTriangle(x, y, [350, 112], [424, 170], [350, 228])) return BLUE;
  return BG;
}

function render(size) {
  const SS = 4; // supersample
  const big = size * SS;
  const acc = new Float64Array(size * size * 4);
  for (let y = 0; y < big; y++) {
    for (let x = 0; x < big; x++) {
      const c = colorAt(((x + 0.5) / big) * 512, ((y + 0.5) / big) * 512);
      const dy = Math.floor(y / SS), dx = Math.floor(x / SS);
      const i = (dy * size + dx) * 4;
      if (c) {
        acc[i] += c[0]; acc[i + 1] += c[1]; acc[i + 2] += c[2]; acc[i + 3] += 255;
      }
    }
  }
  const out = Buffer.alloc(size * size * 4);
  const n = SS * SS;
  for (let i = 0; i < out.length; i += 4) {
    out[i] = Math.round(acc[i] / n);
    out[i + 1] = Math.round(acc[i + 1] / n);
    out[i + 2] = Math.round(acc[i + 2] / n);
    out[i + 3] = Math.round(acc[i + 3] / n);
  }
  return out;
}

for (const size of [192, 512]) {
  fs.writeFileSync(`icon-${size}.png`, encodePNG(size, render(size)));
  console.log(`icon-${size}.png written`);
}
