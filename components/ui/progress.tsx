import { cn } from "@/lib/utils"

interface ProgressProps {
  value?: number | null
  className?: string
  indicatorClassName?: string
}

function Progress({ value, className, indicatorClassName }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value ?? 0))
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      data-slot="progress"
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
    >
      <div
        data-slot="progress-indicator"
        className={cn("h-full bg-primary transition-all duration-300 ease-out", indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export { Progress }
