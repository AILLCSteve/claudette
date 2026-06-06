import { getRequestUser, unauthorized } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getRequestUser(request)
  if (!user) return unauthorized()

  const body = await request.json()
  const { data, error } = await user.supabase.from('tasks').update({ ...body, updated_at: new Date().toISOString() }).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await getRequestUser(request)
  if (!user) return unauthorized()

  const { error } = await user.supabase.from('tasks').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
