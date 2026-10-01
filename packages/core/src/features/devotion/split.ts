/**
 * Pure chapter-splitting logic for parayan groups (no imports, so a plain node script can
 * verify it). Every chapter must be assigned to exactly one member.
 */
export const TOTAL_CHAPTERS = 51

/** Contiguous, fair blocks: sizes differ by at most one, earlier members take the extra. */
export function splitChapters(memberCount: number, total = TOTAL_CHAPTERS): number[][] {
  if (memberCount <= 0) return []
  const base = Math.floor(total / memberCount)
  const extra = total % memberCount
  const out: number[][] = []
  let next = 1
  for (let i = 0; i < memberCount; i++) {
    const size = base + (i < extra ? 1 : 0)
    out.push(Array.from({ length: size }, (_, k) => next + k))
    next += size
  }
  return out
}

/**
 * Re-balance after a member joins or leaves. Chapters a member has already read stay
 * with them; the unread remainder is dealt out so totals stay as even as possible.
 * `members` carries each member's current assignment and what of it they have read.
 */
export function rebalance(
  members: { key: string; assigned: number[]; read: number[] }[],
  total = TOTAL_CHAPTERS,
): Record<string, number[]> {
  const result: Record<string, number[]> = {}
  const taken = new Set<number>()
  for (const m of members) {
    const kept = m.assigned.filter((c) => m.read.includes(c) && c >= 1 && c <= total)
    result[m.key] = [...new Set(kept)]
    kept.forEach((c) => taken.add(c))
  }
  for (let c = 1; c <= total; c++) {
    if (taken.has(c)) continue
    let best: string | undefined
    for (const m of members) {
      if (best === undefined || result[m.key]!.length < result[best]!.length) best = m.key
    }
    if (best === undefined) break
    result[best]!.push(c)
  }
  for (const k of Object.keys(result)) result[k]!.sort((a, b) => a - b)
  return result
}
