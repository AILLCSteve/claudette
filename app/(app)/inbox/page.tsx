import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ExternalLink, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import type { Urgency } from '@/types'

const urgencyConfig: Record<Urgency, { label: string; dot: string; text: string }> = {
  high:   { label: 'High',   dot: 'bg-red-500',   text: 'text-red-400' },
  medium: { label: 'Medium', dot: 'bg-amber-500',  text: 'text-amber-400' },
  low:    { label: 'Low',    dot: 'bg-blue-500',   text: 'text-blue-400' },
}

export default async function InboxPage() {
  const supabase = await createClient()

  const { data: obstacles } = await supabase
    .from('obstacles')
    .select('*, projects(id, name)')
    .eq('status', 'open')
    .eq('needs_human', true)
    .order('urgency', { ascending: false })

  const items = obstacles ?? []

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Decision Inbox"
        description={items.length > 0 ? `${items.length} item${items.length !== 1 ? 's' : ''} need your input` : undefined}
      />
      <div className="flex-1 overflow-auto p-6">
        {items.length === 0 ? (
          <div className="border border-dashed border-border/60 rounded-lg p-16 flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium">All clear</p>
              <p className="text-xs text-muted-foreground mt-1">No decisions needed from you right now</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            {items.map((obstacle: any) => {
              const urg = urgencyConfig[obstacle.urgency as Urgency] ?? urgencyConfig.medium
              return (
                <div
                  key={obstacle.id}
                  className="bg-card border border-border/60 rounded-lg p-4 space-y-3 hover:border-border transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${urg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${urg.dot}`} />
                        {urg.label}
                      </span>
                      {obstacle.projects?.name && (
                        <span className="text-xs text-muted-foreground truncate">
                          · {obstacle.projects.name}
                        </span>
                      )}
                    </div>
                    <Link href={`/projects/${obstacle.projects?.id}`} className="shrink-0">
                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </Button>
                    </Link>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-foreground leading-relaxed">{obstacle.description}</p>

                  {/* Options */}
                  {obstacle.options?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Options</p>
                      <ul className="space-y-1">
                        {obstacle.options.map((opt: string, i: number) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-2">
                            <span className="text-muted-foreground/40 font-mono shrink-0">{i + 1}.</span>
                            {opt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendation + Workaround */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {obstacle.recommendation && (
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-md px-3 py-2">
                        <p className="text-[11px] text-emerald-400 font-medium mb-0.5">Recommendation</p>
                        <p className="text-xs text-muted-foreground">{obstacle.recommendation}</p>
                      </div>
                    )}
                    {obstacle.workaround && (
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-md px-3 py-2">
                        <p className="text-[11px] text-blue-400 font-medium mb-0.5">Workaround</p>
                        <p className="text-xs text-muted-foreground">{obstacle.workaround}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
