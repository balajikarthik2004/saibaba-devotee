import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Publishes the pinned header's height as `--page-chrome-h` on the document root.
 *
 * A table's own `<thead>` is sticky too, and with both pinned at `top: 0` the column
 * headings simply slid underneath this block — so scrolling to row 40 of the donation
 * ledger left you reading eight columns of figures with no headings at all, which is
 * strictly worse than not pinning anything. The thead now sticks to the bottom edge of
 * this block instead, and the two stack.
 *
 * Measured rather than hard-coded because the block's height is genuinely variable:
 * a page with tabs and filters is roughly twice the height of one with neither, and a
 * long title wraps at narrow widths.
 */
function useChromeHeight() {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const write = () => root.style.setProperty('--page-chrome-h', `${el.offsetHeight}px`)
    write()
    const ro = new ResizeObserver(write)
    ro.observe(el)
    return () => {
      ro.disconnect()
      // Leaving a stale height behind would push the next page's table headings down
      // by the height of a header that no longer exists.
      root.style.removeProperty('--page-chrome-h')
    }
  }, [])

  return ref
}

/**
 * The one page skeleton every screen in the console fills in.
 *
 * Before this, each page invented its own opening: some had an eyebrow and some did
 * not, filters floated at a different distance from the title on every route, and the
 * primary action sat wherever the markup happened to put it. Fifteen pages, fifteen
 * headers — which is the specific thing that makes an application look like it was
 * assembled rather than designed.
 *
 * The header, its tabs and its filters are one sticky block. That matters in an ops
 * console more than it does on a marketing page: a donation ledger runs to 250 rows,
 * and scrolling to row 90 used to take the filter controls, the tab you were in and
 * the export button off screen together — so narrowing a search meant scrolling back
 * up to find the controls, then scrolling down again to read the result.
 *
 * Content scrolls underneath, and the block is fully opaque. Frosted glass was the
 * first cut and donor names ghosted legibly through the header of the very page whose
 * job is to be read accurately.
 */
export function PageShell({
  title,
  description,
  eyebrow,
  actions,
  tabs,
  toolbar,
  back,
  children,
  className,
}: {
  title: React.ReactNode
  /** One line under the title — the count, the total, the date. Not a paragraph. */
  description?: React.ReactNode
  /** The sidebar group this page belongs to, so title and nav agree on where you are. */
  eyebrow?: React.ReactNode
  /** Primary and secondary actions, right-aligned on the title row. */
  actions?: React.ReactNode
  /** A `<Tabs>` element. Sits on the header's bottom edge and shares its rule. */
  tabs?: React.ReactNode
  /** A `<Toolbar>` element. Gets its own band under the header, pinned with it. */
  toolbar?: React.ReactNode
  /** Detail pages only: the list this record came from. */
  back?: { to: string; label: string }
  children: React.ReactNode
  className?: string
}) {
  const chromeRef = useChromeHeight()

  return (
    <>
      {/* Pinned from `lg` up only. On a phone the same block — title, wrapped actions,
          tabs and a filter row that reflows to three lines — came to roughly 40% of the
          viewport, so pinning it meant reading a ledger through a letterbox. Below `lg`
          it scrolls away like any other content and the thumb brings it back. */}
      <div
        ref={chromeRef}
        className="page-chrome app-chrome z-20 border-b border-hairline lg:sticky lg:top-0"
      >
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          {back ? (
            <Link
              to={back.to}
              className="-ml-1 mt-2.5 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-1 py-0.5 text-xs font-semibold text-muted transition-colors hover:text-brand-600"
            >
              <ArrowLeft className="size-3.5" />
              {back.label}
            </Link>
          ) : null}

          <div
            className={cn(
              'flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-3',
              back ? 'pt-2' : 'pt-4',
            )}
          >
            <div className="min-w-0">
              {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
              {/* Marcellus at 26px, matching the devotee portal's page titles. */}
              <h1 className="truncate font-serif text-2xl text-ink">{title}</h1>
              {description ? (
                <p className="mt-0.5 truncate text-sm text-muted">{description}</p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2 pb-0.5">{actions}</div>
            ) : null}
          </div>

          {/* Tabs sit on the header's own bottom rule rather than drawing a second
              one two pixels below it. */}
          {tabs ? <div className="-mb-px">{tabs}</div> : null}
        </div>

        {toolbar ? (
          <div className="border-t border-line-soft bg-card/70">
            <div className="mx-auto w-full max-w-[1400px] px-4 py-2 sm:px-6 lg:px-8">{toolbar}</div>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          'animate-fade-in mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8',
          className,
        )}
      >
        {children}
      </div>
    </>
  )
}
