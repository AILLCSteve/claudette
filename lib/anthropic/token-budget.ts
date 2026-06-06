export interface TokenBudgetState {
  sessionBudgetK: number
  tokensUsedK: number
  tokensRemainingK: number
  warningThresholdK: number
  shutdownThresholdK: number
  isWarning: boolean
  isCritical: boolean
  percentUsed: number
}

export function computeTokenBudget(
  sessionBudgetK: number,
  tokensUsedK: number,
  warningThresholdK = 50,
  shutdownThresholdK = 20
): TokenBudgetState {
  const tokensRemainingK = Math.max(0, sessionBudgetK - tokensUsedK)
  const percentUsed = Math.min(100, (tokensUsedK / sessionBudgetK) * 100)

  return {
    sessionBudgetK,
    tokensUsedK,
    tokensRemainingK,
    warningThresholdK,
    shutdownThresholdK,
    isWarning: tokensRemainingK <= warningThresholdK,
    isCritical: tokensRemainingK <= shutdownThresholdK,
    percentUsed,
  }
}

export function buildGracefulShutdownPrompt(
  agentId: string,
  projectName: string,
  tokensRemainingK: number
): string {
  return `SYSTEM: TOKEN BUDGET CRITICAL — ${tokensRemainingK}K tokens remaining.

You must now execute graceful shutdown sequence. DO NOT start new work.

SHUTDOWN SEQUENCE:
1. Update task statuses in the PM platform (mark in-progress tasks as "blocked" with a note about session end)
2. Write a session log entry documenting: tasks completed this session, tasks partially done, any bugs or obstacles found
3. Write any architectural discoveries or debug findings to the project's debug history
4. Generate a session handoff note describing exactly where you stopped and what the next session should pick up
5. If token count drops below 10K before sequence completes, stop at current step and note it

Agent: ${agentId}
Project: ${projectName}
Remaining budget: ${tokensRemainingK}K tokens

BEGIN SHUTDOWN SEQUENCE NOW.`
}

export function buildSessionHandoffNote(
  agentId: string,
  projectName: string,
  tasksCompleted: string[],
  tasksInProgress: string[],
  notes: string
): string {
  return `# Session Handoff — ${agentId}

**Project:** ${projectName}
**Session ended:** token budget exhausted

## Completed This Session
${tasksCompleted.map(t => `- ✅ ${t}`).join('\n') || '- None'}

## In Progress (pick up here)
${tasksInProgress.map(t => `- 🔄 ${t}`).join('\n') || '- None'}

## Notes for Next Session
${notes}

## Next Session Bootstrap
Load this handoff into the next session's bootstrap prompt. All context is preserved in the PM platform.`
}
