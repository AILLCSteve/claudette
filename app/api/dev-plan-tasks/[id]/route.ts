import { getRequestUser } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'

const VALID_STATUSES = ['pending', 'in-progress', 'done', 'blocked', 'skipped']

// Map dev_plan_tasks status → pm_items status
const PM_STATUS_MAP: Record<string, string> = {
  'pending':     'backlog',
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
    .select('id, title, dev_plan_id')
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
    const pmStatus = PM_STATUS_MAP[body.status] ?? 'backlog'
    const { data: pmItems } = await user.supabase
      .from('pm_items')
      .select('id')
      .eq('project_id', plan.project_id)
      .eq('level', 'task')
      .eq('title', task.title)
      .limit(5)

    if (pmItems && pmItems.length > 0) {
      for (const pmItem of pmItems) {
        await user.supabase
          .from('pm_items')
          .update({ status: pmStatus, updated_at: new Date().toISOString() })
          .eq('id', pmItem.id)
      }
    }
  }

  return NextResponse.json(data)
}
