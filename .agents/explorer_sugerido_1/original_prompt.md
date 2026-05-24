## 2026-05-21T13:24:28Z

You are Explorer 1. Your task is to investigate the backend calculations and rate calculations of the Casa Mahana PMS, specifically for timezone-proof rates and per-person Pasadía rates.
Your working directory is: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_sugerido_1

Please:
1. Initialize your BRIEFING.md and progress.md inside your working directory.
2. Read C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\PROJECT.md and C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\ORIGINAL_REQUEST.md.
3. Analyze C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\server\utils\calculations.js and C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\server\utils\calculations.test.js.
4. Investigate:
   - How are dates currently processed? How is weekday vs weekend rate determined? How are nightly breakdowns and totals calculated?
   - How to refactor the date breakdown and weekday vs weekend calculations to use strictly UTC-based Date methods (`Date.UTC()`, `getUTCDate()`, `setUTCDate()`, `getUTCDay()`) to eliminate timezone shifts.
   - How to support per-person pricing for Pasadía plans: `Total = (adults * precio_adulto) + (minors * precio_menor) + (pets * precio_mascota)`.
5. Propose a clear, step-by-step implementation strategy for the worker in your handoff report (saved to C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_sugerido_1\handoff.md).
6. Send a message to the Project Orchestrator (Conversation ID: ff87ec31-9fe0-41d2-9327-1ac8dcd49815) when done.

## 2026-05-21T13:28:00Z

[Resumed session. Analyzed previously completed work, discovered timezone bugs in calculations.js and BookingWidget.tsx, designed proposed_calculations.js and proposed_calculations.test.js files, wrote handoff.md report.]

