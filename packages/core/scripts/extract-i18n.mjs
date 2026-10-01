#!/usr/bin/env node
/**
 * Dev-only i18n key extraction.
 *   node packages/core/scripts/extract-i18n.mjs [--check]
 * Scans apps/*\/src and packages/core/src for  t('key', 'English')  calls (single, double or
 * backtick-without-interpolation literals, multi-line OK) and writes
 * packages/core/src/i18n-dictionaries/keys.en.json (key -> English).
 * Also understands tp('key', n, { one: '..', other: '..' }) -> key.one / key.other.
 * Reports keys used with conflicting English. --check exits 1 on conflicts.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const roots = [join(repo, 'packages/core/src')]
const appsDir = join(repo, 'apps')
if (existsSync(appsDir)) {
  for (const a of readdirSync(appsDir)) {
    const s = join(appsDir, a, 'src')
    if (existsSync(s)) roots.push(s)
  }
}
const OUT = join(repo, 'packages/core/src/i18n-dictionaries/keys.en.json')
const BS = String.fromCharCode(92) // backslash
const SKIP_DIRS = new Set(['node_modules', 'dist', 'i18n-dictionaries'])

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) yield* walk(p)
    else if (/\.(tsx?|jsx?|mjs)$/.test(name) && !/\.d\.ts$/.test(name)) yield p
  }
}

/** Parse a string literal starting at src[i] (a quote char). Returns [value, nextIndex] or null. */
function readLiteral(src, i) {
  const q = src[i]
  if (q !== "'" && q !== '"' && q !== '`') return null
  let out = ''
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j]
    if (c === BS) {
      const n = src[j + 1]
      out += n === 'n' ? '\n' : n === 't' ? '\t' : n
      j++
      continue
    }
    if (q === '`' && c === '$' && src[j + 1] === '{') return null // interpolation: not extractable
    if (c === q) return [out, j + 1]
    if (c === '\n' && q !== '`') return null
    out += c
  }
  return null
}

const skipWs = (s, i) => {
  for (;;) {
    while (i < s.length && /\s/.test(s[i])) i++
    if (s.startsWith('//', i)) { while (i < s.length && s[i] !== '\n') i++; continue }
    if (s.startsWith('/*', i)) { const e = s.indexOf('*/', i + 2); i = e < 0 ? s.length : e + 2; continue }
    return i
  }
}

/** Literal, optionally concatenated with '+' of literals. */
function readConcat(src, i) {
  let r = readLiteral(src, i)
  if (!r) return null
  let [v, j] = r
  for (;;) {
    let k = skipWs(src, j)
    if (src[k] !== '+') return [v, j]
    k = skipWs(src, k + 1)
    const n = readLiteral(src, k)
    if (!n) return [v, j]
    v += n[0]
    j = n[1]
  }
}

const found = new Map() // key -> Map(english -> [locations])
let calls = 0
function add(key, en, file, line) {
  calls++
  if (!found.has(key)) found.set(key, new Map())
  const m = found.get(key)
  if (!m.has(en)) m.set(en, [])
  m.get(en).push(`${relative(repo, file).split(BS).join('/')}:${line}`)
}

const callRe = /(?<![\w$])(t|tp)\(/g
for (const root of roots) {
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8')
    callRe.lastIndex = 0
    let m
    while ((m = callRe.exec(src))) {
      const fn = m[1]
      let i = skipWs(src, m.index + m[0].length)
      const k = readLiteral(src, i)
      if (!k || !/^[\w.-]+$/.test(k[0])) continue
      const key = k[0]
      const line = src.slice(0, m.index).split('\n').length
      i = skipWs(src, k[1])
      if (src[i] !== ',') continue
      i = skipWs(src, i + 1)
      if (fn === 't') {
        const en = readConcat(src, i)
        if (en) add(key, en[0], file, line)
      } else {
        // tp(key, count, { one: '..', other: '..' })
        const brace = src.indexOf('{', i)
        const end = brace < 0 ? -1 : src.indexOf('}', brace)
        if (brace < 0 || end < 0 || brace - i > 80) continue
        const body = src.slice(brace, end + 1)
        const formRe = /\b(zero|one|two|few|many|other)\s*:\s*/g
        let f
        while ((f = formRe.exec(body))) {
          const lit = readConcat(body, f.index + f[0].length)
          if (lit) add(`${key}.${f[1]}`, lit[0], file, line)
        }
      }
    }
  }
}

const out = {}
const conflicts = []
for (const key of [...found.keys()].sort()) {
  const variants = found.get(key)
  const first = [...variants.keys()][0]
  out[key] = first
  if (variants.size > 1) conflicts.push([key, variants])
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`i18n: ${calls} calls, ${Object.keys(out).length} unique keys -> ${relative(repo, OUT)}`)
if (conflicts.length) {
  console.warn(`\n${conflicts.length} key(s) with conflicting English (first one kept):`)
  for (const [key, variants] of conflicts) {
    console.warn(`  ${key}`)
    for (const [en, locs] of variants) console.warn(`    "${en}"  <- ${locs.slice(0, 3).join(', ')}`)
  }
  if (process.argv.includes('--check')) process.exit(1)
}
