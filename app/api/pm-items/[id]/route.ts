import { getRequestUser } from '@/lib/auth/api-auth'
import { rollupAncestors } from '@/lib/pm/rollup'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const updates = await request.json()
  delete updates.id
  delete updates.project_id
  delete updates.created_at

  const { data, error } = await user.supabase
    .from('pm_items')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Roll up parent statuses whenever status or assigned_agents change
  if (updates.status !== undefined || updates.assigned_agents !== undefined) {
    rollupAncestors(user.supabase, params.id, data.project_id).catch(() => {})
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getRequestUser(_request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch project_id before deleting so we can roll up after
  const { data: item } = await user.supabase
    .from('pm_items')
    .select('project_id, parent_id')
    .eq('id', params.id)
    .single()

  const { error } = await user.supabase
    .from('pm_items')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Re-evaluate the parent after a child is removed
  if (item?.parent_id && item.project_id) {
    rollupAncestors(user.supabase, params.id, item.project_id).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
