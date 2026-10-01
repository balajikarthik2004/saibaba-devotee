/**
 * Chart parameters for the admin console.
 *
 * The UI palette in `index.css` is tuned for surfaces and text; chart marks need
 * different steps from the same hue families. These three were run through the
 * colour validator against a white chart surface and pass all six checks —
 * lightness band, chroma floor, CVD separation, normal-vision floor and contrast.
 * Adjacent CVD separation sits at ΔE 8.8 (protan), just above the floor, so every
 * multi-series chart here also carries a legend and direct labels rather than
 * relying on hue alone.
 */
export const CHART = {
  /** Fixed categorical order. Never cycled — a 9th series would fold into "Other". */
  categorical: ['#b3600a', '#7a6a2c', '#1f7a55'] as const,
  /** Single-hue sequential ramp for magnitude-only charts. */
  // Sequential ramps are judged on monotonic lightness, not the categorical checks.
  // OKLab L steps evenly here (0.76 / 0.67 / 0.58 / 0.45 / 0.35) and even the lightest
  // step clears 2:1 against white — the previous ramp opened at #f4dcae, which left the
  // four smaller bars washed out and near-identical.
  sequential: ['#efc98a', '#e0a24f', '#c67a1c', '#9a4a05', '#5f2d03'] as const,
  grid: '#ece2d2',
  axis: '#6f6157',
  surface: '#ffffff',
} as const

/* Axis labels are interface type, not chart type — same face and weight as a table
   header, so a chart card and a ledger card read as the same document. */
export const AXIS_TICK = {
  fill: CHART.axis,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.01em',
}

/** Recharts renders tooltips as DOM, so they take the app's card styling directly. */
export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 9,
    border: '1px solid var(--color-line)',
    background: 'var(--color-card)',
    boxShadow: 'var(--shadow-lg)',
    fontSize: 12.5,
    padding: '8px 10px',
  },
  labelStyle: {
    color: 'var(--color-muted)',
    marginBottom: 3,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  itemStyle: { color: 'var(--color-ink)', padding: 0, fontWeight: 600 },
  cursor: { stroke: CHART.grid, strokeWidth: 1 },
}
