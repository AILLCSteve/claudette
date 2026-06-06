import { getRequestUser, unauthorized } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const user = await getRequestUser(request)
  if (!user) return unauthorized()

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  const needsHuman = searchParams.get('needs_human')
  const status = searchParams.get('status')

  let query = user.supabase.from('obstacles').select('*').order('created_at', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)
  if (needsHuman === 'true') query = query.eq('needs_human', true)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const user = await getRequestUser(request)
  if (!user) return unauthorized()

  const body = await request.json()
  const { data, error } = await user.supabase.from('obstacles').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
