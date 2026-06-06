import { getRequestUser, unauthorized } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getRequestUser(request)
  if (!user) return unauthorized()

  const { data, error } = await user.supabase
    .from('projects')
    .select('*, tasks(*), bugs(*), obstacles(*), session_logs(*), decisions(*), dev_plans(*)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getRequestUser(request)
  if (!user) return unauthorized()

  const body = await request.json()
  const { data, error } = await user.supabase
    .from('projects')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await getRequestUser(request)
  if (!user) return unauthorized()

  const { error } = await user.supabase.from('projects').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
