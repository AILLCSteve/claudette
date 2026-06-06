export const dynamic = 'force-dynamic'

import { Header } from '@/components/layout/header'
import { ChatPanel } from '@/components/ai/chat-panel'

export default function AIPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="AI Intelligence" />
      <div className="flex-1 overflow-hidden">
        <ChatPanel />
      </div>
    </div>
  )
}
