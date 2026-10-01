import { useEffect, useState } from 'react'
import { listAartiSlots } from '@saibaba/core/features/aarti'
import type { AartiSlot } from '@saibaba/core/types.sai'
import { useAsync } from '@/lib/hooks'

/** Current time, re-rendered every `ms` (default 1s). Pauses while the tab is hidden. */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) setNow(new Date())
    }, ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

/** Slots of one temple (re-fetched when the temple changes). */
export function useSlots(templeId: string) {
  return useAsync<AartiSlot[]>(() => listAartiSlots(templeId), [templeId])
}

export function downloadTextFile(filename: string, content: string, mime = 'text/calendar') {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
