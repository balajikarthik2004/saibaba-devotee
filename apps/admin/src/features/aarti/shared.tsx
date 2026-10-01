import { useLocation, useNavigate } from 'react-router-dom'
import { useT } from '@saibaba/core/i18n'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/overlay'
import { Tabs } from '@/components/ui/tabs'

/** Sub-navigation shared by every page of the Darshan CMS. */
export function AartiTabs() {
  const t = useT()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const items = [
    { key: '/aarti', label: t('aarti.admin.tabSchedule', 'Schedule') },
    { key: '/aarti/stream', label: t('aarti.admin.tabStream', 'Live stream') },
    { key: '/aarti/texts', label: t('aarti.admin.tabTexts', 'Aarti texts') },
    { key: '/aarti/recordings', label: t('aarti.admin.tabRecordings', 'Recordings') },
    { key: '/aarti/festival-dates', label: t('aarti.admin.tabFestivals', 'Festival dates') },
  ]
  const current = items.find((i) => i.key === pathname.replace(/\/$/, ''))?.key ?? '/aarti'
  return <Tabs items={items} value={current} onChange={(k) => nav(k)} />
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'default',
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  tone?: 'default' | 'destructive'
  onConfirm: () => void
  onClose: () => void
}) {
  const t = useT()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('aarti.admin.cancel', 'Cancel')}
          </Button>
          <Button variant={tone === 'destructive' ? 'destructive' : 'default'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <span className="sr-only">{title}</span>
    </Dialog>
  )
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const isHttpsUrl = (s: string) => {
  try {
    return new URL(s).protocol === 'https:'
  } catch {
    return false
  }
}
