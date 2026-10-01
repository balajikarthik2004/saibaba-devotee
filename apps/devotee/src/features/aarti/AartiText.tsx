import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MoonStar, Pause, Play, Printer, Type } from 'lucide-react'
import { useT, LANGUAGES, useLanguageStore } from '@saibaba/core/i18n'
import { readLocal, writeLocal } from '@saibaba/core/local'
import { listAartiTexts, type AartiTextEx } from '@saibaba/core/features/aarti'
import type { LanguageCode } from '@saibaba/core/types.sai'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/badge'
import { useAsync } from '@/lib/hooks'
import { cn } from '@/lib/utils'

type ScriptMode = 'native' | 'latin' | 'both'

interface Prefs {
  scale: number
  speed: number
  dim: boolean
  mode: ScriptMode
}
const PREFS_KEY = 'saibaba:aarti:reader-prefs'
const DEFAULT_PREFS: Prefs = { scale: 1.25, speed: 6, dim: false, mode: 'native' }

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function AartiTextPage() {
  const t = useT()
  const { key = 'madhyan' } = useParams()
  const uiLang = useLanguageStore((s) => s.language)
  const { data, loading } = useAsync(() => listAartiTexts(key), [key])

  const [prefs, setPrefs] = useState<Prefs>(() => ({ ...DEFAULT_PREFS, ...readLocal<Partial<Prefs>>(PREFS_KEY, {}) }))
  const patch = (p: Partial<Prefs>) =>
    setPrefs((cur) => {
      const next = { ...cur, ...p }
      writeLocal(PREFS_KEY, next)
      return next
    })

  const texts: AartiTextEx[] = data ?? []
  const [lang, setLang] = useState<LanguageCode | null>(null)
  const text = useMemo(
    () =>
      texts.find((x) => x.language === (lang ?? uiLang)) ??
      texts.find((x) => x.language === 'en') ??
      texts[0],
    [texts, lang, uiLang],
  )

  const [playing, setPlaying] = useState(false)
  const [active, setActive] = useState(0)
  const lineRefs = useRef<(HTMLLIElement | null)[]>([])
  const count = text?.lines.length ?? 0

  useEffect(() => {
    setActive(0)
    setPlaying(false)
  }, [text?.id])

  useEffect(() => {
    if (!playing || count === 0) return
    const id = setInterval(() => {
      setActive((a) => {
        if (a + 1 >= count) {
          setPlaying(false)
          return a
        }
        return a + 1
      })
    }, prefs.speed * 1000)
    return () => clearInterval(id)
  }, [playing, prefs.speed, count])

  useEffect(() => {
    if (!playing) return
    lineRefs.current[active]?.scrollIntoView({
      block: 'center',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [active, playing])

  const hasTranslit = Boolean(text?.transliteration?.length)
  const mode: ScriptMode = hasTranslit ? prefs.mode : 'native'
  const title = text?.title ?? t('aarti.textTitle', 'Aarti text')
  const availableLangs = LANGUAGES.filter((l) => texts.some((x) => x.language === l.code))

  return (
    <div
      className={cn(
        'min-h-[70dvh] transition-colors',
        prefs.dim ? 'bg-ink text-saffron-200' : 'bg-bg text-ink',
      )}
    >
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          to="/darshan"
          className={cn(
            'no-print mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium hover:underline',
            prefs.dim ? 'text-saffron-300' : 'text-brand-500',
          )}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('aarti.backToDarshan', 'Back to live darshan')}
        </Link>
        <h1 className="font-serif text-[30px] leading-tight sm:text-[36px]">{title}</h1>

        {loading ? (
          <Skeleton className="mt-6 h-64 w-full rounded-[12px]" />
        ) : !text ? (
          <p className="mt-6 text-[15px]">{t('aarti.textMissing', 'This aarti text has not been added yet.')}</p>
        ) : (
          <>
            <Card
              className={cn(
                'no-print sticky top-2 z-10 mt-5 space-y-3 p-3 sm:p-4',
                prefs.dim && 'border-saffron-600/40 bg-ink text-saffron-200',
              )}
              role="group"
              aria-label={t('aarti.readerControls', 'Reader controls')}
            >
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-[13px]">
                  <span className="font-medium">{t('aarti.language', 'Language')}</span>
                  <select
                    className="h-9 rounded-md border border-line bg-card px-2 text-[13px] text-ink"
                    value={text.language}
                    onChange={(e) => setLang(e.target.value as LanguageCode)}
                  >
                    {availableLangs.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.native}
                      </option>
                    ))}
                  </select>
                </label>
                {hasTranslit ? (
                  <label className="flex items-center gap-2 text-[13px]">
                    <span className="font-medium">{t('aarti.script', 'Script')}</span>
                    <select
                      className="h-9 rounded-md border border-line bg-card px-2 text-[13px] text-ink"
                      value={prefs.mode}
                      onChange={(e) => patch({ mode: e.target.value as ScriptMode })}
                    >
                      <option value="native">{t('aarti.scriptNative', 'Original script')}</option>
                      <option value="latin">{t('aarti.scriptLatin', 'Transliteration (Latin)')}</option>
                      <option value="both">{t('aarti.scriptBoth', 'Both')}</option>
                    </select>
                  </label>
                ) : null}
                <Button
                  size="sm"
                  variant={prefs.scale >= 1.6 ? 'default' : 'outline'}
                  aria-pressed={prefs.scale >= 1.6}
                  onClick={() => patch({ scale: prefs.scale >= 1.6 ? 1.1 : 1.8 })}
                >
                  <Type /> {t('aarti.largeText', 'Large text')}
                </Button>
                <Button
                  size="sm"
                  variant={prefs.dim ? 'saffron' : 'outline'}
                  aria-pressed={prefs.dim}
                  onClick={() => patch({ dim: !prefs.dim })}
                >
                  <MoonStar /> {t('aarti.dim', 'Dim for low light')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.print()}>
                  <Printer /> {t('aarti.print', 'Print')}
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 text-[13px]">
                  <span className="w-20 shrink-0 font-medium">{t('aarti.textSize', 'Text size')}</span>
                  <input
                    type="range"
                    min={0.8}
                    max={2.4}
                    step={0.05}
                    value={prefs.scale}
                    onChange={(e) => patch({ scale: Number(e.target.value) })}
                    className="w-full accent-[var(--color-brand-500)]"
                    aria-valuetext={`${Math.round(prefs.scale * 100)}%`}
                  />
                </label>
                <div className="flex items-center gap-3 text-[13px]">
                  <Button
                    size="sm"
                    variant={playing ? 'default' : 'ghost'}
                    onClick={() => setPlaying((p) => !p)}
                    aria-pressed={playing}
                  >
                    {playing ? <Pause /> : <Play />}
                    {playing ? t('aarti.pause', 'Pause') : t('aarti.follow', 'Follow along')}
                  </Button>
                  <label className="flex flex-1 items-center gap-2">
                    <span className="shrink-0 font-medium">{t('aarti.pace', 'Pace')}</span>
                    <input
                      type="range"
                      min={2}
                      max={15}
                      step={1}
                      value={prefs.speed}
                      onChange={(e) => patch({ speed: Number(e.target.value) })}
                      className="w-full accent-[var(--color-brand-500)]"
                      aria-valuetext={t('aarti.secondsPerLine', '{n} seconds per line', { n: prefs.speed })}
                    />
                    <span className="w-9 shrink-0 text-right font-mono text-[12px]">{prefs.speed}s</span>
                  </label>
                </div>
              </div>
            </Card>

            <div className="print-area mt-6">
              <h2 className="sr-only">{title}</h2>
              <ol
                className="space-y-3 font-serif leading-relaxed"
                style={{ fontSize: `${prefs.scale * 1.25}rem` }}
                lang={text.language}
              >
                {text.lines.map((line, i) => {
                  const latin = text.transliteration?.[i]
                  const on = i === active
                  return (
                    <li
                      key={i}
                      ref={(el) => {
                        lineRefs.current[i] = el
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setActive(i)}
                        aria-current={on ? 'true' : undefined}
                        className={cn(
                          'w-full rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                          on && (playing || active > 0)
                            ? prefs.dim
                              ? 'bg-saffron-200/15 text-saffron-100'
                              : 'bg-saffron-100 text-brand-800'
                            : playing
                              ? 'opacity-55'
                              : '',
                        )}
                      >
                        {mode !== 'latin' ? <span className="block">{line}</span> : null}
                        {mode !== 'native' && latin ? (
                          <span
                            className={cn(
                              'block italic',
                              mode === 'both' && 'text-[0.8em] opacity-80',
                            )}
                            lang="en"
                          >
                            {latin}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ol>
              <p className={cn('mt-6 text-[13px]', prefs.dim ? 'text-saffron-300' : 'text-muted')}>
                {t('aarti.sourceLabel', 'Source')}: {text.source ?? t('aarti.sourceUnknown', 'Not stated')}
                {' · '}
                {t(
                  'aarti.placeholderNote',
                  'Your temple supplies the verified text; bracketed lines are placeholders.',
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
