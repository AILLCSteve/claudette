'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChevronRight, ChevronDown, Plus, Pencil, Trash2, X, Check,
  UserPlus, Zap, Circle, CheckCircle2, AlertCircle, Ban, Clock,
  Pause, Eye, MessageSquare, GitMerge, Loader2, CalendarDays,
  Layers, LayoutList, Target, RefreshCw
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────

type Level = 'track' | 'feature' | 'task' | 'subtask'
type Priority = 'critical' | 'high' | 'medium' | 'low'

export interface PmItem {
  id: string
  project_id: string
  parent_id: string | null
  level: Level
  position: number
  title: string
  description?: string | null
  status: string
  priority: Priority
  assigned_agents: string[]
  estimated_tokens_k?: number | null
  session_window?: number | null
  acceptance_criteria: string[]
  due_date?: string | null
  notes?: string | null
  tags: string[]
}

interface TreeNode extends PmItem { children: TreeNode[] }

// ── Status system ─────────────────────────────────────────────────────────

export const STATUSES: { value: string; label: string; color: string; pill: string; icon: React.ReactNode; group: string }[] = [
  { value: 'backlog',           label: 'Backlog',            color: 'text-muted-foreground/40', pill: 'bg-muted/15 border-border/25',              icon: <Circle className="h-3 w-3" />,          group: 'Planning' },
  { value: 'not-started',      label: 'Not Yet Started',    color: 'text-muted-foreground/70', pill: 'bg-muted/30 border-border/40',              icon: <Clock className="h-3 w-3" />,           group: 'Planning' },
  { value: 'ready',            label: 'Ready',              color: 'text-blue-400',            pill: 'bg-blue-500/10 border-blue-500/25',         icon: <Target className="h-3 w-3" />,          group: 'Planning' },
  { value: 'in-progress',      label: 'In Progress',        color: 'text-violet-400',          pill: 'bg-violet-500/15 border-violet-500/30',     icon: <Zap className="h-3 w-3" />,             group: 'Active' },
  { value: 'underway',         label: 'Underway',           color: 'text-violet-300',          pill: 'bg-violet-500/10 border-violet-500/20',     icon: <Zap className="h-3 w-3" />,             group: 'Active' },
  { value: 'paused',           label: 'Paused',             color: 'text-yellow-500',          pill: 'bg-yellow-500/10 border-yellow-500/25',     icon: <Pause className="h-3 w-3" />,           group: 'Active' },
  { value: 'needs-attention',  label: 'Needs Attention',    color: 'text-amber-400',           pill: 'bg-amber-500/15 border-amber-500/30',       icon: <AlertCircle className="h-3 w-3" />,     group: 'Attention' },
  { value: 'awaiting-decision',label: 'Awaiting Decision',  color: 'text-orange-400',          pill: 'bg-orange-500/10 border-orange-500/25',     icon: <MessageSquare className="h-3 w-3" />,   group: 'Attention' },
  { value: 'blocked',          label: 'Blocked',            color: 'text-red-400',             pill: 'bg-red-500/15 border-red-500/30',           icon: <Ban className="h-3 w-3" />,             group: 'Attention' },
  { value: 'needs-input',      label: 'Needs Input',        color: 'text-orange-300',          pill: 'bg-orange-500/8 border-orange-500/20',      icon: <MessageSquare className="h-3 w-3" />,   group: 'Attention' },
  { value: 'in-review',        label: 'In Review',          color: 'text-cyan-400',            pill: 'bg-cyan-500/10 border-cyan-500/25',         icon: <Eye className="h-3 w-3" />,             group: 'Review' },
  { value: 'testing',          label: 'Testing',            color: 'text-cyan-300',            pill: 'bg-cyan-500/8 border-cyan-500/20',          icon: <GitMerge className="h-3 w-3" />,        group: 'Review' },
  { value: 'done',             label: 'Done',               color: 'text-emerald-400',         pill: 'bg-emerald-500/15 border-emerald-500/30',   icon: <CheckCircle2 className="h-3 w-3" />,    group: 'Complete' },
  { value: 'cancelled',        label: 'Cancelled',          color: 'text-muted-foreground/30', pill: 'bg-muted/15 border-border/20',              icon: <Ban className="h-3 w-3" />,             group: 'Complete' },
]

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s]))
const STATUS_VALUES = STATUSES.map(s => s.value)

// ── Priority ──────────────────────────────────────────────────────────────

const PRIORITY_CFG: Record<Priority, { dot: string; label: string; text: string }> = {
  critical: { dot: 'bg-red-500',                 label: 'Critical', text: 'text-red-400' },
  high:     { dot: 'bg-orange-400',              label: 'High',     text: 'text-orange-400' },
  medium:   { dot: 'bg-yellow-400',              label: 'Medium',   text: 'text-yellow-400' },
  low:      { dot: 'bg-muted-foreground/30',     label: 'Low',      text: 'text-muted-foreground/50' },
}

// ── Agent colors ──────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  AGENT_A: 'bg-violet-500/25 text-violet-300 border-violet-500/40',
  AGENT_B: 'bg-blue-500/25 text-blue-300 border-blue-500/40',
  AGENT_C: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40',
  AGENT_D: 'bg-orange-500/25 text-orange-300 border-orange-500/40',
  AGENT_E: 'bg-pink-500/25 text-pink-300 border-pink-500/40',
  AGENT_F: 'bg-cyan-500/25 text-cyan-300 border-cyan-500/40',
}

function agentColor(agent: string) {
  return AGENT_COLORS[agent] ?? 'bg-secondary/60 text-muted-foreground border-border/40'
}

function agentShort(agent: string) {
  return agent.replace('AGENT_', 'A')
}

const LEVEL_CHILD: Record<Level, Level | null> = {
  track: 'feature', feature: 'task', task: 'subtask', subtask: null,
}
const LEVEL_LABEL: Record<Level, string> = {
  track: 'Track', feature: 'Feature', task: 'Task', subtask: 'Subtask',
}
const LEVEL_ICON: Record<Level, React.ReactNode> = {
  track:    <Layers className="h-3.5 w-3.5" />,
  feature:  <LayoutList className="h-3.5 w-3.5" />,
  task:     <Target className="h-3.5 w-3.5" />,
  subtask:  <Circle className="h-3 w-3" />,
}

const DEFAULT_AGENTS = ['AGENT_A', 'AGENT_B', 'AGENT_C', 'AGENT_D', 'AGENT_E', 'AGENT_F']

// ── Helpers ───────────────────────────────────────────────────────────────

function buildTree(items: PmItem[], parentId: string | null = null): TreeNode[] {
  return items
    .filter(i => i.parent_id === parentId)
    .sort((a, b) => a.position - b.position)
    .map(i => ({ ...i, children: buildTree(items, i.id) }))
}

function countDescendants(node: TreeNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0)
}

function doneCount(node: TreeNode): number {
  return node.children.reduce((sum, c) => sum + (c.status === 'done' ? 1 : 0) + doneCount(c), 0)
}

function formatDate(d: string | null | undefined) {
  if (!d) return null
  const date = new Date(d)
  const now = new Date()
  const isOverdue = date < now && date.toDateString() !== now.toDateString()
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return { label, isOverdue }
}

// ── AgentChip ─────────────────────────────────────────────────────────────

function AgentChip({ agent, onRemove }: { agent: string; onRemove?: (e: React.MouseEvent) => void }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono rounded px-1.5 py-0.5 border ${agentColor(agent)}`}>
      {agentShort(agent)}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 hover:opacity-70">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}

// ── AgentPicker ───────────────────────────────────────────────────────────

function AgentPicker({ selected, all, onChange, onClose }: {
  selected: string[]; all: string[]
  onChange: (a: string[]) => void; onClose: () => void
}) {
  return (
    <div className="absolute z-[60] top-full left-0 mt-1 bg-card border border-border/70 rounded-lg shadow-2xl p-2 min-w-[180px]">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-1 mb-2">Assign Agents</p>
      {all.map(agent => {
        const on = selected.includes(agent)
        return (
          <button key={agent} onClick={e => { e.stopPropagation(); onChange(on ? selected.filter(a => a !== agent) : [...selected, agent]) }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-secondary/60 transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-primary border-primary' : 'border-border/50'}`}>
              {on && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
            </div>
            <span className={`font-mono ${agentColor(agent).split(' ')[1]}`}>{agent}</span>
          </button>
        )
      })}
      <button onClick={e => { e.stopPropagation(); onClose() }}
        className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground mt-1.5 pt-1.5 border-t border-border/40">
        Done
      </button>
    </div>
  )
}

// ── StatusPicker ──────────────────────────────────────────────────────────

function StatusPicker({ current, onChange, onClose }: {
  current: string; onChange: (s: string) => void; onClose: () => void
}) {
  const groups = Array.from(new Set(STATUSES.map(s => s.group)))
  return (
    <div className="absolute z-[60] top-full left-0 mt-1 bg-card border border-border/70 rounded-lg shadow-2xl p-2 min-w-[200px]">
      {groups.map(group => (
        <div key={group} className="mb-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-1 mb-1">{group}</p>
          {STATUSES.filter(s => s.group === group).map(s => (
            <button key={s.value} onClick={e => { e.stopPropagation(); onChange(s.value); onClose() }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-secondary/60 transition-colors ${current === s.value ? 'bg-secondary/50' : ''}`}>
              <span className={s.color}>{s.icon}</span>
              <span>{s.label}</span>
              {current === s.value && <Check className="h-3 w-3 ml-auto text-primary" />}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────

function DetailPanel({ item, agents, onClose, onUpdate, onDelete }: {
  item: PmItem; agents: string[]
  onClose: () => void
  onUpdate: (id: string, u: Partial<PmItem>) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [criteria, setCriteria] = useState((item.acceptance_criteria ?? []).join('\n'))
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)

  // Sync when item changes
  useEffect(() => {
    setTitle(item.title)
    setDescription(item.description ?? '')
    setNotes(item.notes ?? '')
    setCriteria((item.acceptance_criteria ?? []).join('\n'))
  }, [item.id])

  const save = (field: string, value: unknown) => onUpdate(item.id, { [field]: value } as Partial<PmItem>)

  const statusCfg = STATUS_MAP[item.status] ?? STATUS_MAP['backlog']
  const priCfg = PRIORITY_CFG[item.priority] ?? PRIORITY_CFG.medium
  const dateInfo = formatDate(item.due_date)

  return (
    <div className="fixed inset-y-0 right-0 w-[440px] bg-background border-l border-border/60 shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 shrink-0">
        <span className={`${LEVEL_ICON[item.level] ? '' : ''} text-muted-foreground/60 shrink-0`}>
          {LEVEL_ICON[item.level]}
        </span>
        <div className="flex-1 relative">
          <button onClick={() => setShowStatusPicker(v => !v)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border hover:opacity-80 transition-opacity ${statusCfg.pill} ${statusCfg.color}`}>
            {statusCfg.icon}
            <span>{statusCfg.label}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {showStatusPicker && <StatusPicker current={item.status} onChange={s => save('status', s)} onClose={() => setShowStatusPicker(false)} />}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors ml-auto">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-5">
          {/* Title */}
          <div>
            <textarea
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => save('title', title)}
              rows={2}
              className="w-full bg-transparent text-base font-semibold resize-none focus:outline-none placeholder:text-muted-foreground/30 leading-snug"
              placeholder="Item title..."
            />
          </div>

          {/* Priority · Due date */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Priority</span>
              <select value={item.priority} onChange={e => save('priority', e.target.value)}
                className={`bg-transparent border-0 text-xs font-medium focus:outline-none cursor-pointer ${priCfg.text}`}>
                {(['critical', 'high', 'medium', 'low'] as Priority[]).map(p => (
                  <option key={p} value={p} className="bg-popover text-foreground">{PRIORITY_CFG[p].label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-muted-foreground/60" />
              <input type="date" value={item.due_date ?? ''}
                onChange={e => save('due_date', e.target.value || null)}
                className={`bg-transparent text-xs focus:outline-none cursor-pointer ${dateInfo?.isOverdue ? 'text-red-400' : 'text-muted-foreground'}`}
              />
            </div>

            {(item.level === 'task' || item.level === 'subtask') && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Win.</span>
                <input type="number" min={1} value={item.session_window ?? ''}
                  onChange={e => save('session_window', e.target.value ? parseInt(e.target.value) : null)}
                  className="bg-transparent text-xs w-10 focus:outline-none text-muted-foreground"
                  placeholder="—"
                />
              </div>
            )}

            {(item.level === 'task' || item.level === 'subtask') && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">~K tokens</span>
                <input type="number" min={1} value={item.estimated_tokens_k ?? ''}
                  onChange={e => save('estimated_tokens_k', e.target.value ? parseInt(e.target.value) : null)}
                  className="bg-transparent text-xs w-12 focus:outline-none text-muted-foreground"
                  placeholder="—"
                />
              </div>
            )}
          </div>

          {/* Agents */}
          <div className="relative">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Assigned Agents</p>
            <div className="flex flex-wrap gap-1.5 items-center">
              {item.assigned_agents.map(a => (
                <AgentChip key={a} agent={a}
                  onRemove={e => { e.stopPropagation(); save('assigned_agents', item.assigned_agents.filter(x => x !== a)) }} />
              ))}
              <button onClick={() => setShowAgentPicker(v => !v)}
                className="text-[10px] text-muted-foreground hover:text-foreground border border-dashed border-border/50 hover:border-primary/40 rounded px-2 py-0.5 transition-colors flex items-center gap-0.5">
                <UserPlus className="h-3 w-3" /> Add
              </button>
            </div>
            {showAgentPicker && (
              <AgentPicker selected={item.assigned_agents} all={agents}
                onChange={a => save('assigned_agents', a)} onClose={() => setShowAgentPicker(false)} />
            )}
          </div>

          <div className="border-t border-border/30" />

          {/* Description */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Description</p>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              onBlur={() => save('description', description || null)}
              rows={5} placeholder="Detailed description — what to build, file paths, function signatures, edge cases…"
              className="w-full bg-secondary/30 border border-border/40 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-primary/40 transition-colors leading-relaxed"
            />
          </div>

          {/* Acceptance Criteria */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
              Acceptance Criteria <span className="normal-case text-muted-foreground/40">(one per line)</span>
            </p>
            <textarea value={criteria} onChange={e => setCriteria(e.target.value)}
              onBlur={() => save('acceptance_criteria', criteria.split('\n').map(s => s.trim()).filter(Boolean))}
              rows={4} placeholder={`- Feature behaves as expected\n- All tests pass\n- No regressions\n- Code reviewed`}
              className="w-full bg-secondary/30 border border-border/40 rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-primary/40 transition-colors leading-relaxed"
            />
            {item.acceptance_criteria?.length > 0 && (
              <div className="mt-2 space-y-1">
                {item.acceptance_criteria.map((c, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400/60 mt-0.5 shrink-0" />
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              onBlur={() => save('notes', notes || null)}
              rows={3} placeholder="Implementation notes, context, links, gotchas…"
              className="w-full bg-secondary/30 border border-border/40 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/60 px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={() => { onDelete(item.id); onClose() }}
          className="text-xs text-red-400/60 hover:text-red-400 transition-colors flex items-center gap-1.5">
          <Trash2 className="h-3.5 w-3.5" /> Delete {LEVEL_LABEL[item.level]}
        </button>
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded border border-border/50 hover:bg-secondary/50 transition-colors">
          Close
        </button>
      </div>
    </div>
  )
}

// ── Add Row ───────────────────────────────────────────────────────────────

function AddRow({ level, onAdd, onCancel }: { level: Level; onAdd: (t: string) => void; onCancel: () => void }) {
  const [v, setV] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/20">
      <div className="w-4 shrink-0" />
      <div className={`w-2 h-2 rounded-full bg-primary/30 shrink-0`} />
      <input ref={ref} value={v} onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && v.trim()) onAdd(v.trim()); if (e.key === 'Escape') onCancel() }}
        placeholder={`New ${LEVEL_LABEL[level]}…`}
        className="flex-1 bg-secondary/40 border border-primary/30 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/60 transition-colors"
      />
      <button onClick={() => v.trim() && onAdd(v.trim())} className="text-primary hover:text-primary/70 transition-colors"><Check className="h-3.5 w-3.5" /></button>
      <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-3.5 w-3.5" /></button>
    </div>
  )
}

// ── TreeRow ───────────────────────────────────────────────────────────────

function TreeRow({
  node, depth, expanded, agents, selectedId,
  onToggle, onSelect, onUpdate, onDelete, onAddChild,
  editingId, onStartEdit, onSaveEdit, editTitle, onEditTitleChange,
  addingUnder, onAddUnder, onAddComplete, onAddCancel,
}: {
  node: TreeNode; depth: number; expanded: Set<string>; agents: string[]; selectedId: string | null
  onToggle: (id: string) => void
  onSelect: (item: PmItem) => void
  onUpdate: (id: string, u: Partial<PmItem>) => void
  onDelete: (id: string) => void
  onAddChild: (parentId: string, level: Level) => void
  editingId: string | null
  onStartEdit: (id: string, t: string) => void
  onSaveEdit: (id: string) => void
  editTitle: string
  onEditTitleChange: (t: string) => void
  addingUnder: { parentId: string; level: Level } | null
  onAddUnder: (parentId: string, level: Level) => void
  onAddComplete: (title: string) => void
  onAddCancel: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)

  const isExpanded = expanded.has(node.id)
  const isSelected = selectedId === node.id
  const isEditing = editingId === node.id
  const childLevel = LEVEL_CHILD[node.level]
  const hasChildren = node.children.length > 0
  const isAddingHere = addingUnder?.parentId === node.id

  const statusCfg = STATUS_MAP[node.status] ?? STATUS_MAP['backlog']
  const priCfg = PRIORITY_CFG[node.priority] ?? PRIORITY_CFG.medium
  const dateInfo = formatDate(node.due_date)
  const total = countDescendants(node)
  const done = doneCount(node)

  const indentPx = 12 + depth * 22

  // Row level styles
  const rowBg = isSelected
    ? 'bg-primary/10 border-l-2 border-primary'
    : node.level === 'track'
      ? 'bg-primary/5 border-l-[3px] border-primary/50 hover:bg-primary/8'
      : node.level === 'feature'
        ? 'border-l-2 border-border/30 hover:bg-secondary/30'
        : 'hover:bg-secondary/20'

  const titleStyle = node.level === 'track'
    ? 'text-sm font-semibold tracking-wide text-foreground/90'
    : node.level === 'feature'
      ? 'text-sm font-medium text-foreground/85'
      : node.level === 'subtask'
        ? 'text-xs text-foreground/70'
        : 'text-sm text-foreground/80'

  return (
    <div>
      {/* The row itself */}
      <div
        className={`group relative flex items-center gap-1.5 py-1.5 cursor-pointer select-none transition-colors ${rowBg} ${node.status === 'done' || node.status === 'cancelled' ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${indentPx}px`, paddingRight: '8px' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setShowAgentPicker(false); setShowStatusPicker(false) }}
        onClick={() => { if (hasChildren || childLevel) onToggle(node.id) }}
      >
        {/* Expand chevron */}
        <div className="w-4 shrink-0 flex items-center justify-center">
          {hasChildren
            ? isExpanded
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
            : <span className="w-3.5" />}
        </div>

        {/* Status pill — always visible, click to change */}
        <div className="relative shrink-0">
          <button
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap hover:opacity-80 transition-opacity ${statusCfg.pill} ${statusCfg.color}`}
            onClick={e => { e.stopPropagation(); setShowStatusPicker(v => !v) }}>
            {statusCfg.icon}
            <span>{statusCfg.label}</span>
          </button>
          {showStatusPicker && (
            <StatusPicker current={node.status} onChange={s => { onUpdate(node.id, { status: s }); setShowStatusPicker(false) }} onClose={() => setShowStatusPicker(false)} />
          )}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {node.level === 'track' && (
            <span className="text-[9px] font-mono uppercase tracking-widest text-primary/50 shrink-0">TRK</span>
          )}
          {isEditing ? (
            <input autoFocus value={editTitle} onChange={e => onEditTitleChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') onSaveEdit(node.id) }}
              onBlur={() => onSaveEdit(node.id)} onClick={e => e.stopPropagation()}
              className="flex-1 bg-secondary/60 border border-primary/40 rounded px-1.5 py-0.5 text-sm focus:outline-none min-w-0"
            />
          ) : (
            <span className={`${titleStyle} truncate ${node.status === 'done' || node.status === 'cancelled' ? 'line-through' : ''}`}
              onDoubleClick={e => { e.stopPropagation(); onStartEdit(node.id, node.title) }}>
              {node.title}
            </span>
          )}
        </div>

        {/* Right side meta */}
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {/* Due date */}
          {dateInfo && !hovered && (
            <span className={`text-[10px] flex items-center gap-0.5 ${dateInfo.isOverdue ? 'text-red-400' : 'text-muted-foreground/50'}`}>
              <CalendarDays className="h-3 w-3" />
              {dateInfo.label}
            </span>
          )}

          {/* Priority dot */}
          {node.priority !== 'medium' && !hovered && (
            <div className={`w-2 h-2 rounded-full shrink-0 ${priCfg.dot}`} title={priCfg.label} />
          )}

          {/* Agents */}
          <div className="flex items-center -space-x-1">
            {node.assigned_agents.slice(0, 4).map(a => (
              <span key={a} className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold border-2 border-background ${agentColor(a)}`}>
                {agentShort(a)}
              </span>
            ))}
            {node.assigned_agents.length > 4 && (
              <span className="text-[10px] text-muted-foreground ml-1">+{node.assigned_agents.length - 4}</span>
            )}
          </div>

          {/* Progress badge for tracks/features */}
          {total > 0 && (node.level === 'track' || node.level === 'feature') && !hovered && (
            <span className="text-[10px] text-muted-foreground/40 tabular-nums">{done}/{total}</span>
          )}

          {/* Hover actions */}
          {hovered && (
            <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
              {/* Assign agent */}
              <div className="relative">
                <button onClick={() => setShowAgentPicker(v => !v)}
                  className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60 transition-colors" title="Assign agent">
                  <UserPlus className="h-3 w-3" />
                </button>
                {showAgentPicker && (
                  <AgentPicker selected={node.assigned_agents} all={agents}
                    onChange={a => onUpdate(node.id, { assigned_agents: a })} onClose={() => setShowAgentPicker(false)} />
                )}
              </div>

              {/* Add child */}
              {childLevel && (
                <button onClick={() => onAddUnder(node.id, childLevel)}
                  className="h-6 flex items-center gap-0.5 px-1.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60 transition-colors text-[10px]" title={`Add ${LEVEL_LABEL[childLevel]}`}>
                  <Plus className="h-3 w-3" />
                  {LEVEL_LABEL[childLevel]}
                </button>
              )}

              {/* Open detail */}
              <button onClick={() => onSelect(node)}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60 transition-colors" title="Open details">
                <Pencil className="h-3 w-3" />
              </button>

              {/* Delete */}
              <button onClick={() => onDelete(node.id)}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Children — smooth cascade */}
      <div style={{ display: 'grid', gridTemplateRows: isExpanded ? '1fr' : '0fr', transition: 'grid-template-rows 0.18s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          {isAddingHere && childLevel && (
            <AddRow level={childLevel} onAdd={onAddComplete} onCancel={onAddCancel} />
          )}
          {node.children.map(child => (
            <TreeRow key={child.id} node={child} depth={depth + 1} expanded={expanded} agents={agents}
              selectedId={selectedId} onToggle={onToggle} onSelect={onSelect} onUpdate={onUpdate}
              onDelete={onDelete} onAddChild={onAddChild} editingId={editingId}
              onStartEdit={onStartEdit} onSaveEdit={onSaveEdit} editTitle={editTitle}
              onEditTitleChange={onEditTitleChange} addingUnder={addingUnder}
              onAddUnder={onAddUnder} onAddComplete={onAddComplete} onAddCancel={onAddCancel}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────

export function PmTree({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<PmItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [addingUnder, setAddingUnder] = useState<{ parentId: string; level: Level } | null>(null)
  const [addingTrack, setAddingTrack] = useState(false)
  const [agents] = useState<string[]>(DEFAULT_AGENTS)
  const [syncing, setSyncing] = useState(false)

  const loadItems = useCallback(() => {
    setLoading(true)
    fetch(`/api/pm-items?project_id=${projectId}`)
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [projectId])

  useEffect(() => { loadItems() }, [loadItems])

  const syncFromPlan = useCallback(async () => {
    setSyncing(true)
    try {
      await fetch(`/api/pm-items/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })
      loadItems()
    } finally {
      setSyncing(false)
    }
  }, [projectId, loadItems])

  const tree = buildTree(items)
  const selectedItem = selectedId ? items.find(i => i.id === selectedId) ?? null : null

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }, [])

  const update = useCallback(async (id: string, updates: Partial<PmItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    await fetch(`/api/pm-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  }, [])

  const remove = useCallback(async (id: string) => {
    // Collect all descendant IDs to remove from local state
    const allIds = new Set<string>()
    const collect = (pid: string) => {
      allIds.add(pid)
      items.filter(i => i.parent_id === pid).forEach(c => collect(c.id))
    }
    collect(id)
    setItems(prev => prev.filter(i => !allIds.has(i.id)))
    setSelectedId(s => allIds.has(s ?? '') ? null : s)
    await fetch(`/api/pm-items/${id}`, { method: 'DELETE' })
  }, [items])

  const addItem = useCallback(async (parentId: string | null, level: Level, title: string) => {
    const siblings = items.filter(i => i.parent_id === parentId && i.level === level)
    const position = siblings.length ? Math.max(...siblings.map(s => s.position)) + 1000 : 1000
    const optimistic: PmItem = {
      id: `tmp-${Date.now()}`, project_id: projectId, parent_id: parentId,
      level, position, title, status: 'backlog', priority: 'medium',
      assigned_agents: [], acceptance_criteria: [], tags: [],
    }
    setItems(prev => [...prev, optimistic])
    if (parentId) {
      setExpanded(prev => new Set(Array.from(prev).concat(parentId)))
    }

    const res = await fetch('/api/pm-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, parent_id: parentId, level, title, position }),
    })
    if (res.ok) {
      const real = await res.json()
      setItems(prev => prev.map(i => i.id === optimistic.id ? real : i))
    } else {
      setItems(prev => prev.filter(i => i.id !== optimistic.id))
    }
  }, [items, projectId])

  const startEdit = useCallback((id: string, title: string) => {
    setEditingId(id); setEditTitle(title)
  }, [])

  const saveEdit = useCallback((id: string) => {
    if (editTitle.trim()) update(id, { title: editTitle.trim() })
    setEditingId(null)
  }, [editTitle, update])

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading plan…
    </div>
  )

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{tree.length} tracks</span>
          <span>·</span>
          <span>{items.filter(i => i.level === 'task').length} tasks</span>
          <span>·</span>
          <span className="text-emerald-400">{items.filter(i => i.status === 'done').length} done</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="text-xs h-7 gap-1"
            onClick={() => setExpanded(new Set(items.map(i => i.id)))}>
            Expand All
          </Button>
          <Button size="sm" variant="ghost" className="text-xs h-7 gap-1"
            onClick={() => setExpanded(new Set())}>
            Collapse
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5"
            onClick={syncFromPlan} disabled={syncing}
            title="Pull latest task statuses from the dev plan into the board">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync Plan'}
          </Button>
          <Button size="sm" className="text-xs h-7 gap-1.5"
            onClick={() => setAddingTrack(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Track
          </Button>
        </div>
      </div>

      {/* Tree */}
      <div className="border border-border/50 rounded-lg overflow-hidden bg-card/50">
        {tree.length === 0 && !addingTrack ? (
          <div className="py-16 text-center space-y-3">
            <Layers className="h-8 w-8 text-muted-foreground/20 mx-auto" />
            <p className="text-sm text-muted-foreground">No tracks yet.</p>
            <p className="text-xs text-muted-foreground/60">
              Add a track to start organizing work, or generate a dev plan to auto-populate.
            </p>
            <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs"
              onClick={() => setAddingTrack(true)}>
              <Plus className="h-3.5 w-3.5" /> Add First Track
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {/* Add track form at top */}
            {addingTrack && (
              <AddRow level="track"
                onAdd={t => { addItem(null, 'track', t); setAddingTrack(false) }}
                onCancel={() => setAddingTrack(false)} />
            )}

            {tree.map(node => (
              <TreeRow key={node.id} node={node} depth={0} expanded={expanded} agents={agents}
                selectedId={selectedId}
                onToggle={toggle}
                onSelect={item => setSelectedId(prev => prev === item.id ? null : item.id)}
                onUpdate={update}
                onDelete={remove}
                onAddChild={(parentId, level) => setAddingUnder({ parentId, level })}
                editingId={editingId}
                onStartEdit={startEdit}
                onSaveEdit={saveEdit}
                editTitle={editTitle}
                onEditTitleChange={setEditTitle}
                addingUnder={addingUnder}
                onAddUnder={(parentId, level) => { setAddingUnder({ parentId, level }); setExpanded(prev => new Set(Array.from(prev).concat(parentId))) }}
                onAddComplete={title => {
                  if (addingUnder) { addItem(addingUnder.parentId, addingUnder.level, title); setAddingUnder(null) }
                }}
                onAddCancel={() => setAddingUnder(null)}
              />
            ))}

            {/* Add track at bottom */}
            {tree.length > 0 && !addingTrack && (
              <button onClick={() => setAddingTrack(true)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary/20 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Track
              </button>
            )}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedItem && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSelectedId(null)} />
          <DetailPanel item={selectedItem} agents={agents}
            onClose={() => setSelectedId(null)}
            onUpdate={update}
            onDelete={remove}
          />
        </>
      )}
    </div>
  )
}
