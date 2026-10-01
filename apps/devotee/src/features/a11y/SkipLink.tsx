import { useT } from '@saibaba/core'

/**
 * "Skip to content" link. Mount as the FIRST focusable element (top of the app shell).
 * Targets `#main-content` if present, otherwise the first <main>. Layouts that can, should add
 * `id="main-content"` to their <main>.
 */
export function SkipLink() {
  const t = useT()
  return (
    <a
      href="#main-content"
      onClick={(e) => {
        const target = document.getElementById('main-content') ?? document.querySelector('main')
        if (!target) return
        e.preventDefault()
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
        ;(target as HTMLElement).focus({ preventScroll: false })
      }}
      className="a11y-skip-link"
    >
      {t('a11y.skip', 'Skip to content')}
    </a>
  )
}
