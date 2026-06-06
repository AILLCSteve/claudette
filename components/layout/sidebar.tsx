'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Inbox,
  Bot,
  ListTodo,
  Brain,
  Sparkles,
  Settings,
} from 'lucide-react'

const navItems = [
  { href: '/',         icon: LayoutDashboard, label: 'Portfolio' },
  { href: '/inbox',    icon: Inbox,           label: 'Inbox' },
  { href: '/agents',   icon: Bot,             label: 'Agents' },
  { href: '/queue',    icon: ListTodo,        label: 'Queue' },
  { href: '/ai',       icon: Brain,           label: 'AI' },
  { href: '/settings', icon: Settings,        label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-52 shrink-0 flex flex-col h-screen bg-sidebar border-r border-border/60">
      {/* Logo */}
      <div className="h-12 flex items-center px-4 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center ring-1 ring-primary/30">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground">Claudette</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-px overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/'
            ? pathname === '/'
            : pathname === href || pathname.startsWith(href + '/')

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group relative flex items-center gap-2.5 px-3 py-[7px] rounded-md text-sm transition-all duration-150',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
              )}
            >
              {isActive && (
                <span className="absolute left-0 inset-y-0 w-[2px] rounded-full bg-primary my-1.5" />
              )}
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border/60">
        <p className="text-[11px] font-mono text-muted-foreground/40 tracking-wide">v0.1.0</p>
      </div>
    </aside>
  )
}
