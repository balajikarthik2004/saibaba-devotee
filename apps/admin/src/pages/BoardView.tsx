import Transparency from './Transparency'

/**
 * Section 11.13 — the same figures as `/transparency`, read-only, with the AGM
 * print action promoted. Role-gated to `board` by the router.
 */
export default function BoardView() {
  return <Transparency readOnly />
}
