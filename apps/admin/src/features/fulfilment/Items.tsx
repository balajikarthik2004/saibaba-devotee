import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  COUNTRY_NAMES,
  listShopItems,
  setStock,
  upsertShopItem,
} from '@saibaba/core/features/fulfilment'
import { formatMoney } from '@saibaba/core/money'
import { useT } from '@saibaba/core/i18n'
import { currentTemple } from '@saibaba/core/tenant'
import type { CountryCode, ShopItem } from '@saibaba/core/types.sai'
import { PageShell } from '@/components/layout/PageShell'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/input'
import { Dialog } from '@/components/ui/overlay'
import { useToast } from '@/components/ui/toast'
import { useAsync, useTempleId } from '@/lib/hooks'

const KEYS: ShopItem['key'][] = ['udi', 'prasad-box', 'book', 'photo', 'ring', 'other']

interface Draft {
  id?: string
  key: ShopItem['key']
  name: string
  description: string
  price: string
  weightGrams: string
  shipsTo: CountryCode[]
  active: boolean
  stock: string
}

const blank = (): Draft => ({
  key: 'other',
  name: '',
  description: '',
  price: '',
  weightGrams: '100',
  shipsTo: [...currentTemple().shipsTo],
  active: true,
  stock: '',
})

export default function Items() {
  const t = useT()
  const { toast } = useToast()
  const templeId = useTempleId()
  const { data, loading, refresh } = useAsync(() => listShopItems(templeId, { all: true }), [templeId])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const temple = currentTemple()

  const edit = (i: ShopItem) =>
    setDraft({
      id: i.id,
      key: i.key,
      name: i.name,
      description: i.description,
      price: String(i.price),
      weightGrams: String(i.weightGrams),
      shipsTo: i.shipsTo,
      active: i.active,
      stock: i.stock === null ? '' : String(i.stock),
    })

  const save = async () => {
    if (!draft) return
    const price = Number(draft.price)
    const weight = Number(draft.weightGrams)
    if (!draft.name.trim()) return setErr(t('shop.req', 'Required'))
    if (!(price >= 0) || draft.price === '') return setErr(t('shop.admin.err.price', 'Enter a price'))
    if (!(weight > 0)) return setErr(t('shop.admin.err.weight', 'Enter a weight in grams'))
    setBusy(true)
    try {
      const item = await upsertShopItem({
        id: draft.id,
        templeId,
        key: draft.key,
        name: draft.name.trim(),
        description: draft.description.trim(),
        price,
        weightGrams: weight,
        shipsTo: draft.shipsTo,
        active: draft.active,
        currency: temple.currency,
      })
      await setStock(item.id, draft.stock.trim() === '' ? null : Number(draft.stock))
      toast(t('shop.admin.saved', 'Item saved'))
      setDraft(null)
      setErr('')
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const cols: Column<ShopItem>[] = [
    { key: 'name', header: t('shop.admin.item', 'Item'), sortValue: (i) => i.name, cell: (i) => <span className="font-medium">{i.name}</span> },
    { key: 'price', header: t('shop.admin.price', 'Price'), align: 'right', sortValue: (i) => i.price, cell: (i) => formatMoney(i.price, i.currency) },
    { key: 'weight', header: t('shop.admin.weight', 'Weight'), align: 'right', sortValue: (i) => i.weightGrams, cell: (i) => `${i.weightGrams} g` },
    {
      key: 'stock',
      header: t('shop.admin.stock', 'Stock'),
      align: 'right',
      sortValue: (i) => i.stock ?? 1e9,
      cell: (i) => (i.stock === null ? '∞' : i.stock <= 5 ? <Badge variant="brand">{i.stock}</Badge> : i.stock),
    },
    { key: 'ships', header: t('shop.admin.shipsto', 'Ships to'), cell: (i) => (i.shipsTo.length ? i.shipsTo.join(', ') : '—') },
    { key: 'active', header: t('shop.admin.visible', 'Visible'), cell: (i) => <Badge variant={i.active ? 'leaf' : 'neutral'}>{i.active ? t('shop.admin.on', 'Yes') : t('shop.admin.off', 'Hidden')}</Badge> },
  ]

  return (
    <PageShell
      title={t('shop.admin.items.title', 'Shop items')}
      eyebrow={t('shop.admin.group', 'Fulfilment')}
      description={t('shop.admin.items.sub', 'Prices are in {currency}. Leave stock blank for unlimited.', { currency: temple.currency })}
      actions={<Button onClick={() => { setErr(''); setDraft(blank()) }}><Plus />{t('shop.admin.newitem', 'New item')}</Button>}
    >
      {loading ? <LoadingSkeleton variant="table" rows={5} /> : <DataTable rows={data ?? []} columns={cols} rowKey={(i) => i.id} onRowClick={(i) => { setErr(''); edit(i) }} />}

      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? t('shop.admin.edititem', 'Edit item') : t('shop.admin.newitem', 'New item')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft(null)}>{t('shop.admin.cancelbtn', 'Cancel')}</Button>
            <Button onClick={save} disabled={busy}>{t('shop.admin.save', 'Save')}</Button>
          </>
        }
      >
        {draft ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('shop.admin.name', 'Name')} htmlFor="i-name" className="sm:col-span-2">
              <Input id="i-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label={t('shop.admin.kind', 'Kind')} htmlFor="i-key">
              <Select id="i-key" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value as ShopItem['key'] })}>
                {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </Select>
            </Field>
            <Field label={t('shop.admin.price', 'Price')} htmlFor="i-price">
              <Input id="i-price" type="number" min={0} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
            </Field>
            <Field label={t('shop.admin.weightg', 'Weight (g)')} htmlFor="i-w">
              <Input id="i-w" type="number" min={1} value={draft.weightGrams} onChange={(e) => setDraft({ ...draft, weightGrams: e.target.value })} />
            </Field>
            <Field label={t('shop.admin.stock', 'Stock')} htmlFor="i-stock">
              <Input id="i-stock" type="number" min={0} placeholder="∞" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} />
            </Field>
            <Field label={t('shop.admin.desc', 'Description')} htmlFor="i-desc" className="sm:col-span-2">
              <Textarea id="i-desc" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-[13px] font-medium">{t('shop.admin.shipsto', 'Ships to')}</legend>
              <div className="flex flex-wrap gap-3">
                {temple.shipsTo.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={draft.shipsTo.includes(c)}
                      onChange={(e) => setDraft({ ...draft, shipsTo: e.target.checked ? [...draft.shipsTo, c] : draft.shipsTo.filter((x) => x !== c) })}
                    />
                    {COUNTRY_NAMES[c]}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">
                {t('shop.admin.shipsnote', 'Food and plant products are often restricted across borders — tick only destinations you have checked.')}
              </p>
            </fieldset>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              {t('shop.admin.visible', 'Visible')}
            </label>
            {err ? <p role="alert" className="text-xs font-medium text-brand-600 sm:col-span-2">{err}</p> : null}
          </div>
        ) : null}
      </Dialog>
    </PageShell>
  )
}
