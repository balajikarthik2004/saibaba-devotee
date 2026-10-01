import { useCurrentTemple } from '@saibaba/core'
import { cn } from '@/lib/utils'

/** The Shree Saibaba mark — sacred diya flame with divine lotus and radiant aura. */
export function Logo({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <img
      src="/logo.svg"
      width={size}
      height={size}
      alt="Shree Saibaba"
      aria-hidden="true"
      className={cn('shrink-0 select-none object-contain drop-shadow-xs transition-transform duration-200 hover:scale-105', className)}
    />
  )
}

/** Wordmark: "Shree Saibaba", with the current temple's name beneath. */
export function LogoWordmark({
  compact = false,
  showTemple = true,
  tone = 'default',
}: {
  compact?: boolean
  showTemple?: boolean
  tone?: 'default' | 'light'
}) {
  const temple = useCurrentTemple()
  return (
    <span className="flex shrink-0 items-center gap-2.5">
      <Logo size={compact ? 32 : 40} />
      <span className="flex min-w-0 flex-col justify-center leading-tight">
        <span
          className={cn(
            'block truncate font-serif font-bold tracking-tight',
            compact ? 'text-[16px]' : 'text-[18px] sm:text-[19px]',
            tone === 'light' ? 'text-saffron-100' : 'text-brand-900',
          )}
        >
          Shree Saibaba
        </span>
        {showTemple ? (
          <span
            className={cn(
              'block truncate text-[10px] font-semibold uppercase tracking-[0.14em]',
              tone === 'light' ? 'text-saffron-200/80' : 'text-saffron-700/90',
            )}
          >
            {temple.name}
          </span>
        ) : null}
      </span>
    </span>
  )
}
