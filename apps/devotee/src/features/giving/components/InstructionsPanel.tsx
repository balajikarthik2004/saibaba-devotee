import { Building2 } from 'lucide-react'
import { manualInstructions, useT } from '@saibaba/core'
import type { PaymentProviderKey, Temple } from '@saibaba/core'
import { ChequeInstructions } from '@/components/shared/ChequeInstructions'

/**
 * What the donor does next after choosing a manual method: the temple's own instructions
 * (from Giving settings) with the donation reference to quote. Cheques get the address card.
 */
export function InstructionsPanel({
  providerKey,
  temple,
  reference,
  className,
}: {
  providerKey: PaymentProviderKey
  temple: Temple
  reference: string
  className?: string
}) {
  const t = useT()
  if (providerKey === 'cheque') return <ChequeInstructions reference={reference} className={className} />
  const ins = manualInstructions(providerKey, temple, reference)
  return (
    <div
      className={
        'rounded-[10px] border border-saffron-400/50 bg-saffron-500/[0.07] p-4 text-[13px] leading-relaxed text-ink ' +
        (className ?? '')
      }
    >
      <p className="flex items-center gap-2 font-medium">
        <Building2 className="size-4 text-saffron-600" />
        {ins.title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] text-muted">
        {ins.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-muted">
        {t('giving.instructions.receiptNote', 'Your receipt is issued once the temple has received the payment.')}
      </p>
    </div>
  )
}
