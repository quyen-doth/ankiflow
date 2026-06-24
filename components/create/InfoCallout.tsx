import { Info } from 'lucide-react'

interface InfoCalloutProps {
  children: React.ReactNode
}

/** Green tinted info callout shown at the bottom of the Configuration card. */
export function InfoCallout({ children }: InfoCalloutProps) {
  return (
    <div className="flex items-start gap-2.5 bg-[#f1f7f3] border border-[#d8e6dd] rounded-[10px] px-[14px] py-[13px]">
      <Info className="w-[15px] h-[15px] text-primary flex-shrink-0 mt-px" />
      <p className="text-[12.5px] text-[#3f6b51] leading-[1.5]">{children}</p>
    </div>
  )
}
