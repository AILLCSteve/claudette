import { getRequestUser } from '@/lib/auth/api-auth'
import { rollupAll } from '@/lib/pm/rollup'
import { NextResponse } from 'next/server'

// Map dev_plan_tasks status → pm_items status
const PM_STATUS_MAP: Record<string, string> = {
  'pending':     'not-started',
  'in-progress': 'in-progress',
  'done':        'done',
  'blocked':     'blocked',
  'skipped':     'done',
}

export async function POST(request: Request) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { project_id } = await request.json()
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  // Verify project ownership
  const { data: project } = await user.supabase
    .from('projects')
    .select('user_id')
    .eq('id', project_id)
    .single()

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Fetch all dev_plan_tasks for this project (via dev_plans join)
  const { data: plans } = await user.supabase
    .from('dev_plans')
    .select('id')
    .eq('project_id', project_id)

  if (!plans || plans.length === 0) {
    return NextResponse.json({ synced: 0, message: 'No dev plans found for this project' })
  }

  const planIds = plans.map((p: any) => p.id)

  const { data: devTasks } = await user.supabase
    .from('dev_plan_tasks')
    .select('id, title, status')
    .in('dev_plan_id', planIds)

  if (!devTasks || devTasks.length === 0) {
    return NextResponse.json({ synced: 0, message: 'No plan tasks found' })
  }

  // Fetch all pm_items tasks for this project
  const { data: pmTasks } = await user.supabase
    .from('pm_items')
    .select('id, title, status')
    .eq('project_id', project_id)
    .eq('level', 'task')

  if (!pmTasks || pmTasks.length === 0) {
    return NextResponse.json({ synced: 0, message: 'No board items found to sync' })
  }

  // Build a lookup: normalized title → pm_item id
  const pmByTitle = new Map<string, string>()
  for (const pm of pmTasks) {
    pmByTitle.set(pm.title.trim().toLowerCase(), pm.id)
  }

  let synced = 0
  for (const devTask of devTasks) {
    const pmStatus = PM_STATUS_MAP[devTask.status]
    if (!pmStatus) continue

    const pmId = pmByTitle.get(devTask.title.trim().toLowerCase())
    if (!pmId) continue

    const { error } = await user.supabase
      .from('pm_items')
      .update({ status: pmStatus, updated_at: new Date().toISOString() })
      .eq('id', pmId)

    if (!error) synced++
  }

  // Roll up all parent statuses bottom-up now that leaf statuses are correct.
  // This ensures windows/features reflect the state of their tasks.
  await rollupAll(user.supabase, project_id)

  return NextResponse.json({ synced, total: devTasks.length })
}
