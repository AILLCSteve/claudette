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

// Nested hierarchy schema: tracks → features → tasks (with subtasks).
// The AI decides the full tree shape — how many features per track, tasks per
// feature, and subtasks per task — based on actual work complexity.
//
// Subtasks are explicit strings (the AI writes them, not derived from acceptance_criteria).
// acceptance_criteria remain on tasks for quality gates.
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    title:    { type: 'string' },
    overview: { type: 'string' },
    tracks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title:          { type: 'string' },   // e.g. "Window 1 — Foundation"
          session_window: { type: 'integer' },
          features: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title:       { type: 'string' },
                description: { type: 'string' },
                priority:    { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                tasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title:               { type: 'string' },
                      description:         { type: 'string' },
                      subtasks:            { type: 'array', items: { type: 'string' } },
                      acceptance_criteria: { type: 'array', items: { type: 'string' } },
                      depends_on_titles:   { type: 'array', items: { type: 'string' } },
                      assigned_agent:      { type: 'string', enum: ['AGENT_A', 'AGENT_B'] },
                      estimated_tokens_k:  { type: 'integer' },
                      priority:            { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                      is_checkpoint:       { type: 'boolean' },
                      test_commands:       { type: 'array', items: { type: 'string' } },
                      files_to_create:     { type: 'array', items: { type: 'string' } },
                      files_to_modify:     { type: 'array', items: { type: 'string' } },
                    },
                    required: [
                      'title', 'description', 'subtasks', 'acceptance_criteria',
                      'depends_on_titles', 'assigned_agent', 'estimated_tokens_k',
                      'priority', 'is_checkpoint', 'test_commands',
                      'files_to_create', 'files_to_modify',
                    ],
                    additionalProperties: false,
                  },
                },
              },
              required: ['title', 'description', 'priority', 'tasks'],
              additionalProperties: false,
            },
          },
        },
        required: ['title', 'session_window', 'features'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'overview', 'tracks'],
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

## Output Structure

Your plan is organized as a hierarchy: tracks → features → tasks → subtasks.
You decide the shape based on what makes sense for the actual work.

TRACKS group work into execution windows (~${SESSION_WINDOW_TOKENS_K}K tokens each). Think of each track as a sprint or session block. Some tracks are simple (1–2 features), others complex (4–6 features). Let the work dictate the size.

FEATURES are meaningful logical areas within a track — "Auth Layer", "Database Schema", "Frontend Components", "Test Suite". A track will naturally have multiple features when the work spans different concerns. Name features after what they build, not just categories.

TASKS are concrete implementation steps within a feature. A simple feature may have 2 tasks; a complex one may have 6+. Every feature needs at least one implementation task and one test task (TDD: test first). Add a CHECKPOINT task as the final task of every track's last feature.

SUBTASKS are the granular steps an agent follows to complete a task. Be specific: exact file paths, function names, commands to run. Aim for 3–6 subtasks per task. Subtasks are how agents self-verify progress — make them actionable and checkable.

## Planning Dimensions

Think through this plan on all these axes before writing it:
1. Feature decomposition — break every feature into atomic, independently-testable units
2. Architecture decisions — data models, API contracts, component boundaries, state management
3. Testing strategy — unit, integration, edge case tests per feature (TDD: test first)
4. Risk analysis — hard parts, external dependencies, failure modes, defensive handling
5. Execution ordering — dependency chains across features and tracks; mark blockers explicitly in depends_on_titles

## Field Guidance

**Track:**
- title: descriptive name that tells agents what this window accomplishes, e.g. "Window 1 — Schema & Auth Foundation"
- session_window: 1-based integer; each window ~${SESSION_WINDOW_TOKENS_K}K tokens total

**Feature:**
- title: what is built, not a category label — "Guardian Auth Middleware" not "Authentication"
- description: what this feature covers, why it's needed, its boundaries with adjacent features
- priority: "critical" for blockers, "high" for core, "medium" for supporting, "low" for polish

**Task:**
- title: imperative verb phrase — "Implement X", "Write tests for Y", "Add Z middleware"
- description: detailed — exact file paths, function signatures, data schemas, API contracts, edge cases. Minimum 4 sentences.
- subtasks: step-by-step agent execution list; 3–6 items; each is a single checkable action
- acceptance_criteria: specific, testable conditions verifiable by running a test or checking output
- assigned_agent: "AGENT_A" for backend/DB/API/infra/testing; "AGENT_B" for frontend/UI/components/styles
- estimated_tokens_k (integer): 10–20 simple, 25–50 medium, 50–80 complex; checkpoints always 10
- is_checkpoint: true ONLY for checkpoint/review tasks that close a window; false for all implementation tasks
- Generate at least 15 tasks total across all features — be thorough, don't skip testing or edge-case handling`

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
    console.error('[generate-plan] JSON.parse failed (unexpected with json_schema):', parseErr)
    console.error('[generate-plan] Full rawText:', rawText.slice(0, 3000))
    return NextResponse.json(
      { error: 'Failed to parse plan JSON', raw: rawText.slice(0, 1000) },
      { status: 500 }
    )
  }

  if (!Array.isArray(planData?.tracks)) {
    console.error('[generate-plan] planData.tracks is not an array. Keys:', Object.keys(planData ?? {}))
    return NextResponse.json(
      { error: 'Plan JSON missing tracks array', keys: Object.keys(planData ?? {}) },
      { status: 500 }
    )
  }

  // Flatten all tasks across the tree for validation and dev_plan_tasks insertion
  const allFlatTasks: Array<{ task: any; win: number; featureTitle: string }> = []
  for (const track of planData.tracks) {
    for (const feature of track.features ?? []) {
      for (const task of feature.tasks ?? []) {
        allFlatTasks.push({ task, win: track.session_window ?? 1, featureTitle: feature.title })
      }
    }
  }

  // ─── Sanity checks ────────────────────────────────────────────────────────────
  if (allFlatTasks.length === 0) {
    console.error('[generate-plan] SANITY FAIL: 0 tasks returned')
    return NextResponse.json(
      { error: 'Plan contains 0 tasks — the AI returned an empty task list. Try again with more project context.' },
      { status: 500 }
    )
  }

  const windowSet = new Set(planData.tracks.map((t: any) => t.session_window ?? 1))
  if (windowSet.size === 1 && allFlatTasks.length >= 8) {
    console.warn('[generate-plan] SANITY WARN: all', allFlatTasks.length, 'tasks in window 1 — no session windowing applied')
  }

  if (allFlatTasks.length >= 5 && !allFlatTasks.some(({ task }) => task.is_checkpoint === true)) {
    console.warn('[generate-plan] SANITY WARN: no checkpoint tasks found in', allFlatTasks.length, 'tasks')
  }

  const titlesSeen = new Set<string>()
  const dupTitles: string[] = []
  for (const { task } of allFlatTasks) {
    if (titlesSeen.has(task.title)) dupTitles.push(task.title)
    titlesSeen.add(task.title)
  }
  if (dupTitles.length > 0) {
    console.warn('[generate-plan] SANITY WARN: duplicate task titles:', dupTitles)
  }

  const thinTasks = allFlatTasks.filter(
    ({ task }) => !task.description || task.description.length < 30 || !task.acceptance_criteria?.length
  )
  if (thinTasks.length > allFlatTasks.length * 0.3) {
    console.warn('[generate-plan] SANITY WARN:', thinTasks.length, 'of', allFlatTasks.length, 'tasks have thin descriptions')
  }
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('[generate-plan] Parsed successfully — tracks:', planData.tracks.length, 'tasks:', allFlatTasks.length)

  const totalSessions = planData.tracks.reduce(
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

  // Insert flat tasks into dev_plan_tasks (for agent execution)
  const titleToId = new Map<string, string>()
  const insertedTasks: any[] = []

  for (let i = 0; i < allFlatTasks.length; i++) {
    const { task: t, win } = allFlatTasks[i]
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
        session_window: win,
        position: i + 1,
        status: 'pending',
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

  if (insertedTasks.length === 0 && allFlatTasks.length > 0) {
    console.error('[generate-plan] SANITY FAIL: 0 of', allFlatTasks.length, 'tasks inserted — migration 006 likely not applied')
    return NextResponse.json(
      {
        error: `Plan generated (${allFlatTasks.length} tasks) but none saved to database.\n\nRun migration 006 in Supabase SQL Editor:\n\nALTER TABLE dev_plan_tasks\n  ADD COLUMN IF NOT EXISTS is_checkpoint boolean NOT NULL DEFAULT false,\n  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'\n    CHECK (priority IN ('critical','high','medium','low'));`,
        taskCount: allFlatTasks.length,
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

  // Auto-populate pm_items from the AI-designed nested hierarchy.
  // The tree shape is exactly what the AI produced — no mechanical remapping.
  // Best-effort: failure here doesn't affect the plan save.
  try {
    for (const track of planData.tracks) {
      const win: number = track.session_window ?? 1
      const trackPos = win * 10000

      const { data: trackItem, error: trackError } = await user.supabase
        .from('pm_items')
        .insert({
          project_id: projectId,
          parent_id: null,
          level: 'track',
          title: track.title,
          description: `Session window ${win} — ${devPlan.title}`,
          status: 'not-started',
          priority: 'medium',
          position: trackPos,
          assigned_agents: [],
        })
        .select()
        .single()

      if (trackError || !trackItem) {
        console.error(`[generate-plan] pm_items track insert error (window ${win}):`, trackError)
        continue
      }

      const features: any[] = track.features ?? []
      for (let fi = 0; fi < features.length; fi++) {
        const feature = features[fi]
        const featurePos = trackPos + (fi + 1) * 1000

        const featureTasks: any[] = feature.tasks ?? []
        const topPriority = featureTasks.some((t: any) => t.priority === 'critical') ? 'critical'
          : featureTasks.some((t: any) => t.priority === 'high') ? 'high' : (feature.priority ?? 'medium')
        const featureAgents = Array.from(
          new Set(featureTasks.map((t: any) => t.assigned_agent).filter(Boolean))
        )

        const { data: featureItem, error: featureError } = await user.supabase
          .from('pm_items')
          .insert({
            project_id: projectId,
            parent_id: trackItem.id,
            level: 'feature',
            title: feature.title,
            description: feature.description ?? null,
            status: 'not-started',
            priority: topPriority,
            position: featurePos,
            assigned_agents: featureAgents,
            acceptance_criteria: [],
            tags: [],
          })
          .select()
          .single()

        if (featureError || !featureItem) {
          console.error(`[generate-plan] pm_items feature insert error (win ${win}, feature "${feature.title}"):`, featureError)
          continue
        }

        for (let ti = 0; ti < featureTasks.length; ti++) {
          const t = featureTasks[ti]
          const taskPos = featurePos + (ti + 1) * 100

          const { data: taskItem, error: taskError } = await user.supabase
            .from('pm_items')
            .insert({
              project_id: projectId,
              parent_id: featureItem.id,
              level: 'task',
              title: t.title,
              description: t.description ?? null,
              status: 'not-started',
              priority: t.priority ?? 'medium',
              position: taskPos,
              assigned_agents: t.assigned_agent ? [t.assigned_agent] : [],
              acceptance_criteria: t.acceptance_criteria ?? [],
              estimated_tokens_k: t.estimated_tokens_k ?? null,
              session_window: win,
              tags: t.is_checkpoint ? ['checkpoint'] : [],
            })
            .select()
            .single()

          if (taskError || !taskItem) {
            console.error(`[generate-plan] pm_items task insert error (win ${win}, task ${ti}):`, taskError)
            continue
          }

          // Insert subtasks as written by the AI (not derived from acceptance_criteria)
          const subtasks: string[] = t.subtasks ?? []
          for (let si = 0; si < subtasks.length; si++) {
            const { error: subError } = await user.supabase.from('pm_items').insert({
              project_id: projectId,
              parent_id: taskItem.id,
              level: 'subtask',
              title: subtasks[si],
              description: null,
              status: 'not-started',
              priority: 'medium',
              position: taskPos + si + 1,
              assigned_agents: t.assigned_agent ? [t.assigned_agent] : [],
              acceptance_criteria: [],
              tags: [],
            })
            if (subError) {
              console.error(`[generate-plan] pm_items subtask insert error (task ${taskItem.id}, subtask ${si}):`, subError)
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
