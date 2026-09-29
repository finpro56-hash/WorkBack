# Plan - Derived RPG State (Cross-Device Level & Streak Sync)

Currently, your RPG level, XP, and streaks are stored in your device’s local memory (`localStorage`), but they are never synced or uploaded. This is why your laptop resets to **Level 1 — 0 Days Streak** even though your actual logs are correctly pulled.

We will change the RPG state from a fragile, device-dependent local variable into a **derived, computed state**.

### What we will do:
1. **Dynamic Derived State Engine (`src/context/AppContext.tsx`)**:
   - Refactor the `rpg` variable to use `React.useMemo()`, deriving your Level, XP, Consecutive Daily Streaks, and Milestones dynamically from your actual list of `workSessions` and `expenses`.
2. **Immediate Mirroring**:
   - Because your logs are synchronized perfectly through the Google Sheet, **your Level, XP, Streaks, and Badges will automatically mirror across all your devices** (mobile and laptop) instantly without any configuration or secondary databases.
