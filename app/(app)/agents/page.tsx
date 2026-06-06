import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { TokenBudgetBar } from '@/components/layout/token-budget-bar'
import { Bot, Cpu } from 'lucide-react'

export default async function AgentsPage() {
  const supabase = await createClient()
  const { data: agents } = await supabase.from('agents').select('*').order('created_at')

  return (
    <div className="flex flex-col h-full">
      <Header title="Agents" description={`${(agents ?? []).length} configured`} />
      <div className="flex-1 overflow-auto p-6">
        {(agents ?? []).length === 0 ? (
          <div className="border border-dashed border-border/60 rounded-lg p-16 flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">No agents yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Agents are seeded automatically on first API call to /api/agents
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            {(agents ?? []).map((agent: any) => (
              <div
                key={agent.id}
                className="bg-card border border-border/60 rounded-lg overflow-hidden"
              >
                {/* Agent header with color accent */}
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
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground">{agent.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{agent.agent_key}</p>
                  </div>
                  <div
                    className="ml-auto w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: agent.color }}
                    title="Active"
                  />
                </div>

                {/* Agent details */}
                <div className="px-4 py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    <div>
                      <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wide block mb-0.5">Domain</span>
                      <span className="text-foreground/80">{agent.domain || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wide block mb-0.5">Budget</span>
                      <span className="text-foreground/80 font-mono">{agent.session_budget_k}K</span>
                    </div>
                    {agent.account_email && (
                      <div className="col-span-2">
                        <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wide block mb-0.5">Account</span>
                        <span className="text-foreground/80 truncate block">{agent.account_email}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Cpu className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wide">Today&apos;s Usage</span>
                    </div>
                    <TokenBudgetBar agentId={agent.id} agentName="" color={agent.color} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
