import { useState } from 'react'
import { Plus, Trash2, UserRound } from 'lucide-react'
import type { FamilyMember } from '@/lib/data/types'
import { GOTHRAS, NAKSHATRAS } from '@/lib/data/mock'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { Dialog } from '@/components/ui/overlay'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from './states'
import { titleCase } from '@/lib/utils'

const RELATIONS: FamilyMember['relation'][] = ['spouse', 'son', 'daughter', 'parent', 'other']

const blank = (): FamilyMember => ({ name: '', relation: 'spouse', nakshatra: '', gothra: '' })

export function FamilyTreeEditor({
  members,
  onChange,
  readOnly = false,
}: {
  members: FamilyMember[]
  onChange: (members: FamilyMember[]) => void
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FamilyMember>(blank())

  const save = () => {
    if (!draft.name.trim()) return
    onChange([...members, { ...draft, name: draft.name.trim() }])
    setDraft(blank())
    setOpen(false)
  }

  return (
    <div className="space-y-3">
      {members.length === 0 ? (
        <EmptyState
          Icon={UserRound}
          title="No family members yet"
          detail="Add your spouse, children and parents so their names can be included in every sankalpam."
        />
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-card">
          {members.map((m, i) => (
            <li key={`${m.name}-${i}`} className="flex items-center gap-3 p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-tint text-sm font-semibold text-brand-600">
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-ink">{m.name}</p>
                {m.nakshatra || m.gothra ? (
                  <p className="truncate text-sm text-muted">
                    {[m.nakshatra, m.gothra && `${m.gothra} gothra`].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
              </div>
              <Badge variant="neutral">{titleCase(m.relation)}</Badge>
              {!readOnly ? (
                <Button
                  variant="plain"
                  size="icon"
                  aria-label={`Remove ${m.name}`}
                  onClick={() => onChange(members.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!readOnly ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Plus />
          Add family member
        </Button>
      ) : null}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add a family member"
        description="They'll be offered as a one-tap name in every sankalpam you sponsor."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!draft.name.trim()}>
              Add to family tree
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" htmlFor="fm-name" className="sm:col-span-2">
            <Input
              id="fm-name"
              value={draft.name}
              autoFocus
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Aditya Krishnan"
            />
          </Field>
          <Field label="Relation" htmlFor="fm-rel">
            <Select
              id="fm-rel"
              value={draft.relation}
              onChange={(e) =>
                setDraft({ ...draft, relation: e.target.value as FamilyMember['relation'] })
              }
            >
              {RELATIONS.map((r) => (
                <option key={r} value={r}>
                  {titleCase(r)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nakshatra (optional)" htmlFor="fm-nak">
            <Select
              id="fm-nak"
              value={draft.nakshatra}
              onChange={(e) => setDraft({ ...draft, nakshatra: e.target.value })}
            >
              <option value="">Not known</option>
              {NAKSHATRAS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Gothra (optional)" htmlFor="fm-got" className="sm:col-span-2">
            <Select
              id="fm-got"
              value={draft.gothra}
              onChange={(e) => setDraft({ ...draft, gothra: e.target.value })}
            >
              <option value="">Not known</option>
              {GOTHRAS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>
    </div>
  )
}
