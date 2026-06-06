import { getRequestUser, unauthorized } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const user = await getRequestUser(request)
  if (!user) return unauthorized()

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')

  let query = user.supabase.from('session_logs').select('*').order('created_at', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const user = await getRequestUser(request)
  if (!user) return unauthorized()

  const body = await request.json()
  const { data, error } = await user.supabase.from('session_logs').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-update project health/updated_at when session is logged
  if (body.project_id) {
    await user.supabase
      .from('projects')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', body.project_id)
  }

  return NextResponse.json(data, { status: 201 })
}
