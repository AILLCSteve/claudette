import { createClient } from '@/lib/supabase/server'
import { computeTokenBudget } from '@/lib/anthropic/token-budget'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agent_id')

  if (!agentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

  const { data: agent } = await supabase
    .from('agents')
    .select('session_budget_k')
    .eq('id', agentId)
    .single()

  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const today = new Date().toISOString().split('T')[0]
  const { data: sessions } = await supabase
    .from('session_logs')
    .select('tokens_used_k')
    .eq('agent_id', agentId)
    .eq('session_date', today)

  const tokensUsedK = sessions?.reduce((sum, s) => sum + (s.tokens_used_k ?? 0), 0) ?? 0

  const status = computeTokenBudget(agent.session_budget_k, tokensUsedK)

  return NextResponse.json(status)
}
