import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { useT } from '@saibaba/core'
import { Logo } from '@/components/shared/Logo'

export default function NotFound() {
  const t = useT()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo size={52} />
      <span className="grid size-11 place-items-center rounded-full bg-tint text-brand-400">
        <Compass className="size-5" />
      </span>
      <h1 className="font-serif text-[28px] leading-tight">{t('notfound.title', 'This path leads nowhere')}</h1>
      <p className="max-w-sm text-[14px] text-muted">
        {t('notfound.body', 'The page you were looking for isn’t part of Shree Saibaba. Let’s take you back to the entrance.')}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2.5">
        <Link to="/" className={buttonVariants({})}>
          {t('notfound.home', 'Go to the homepage')}
        </Link>
        <Link to="/calendar" className={buttonVariants({ variant: 'ghost' })}>
          {t('notfound.cal', 'See the calendar')}
        </Link>
      </div>
    </div>
  )
}
