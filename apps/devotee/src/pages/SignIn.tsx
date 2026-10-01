import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useCurrentTemple, useT } from '@saibaba/core'
import { Logo } from '@/components/shared/Logo'
import { DeityArt } from '@/components/shared/DeityArt'
import { OtpSignIn } from '@/features/auth/OtpSignIn'

export default function SignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  const temple = useCurrentTemple()
  const t = useT()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Left: temple imagery and welcome copy */}
      <aside className="relative hidden overflow-hidden lg:block">
        <DeityArt deity="Sai Baba" className="absolute inset-0 h-full w-full" label="Temple welcome" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-900/80 via-brand-900/55 to-brand-900/90" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Link to="/" className="flex items-center gap-2.5 text-white">
            <Logo size={38} />
            <span className="font-serif text-[17px] text-saffron-100">{temple.name}</span>
          </Link>
          <div className="max-w-md space-y-3">
            <h2 className="font-serif text-[36px] leading-[1.12] text-saffron-100">
              {t('auth.welcomeBack', 'Welcome back to your temple.')}
            </h2>
            <p className="text-[15px] leading-relaxed text-white/80">
              {t(
                'auth.welcomeBody',
                'Sign in to sponsor a puja in your family’s name, follow your spiritual calendar, and see where every gift is used.',
              )}
            </p>
          </div>
          <p className="text-[12.5px] text-white/60">
            {temple.address}, {temple.city}, {temple.state} · {temple.phone}
          </p>
        </div>
      </aside>

      {/* Right: the form */}
      <main className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3.5" />
            {t('auth.backToSite', 'Back to the temple site')}
          </Link>

          <div className="mb-6 lg:hidden">
            <Logo size={40} />
          </div>

          <h1 className="font-serif text-[28px] leading-tight">{t('auth.signIn', 'Sign in')}</h1>
          <p className="mb-6 mt-1 text-[13.5px] text-muted">
            {t('auth.signInSub', 'We will send a one-time code. No password to remember.')}
          </p>

          <OtpSignIn onVerified={() => navigate(from, { replace: true })} />

          <p className="mt-6 text-[13px] text-muted">
            {t('auth.newHere', 'New here?')}{' '}
            <Link to="/signup" className="font-medium text-brand-500 hover:underline">
              {t('auth.createAccount', 'Create a devotee account')} →
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
