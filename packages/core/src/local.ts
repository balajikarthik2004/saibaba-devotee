/**
 * Browser-side persistence for the few records a devotee edits about themselves.
 *
 * The mock arrays live in memory and reset on reload. That is fine for seeded data
 * nobody touches, but a family tree the devotee typed in is their own work, and
 * losing it on refresh reads as a bug rather than as a demo limitation. The user
 * object already survives — the auth store is wrapped in zustand's `persist` — so
 * this file covers what that store does not.
 *
 * Every access is wrapped: a private window, cleared site data, a storage quota
 * error or a browser configured to block site data must degrade to the seeded
 * value, never throw into a render.
 */

const NS = 'saibaba'

export const LOCAL_KEYS = {
  familyTrees: `${NS}:family-trees`,
  guestDonations: `${NS}:guest-donations`,
  emailPrefs: `${NS}:email-prefs`,
  /**
   * Approval decisions, and the roster they produce.
   *
   * The seeded arrays reset on every page load, which is fine for data nobody changes.
   * An approval chain is different: it deliberately spans two desks, and reaching the
   * second one means signing in as somebody else — a full page load. Without this, the
   * accounts desk verifies a payment and the committee opens a queue that never
   * received it, which makes the feature untestable and undemonstrable.
   */
  approvals: `${NS}:approvals`,
  rosterAssignments: `${NS}:roster-assignments`,
  /**
   * Volunteer campaigns, outreach and rosters.
   *
   * Same reasoning as `approvals`, for the same reason: the volunteer flow spans a
   * broadcast, the replies it draws and the roster those replies build, and demonstrating
   * it end to end means reloading between steps. Unlike the approval keys, this one also
   * holds records that exist nowhere else — a campaign the coordinator created has no
   * seeded original to fall back to — so created rows are stored whole while seeded rows
   * store only the fields a desk can change.
   */
  volunteers: `${NS}:volunteers`,
  /**
   * The store, the requirement sheets, and the priest's readiness sign-offs.
   *
   * This one has to persist for a reason the others do not: the requirement chain runs
   * priest → accounts → administrator, three sign-ins and therefore three page loads,
   * and the readiness screen at the end of it reads the stock the whole chain was about.
   * Without this, a sheet approved as the administrator is gone by the time you sign
   * back in as the priest to check it against the shelf.
   *
   * Stock is stored as movements plus the balance they arrive at, rather than as a bare
   * `onHand` figure, so a reload cannot leave the ledger and the count disagreeing.
   */
  inventory: `${NS}:inventory`,
} as const

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    // Unreadable or malformed — the seed is a better answer than a crash.
    return fallback
  }
}

export function writeLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Quota exceeded or storage denied. The in-memory copy still holds for this
    // session, so the save is not lost until the tab closes.
    return false
  }
}

export function clearLocal(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* nothing to do — the key is already unreachable */
  }
}
