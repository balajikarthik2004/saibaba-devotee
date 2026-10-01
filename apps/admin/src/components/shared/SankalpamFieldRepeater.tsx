import { Plus, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export const MAX_SANKALPAM_NAMES = 108

/**
 * Names read out in the sankalpam. Capped at 108 — the traditional count, and also
 * as far as a priest will realistically get through in one sitting.
 */
export function SankalpamFieldRepeater({
  names,
  onChange,
  suggestions = [],
  className,
}: {
  names: string[]
  onChange: (names: string[]) => void
  suggestions?: string[]
  className?: string
}) {
  const setAt = (i: number, v: string) => onChange(names.map((n, j) => (j === i ? v : n)))
  const removeAt = (i: number) => onChange(names.filter((_, j) => j !== i))
  const add = (v = '') => {
    if (names.length >= MAX_SANKALPAM_NAMES) return
    onChange([...names, v])
  }

  const unused = suggestions.filter((s) => !names.includes(s))

  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="space-y-2">
        {names.map((n, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted">
              {i + 1}.
            </span>
            <Input
              value={n}
              aria-label={i === 0 ? 'Primary sankalpam name' : `Additional name ${i}`}
              placeholder={i === 0 ? 'Primary name' : 'Family member name'}
              onChange={(e) => setAt(i, e.target.value)}
            />
            {i > 0 ? (
              <Button
                variant="plain"
                size="icon"
                aria-label={`Remove name ${i + 1}`}
                onClick={() => removeAt(i)}
              >
                <Trash2 />
              </Button>
            ) : (
              <span className="size-9 shrink-0" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => add()}
          disabled={names.length >= MAX_SANKALPAM_NAMES}
        >
          <Plus />
          Add family name
        </Button>
        {unused.length > 0 ? (
          <>
            <span className="inline-flex items-center gap-1 text-sm text-muted">
              <Users className="size-3.5" />
              From your family tree:
            </span>
            {unused.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="rounded-full border border-line bg-tint px-2.5 py-1 text-sm text-brand-700 transition-colors hover:border-brand-300"
              >
                + {s}
              </button>
            ))}
          </>
        ) : null}
      </div>

      <p className="text-sm text-muted">
        {names.length} of {MAX_SANKALPAM_NAMES} names. Nakshatra and gothra, if the devotee has
        shared them, are read with the primary name; they are never required.
      </p>
    </div>
  )
}
