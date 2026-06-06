import { createClient } from '@/lib/supabase/server'
import { generateBootstrapPrompt } from '@/lib/pm/bootstrap-generator'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId, sessionWindow = 1 } = await request.json()

  const [agentRes, queueRes] = await Promise.all([
    supabase.from('agents').select('*').eq('id', agentId).single(),
    supabase.from('session_queues').select('*').eq('agent_id', agentId).single(),
  ])

  if (!agentRes.data) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  if (!queueRes.data) return NextResponse.json({ error: 'No queue for agent' }, { status: 404 })

  const projectId = queueRes.data.project_id
  if (!projectId) return NextResponse.json({ error: 'No project assigned to queue' }, { status: 400 })

  const { data: project } = await supabase
    .from('projects')
    .select('*, tasks(*), bugs(*), obstacles(*)')
    .eq('id', projectId)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const prompt = generateBootstrapPrompt(agentRes.data, queueRes.data, project, sessionWindow)

  return NextResponse.json({ prompt })
}
