import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DEFAULT_AGENTS = [
  {
    agent_key: 'AGENT_A',
    name: 'Agent A',
    domain: 'Backend / DB / Infrastructure',
    color: '#58A6FF',
    session_budget_k: 300,
  },
  {
    agent_key: 'AGENT_B',
    name: 'Agent B',
    domain: 'Frontend / UI / Testing',
    color: '#3FB950',
    session_budget_k: 300,
  },
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let { data: agents } = await supabase.from('agents').select('*').order('created_at')

  if (!agents || agents.length === 0) {
    const { data: seeded } = await supabase
      .from('agents')
      .insert(DEFAULT_AGENTS.map(a => ({ ...a, user_id: user.id })))
      .select()
    agents = seeded
  }

  return NextResponse.json(agents ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('agents')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
