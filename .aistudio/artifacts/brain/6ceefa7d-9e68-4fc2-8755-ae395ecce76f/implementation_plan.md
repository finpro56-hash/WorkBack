# Plan - Google Sheets Dynamic Overwrite & Deletion Sync

Currently, deleting logs only removes them from local storage but leaves them intact in the Google Sheet. On the next sync or page reload, they get re-pulled. We will implement full deletion and sync-overwrite behavior.

### What we will do:
1. **Google Sheets Value Clear and Overwrite (`src/services/sheetsService.ts`)**:
   - Add a new API method `overwriteLedgerRows()`.
   - This method clears the Google Sheet range `Sheet1!A2:G` via the Sheets `:clear` endpoint and writes the exact list of non-deleted rows.
2. **Deletions and Update Hooks (`src/context/AppContext.tsx`)**:
   - When a row is deleted (Expense or Work), remove it locally and immediately trigger a background update to rewrite the Google Sheet values.
   - Refactor `triggerManualSync()` into a complete two-way consolidation sync to reflect deletes on both devices.
