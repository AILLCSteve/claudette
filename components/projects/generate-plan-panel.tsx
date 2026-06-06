'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Sparkles, ChevronDown, ChevronRight, RefreshCw,
  Clock, CheckCircle2, Circle, AlertCircle, Layers
} from 'lucide-react'

interface PlanTask {
  id: string
  title: string
  description: string
  status: string
  priority: string
  assigned_agent: string
  estimated_tokens_k: number
  session_window: number
  is_checkpoint?: boolean
  acceptance_criteria?: string[]
}

interface DevPlan {
  id: string
  title: string
  overview: string
  status: string
  total_sessions_estimated: number
  dev_plan_tasks?: PlanTask[]
}

interface Props {
  projectId: string
  initialPlans: DevPlan[]
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 border-red-500/30',
  high: 'text-orange-400 border-orange-500/30',
  medium: 'text-yellow-400 border-yellow-500/30',
  low: 'text-muted-foreground border-border/60',
}

const AGENT_COLORS: Record<string, string> = {
  AGENT_A: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  AGENT_B: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
}

function PlanCard({ plan }: { plan: DevPlan }) {
  const [expanded, setExpanded] = useState(false)
  const tasks = plan.dev_plan_tasks ?? []
  const windowNums = tasks.map(t => t.session_window)
  const windows = Array.from(new Set(windowNums)).sort((a, b) => a - b)
  const doneTasks = tasks.filter(t => t.status === 'done').length

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden bg-card">
      <button
        className="w-full flex items-start justify-between p-4 hover:bg-secondary/20 transition-colors text-left gap-3"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <span className="text-sm font-medium truncate">{plan.title}</span>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${plan.status === 'active' ? 'border-emerald-500/30 text-emerald-400' : ''}`}>
              {plan.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground ml-5 line-clamp-2">{plan.overview?.slice(0, 180)}</p>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <p className="text-xs text-muted-foreground">{tasks.length} tasks</p>
          <p className="text-xs text-muted-foreground">{plan.total_sessions_estimated} windows</p>
          {tasks.length > 0 && (
            <p className="text-xs text-emerald-400">{doneTasks}/{tasks.length} done</p>
          )}
        </div>
      </button>

      {expanded && tasks.length > 0 && (
        <div className="border-t border-border/40 divide-y divide-border/30">
          {windows.map(win => {
            const winTasks = tasks.filter(t => t.session_window === win)
            const totalK = winTasks.reduce((sum, t) => sum + (t.estimated_tokens_k ?? 0), 0)
            return (
              <div key={win} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3 w-3 text-muted-foreground/60" />
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      Window {win}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground/60">~{totalK}K tokens</span>
                </div>
                <div className="space-y-1.5">
                  {winTasks.map(task => (
                    <div
                      key={task.id}
                      className={`flex items-start gap-2 px-2 py-1.5 rounded text-xs ${task.is_checkpoint ? 'bg-primary/5 border border-primary/20' : 'bg-secondary/30'}`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {task.status === 'done'
                          ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          : task.status === 'in-progress'
                            ? <RefreshCw className="h-3 w-3 text-blue-400 animate-spin" />
                            : task.is_checkpoint
                              ? <AlertCircle className="h-3 w-3 text-primary/60" />
                              : <Circle className="h-3 w-3 text-muted-foreground/40" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`font-medium ${task.is_checkpoint ? 'text-primary/80' : ''}`}>
                          {task.title}
                        </span>
                        {task.acceptance_criteria?.length ? (
                          <ul className="mt-1 space-y-0.5 text-muted-foreground/70">
                            {task.acceptance_criteria.slice(0, 2).map((c, i) => (
                              <li key={i} className="truncate">· {c}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1 py-0 ${PRIORITY_COLORS[task.priority] ?? 'border-border/60'}`}
                        >
                          {task.priority}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1 py-0 ${AGENT_COLORS[task.assigned_agent] ?? 'border-border/60 text-muted-foreground'}`}
                        >
                          {task.assigned_agent}
                        </Badge>
                        <span className="text-[9px] text-muted-foreground/50">{task.estimated_tokens_k}K</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function GeneratePlanPanel({ projectId, initialPlans }: Props) {
  const [plans, setPlans] = useState<DevPlan[]>(initialPlans)
  const [showForm, setShowForm] = useState(false)
  const [scope, setScope] = useState('')
  const [constraints, setConstraints] = useState('')
  const [generating, setGenerating] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setGenerating(true)
    setError(null)
    setShowForm(false)
    const start = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500)

    try {
      const res = await fetch('/api/claude/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, scope: scope.trim(), constraints: constraints.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Plan generation failed')
      } else {
        const newPlan: DevPlan = {
          ...data.devPlan,
          dev_plan_tasks: data.tasks ?? [],
        }
        setPlans(prev => [newPlan, ...prev])
        setScope('')
        setConstraints('')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      clearInterval(timer)
      setGenerating(false)
      setElapsed(0)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            Claude Opus generates a fully detailed, session-windowed implementation plan — the same as running{' '}
            <code className="bg-secondary px-1 rounded font-mono">/pm-plan</code> in your CLI.
          </p>
        </div>
        {!generating && (
          <Button
            size="sm"
            className="gap-1.5 text-xs shrink-0 ml-4"
            onClick={() => setShowForm(v => !v)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate Plan
          </Button>
        )}
      </div>

      {/* Inline form */}
      {showForm && !generating && (
        <div className="border border-primary/20 rounded-lg p-4 bg-primary/5 space-y-3">
          <p className="text-xs font-medium text-primary/80">Plan Generation</p>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Scope (optional — defaults to full project)</label>
            <Textarea
              value={scope}
              onChange={e => setScope(e.target.value)}
              placeholder="e.g. Focus on the auth system and user dashboard"
              className="h-16 text-xs resize-none bg-secondary/50 border-border/60"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Constraints (optional)</label>
            <Textarea
              value={constraints}
              onChange={e => setConstraints(e.target.value)}
              placeholder="e.g. No breaking changes to the API, must work offline"
              className="h-16 text-xs resize-none bg-secondary/50 border-border/60"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gap-1.5 text-xs h-7" onClick={generate}>
              <Sparkles className="h-3 w-3" />
              Generate with Claude Opus
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="border border-primary/20 rounded-lg p-6 bg-primary/5 flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <Sparkles className="h-4 w-4 text-primary absolute inset-0 m-auto" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">Claude Opus is planning…</p>
            <p className="text-xs text-muted-foreground">
              5-round autonomous research — feature decomp → architecture → web research → self-critique → synthesis
            </p>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground/70 mt-2">
              <Clock className="h-3 w-3" />
              <span>{elapsed}s — typically 30–90 seconds</span>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      {/* Plan list */}
      {plans.length === 0 && !generating && (
        <div className="border border-dashed border-border/40 rounded-lg p-10 text-center space-y-2">
          <Sparkles className="h-6 w-6 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No dev plans yet.</p>
          <p className="text-xs text-muted-foreground/60">
            Generate one above — Claude Opus will produce a fully detailed, session-windowed plan
            with TDD structure, agent assignments, and checkpoints.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {plans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
      </div>
    </div>
  )
}
