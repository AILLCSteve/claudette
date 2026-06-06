import { getAnthropicClient } from '@/lib/anthropic/client'
import { buildCompressedContext } from '@/lib/anthropic/prompt-builder'
import { sanitizeForPrompt } from '@/lib/anthropic/sanitize'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, history = [] } = await request.json()

  const [projectsRes, tasksRes, bugsRes, obstaclesRes, sessionsRes, agentsRes, queuesRes] =
    await Promise.all([
      supabase.from('projects').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('bugs').select('*'),
      supabase.from('obstacles').select('*'),
      supabase.from('session_logs').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('agents').select('*'),
      supabase.from('session_queues').select('*'),
    ])

  const portfolioContext = buildCompressedContext({
    projects: projectsRes.data ?? [],
    tasks: tasksRes.data ?? [],
    bugs: bugsRes.data ?? [],
    obstacles: obstaclesRes.data ?? [],
    recentSessions: sessionsRes.data ?? [],
    agents: agentsRes.data ?? [],
    queues: queuesRes.data ?? [],
  })

  const systemPrompt = `You are an expert software engineering project manager integrated into the Claude PM platform. You have full visibility into the user's portfolio and help them make informed decisions about their AI-agent-driven development workflows.

${portfolioContext}

You can help with: sprint planning, task prioritization, identifying blockers, agent session planning, token budget analysis, risk assessment, and generating detailed development plans.

When asked to generate plans, be specific: name actual files, functions, timelines, and token estimates. When identifying risks, be direct about what could go wrong and why.`

  const anthropic = getAnthropicClient()

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      }
    ],
    messages: [
      ...history,
      { role: 'user', content: sanitizeForPrompt(message) }
    ],
  })

  const assistantMessage = response.content[0].type === 'text' ? response.content[0].text : ''

  return NextResponse.json({
    message: assistantMessage,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationTokens: (response.usage as any).cache_creation_input_tokens ?? 0,
      cacheReadTokens: (response.usage as any).cache_read_input_tokens ?? 0,
    },
  })
}
