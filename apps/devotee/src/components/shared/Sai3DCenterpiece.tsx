import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function Sai3DCenterpiece({ className }: { className?: string }) {
  const [hasLanded, setHasLanded] = useState(false)
  const [spinCount, setSpinCount] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    // Switch to smooth floating animation after horizontal entry rotation completes
    const timer = setTimeout(() => {
      setHasLanded(true)
    }, 2200)
    return () => clearTimeout(timer)
  }, [spinCount])

  const handleManualSpin = () => {
    setHasLanded(false)
    setSpinCount((c) => c + 1)
  };

  return (
    <div
      className={cn(
        'relative flex items-center justify-center select-none group cursor-pointer',
        className,
      )}
      style={{ perspective: '1200px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleManualSpin}
      role="button"
      tabIndex={0}
      title="Shree Sai Baba Darshan — Click for blessing rotation"
      aria-label="3D Darshan of Shree Sai Baba seated in blessing posture"
    >
      {/* Soft Ambient Halo Aura */}
      <div
        className={cn(
          'pointer-events-none absolute -inset-2 sm:-inset-4 rounded-full transition-opacity duration-700',
          'bg-[radial-gradient(circle_at_50%_50%,rgba(255,220,100,0.45)_0%,rgba(255,160,20,0.2)_50%,transparent_75%)]',
          isHovered ? 'opacity-100 scale-110' : 'opacity-80 scale-100',
        )}
      />

      {/* 3D Rotating & Floating Figure Container */}
      <div
        key={spinCount}
        className={cn(
          'relative z-10 flex items-center justify-center transition-transform duration-300',
          !hasLanded ? 'sai3d-enter' : 'sai3d-float',
          isHovered && hasLanded ? 'scale-[1.05]' : '',
        )}
      >
        <img
          src="/art/saibaba-3d-transparent.png"
          alt="Shree Sai Baba 3D Divine Murti"
          className="h-28 w-28 sm:h-36 sm:w-36 lg:h-40 lg:w-40 xl:h-44 xl:w-44 object-contain filter drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)] drop-shadow-[0_0_24px_rgba(255,200,80,0.55)]"
          loading="eager"
        />
      </div>

      {/* Subtle Lotus Pedestal Base Golden Shimmer */}
      <div className="pointer-events-none absolute -bottom-1 z-0 h-4 w-28 sm:w-36 rounded-[100%] bg-saffron-300/40 blur-sm" />
    </div>
  )
}
