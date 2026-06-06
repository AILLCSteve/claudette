import { createClient } from '@/lib/supabase/server'
import { partitionIntoSessions, generateSessionBriefing } from '@/lib/anthropic/session-partitioner'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { devPlanId, agentId } = await request.json()

  const { data: tasks, error } = await supabase
    .from('dev_plan_tasks')
    .select('*')
    .eq('dev_plan_id', devPlanId)
    .neq('status', 'done')
    .order('position', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sessions = partitionIntoSessions(tasks ?? [])

  for (const session of sessions) {
    const taskIds = session.tasks.map(t => t.id)
    await supabase
      .from('dev_plan_tasks')
      .update({ session_window: session.windowNumber })
      .in('id', taskIds)
  }

  await supabase
    .from('dev_plans')
    .update({ total_sessions_estimated: sessions.length })
    .eq('id', devPlanId)

  const briefings = sessions.map(s => ({
    ...s,
    briefing: generateSessionBriefing(s, agentId),
  }))

  return NextResponse.json({ sessions: briefings })
}
