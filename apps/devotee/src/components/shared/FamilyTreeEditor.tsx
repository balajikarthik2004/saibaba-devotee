import { useState } from 'react'
import { useT } from '@saibaba/core'
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
  const t = useT()
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
          title={t('family.emptyTitle', 'No family names yet')}
          detail={t('family.emptyDetail', 'Add your spouse, children and parents so their names can be read in every sankalpam.')}
        />
      ) : (
        <ul className="divide-y divide-line rounded-[10px] border border-line bg-card">
          {members.map((m, i) => (
            <li key={`${m.name}-${i}`} className="flex items-center gap-3 p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-tint text-[12px] font-semibold text-brand-600">
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-ink">{m.name}</p>
                <p className="truncate text-[12px] text-muted">
                  {[m.nakshatra, m.gothra && `${m.gothra} gothra`].filter(Boolean).join(' · ') ||
                    titleCase(m.relation)}
                </p>
              </div>
              <Badge variant="neutral">{titleCase(m.relation)}</Badge>
              {!readOnly ? (
                <Button
                  variant="plain"
                  size="icon"
                  aria-label={t('family.remove', 'Remove {name}', { name: m.name })}
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
          {t('family.add', 'Add family member')}
        </Button>
      ) : null}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('family.addTitle', 'Add a family member')}
        description={t('family.addDesc', 'Their name will be offered in every sankalpam you sponsor.')}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={save} disabled={!draft.name.trim()}>
              {t('family.addBtn', 'Add to family')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('family.fullName', 'Full name')} htmlFor="fm-name" className="sm:col-span-2">
            <Input
              id="fm-name"
              value={draft.name}
              autoFocus
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t('family.namePh', 'e.g. Anita Sharma')}
            />
          </Field>
          <Field label={t('family.relation', 'Relation')} htmlFor="fm-rel">
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
          <details className="group rounded-md border border-line bg-tint/40 px-3 py-2 sm:col-span-2">
            <summary className="cursor-pointer list-none text-[13px] font-medium text-ink marker:hidden">
              {t('sankalpam.optionalTitle', 'For a traditional sankalpam (optional)')}
              <span className="ml-1.5 text-[12px] font-normal text-muted">
                {t('sankalpam.optionalHint', 'Skip this if it is not part of your tradition.')}
              </span>
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label={t('sankalpam.nakshatra', 'Nakshatra')} htmlFor="fm-nak">
            <Select
              id="fm-nak"
              value={draft.nakshatra}
              onChange={(e) => setDraft({ ...draft, nakshatra: e.target.value })}
            >
              <option value="">{t('sankalpam.notKnown', 'Not known')}</option>
              {NAKSHATRAS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('sankalpam.gothra', 'Gothra')} htmlFor="fm-got">
            <Select
              id="fm-got"
              value={draft.gothra}
              onChange={(e) => setDraft({ ...draft, gothra: e.target.value })}
            >
              <option value="">{t('sankalpam.notKnown', 'Not known')}</option>
              {GOTHRAS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
            </div>
          </details>
        </div>
      </Dialog>
    </div>
  )
}
