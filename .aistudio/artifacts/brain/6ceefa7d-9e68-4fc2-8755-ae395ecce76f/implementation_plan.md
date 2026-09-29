# Session Persistence Optimization Plan

We will eliminate the issue where you are forced to re-connect your Google Account and email every time you refresh or open the app.

---

## 1. Problem Diagnosis
Currently, the Google OAuth token (which authorizes writing to your Google Sheets) is stored only in the browser's volatile memory (RAM). When the browser reloads or you reopen the app:
- Firebase successfully remembers your email and login profile.
- However, the Google Sheets token in memory is lost.
- The app's startup listener currently detects the missing token and automatically logs your email profile out to avoid desynchronization.

---

## 2. Solution Plan

### Step A: Persist Google OAuth Token safely in LocalStorage
We will update `src/services/authService.ts` to save and load the Google Access Token from `localStorage` under `wb_google_access_token`:
- On successful login: save token to `localStorage`.
- On start: initialize the cached token from `localStorage`.
- On explicit logout: delete the token from `localStorage` alongside your Firebase sign-out.

### Step B: Robust Graceful Authentication State (`AppContext.tsx`)
We will update `src/context/AppContext.tsx` and `src/services/authService.ts` to separate the **Google Account Profile** from the **Sheets Write Permission**:
1. If the app opens and Firebase has your email profile, you will **always remain logged in**. You will see your profile, your level, and your logs immediately.
2. If the Sheets Access Token is missing or expired, the app **will not log you out**. Instead, it will keep your email active, and only show a "Reconnect Sheets" button inside the Settings rules panel if synchronization needs re-authorization.
