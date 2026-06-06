'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface HeaderProps {
  title?: string
  description?: string
}

export function Header({ title, description }: HeaderProps) {
  const router = useRouter()

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {title && (
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        )}
        {description && (
          <span className="text-xs text-muted-foreground hidden sm:block">{description}</span>
        )}
      </div>
      <button
        onClick={signOut}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Sign out
      </button>
    </header>
  )
}
