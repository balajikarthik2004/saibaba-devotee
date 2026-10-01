import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, MapPin, Search } from 'lucide-react'
import { useCurrentTemple, useT, useTempleStore } from '@saibaba/core'
import { listTemples } from '@saibaba/core/features/tenancy'
import type { Temple } from '@saibaba/core/types'
import { useAuthStore } from '@/lib/store/auth'
import { useAsync } from '@/lib/hooks'
import { cn } from '@/lib/utils'

const STATUS_DOT: Record<Temple['status'], string> = {
  active: 'bg-leaf-500',
  onboarding: 'bg-saffron-500',
  suspended: 'bg-faint',
}

/**
 * Which temple the console is looking at.
 *
 * Staff roles are scoped to the temple they belong to and see it as a static label.
 * The `platform` role sees a searchable switcher across every temple; choosing one
 * writes `useTempleStore`, and AdminLayout remounts the routed page so it refetches.
 */
export function TempleSwitcher({ className }: { className?: string }) {
  const t = useT()
  const role = useAuthStore((s) => s.user?.role)
  const current = useCurrentTemple()

  if (role !== 'platform') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-[10px] border border-line bg-card px-2.5 py-1.5 text-left',
          className,
        )}
        title={t('temple.yourTemple', 'Your temple')}
      >
        <MapPin className="size-3.5 shrink-0 text-brand-600" aria-hidden />
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-ink">{current.name}</span>
          <span className="block truncate text-2xs text-muted">
            {current.city} · {current.currency}
          </span>
        </span>
      </div>
    )
  }
  return <PlatformSwitcher className={className} />
}

function PlatformSwitcher({ className }: { className?: string }) {
  const t = useT()
  const current = useCurrentTemple()
  const setTempleId = useTempleStore((s) => s.setTempleId)
  const { data } = useAsync(() => listTemples({ includeAll: true }), [])
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    input.current?.focus()
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const all = data ?? []
    if (!needle) return all
    return all.filter((x) =>
      [x.name, x.city, x.state, x.country, x.currency].some((s) => s.toLowerCase().includes(needle)),
    )
  }, [data, q])

  return (
    <div ref={wrap} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('temple.switch', 'Switch temple')}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-[10px] border border-line bg-card px-2.5 py-1.5 text-left transition-colors hover:border-hairline"
      >
        <MapPin className="size-3.5 shrink-0 text-brand-600" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-ink">{current.name}</span>
          <span className="block truncate text-2xs text-muted">
            {current.city} · {current.currency}
          </span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted" aria-hidden />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-[min(320px,calc(100vw-2rem))] rounded-[12px] border border-hairline bg-card p-2 shadow-[var(--shadow-lg)]">
          <label className="relative block">
            <span className="sr-only">{t('temple.search', 'Search temples')}</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('temple.searchPlaceholder', 'Search by name, city, country')}
              className="h-8 w-full rounded-[8px] border border-line bg-bg pl-8 pr-2 text-xs text-ink placeholder:text-faint"
            />
          </label>
          <ul role="listbox" className="mt-1.5 max-h-72 overflow-y-auto">
            {rows.length === 0 ? (
              <li className="px-2 py-3 text-xs text-muted">{t('temple.none', 'No temples match.')}</li>
            ) : (
              rows.map((x) => {
                const selected = x.id === current.id
                return (
                  <li key={x.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        setTempleId(x.id)
                        setOpen(false)
                        setQ('')
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left hover:bg-tint',
                        selected && 'bg-tint',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[x.status])}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-ink">{x.name}</span>
                        <span className="block truncate text-2xs text-muted">
                          {x.city}, {x.country} · {x.currency} · {x.status}
                        </span>
                      </span>
                      {selected ? <Check className="size-3.5 text-brand-600" /> : null}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
