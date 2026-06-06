import { cn } from '@/lib/utils'
import type { Health } from '@/types'

const healthConfig: Record<Health, { label: string; dot: string; text: string }> = {
  'on-track':        { label: 'On Track',       dot: 'bg-emerald-500',  text: 'text-emerald-400' },
  'blocked':         { label: 'Blocked',         dot: 'bg-red-500',      text: 'text-red-400' },
  'needs-attention': { label: 'Needs Attention', dot: 'bg-amber-500',    text: 'text-amber-400' },
  'idle':            { label: 'Idle',            dot: 'bg-zinc-500',     text: 'text-zinc-400' },
}

export const healthBorderColor: Record<Health, string> = {
  'on-track':        '#10b981',
  'blocked':         '#ef4444',
  'needs-attention': '#f59e0b',
  'idle':            '#52525b',
}

export function HealthBadge({ health }: { health: Health }) {
  const config = healthConfig[health] ?? healthConfig.idle
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', config.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.dot)} />
      {config.label}
    </span>
  )
}
