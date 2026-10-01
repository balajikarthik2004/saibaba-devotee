import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Logo } from '@/components/shared/Logo'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo size={52} />
      <span className="grid size-11 place-items-center rounded-full bg-tint text-brand-400">
        <Compass className="size-5" />
      </span>
      <h1 className="font-bold text-3xl leading-tight">No such console page</h1>
      <p className="max-w-sm text-base text-muted">
        That route is not part of the operations console.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2.5">
        <Link to="/dashboard" className={buttonVariants({})}>
          Back to dashboard
        </Link>
        <Link to="/signin" className={buttonVariants({ variant: 'ghost' })}>
          Switch role
        </Link>
      </div>
    </div>
  )
}
