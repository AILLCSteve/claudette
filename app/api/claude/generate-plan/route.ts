import { getAnthropicClient } from '@/lib/anthropic/client'
import { sanitizeForPrompt } from '@/lib/anthropic/sanitize'
import { getRequestUser } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'

// ─── Anthropic API rules for claude-opus-4-7 (confirmed June 2026) ───────────
// See memory/anthropic_api_research.md for full findings.
//
// ✅ thinking: { type: 'adaptive' }         — correct for Opus 4.7
// ✅ output_config.effort: 'high'           — controls thinking depth
// ✅ output_config.format.type: 'json_schema' — grammar-constrained, JSON.parse() guaranteed
//
// ❌ thinking: { type: 'enabled', budget_tokens: N } — Claude 3.x / Haiku 4.5 only → 400
// ❌ assistant prefill { role:'assistant', content:'{' } — Opus 4.7 → 400
// ❌ minItems > 1 in json_schema arrays     — unsupported → 400
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_WINDOW_TOKENS_K = 150

// Grammar-constrained schema — the model CANNOT violate this structure.
// JSON.parse() on the response is therefore guaranteed to succeed.
//
// Type choices match the DB columns in dev_plan_tasks (migration 001 + 006):
//   estimated_tokens_k integer  → 'integer' (not 'number' — prevents 30.5-style floats)
//   session_window integer      → 'integer'
//   is_checkpoint boolean       → 'boolean'
//   priority text check(...)    → 'string' + enum
//   assigned_agent text         → 'string' + enum (constrain to defined agents)
//
// minItems is intentionally absent — Anthropic only allows 0 or 1.
// Minimum task count is enforced via the prompt instead.
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    overview: { type: 'string' },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title:                { type: 'string' },
          description:          { type: 'string' },
          feature_group:        { type: 'string' },
          acceptance_criteria:  { type: 'array', items: { type: 'string' } },
          depends_on_titles:    { type: 'array', items: { type: 'string' } },
          assigned_agent:       { type: 'string', enum: ['AGENT_A', 'AGENT_B'] },
          estimated_tokens_k:   { type: 'integer' },
          session_window:       { type: 'integer' },
          priority:             { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          is_checkpoint:        { type: 'boolean' },
          test_commands:        { type: 'array', items: { type: 'string' } },
          files_to_create:      { type: 'array', items: { type: 'string' } },
          files_to_modify:      { type: 'array', items: { type: 'string' } },
        },
        required: [
          'title', 'description', 'feature_group', 'acceptance_criteria', 'depends_on_titles',
          'assigned_agent', 'estimated_tokens_k', 'session_window',
          'priority', 'is_checkpoint', 'test_commands', 'files_to_create', 'files_to_modify',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'overview', 'tasks'],
  additionalProperties: false,
}

export async function POST(request: Request) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, scope, constraints, githubAnalysis } = await request.json()

  const { data: project } = await user.supabase
    .from('projects')
    .select('*, tasks(*), bugs(*), obstacles(*), decisions(*), session_logs(*)')
    .eq('id', projectId)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const existingTasks = (project.tasks ?? [])
    .map((t: any) => `- [${t.status}] ${sanitizeForPrompt(t.title)}`)
    .join('\n')

  const openBugs = (project.bugs ?? [])
    .filter((b: any) => b.status !== 'resolved')
    .map((b: any) => `- [${b.severity}] ${sanitizeForPrompt(b.title)}`)
    .join('\n')

  const sessionSummaries = (project.session_logs ?? [])
    .slice(0, 5)
    .map((s: any) => `- ${s.session_date}: ${sanitizeForPrompt(s.notes)}`)
    .join('\n')

  const systemPrompt = `You are Claudette, an expert software engineering PM AI.
Generate comprehensive, production-grade development plans with deep technical detail.
Your output must conform exactly to the JSON schema provided — be thorough and specific.`

  const userPrompt = `Generate a comprehensive development plan for this project.

## Project Context
NAME: ${sanitizeForPrompt(project.name)}
DESCRIPTION: ${sanitizeForPrompt(project.description)}
STACK: ${project.stack?.join(', ') ?? 'Unknown'}
SPRINT GOAL: ${sanitizeForPrompt(project.sprint_goal ?? '')}
HEALTH: ${project.health}
SCOPE: ${sanitizeForPrompt(scope || 'Full project development')}
CONSTRAINTS: ${sanitizeForPrompt(constraints || 'None')}
${githubAnalysis ? `\nGITHUB ANALYSIS (fetched from connected repo):\n${sanitizeForPrompt(githubAnalysis)}\n` : ''}
EXISTING TASKS:
${existingTasks || 'None yet'}

OPEN BUGS:
${openBugs || 'None'}

RECENT SESSIONS:
${sessionSummaries || 'No sessions yet'}

## Planning Requirements

Think through this plan across these dimensions before writing it:
1. Feature decomposition — break every feature into atomic, independently-testable units
2. Architecture decisions — data models, API contracts, component boundaries, state management
3. Testing strategy — unit, integration, edge case tests per feature (TDD: test first)
4. Risk analysis — hard parts, external dependencies, failure modes, defensive handling
5. Session window planning — group tasks into 5-hour windows (~${SESSION_WINDOW_TOKENS_K}K tokens each), add a CHECKPOINT task at the end of every window

## Field Guidance

- title: imperative verb phrase — "Implement X", "Write tests for Y", "Add Z"
- description: detailed — exact file paths, function signatures, data schemas, API contracts, edge cases. Minimum 4 sentences.
- acceptance_criteria: specific, testable conditions verifiable by running a test or checking output
- assigned_agent: "AGENT_A" for backend/DB/API/infra, "AGENT_B" for frontend/UI/components/styles
- estimated_tokens_k (integer): 10-20 simple, 25-50 medium, 50-80 complex. Checkpoints always 10.
- session_window (integer): 1-based grouping. Each window ~${SESSION_WINDOW_TOKENS_K}K total tokens. End every window with a CHECKPOINT task.
- feature_group: Short label grouping related tasks within a window (e.g., "Auth Layer", "Database Schema", "UI Components", "Testing Suite"). Tasks with the same feature_group appear under the same Feature node on the project board. Every task must have one.
- priority: "critical" blockers, "high" core features, "medium" enhancements, "low" polish
- is_checkpoint: true ONLY for checkpoint/review tasks, false for all feature/test tasks
- Generate at least 15 tasks total — be thorough, don't skip testing or edge-case handling
- Every feature needs a corresponding test task (TDD structure)`

  const anthropic = getAnthropicClient()

  let response: any
  try {
    response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 20000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: {
          type: 'json_schema',
          schema: PLAN_SCHEMA,
        },
      },
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    } as any)
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    console.error('[generate-plan] API error:', msg)
    return NextResponse.json({ error: 'AI API error', details: msg }, { status: 500 })
  }

  const stopReason: string = response.stop_reason
  console.log('[generate-plan] stop_reason:', stopReason)
  console.log('[generate-plan] output_tokens:', response.usage?.output_tokens)

  // Truncation means the JSON is incomplete — no point trying to parse it.
  if (stopReason === 'max_tokens') {
    console.error('[generate-plan] Response truncated — increase max_tokens')
    return NextResponse.json(
      { error: 'Plan generation was cut off. Please try again.' },
      { status: 500 }
    )
  }

  const textBlock = response.content?.find((b: any) => b.type === 'text')
  const rawText: string = textBlock?.text ?? ''

  console.log('[generate-plan] rawText length:', rawText.length)
  console.log('[generate-plan] rawText[0:300]:', rawText.slice(0, 300))

  let planData: any
  try {
    planData = JSON.parse(rawText)
  } catch (parseErr) {
    // With json_schema format this should never happen, but handle defensively.
    console.error('[generate-plan] JSON.parse failed (unexpected with json_schema):', parseErr)
    console.error('[generate-plan] Full rawText:', rawText.slice(0, 3000))
    return NextResponse.json(
      { error: 'Failed to parse plan JSON', raw: rawText.slice(0, 1000) },
      { status: 500 }
    )
  }

  if (!Array.isArray(planData?.tasks)) {
    console.error('[generate-plan] planData.tasks is not an array. Keys:', Object.keys(planData ?? {}))
    return NextResponse.json(
      { error: 'Plan JSON missing tasks array', keys: Object.keys(planData ?? {}) },
      { status: 500 }
    )
  }

  // ─── Sanity checks ────────────────────────────────────────────────────────────
  // 1. Zero tasks — hard fail (always wrong)
  if (planData.tasks.length === 0) {
    console.error('[generate-plan] SANITY FAIL: 0 tasks returned')
    return NextResponse.json(
      { error: 'Plan contains 0 tasks — the AI returned an empty task list. Try again with more project context in the Codebase Context field.' },
      { status: 500 }
    )
  }

  // 2. All tasks in same session window (no windowing applied)
  const taskWindowSet = new Set(planData.tasks.map((t: any) => t.session_window ?? 1))
  if (taskWindowSet.size === 1 && planData.tasks.length >= 8) {
    console.warn('[generate-plan] SANITY WARN: all', planData.tasks.length, 'tasks in window 1 — no session windowing applied')
  }

  // 3. No checkpoint tasks (every windowed plan must have at least one)
  if (planData.tasks.length >= 5 && !planData.tasks.some((t: any) => t.is_checkpoint === true)) {
    console.warn('[generate-plan] SANITY WARN: no checkpoint tasks found in', planData.tasks.length, 'tasks')
  }

  // 4. All tasks assigned to same agent (no AGENT_A / AGENT_B split)
  const taskAgentSet = new Set(planData.tasks.map((t: any) => t.assigned_agent))
  if (taskAgentSet.size === 1 && planData.tasks.length >= 5) {
    console.warn('[generate-plan] SANITY WARN: all tasks assigned to single agent:', Array.from(taskAgentSet)[0])
  }

  // 5. All tasks have the same priority (no differentiation)
  const taskPrioritySet = new Set(planData.tasks.map((t: any) => t.priority))
  if (taskPrioritySet.size === 1 && planData.tasks.length >= 5) {
    console.warn('[generate-plan] SANITY WARN: all tasks have same priority:', Array.from(taskPrioritySet)[0])
  }

  // 6. Duplicate task titles
  const titlesSeen = new Set<string>()
  const dupTitles: string[] = []
  for (const t of planData.tasks) {
    if (titlesSeen.has(t.title)) dupTitles.push(t.title)
    titlesSeen.add(t.title)
  }
  if (dupTitles.length > 0) {
    console.warn('[generate-plan] SANITY WARN: duplicate task titles:', dupTitles)
  }

  // 7. Thin tasks — short descriptions or missing acceptance criteria (>30% threshold)
  const thinTasks = planData.tasks.filter(
    (t: any) => !t.description || t.description.length < 30 || !t.acceptance_criteria?.length
  )
  if (thinTasks.length > planData.tasks.length * 0.3) {
    console.warn('[generate-plan] SANITY WARN:', thinTasks.length, 'of', planData.tasks.length, 'tasks have thin descriptions or no acceptance criteria')
  }
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('[generate-plan] Parsed successfully — tasks:', planData.tasks.length)

  // total_sessions_estimated: use reduce instead of spread to avoid stack issues on large arrays
  const totalSessions = planData.tasks.reduce(
    (max: number, t: any) => Math.max(max, t.session_window ?? 1),
    1
  )

  const { data: devPlan, error: planError } = await user.supabase
    .from('dev_plans')
    .insert({
      project_id: projectId,
      title: planData.title ?? 'Development Plan',
      overview: planData.overview ?? '',
      status: 'draft',
      total_sessions_estimated: totalSessions,
    })
    .select()
    .single()

  if (planError) {
    console.error('[generate-plan] dev_plans insert error:', planError)
    return NextResponse.json({ error: planError.message }, { status: 500 })
  }

  const titleToId = new Map<string, string>()
  const insertedTasks: any[] = []

  for (let i = 0; i < planData.tasks.length; i++) {
    const t = planData.tasks[i]
    const dependsOnIds = (t.depends_on_titles ?? [])
      .map((title: string) => titleToId.get(title))
      .filter(Boolean)

    const { data: task, error: taskError } = await user.supabase
      .from('dev_plan_tasks')
      .insert({
        dev_plan_id: devPlan.id,
        title: t.title,
        description: t.description,
        acceptance_criteria: t.acceptance_criteria ?? [],
        depends_on: dependsOnIds,
        assigned_agent: t.assigned_agent ?? 'AGENT_A',
        estimated_tokens_k: t.estimated_tokens_k ?? 20,
        session_window: t.session_window ?? 1,
        position: i + 1,
        status: 'pending',
        // migration 006 columns
        is_checkpoint: t.is_checkpoint ?? false,
        priority: t.priority ?? 'medium',
      })
      .select()
      .single()

    if (taskError) {
      console.error(`[generate-plan] dev_plan_tasks insert error (task ${i}):`, taskError)
    }
    if (task) {
      titleToId.set(t.title, task.id)
      insertedTasks.push(task)
    }
  }

  // Sanity: if 0 tasks inserted but AI returned tasks, migration 006 is likely missing
  if (insertedTasks.length === 0 && planData.tasks.length > 0) {
    console.error('[generate-plan] SANITY FAIL: 0 of', planData.tasks.length, 'tasks inserted — migration 006 likely not applied')
    return NextResponse.json(
      {
        error: `Plan generated (${planData.tasks.length} tasks) but none saved to database.\n\nRun migration 006 in Supabase SQL Editor:\n\nALTER TABLE dev_plan_tasks\n  ADD COLUMN IF NOT EXISTS is_checkpoint boolean NOT NULL DEFAULT false,\n  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'\n    CHECK (priority IN ('critical','high','medium','low'));`,
        taskCount: planData.tasks.length,
        insertedCount: 0,
      },
      { status: 500 }
    )
  }

  // Update project health
  await user.supabase
    .from('projects')
    .update({ health: 'on-track', updated_at: new Date().toISOString() })
    .eq('id', projectId)

  // Auto-populate pm_items: Track → Feature → Task → Subtask (4-level hierarchy).
  // Best-effort — migration 005 must be run; failure here doesn't affect the plan save.
  try {
    const windowNums = Array.from(
      new Set(planData.tasks.map((t: any) => t.session_window ?? 1))
    ).sort((a: any, b: any) => a - b) as number[]

    for (const win of windowNums) {
      const winTasks = planData.tasks.filter((t: any) => (t.session_window ?? 1) === win)
      const trackPos = win * 10000

      // Level 1: Track (one per session window)
      const { data: track, error: trackError } = await user.supabase
        .from('pm_items')
        .insert({
          project_id: projectId,
          parent_id: null,
          level: 'track',
          title: `Session Window ${win}`,
          description: `Auto-generated from dev plan: ${devPlan.title}`,
          status: 'backlog',
          priority: 'medium',
          position: trackPos,
          assigned_agents: [],
        })
        .select()
        .single()

      if (trackError) {
        console.error(`[generate-plan] pm_items track insert error (window ${win}):`, trackError)
        continue
      }
      if (!track) continue

      // Group tasks by feature_group (preserve insertion order of first occurrence)
      const featureOrder: string[] = []
      const featureGroups = new Map<string, any[]>()
      for (const t of winTasks) {
        const fg: string = (t.feature_group as string | undefined) || 'General'
        if (!featureGroups.has(fg)) { featureGroups.set(fg, []); featureOrder.push(fg) }
        featureGroups.get(fg)!.push(t)
      }

      let fIdx = 0
      for (const groupName of featureOrder) {
        fIdx++
        const groupTasks: any[] = featureGroups.get(groupName)!
        const featurePos = trackPos + fIdx * 1000

        // Level 2: Feature (one per feature_group)
        const topPriority = groupTasks.some((t: any) => t.priority === 'critical') ? 'critical'
          : groupTasks.some((t: any) => t.priority === 'high') ? 'high' : 'medium'
        const featureAgents = Array.from(new Set(groupTasks.map((t: any) => t.assigned_agent).filter(Boolean)))

        const { data: feature, error: featureError } = await user.supabase
          .from('pm_items')
          .insert({
            project_id: projectId,
            parent_id: track.id,
            level: 'feature',
            title: groupName,
            description: null,
            status: 'backlog',
            priority: topPriority,
            position: featurePos,
            assigned_agents: featureAgents,
            acceptance_criteria: [],
            tags: [],
          })
          .select()
          .single()

        if (featureError) {
          console.error(`[generate-plan] pm_items feature insert error (win ${win}, group "${groupName}"):`, featureError)
          continue
        }
        if (!feature) continue

        for (let ti = 0; ti < groupTasks.length; ti++) {
          const t = groupTasks[ti]
          const taskPos = featurePos + (ti + 1) * 100

          // Level 3: Task (one per plan task)
          const { data: taskItem, error: taskError } = await user.supabase
            .from('pm_items')
            .insert({
              project_id: projectId,
              parent_id: feature.id,
              level: 'task',
              title: t.title,
              description: t.description ?? null,
              status: 'backlog',
              priority: t.priority ?? 'medium',
              position: taskPos,
              assigned_agents: t.assigned_agent ? [t.assigned_agent] : [],
              acceptance_criteria: t.acceptance_criteria ?? [],
              estimated_tokens_k: t.estimated_tokens_k ?? null,
              session_window: t.session_window ?? win,
              tags: t.is_checkpoint ? ['checkpoint'] : [],
            })
            .select()
            .single()

          if (taskError) {
            console.error(`[generate-plan] pm_items task insert error (win ${win}, task ${ti}):`, taskError)
            continue
          }
          if (!taskItem) continue

          // Level 4: Subtasks from acceptance_criteria (max 6 per task)
          const criteria: string[] = t.acceptance_criteria ?? []
          for (let ci = 0; ci < Math.min(criteria.length, 6); ci++) {
            const { error: subError } = await user.supabase.from('pm_items').insert({
              project_id: projectId,
              parent_id: taskItem.id,
              level: 'subtask',
              title: criteria[ci],
              description: null,
              status: 'backlog',
              priority: 'medium',
              position: taskPos + (ci + 1),
              assigned_agents: t.assigned_agent ? [t.assigned_agent] : [],
              acceptance_criteria: [],
              tags: [],
            })
            if (subError) {
              console.error(`[generate-plan] pm_items subtask insert error (task ${taskItem.id}, criteria ${ci}):`, subError)
            }
          }
        }
      }
    }
  } catch (pmErr) {
    console.error('[generate-plan] pm_items population failed (non-fatal):', pmErr)
  }

  return NextResponse.json({ devPlan, tasks: insertedTasks, totalWindows: devPlan.total_sessions_estimated })
}
