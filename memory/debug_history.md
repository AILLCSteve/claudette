# Claudette PM — Debug History

---

## [2026-06-06] Port conflict — dev server starts on wrong port, no styling

**Root cause:** `kill-port` was called via Bash with PowerShell syntax (`$null`), which silently failed on the Bash shell. The old node process on port 3000 kept running, so `npm run dev` bumped to 3001. The browser opened on 3000 (old/dead server) showing raw HTML with no assets.

**Confirmed pattern — has recurred multiple times:**
- `npx kill-port 3000 3001 3002 3003 2>$null` — the `2>$null` is PowerShell syntax, fails silently in Bash
- Server logs "Port 3000 is in use, trying 3001" but background task output isn't checked before opening browser
- Result: browser opens dead server, user sees no styling

**Fix that works:**
1. Use PowerShell tool (not Bash) to find and kill node PIDs on ports 3000-3003:
   ```powershell
   Get-NetTCPConnection -LocalPort 3000,3001,3002,3003 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
   ```
2. Start server in background, then read the output file to confirm which port it bound to BEFORE opening the browser
3. Open the confirmed port, not assumed port 3000

**Rule going forward:**
- ALWAYS read background task output after starting dev server to confirm actual port
- NEVER assume port 3000 — check first
- Use PowerShell tool for port operations on Windows, not Bash

---

## [2026-06-06] `$null` redirect syntax — Bash vs PowerShell

**Root cause:** Bash and PowerShell have different null redirect syntax. `2>$null` is PowerShell; `2>/dev/null` is Bash. When a command uses the wrong one in the wrong shell, the error output isn't suppressed AND the redirection string is treated as a filename or causes an "ambiguous redirect" error — which itself can silently abort the command.

**Rule:** Always use the Bash tool for POSIX commands. Always use the PowerShell tool for Windows-native operations (port management, process management, filesystem ops on Windows paths).

---
