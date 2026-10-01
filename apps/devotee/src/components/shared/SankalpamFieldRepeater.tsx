import { Link } from 'react-router-dom'
import { useT } from '@saibaba/core'
import { Plus, Trash2, Undo2, Users } from 'lucide-react'
import type { FamilyMember } from '@/lib/data/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, titleCase } from '@/lib/utils'

export const MAX_SANKALPAM_NAMES = 108

/**
 * The names read out in the sankalpam — the devotee's name plus family names — in the
 * order the priest will read them. Gothra and nakshatra are added only if the devotee
 * has chosen to share them (see ownerDetail). Capped
 * at 108 — the traditional count, and about as far as a priest gets in one sitting.
 *
 * The list arrives already filled: the devotee's own name first, then everyone saved on
 * their profile. Nothing is ticked in, because a devotee who has already entered their
 * family once has said who their family is — asking again with a column of checkboxes
 * makes them do the same work twice. The correction they might actually want is the
 * other direction (leave someone out this time), so removal is the affordance, and a
 * removed relative can be put back without retyping.
 */
export function SankalpamFieldRepeater({
  names,
  onChange,
  ownerName,
  ownerDetail,
  family = [],
  className,
}: {
  names: string[]
  onChange: (names: string[]) => void
  /** The signed-in devotee. Always the first name, and never removable. */
  ownerName: string
  /** Optional gothra · nakshatra, shown under the owner's name only if provided. */
  ownerDetail?: string
  family?: FamilyMember[]
  className?: string
}) {
  const t = useT()
  const atCap = names.length >= MAX_SANKALPAM_NAMES

  const setAt = (i: number, v: string) => onChange(names.map((n, j) => (j === i ? v : n)))
  const removeAt = (i: number) => onChange(names.filter((_, j) => j !== i))
  const add = (v = '') => {
    if (atCap) return
    onChange([...names, v])
  }

  const relationOf = (name: string) => family.find((m) => m.name === name)?.relation

  // Relatives the devotee took off this booking. Offered back as one-tap chips rather
  // than leaving them to retype a name the temple already has.
  const dropped = family.filter((m) => !names.includes(m.name))

  return (
    <div className={cn('space-y-3', className)}>
      <ol className="overflow-hidden rounded-[10px] border border-line">
        {names.map((name, i) => {
          const isOwner = i === 0
          const relation = relationOf(name)
          const fromProfile = isOwner || Boolean(relation)

          return (
            <li
              key={i}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5',
                i > 0 && 'border-t border-line',
                isOwner && 'bg-tint/50',
              )}
            >
              <span className="w-5 shrink-0 text-right text-[12px] tabular-nums text-muted">
                {i + 1}
              </span>

              {fromProfile ? (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">
                    {isOwner ? ownerName : name}
                  </span>
                  {isOwner && ownerDetail ? (
                    <span className="block truncate text-[12px] text-muted">{ownerDetail}</span>
                  ) : null}
                </span>
              ) : (
                <Input
                  value={name}
                  aria-label={t('sankalpam.nameN', 'Name {n}', { n: i + 1 })}
                  placeholder={t('sankalpam.namePh', 'Name to be read')}
                  onChange={(e) => setAt(i, e.target.value)}
                  className="h-9"
                />
              )}

              {isOwner ? (
                <Badge variant="neutral">{t('sankalpam.you', 'You')}</Badge>
              ) : relation ? (
                <Badge variant="default">{titleCase(relation)}</Badge>
              ) : (
                <Badge variant="outline">{t('sankalpam.guest', 'Guest')}</Badge>
              )}

              {/* The devotee's own name is what the sankalpam is for — there is no
                  sensible booking with it removed, so it has no remove control. */}
              {isOwner ? (
                <span className="size-9 shrink-0" aria-hidden="true" />
              ) : (
                <Button
                  variant="plain"
                  size="icon"
                  aria-label={t('family.remove', 'Remove {name}', { name: name || t('sankalpam.nameN', 'Name {n}', { n: i + 1 }) })}
                  onClick={() => removeAt(i)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          )
        })}
      </ol>

      {dropped.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-muted">{t('sankalpam.alsoOnProfile', 'Also on your profile:')}</span>
          {dropped.map((m) => (
            <button
              key={`${m.name}-${m.relation}`}
              type="button"
              disabled={atCap}
              onClick={() => add(m.name)}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-tint px-2.5 py-1 text-[12px] text-brand-700 transition-colors hover:border-brand-300 disabled:opacity-50"
            >
              <Undo2 className="size-3" />
              {m.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="ghost" size="sm" onClick={() => add()} disabled={atCap}>
          <Plus />
          {t('sankalpam.addName', 'Add another name')}
        </Button>

        {family.length === 0 ? (
          <span className="text-[12px] text-muted">
            {t('sankalpam.saveFamily', 'Save family names on your')}{' '}
            <Link to="/profile" className="font-medium text-brand-500 hover:underline">
              {t('sankalpam.profile', 'profile')}
            </Link>{' '}
            {t('sankalpam.fillAuto', 'and they fill in here automatically.')}
          </span>
        ) : null}
      </div>

      <p className="flex items-center gap-1.5 border-t border-line pt-3 text-[12px] text-muted">
        <Users className="size-3.5 shrink-0" />
        {atCap ? (
          <span className="text-brand-600">
            {t('sankalpam.full', 'That is the full {n}. Remove a name to add another.', { n: MAX_SANKALPAM_NAMES })}
          </span>
        ) : (
          <>
            {t('sankalpam.count', '{n} of {max} names, read in this order.', {
              n: names.filter((x) => x.trim()).length,
              max: MAX_SANKALPAM_NAMES,
            })}{' '}
            {t('sankalpam.optionalNote', 'Gothra and nakshatra are added only if you have shared them on your profile.')}
          </>
        )}
      </p>
    </div>
  )
}
