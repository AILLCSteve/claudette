'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { TokenBudgetBar } from '@/components/layout/token-budget-bar'
import { Bot, Copy, RefreshCw, Check, Terminal } from 'lucide-react'

interface Agent { id: string; name: string; agent_key: string; color: string; session_budget_k: number }

export default function QueuePage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [bootstraps, setBootstraps] = useState<Record<string, string>>({})
  const [loadingBootstrap, setLoadingBootstrap] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then(setAgents)
  }, [])

  const generateBootstrap = async (agentId: string) => {
    setLoadingBootstrap(agentId)
    try {
      const res = await fetch('/api/claude/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, sessionWindow: 1 }),
      })
      const data = await res.json()
      setBootstraps(prev => ({ ...prev, [agentId]: data.prompt }))
    } finally {
      setLoadingBootstrap(null)
    }
  }

  const copyToClipboard = async (agentId: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(agentId)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Session Queue"
        description={agents.length > 0 ? `${agents.length} agent${agents.length !== 1 ? 's' : ''} ready` : undefined}
      />
      <div className="flex-1 overflow-auto p-6">
        {agents.length === 0 ? (
          <div className="border border-dashed border-border/60 rounded-lg p-16 flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">No agents configured</p>
              <p className="text-xs text-muted-foreground mt-1">Visit the Agents page to set up your AI agents</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl">
            {agents.map(agent => (
              <div
                key={agent.id}
                className="bg-card border border-border/60 rounded-lg overflow-hidden"
              >
                {/* Agent header */}
                <div
                  className="px-4 py-3 flex items-center gap-3 border-b border-border/60"
                  style={{ borderLeftColor: agent.color, borderLeftWidth: 3 }}
                >
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: agent.color + '1a', border: `1px solid ${agent.color}33` }}
                  >
                    <Bot className="h-4 w-4" style={{ color: agent.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground">{agent.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{agent.agent_key}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 border-border/60 hover:border-border shrink-0"
                    onClick={() => generateBootstrap(agent.id)}
                    disabled={loadingBootstrap === agent.id}
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingBootstrap === agent.id ? 'animate-spin' : ''}`} />
                    {bootstraps[agent.id] ? 'Regenerate' : 'Generate Bootstrap'}
                  </Button>
                </div>

                {/* Token budget */}
                <div className="px-4 py-2.5 border-b border-border/60">
                  <TokenBudgetBar agentId={agent.id} agentName="" color={agent.color} />
                </div>

                {/* Bootstrap output */}
                {bootstraps[agent.id] ? (
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wide font-medium">
                        Bootstrap Prompt
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        onClick={() => copyToClipboard(agent.id, bootstraps[agent.id])}
                      >
                        {copied === agent.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <Textarea
                      value={bootstraps[agent.id]}
                      readOnly
                      className="font-mono text-xs h-52 resize-none bg-secondary/50 border-border/60 text-muted-foreground"
                    />
                  </div>
                ) : (
                  <div className="px-4 py-6 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground/60">
                      Generate a bootstrap prompt to start an agent session
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
