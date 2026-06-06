import { getRequestUser, unauthorized } from '@/lib/auth/api-auth'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const user = await getRequestUser(request)
  if (!user) return unauthorized()

  const { data, error } = await user.supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const user = await getRequestUser(request)
  if (!user) return unauthorized()

  const body = await request.json()
  const { data, error } = await user.supabase
    .from('projects')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
