#!/usr/bin/env node
/**
 * Generates the PWA icon set (original mark: a rising sun over a diya flame) using only
 * node built-ins. One geometry source -> SVG + hand-rasterised PNG (no sharp needed).
 *   node apps/devotee/scripts/gen-icons.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons')
mkdirSync(out, { recursive: true })

const BG_TOP = [0xb4, 0x2a, 0x1c]
const BG_BOT = [0x7f, 0x15, 0x0f]
const IVORY = [0xfb, 0xf6, 0xec]
const SAFFRON = [0xf8, 0xc9, 0x5f]
const GOLD = [0xd7, 0xbc, 0x78]
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')

// Geometry in a 0..100 box, absolute commands M L C Q Z only.
const rays = []
for (let k = 0; k <= 6; k++) {
  const a = Math.PI + (k * Math.PI) / 6
  const [cx, cy, r0, r1, w] = [50, 46, 21, 31, 1.6]
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx
  const p = (r, s) => `${(cx + dx * r + nx * s).toFixed(2)} ${(cy + dy * r + ny * s).toFixed(2)}`
  rays.push(`M${p(r0, -w)} L${p(r1, -w * 0.7)} L${p(r1, w * 0.7)} L${p(r0, w)} Z`)
}
const shapes = [
  { d: rays.join(' '), fill: SAFFRON },
  { d: 'M27 61 L73 61 Q71 80 50 82 Q29 80 27 61 Z', fill: GOLD },
  { d: 'M50 27 C57 37 61 45 50 58 C39 45 43 37 50 27 Z', fill: IVORY },
]

function flatten(d) {
  const polys = []
  let cur = [], pos = [0, 0]
  const t = d.match(/[MLCQZ]|-?\d*\.?\d+/g)
  for (let i = 0; i < t.length; ) {
    const c = t[i++]
    const n = () => parseFloat(t[i++])
    if (c === 'M') { if (cur.length) polys.push(cur); pos = [n(), n()]; cur = [pos] }
    else if (c === 'L') { pos = [n(), n()]; cur.push(pos) }
    else if (c === 'Q') {
      const [x1, y1, x, y] = [n(), n(), n(), n()], [x0, y0] = pos
      for (let s = 1; s <= 16; s++) { const u = s / 16, v = 1 - u
        cur.push([v * v * x0 + 2 * v * u * x1 + u * u * x, v * v * y0 + 2 * v * u * y1 + u * u * y]) }
      pos = [x, y]
    } else if (c === 'C') {
      const [x1, y1, x2, y2, x, y] = [n(), n(), n(), n(), n(), n()], [x0, y0] = pos
      for (let s = 1; s <= 24; s++) { const u = s / 24, v = 1 - u
        cur.push([v ** 3 * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u ** 3 * x,
                  v ** 3 * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u ** 3 * y]) }
      pos = [x, y]
    } else if (c === 'Z') { if (cur.length) polys.push(cur); cur = [] }
  }
  if (cur.length) polys.push(cur)
  return polys
}
const flat = shapes.map((s) => ({ polys: flatten(s.d), fill: s.fill }))
const inPoly = (p, x, y) => {
  let inside = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function svg(maskable) {
  const bg = maskable
    ? '<rect width="100" height="100" fill="url(#g)"/>'
    : '<rect width="100" height="100" rx="22" fill="url(#g)"/>'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hex(BG_TOP)}"/><stop offset="1" stop-color="${hex(BG_BOT)}"/></linearGradient></defs>
${bg}
${shapes.map((s) => `<path d="${s.d}" fill="${hex(s.fill)}"/>`).join('\n')}
</svg>
`
}

function raster(size, maskable) {
  const SS = 3
  const px = Buffer.alloc(size * size * 4)
  const scale = 100 / size
  // bounding boxes
  const items = flat.map((s) => ({ ...s, boxes: s.polys.map((p) => {
    const xs = p.map((q) => q[0]), ys = p.map((q) => q[1])
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  }) }))
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const ux = (x + (sx + 0.5) / SS) * scale, uy = (y + (sy + 0.5) / SS) * scale
      // rounded-square coverage for the "any" icon
      if (!maskable) {
        const rad = 22, cx = Math.min(Math.max(ux, rad), 100 - rad), cy = Math.min(Math.max(uy, rad), 100 - rad)
        if ((ux - cx) ** 2 + (uy - cy) ** 2 > rad * rad) continue
      }
      const t = uy / 100
      let col = BG_TOP.map((v, i) => v + (BG_BOT[i] - v) * t)
      for (const it of items) {
        let hit = false
        for (let k = 0; k < it.polys.length && !hit; k++) {
          const bx = it.boxes[k]
          if (ux < bx[0] || ux > bx[2] || uy < bx[1] || uy > bx[3]) continue
          hit = inPoly(it.polys[k], ux, uy)
        }
        if (hit) col = it.fill
      }
      r += col[0]; g += col[1]; b += col[2]; a++
    }
    const o = (y * size + x) * 4, n = SS * SS
    px[o] = a ? r / a : 0; px[o + 1] = a ? g / a : 0; px[o + 2] = a ? b / a : 0; px[o + 3] = Math.round((a / n) * 255)
  }
  return png(size, px)
}

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function png(size, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
    return Buffer.concat([len, td, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4) }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

writeFileSync(`${out}/icon.svg`, svg(false))
writeFileSync(`${out}/icon-maskable.svg`, svg(true))
writeFileSync(`${out}/icon-192.png`, raster(192, false))
writeFileSync(`${out}/icon-512.png`, raster(512, false))
writeFileSync(`${out}/icon-maskable-512.png`, raster(512, true))
writeFileSync(`${out}/apple-touch-icon.png`, raster(180, true))
console.log('icons written to', out)
