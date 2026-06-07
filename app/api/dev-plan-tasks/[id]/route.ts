import { getRequestUser } from '@/lib/auth/api-auth'
import { rollupAncestors } from '@/lib/pm/rollup'
import { NextResponse } from 'next/server'

const VALID_STATUSES = ['pending', 'in-progress', 'done', 'blocked', 'skipped']

// Map dev_plan_tasks status → pm_items status
const PM_STATUS_MAP: Record<string, string> = {
  'pending':     'not-started',
  'in-progress': 'in-progress',
  'done':        'done',
  'blocked':     'blocked',
  'skipped':     'done',
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Only allow updating safe fields
  const allowed: Record<string, unknown> = {}
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
    }
    allowed.status = body.status
  }
  if (body.notes !== undefined) allowed.notes = body.notes

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided (status, notes)' }, { status: 400 })
  }

  // Verify ownership: task → dev_plan → project → user
  const { data: task } = await user.supabase
    .from('dev_plan_tasks')
    .select('id, title, notes, dev_plan_id')
    .eq('id', params.id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const { data: plan } = await user.supabase
    .from('dev_plans')
    .select('project_id')
    .eq('id', task.dev_plan_id)
    .single()

  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  const { data: project } = await user.supabase
    .from('projects')
    .select('user_id')
    .eq('id', plan.project_id)
    .single()

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // When completing a task, stamp who completed it in notes
  const isCompleting = body.status === 'done' || body.status === 'skipped'
  if (isCompleting && user.email) {
    const completedLine = `Completed by: ${user.email}${user.tokenName ? ` (${user.tokenName})` : ''} at ${new Date().toISOString()}`
    const existingNotes: string = task.notes ?? ''
    // Replace any previous "Completed by" line or append
    const cleaned = existingNotes.replace(/^Completed by:.*$/m, '').trim()
    allowed.notes = cleaned ? `${cleaned}\n${completedLine}` : completedLine
  }

  const { data, error } = await user.supabase
    .from('dev_plan_tasks')
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Propagate status change to pm_items Board view (best-effort, non-fatal).
  // Match by project_id + title + level='task' since titles are unique within a plan.
  if (body.status !== undefined) {
    const pmStatus = PM_STATUS_MAP[body.status] ?? 'not-started'
    const { data: pmItems } = await user.supabase
      .from('pm_items')
      .select('id, assigned_agents')
      .eq('project_id', plan.project_id)
      .eq('level', 'task')
      .eq('title', task.title)
      .limit(5)

    if (pmItems && pmItems.length > 0) {
      for (const pmItem of pmItems) {
        const pmUpdate: Record<string, unknown> = {
          status: pmStatus,
          updated_at: new Date().toISOString(),
        }

        // On completion, assign the completing account so the board shows who did it
        if (isCompleting && user.email) {
          const existing: string[] = pmItem.assigned_agents ?? []
          if (!existing.includes(user.email)) {
            pmUpdate.assigned_agents = [...existing, user.email]
          }
        }

        await user.supabase
          .from('pm_items')
          .update(pmUpdate)
          .eq('id', pmItem.id)

        // Roll up parent statuses after each task update (fire-and-forget)
        rollupAncestors(user.supabase, pmItem.id, plan.project_id).catch(() => {})
      }
    }
  }

  return NextResponse.json(data)
}
