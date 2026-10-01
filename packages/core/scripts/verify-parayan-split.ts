/**
 * Verifies that parayan group splitting assigns every chapter (1-51) exactly once, with
 * fair sizes, for every group size and after rebalancing.
 * Run:  node --experimental-strip-types packages/core/scripts/verify-parayan-split.ts
 */
import { splitChapters, rebalance, TOTAL_CHAPTERS } from '../src/features/devotion/split.ts'

let failures = 0
const fail = (msg: string) => {
  failures++
  console.error('FAIL', msg)
}

function check(label: string, groups: number[][], pinned = 0) {
  const all = groups.flat().sort((a, b) => a - b)
  if (all.length !== TOTAL_CHAPTERS) fail(`${label}: ${all.length} chapters assigned, expected ${TOTAL_CHAPTERS}`)
  for (let c = 1; c <= TOTAL_CHAPTERS; c++) {
    const n = all.filter((x) => x === c).length
    if (n !== 1) fail(`${label}: chapter ${c} assigned ${n} times`)
  }
  const sizes = groups.map((g) => g.length)
  // Chapters already read stay with their reader, so after a rebalance the ceiling is the larger
  // of an even share and what a member has already read.
  const ceiling = Math.max(Math.ceil(TOTAL_CHAPTERS / groups.length), pinned)
  if (Math.max(...sizes) > ceiling) fail(`${label}: unfair sizes ${sizes.join(',')}`)
  if (!pinned && Math.max(...sizes) - Math.min(...sizes) > 1) fail(`${label}: sizes differ by more than one`)
}

for (let n = 1; n <= 60; n++) {
  const split = splitChapters(n)
  check(`split(${n})`, split)

  // A member reads the first 2 chapters of their block, then someone joins, then someone leaves.
  const members = split.map((assigned, i) => ({ key: `m${i}`, assigned, read: assigned.slice(0, 2) }))
  const joined = rebalance([...members, { key: 'new', assigned: [], read: [] }])
  check(`join(${n})`, Object.values(joined), 2)
  for (const m of members) {
    for (const c of m.read) if (!joined[m.key]!.includes(c)) fail(`join(${n}): ${m.key} lost read chapter ${c}`)
  }
  if (n > 1) {
    const left = rebalance(members.slice(1).map((m) => ({ ...m, read: m.read })))
    // The leaver's read chapters return to the pool (they are unread from the group's view).
    check(`leave(${n})`, Object.values(left), 2)
  }
}

if (failures) {
  console.error(`${failures} failure(s)`)
  process.exit(1)
}
console.log('OK: every chapter assigned exactly once for group sizes 1-60 (split, join, leave).')
