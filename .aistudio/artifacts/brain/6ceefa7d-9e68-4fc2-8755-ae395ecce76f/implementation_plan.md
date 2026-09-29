# Plan - Bidirectional Google Sheets Two-Way Sync (Laptop & Mobile Mirroring)

Currently, your device only **pushes (appends)** data to the Google Sheet but never **pulls (downloads)** existing records to populate the local state. When you open the app on your laptop, the laptop’s local storage is empty, meaning you cannot see your mobile data until we implement a bidirectional pull-and-merge algorithm.

### What we will do:
1. **Bidirectional Merging (`src/context/AppContext.tsx`)**:
   - Implement `pullAndMergeFromSheet()` which downloads the complete ledger from Google Sheets on page load/login.
   - De-duplicate and merge remote rows with local logs chronologically (ensuring unsynced local data is never overwritten).
2. **Two-Way Syncing**:
   - Update `triggerManualSync()` to first download/merge incoming mobile entries, and then push any unsynced laptop entries.
   - Add a startup `useEffect` hook to pull latest records automatically on application launch.
