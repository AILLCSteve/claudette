'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { RepoPicker } from '@/components/github/repo-picker'
import {
  Sparkles, ChevronDown, ChevronRight, RefreshCw,
  CheckCircle2, Circle, AlertCircle, Layers, Trash2, Play,
  GitBranch, RotateCcw,
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
  github_repo: string | null
}

// Phase 1: fetching + analyzing the repo (fast, ~10-20s)
const ANALYZE_MESSAGES = [
  'Fetching repository structure and README from GitHub…',
  'Claude is reading your codebase…',
  'Summarizing tech stack, architecture, and current state…',
]

// Phase 2: generating the plan (slow, ~60-120s)
const PLAN_MESSAGES = [
  'Codebase analysis complete — generating development plan…',
  'Decomposing features into atomic, testable units…',
  'Building session windows and mapping task dependencies…',
  'Writing acceptance criteria and test strategies…',
  'Assigning agents, estimating token budgets, placing checkpoints…',
  'Finalizing plan structure…',
]

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 border-red-500/30',
  high:     'text-orange-400 border-orange-500/30',
  medium:   'text-yellow-400 border-yellow-500/30',
  low:      'text-muted-foreground border-border/60',
}

const AGENT_COLORS: Record<string, string> = {
  AGENT_A: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  AGENT_B: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
}

function PlanCard({
  plan,
  onDelete,
  onActivate,
}: {
  plan: DevPlan
  onDelete: (id: string) => Promise<void>
  onActivate: (id: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activating, setActivating] = useState(false)
  const tasks = plan.dev_plan_tasks ?? []
  const windowNums = Array.from(new Set(tasks.map(t => t.session_window))).sort((a, b) => a - b)
  const doneTasks = tasks.filter(t => t.status === 'done').length

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <button
        className="w-full flex items-start justify-between p-4 hover:bg-secondary/20 transition-colors text-left gap-3"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <span className="text-sm font-medium truncate">{plan.title}</span>
            <Badge
              variant="outline"
              className={`text-[10px] shrink-0 ${
                plan.status === 'active' ? 'border-emerald-500/30 text-emerald-400' :
                plan.status === 'completed' ? 'border-primary/30 text-primary' : ''
              }`}
            >
              {plan.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground ml-5 line-clamp-2">{plan.overview?.slice(0, 180)}</p>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <p className="text-xs text-muted-foreground">{tasks.length} tasks</p>
          <p className="text-xs text-muted-foreground">{plan.total_sessions_estimated} windows</p>
          {tasks.length > 0 && <p className="text-xs text-emerald-400">{doneTasks}/{tasks.length} done</p>}
        </div>
      </button>

      {/* 0-tasks warning */}
      {tasks.length === 0 && (
        <div className="border-t border-yellow-500/20 bg-yellow-500/5 px-4 py-3 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-yellow-400">No tasks saved — migration 006 not applied</p>
            <p className="text-[11px] text-yellow-400/70">Run in Supabase SQL Editor, then regenerate:</p>
            <code className="block bg-yellow-500/10 rounded px-2 py-1.5 font-mono text-[10px] text-yellow-300/80 break-all leading-relaxed">
              ALTER TABLE dev_plan_tasks ADD COLUMN IF NOT EXISTS is_checkpoint boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT &apos;medium&apos; CHECK (priority IN (&apos;critical&apos;,&apos;high&apos;,&apos;medium&apos;,&apos;low&apos;));
            </code>
          </div>
        </div>
      )}

      {/* Expanded tasks */}
      {expanded && tasks.length > 0 && (
        <div className="border-t border-border/40 divide-y divide-border/30">
          {windowNums.map(win => {
            const winTasks = tasks.filter(t => t.session_window === win)
            const totalK = winTasks.reduce((sum, t) => sum + (t.estimated_tokens_k ?? 0), 0)
            return (
              <div key={win} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3 w-3 text-muted-foreground/60" />
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Window {win}</span>
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
                        {task.status === 'done' ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> :
                         task.status === 'in-progress' ? <RefreshCw className="h-3 w-3 text-blue-400 animate-spin" /> :
                         task.is_checkpoint ? <AlertCircle className="h-3 w-3 text-primary/60" /> :
                         <Circle className="h-3 w-3 text-muted-foreground/40" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`font-medium ${task.is_checkpoint ? 'text-primary/80' : ''}`}>{task.title}</span>
                        {task.acceptance_criteria?.length ? (
                          <ul className="mt-1 space-y-0.5 text-muted-foreground/70">
                            {task.acceptance_criteria.slice(0, 2).map((c, i) => <li key={i} className="truncate">· {c}</li>)}
                          </ul>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${PRIORITY_COLORS[task.priority] ?? 'border-border/60'}`}>
                          {task.priority}
                        </Badge>
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${AGENT_COLORS[task.assigned_agent] ?? 'border-border/60 text-muted-foreground'}`}>
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

      {/* Action bar */}
      <div className="border-t border-border/40 px-4 py-2 flex items-center justify-between bg-secondary/10">
        <div className="flex items-center gap-3">
          {plan.status === 'draft' && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[11px] gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={e => { e.stopPropagation(); setActivating(true); onActivate(plan.id).finally(() => setActivating(false)) }}
              disabled={activating}
            >
              <Play className="h-2.5 w-2.5" />
              {activating ? 'Activating…' : 'Activate'}
            </Button>
          )}
          {tasks.length > 0 && <span className="text-[10px] text-muted-foreground/50">Tasks added to Board</span>}
        </div>
        <div>
          {!confirmDelete ? (
            <button
              className="text-muted-foreground/40 hover:text-red-400 transition-colors p-1 rounded"
              onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
              title="Delete plan"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Delete plan?</span>
              <button
                className="text-[11px] text-red-400 hover:text-red-300 font-medium disabled:opacity-50"
                onClick={e => { e.stopPropagation(); setDeleting(true); onDelete(plan.id).finally(() => setDeleting(false)) }}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Yes'}
              </button>
              <button
                className="text-[11px] text-muted-foreground hover:text-foreground"
                onClick={e => { e.stopPropagation(); setConfirmDelete(false) }}
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function GeneratePlanPanel({ projectId, initialPlans, github_repo }: Props) {
  const router = useRouter()
  const [plans, setPlans] = useState<DevPlan[]>(initialPlans)
  const [showForm, setShowForm] = useState(false)
  const [scope, setScope] = useState('')
  const [constraints, setConstraints] = useState('')
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'planning'>('idle')
  const [statusIdx, setStatusIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  // Repo selected via picker when project has no github_repo linked yet
  const [pickedRepo, setPickedRepo] = useState<string | null>(null)

  // Re-sync local state when server passes updated initialPlans (e.g. after router.refresh())
  const prevInitialRef = useRef(initialPlans)
  useEffect(() => {
    if (prevInitialRef.current !== initialPlans) {
      prevInitialRef.current = initialPlans
      setPlans(initialPlans)
    }
  }, [initialPlans])

  const repoToUse = github_repo ?? pickedRepo
  const generating = phase !== 'idle'
  const messages = phase === 'analyzing' ? ANALYZE_MESSAGES : PLAN_MESSAGES

  // Advance status message at different rates per phase
  useEffect(() => {
    if (phase === 'idle') { setStatusIdx(0); return }
    const interval = phase === 'analyzing' ? 5000 : 12000
    const maxIdx = (phase === 'analyzing' ? ANALYZE_MESSAGES : PLAN_MESSAGES).length - 1
    const timer = setInterval(() => setStatusIdx(prev => Math.min(prev + 1, maxIdx)), interval)
    return () => clearInterval(timer)
  }, [phase])

  const generate = async () => {
    if (!repoToUse) return
    setError(null)
    setShowForm(false)

    const [owner, repo] = repoToUse.split('/')

    // Stage 1 — fetch GitHub analysis
    setPhase('analyzing')
    setStatusIdx(0)
    let githubAnalysis = ''
    try {
      const res = await fetch('/api/github/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, projectId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'GitHub analysis failed')
      githubAnalysis = data.analysis ?? ''
    } catch (err: any) {
      setError(`GitHub analysis failed: ${err.message}`)
      setPhase('idle')
      return
    }

    // Stage 2 — generate plan using the analysis
    setPhase('planning')
    setStatusIdx(0)
    try {
      const res = await fetch('/api/claude/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, scope: scope.trim(), constraints: constraints.trim(), githubAnalysis }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Plan generation failed')
      } else {
        setPlans(prev => [{ ...data.devPlan, dev_plan_tasks: data.tasks ?? [] }, ...prev])
        setScope('')
        setConstraints('')
        // Refresh SSR data so the plan survives tab switches
        router.refresh()
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setPhase('idle')
    }
  }

  // Pull fresh task statuses from the server (agents update them via API)
  const syncPlans = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`/api/dev-plans?project_id=${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setPlans(Array.isArray(data) ? data : [])
      }
    } finally {
      setSyncing(false)
      router.refresh()
    }
  }

  const deletePlan = async (id: string) => {
    const res = await fetch(`/api/plans/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPlans(prev => prev.filter(p => p.id !== id))
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(`Delete failed: ${data.error ?? res.statusText}`)
    }
  }

  const activatePlan = async (id: string) => {
    const res = await fetch(`/api/plans/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })
    if (res.ok) {
      setPlans(prev => prev.map(p => p.id === id ? { ...p, status: 'active' } : p))
    } else {
      const data = await res.json().catch(() => ({}))
      setError(`Activation failed: ${data.error ?? res.statusText}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Claude Opus analyzes your GitHub repo, then generates a session-windowed plan with TDD
          structure, agent assignments, and checkpoints.
        </p>
        {!generating && (
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground"
              onClick={syncPlans}
              disabled={syncing}
              title="Sync task statuses from server"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync'}
            </Button>
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowForm(v => !v)}>
              <Sparkles className="h-3.5 w-3.5" />
              Generate Plan
            </Button>
          </div>
        )}
      </div>

      {/* Generation form */}
      {showForm && !generating && (
        <div className="border border-primary/20 rounded-lg p-4 bg-primary/5 space-y-4">
          <p className="text-xs font-medium text-primary/80">Plan Generation</p>

          {/* Repo status */}
          {repoToUse ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-emerald-500/10 border border-emerald-500/20">
              <GitBranch className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-emerald-400 font-medium">{repoToUse}</span>
                <p className="text-[11px] text-emerald-400/70">Claude will analyze this repo before planning</p>
              </div>
              {!github_repo && (
                <button
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => setPickedRepo(null)}
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-yellow-400/80">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                No GitHub repo linked — select one to continue
              </div>
              <RepoPicker
                onSelect={r => setPickedRepo(r.full_name)}
              />
            </div>
          )}

          {/* Scope + Constraints — only show when repo is ready */}
          {repoToUse && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Scope (optional)</label>
                <Textarea
                  value={scope}
                  onChange={e => setScope(e.target.value)}
                  placeholder="e.g. Focus on the auth system and user dashboard"
                  className="h-14 text-xs resize-none bg-secondary/50 border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Constraints (optional)</label>
                <Textarea
                  value={constraints}
                  onChange={e => setConstraints(e.target.value)}
                  placeholder="e.g. No breaking API changes, must work offline"
                  className="h-14 text-xs resize-none bg-secondary/50 border-border/60"
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
            </>
          )}
        </div>
      )}

      {/* Generation progress */}
      {generating && (
        <div className="border border-primary/20 rounded-lg p-6 bg-primary/5 flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            {phase === 'analyzing'
              ? <GitBranch className="h-4 w-4 text-primary absolute inset-0 m-auto" />
              : <Sparkles className="h-4 w-4 text-primary absolute inset-0 m-auto" />}
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">
              {phase === 'analyzing' ? `Analyzing ${repoToUse}…` : 'Claude Opus is planning…'}
            </p>
            <p className="text-xs text-muted-foreground">{messages[statusIdx]}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md px-3 py-2.5 text-xs bg-red-500/10 border border-red-500/20 text-red-400 whitespace-pre-wrap font-mono leading-relaxed">
          {error}
        </div>
      )}

      {/* Empty state */}
      {plans.length === 0 && !generating && (
        <div className="border border-dashed border-border/40 rounded-lg p-10 text-center space-y-2">
          <Sparkles className="h-6 w-6 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No dev plans yet.</p>
          <p className="text-xs text-muted-foreground/60">
            Generate one above — Claude Opus will analyze your GitHub repo and produce a fully
            detailed, session-windowed plan with TDD structure, agent assignments, and checkpoints.
          </p>
        </div>
      )}

      {/* Plans list */}
      <div className="space-y-3">
        {plans.map(plan => (
          <PlanCard key={plan.id} plan={plan} onDelete={deletePlan} onActivate={activatePlan} />
        ))}
      </div>
    </div>
  )
}
