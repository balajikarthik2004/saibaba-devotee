import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Every screen loads from the fake-async data API, so they all need the same
 * loading/data/refresh triad. `deps` behaves like a `useEffect` dependency list.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let live = true
    setLoading(true)
    fnRef
      .current()
      .then((r) => live && setData(r))
      .catch((e: Error) => live && setError(e))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  return { data, loading, error, refresh, setData }
}

/** Debounced value — used by the admin search inputs. */
export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Sortable table state shared by every admin DataTable. */
export function useSort<T extends string>(initial: T, initialDir: 'asc' | 'desc' = 'asc') {
  const [key, setKey] = useState<T>(initial)
  const [dir, setDir] = useState<'asc' | 'desc'>(initialDir)
  const toggle = useCallback(
    (k: T) => {
      if (k === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      else {
        setKey(k)
        setDir('asc')
      }
    },
    [key],
  )
  return { key, dir, toggle }
}
