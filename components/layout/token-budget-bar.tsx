'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { TokenBudgetState } from '@/lib/anthropic/token-budget'

interface TokenBudgetBarProps {
  agentId: string
  agentName: string
  color?: string
}

export function TokenBudgetBar({ agentId, agentName }: TokenBudgetBarProps) {
  const [status, setStatus] = useState<TokenBudgetState | null>(null)

  useEffect(() => {
    const fetchStatus = () =>
      fetch(`/api/claude/token-status?agent_id=${agentId}`)
        .then(r => r.json())
        .then(setStatus)
        .catch(() => {})

    fetchStatus()
    const interval = setInterval(fetchStatus, 30_000)
    return () => clearInterval(interval)
  }, [agentId])

  if (!status) return (
    <div className="space-y-1.5">
      <div className="h-1.5 w-full rounded-full bg-secondary animate-pulse" />
    </div>
  )

  const indicatorClass = status.isCritical
    ? 'bg-red-500'
    : status.isWarning
    ? 'bg-amber-500'
    : 'bg-emerald-500'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {agentName && <span className="text-xs text-muted-foreground">{agentName}</span>}
        <span className={cn(
          'text-xs font-mono ml-auto',
          status.isCritical ? 'text-red-400' :
          status.isWarning  ? 'text-amber-400' :
          'text-muted-foreground'
        )}>
          {status.tokensRemainingK}K left
        </span>
      </div>
      <Progress
        value={status.percentUsed}
        className="h-1"
        indicatorClassName={indicatorClass}
      />
      {status.isCritical && (
        <p className="text-[11px] text-red-400 font-medium">Initiate graceful shutdown</p>
      )}
    </div>
  )
}
