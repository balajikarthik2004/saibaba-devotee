import { Link } from 'react-router-dom'
import { Check, ChevronDown, MapPin, Search } from 'lucide-react'
import { useCurrentTemple, useT, useTempleStore } from '@saibaba/core'
import { TEMPLES } from '@/lib/data/mock'
import { Popover } from '@/components/ui/overlay'
import { cn } from '@/lib/utils'

/**
 * Header control: shows the temple you are looking at and lets you switch to another.
 * Switching only changes the session's selected temple (every temple-scoped read follows
 * it); the full finder with search and distance lives at /temples.
 */
export function TempleSwitcher({ className }: { className?: string }) {
  const t = useT()
  const current = useCurrentTemple()
  const setTempleId = useTempleStore((s) => s.setTempleId)

  return (
    <Popover
      align="end"
      className="w-[300px] max-w-[calc(100vw-2rem)]"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={t('temple.switch', 'Change temple — currently {name}', { name: current.name })}
          className={cn(
            'flex h-9 max-w-[190px] items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[13px] font-medium text-ink transition-colors hover:bg-tint',
            className,
          )}
        >
          <MapPin className="size-4 shrink-0 text-brand-500" aria-hidden="true" />
          <span className="hidden truncate sm:inline">{current.city}</span>
          <ChevronDown
            className={cn('size-3.5 shrink-0 text-muted transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      )}
    >
      {(close) => (
        <div>
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {t('temple.yourTemple', 'Choose your temple')}
          </p>
          <ul className="max-h-[320px] overflow-y-auto">
            {TEMPLES.map((tp) => {
              const active = tp.id === current.id
              return (
                <li key={tp.id}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => {
                      setTempleId(tp.id)
                      close()
                    }}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-tint',
                      active && 'bg-tint',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {tp.name}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        {tp.city}, {tp.state} · {tp.country}
                      </span>
                    </span>
                    {active ? <Check className="mt-0.5 size-4 shrink-0 text-brand-500" /> : null}
                  </button>
                </li>
              )
            })}
          </ul>
          <Link
            to="/temples"
            onClick={close}
            className="mt-1 flex items-center gap-2 border-t border-line px-2.5 pb-1 pt-2.5 text-[13px] font-medium text-brand-600 hover:text-brand-700"
          >
            <Search className="size-4" aria-hidden="true" />
            {t('temple.find', 'Find a temple')}
          </Link>
        </div>
      )}
    </Popover>
  )
}
