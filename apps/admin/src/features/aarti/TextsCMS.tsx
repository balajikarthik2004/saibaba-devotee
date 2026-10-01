import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { useT, LANGUAGES } from '@saibaba/core/i18n'
import { listAartiTexts, upsertAartiText, type AartiTextEx } from '@saibaba/core/features/aarti'
import type { AartiKey, AartiText, LanguageCode } from '@saibaba/core/types.sai'
import { PageShell } from '@/components/layout/PageShell'
import { LoadingSkeleton } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/lib/hooks'
import { AartiTabs } from './shared'

const KEYS: AartiKey[] = ['kakad', 'madhyan', 'dhoop', 'shej', 'special']
const SCRIPTS: AartiText['script'][] = ['devanagari', 'latin', 'gujarati', 'telugu', 'tamil']
const DEFAULT_SCRIPT: Partial<Record<LanguageCode, AartiText['script']>> = {
  en: 'latin',
  es: 'latin',
  hi: 'devanagari',
  mr: 'devanagari',
  gu: 'gujarati',
  te: 'telugu',
  ta: 'tamil',
}

export default function TextsCMS() {
  const t = useT()
  const { toast } = useToast()
  const [key, setKey] = useState<AartiKey>('madhyan')
  const [lang, setLang] = useState<LanguageCode>('en')
  const { data, loading, refresh } = useAsync(() => listAartiTexts(key), [key])

  const existing = data?.find((x) => x.language === lang)
  const [title, setTitle] = useState('')
  const [script, setScript] = useState<AartiText['script']>('latin')
  const [lines, setLines] = useState('')
  const [translit, setTranslit] = useState('')
  const [source, setSource] = useState('')
  const [audioUrl, setAudioUrl] = useState('')

  useEffect(() => {
    if (loading) return
    setTitle(existing?.title ?? '')
    setScript(existing?.script ?? DEFAULT_SCRIPT[lang] ?? 'latin')
    setLines((existing?.lines ?? []).join('\n'))
    setTranslit((existing?.transliteration ?? []).join('\n'))
    setSource(existing?.source ?? 'Temple to supply verified text')
    setAudioUrl(existing?.audioUrl ?? '')
  }, [existing, lang, key, loading])

  const split = (s: string) => s.split('\n').map((l) => l.trimEnd())
  const lineList = split(lines).filter((l) => l.trim())
  const translitList = split(translit).filter((l) => l.trim())
  const mismatch = translitList.length > 0 && translitList.length !== lineList.length

  const save = async () => {
    const payload: Omit<AartiTextEx, 'id'> & { id?: string } = {
      id: existing?.id,
      key,
      title: title.trim(),
      language: lang,
      script,
      lines: lineList,
      source: source.trim() || undefined,
      audioUrl: audioUrl.trim() || undefined,
      transliteration: translitList.length ? translitList : undefined,
    }
    await upsertAartiText(payload)
    toast(t('aarti.admin.textSaved', 'Aarti text saved'), { detail: `${title} (${lang})` })
    refresh()
  }

  return (
    <PageShell
      eyebrow={t('aarti.admin.group', 'Darshan')}
      title={t('aarti.admin.textsTitle', 'Aarti texts')}
      description={t(
        'aarti.admin.textsDesc',
        'Paste your temple’s own verified text, one line per row. Shared across temples.',
      )}
      tabs={<AartiTabs />}
    >
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Card className="space-y-4 p-4">
          <Field label={t('aarti.admin.fKey', 'Type')} htmlFor="tx-key">
            <Select id="tx-key" value={key} onChange={(e) => setKey(e.target.value as AartiKey)}>
              {KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </Field>
          <div role="group" aria-label={t('aarti.language', 'Language')}>
            <p className="mb-1 text-xs font-semibold text-ink-soft">{t('aarti.language', 'Language')}</p>
            <ul className="space-y-1">
              {LANGUAGES.map((l) => {
                const has = data?.some((x) => x.language === l.code)
                return (
                  <li key={l.code}>
                    <button
                      type="button"
                      aria-pressed={lang === l.code}
                      onClick={() => setLang(l.code)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm ${
                        lang === l.code ? 'bg-brand-500 text-white' : 'hover:bg-tint'
                      }`}
                    >
                      {l.native}
                      {has ? (
                        <Badge variant={lang === l.code ? 'outline' : 'leaf'}>{t('aarti.admin.added', 'added')}</Badge>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('aarti.admin.fTitle', 'Title')} htmlFor="tx-title">
                  <Input id="tx-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
                <Field label={t('aarti.script', 'Script')} htmlFor="tx-script">
                  <Select id="tx-script" value={script} onChange={(e) => setScript(e.target.value as AartiText['script'])}>
                    {SCRIPTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field
                label={t('aarti.admin.fLines', 'Text (one line per row)')}
                htmlFor="tx-lines"
                hint={`${lineList.length} ${t('aarti.admin.lines', 'lines')}`}
              >
                <Textarea id="tx-lines" rows={10} lang={lang} value={lines} onChange={(e) => setLines(e.target.value)} />
              </Field>
              <Field
                label={t('aarti.admin.fTranslit', 'Latin transliteration (optional, same number of lines)')}
                htmlFor="tx-translit"
                error={mismatch ? t('aarti.admin.translitMismatch', 'Line counts differ — lines are matched by position.') : undefined}
              >
                <Textarea id="tx-translit" rows={6} value={translit} onChange={(e) => setTranslit(e.target.value)} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('aarti.admin.fSource', 'Source')} htmlFor="tx-source">
                  <Input id="tx-source" value={source} onChange={(e) => setSource(e.target.value)} />
                </Field>
                <Field label={t('aarti.admin.fAudio', 'Audio URL (optional)')} htmlFor="tx-audio">
                  <Input id="tx-audio" inputMode="url" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} />
                </Field>
              </div>
              <Button onClick={save} disabled={!title.trim() || lineList.length === 0}>
                <Save /> {t('aarti.admin.save', 'Save')}
              </Button>
            </>
          )}
        </Card>
      </div>
    </PageShell>
  )
}
