import { cn } from '@/lib/utils'
import { useT } from '@saibaba/core'

/**
 * The Shree Saibaba mark: sacred diya with eternal flame over a lotus base with radiant aura.
 */
export function Logo({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <img
      src="/logo.svg"
      width={size}
      height={size}
      alt="Shree Saibaba"
      aria-hidden="true"
      className={cn('shrink-0 select-none object-contain drop-shadow-xs', className)}
    />
  )
}

export function LogoWordmark({ compact = false }: { compact?: boolean }) {
  const t = useT()
  return (
    <span className="flex shrink-0 items-center gap-2.5">
      <Logo size={compact ? 32 : 40} />
      <span className="flex min-w-0 flex-col justify-center leading-tight">
        <span className="block truncate font-serif text-lg font-bold tracking-tight text-brand-900">
          {t('brand.name', 'Shree Saibaba')}
        </span>
        {!compact && (
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-saffron-700">
            {t('brand.console', 'Operations Console')}
          </span>
        )}
      </span>
    </span>
  )
}
