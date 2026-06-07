import { getRequestUser } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const { data, error } = await user.supabase
    .from('pm_items')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { project_id, parent_id, level, title, position, ...rest } = body

  if (!project_id || !title || !level) {
    return NextResponse.json({ error: 'project_id, title, level required' }, { status: 400 })
  }

  // Verify project ownership
  const { data: project } = await user.supabase
    .from('projects').select('id').eq('id', project_id).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Auto-position: place at end of siblings
  let pos = position
  if (pos == null) {
    const { data: siblings } = await user.supabase
      .from('pm_items')
      .select('position')
      .eq('project_id', project_id)
      .eq(parent_id ? 'parent_id' : 'level', parent_id ?? level)
      .order('position', { ascending: false })
      .limit(1)
    pos = siblings?.[0] ? siblings[0].position + 1000 : 1000
  }

  const { data, error } = await user.supabase
    .from('pm_items')
    .insert({
      project_id,
      parent_id: parent_id ?? null,
      level,
      title,
      position: pos,
      status: rest.status ?? 'not-started',
      priority: rest.priority ?? 'medium',
      assigned_agents: rest.assigned_agents ?? [],
      acceptance_criteria: rest.acceptance_criteria ?? [],
      description: rest.description ?? null,
      estimated_tokens_k: rest.estimated_tokens_k ?? null,
      session_window: rest.session_window ?? null,
      due_date: rest.due_date ?? null,
      notes: rest.notes ?? null,
      tags: rest.tags ?? [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
