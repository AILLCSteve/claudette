'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_PROMPTS = [
  'Portfolio health summary',
  'What needs my decision?',
  'Most blocked project?',
  'Sprint priorities next 3 days',
  'Agent token budget status',
  'What did agents accomplish?',
  'Tasks at risk of missing sprint',
  'Shutdown checklist for AGENT_A',
]

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenUsage, setTokenUsage] = useState<{ inputTokens: number; outputTokens: number; cacheReadTokens: number } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/claude/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages([...newHistory, { role: 'assistant', content: data.message }])
      setTokenUsage(data.usage)
    } catch (err) {
      setMessages([...newHistory, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Quick prompts */}
      <div className="border-b border-border/60 px-4 py-2.5 flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map(prompt => (
          <button
            key={prompt}
            onClick={() => send(prompt)}
            disabled={loading}
            className="text-xs px-2.5 py-1 rounded-full border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-40"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center pb-12">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Ask me about your portfolio</p>
              <p className="text-xs text-muted-foreground mt-1">
                I have full visibility into projects, tasks, agents, and budgets
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mr-2 mt-0.5 ring-1 ring-primary/20">
                <Sparkles className="h-3 w-3 text-primary" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[78%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-card border border-border/60 text-foreground rounded-bl-sm'
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mr-2 ring-1 ring-primary/20">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
            <div className="bg-card border border-border/60 rounded-xl rounded-bl-sm px-3.5 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Token usage */}
      {tokenUsage && (
        <div className="border-t border-border/60 px-4 py-1.5 flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
          <span>in {tokenUsage.inputTokens.toLocaleString()}</span>
          <span className="text-border">·</span>
          <span>out {tokenUsage.outputTokens.toLocaleString()}</span>
          {tokenUsage.cacheReadTokens > 0 && (
            <>
              <span className="text-border">·</span>
              <span className="text-emerald-400">cache {tokenUsage.cacheReadTokens.toLocaleString()}</span>
            </>
          )}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/60 p-3 flex gap-2">
        <Textarea
          placeholder="Ask about your portfolio..."
          className="resize-none text-sm min-h-0 h-10 bg-secondary/50 border-border/60 focus:border-primary/50 transition-colors"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
          rows={1}
        />
        <Button
          size="sm"
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="h-10 w-10 p-0 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
