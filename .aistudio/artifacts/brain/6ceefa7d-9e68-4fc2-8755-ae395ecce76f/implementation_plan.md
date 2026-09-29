# Plan - Branded Home Screen Shortcuts (PWA Quick Widgets)

PWAs on mobile devices support **App Shortcuts** (long-pressing the app icon on the home screen to show instant shortcuts, acting as dynamic quick-access widgets). We will implement this perfectly!

### What we will do:
1. **PWA Manifest Update (`vite.config.ts`)**: Add shortcut configurations for:
   - **Log Expense**: Navigates directly to `/?tab=expense`
   - **Log Work**: Navigates directly to `/?tab=work`
2. **React Routing Handler (`src/App.tsx`)**: Look for URL query parameters on startup and auto-switch the view tab to the requested form (and clean up the URL to keep it pristine).

---

### How to use this feature:
* **Android (Chrome/Edge)**: Long-press the installed **WorkBack** icon on your home screen. A menu will pop up with "Log Expense" and "Log Work" buttons. You can even drag these individual options directly onto your home screen to create standalone "widgets"!
* **iOS (Safari)**: Long-press the installed "Add to Home Screen" app icon to open the context menu shortcuts.
