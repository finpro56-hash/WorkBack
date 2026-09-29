import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { User } from 'firebase/auth';
import { googleSignIn, logout as firebaseLogout, initAuth } from '../services/authService';
import { findLedgerFile, createLedgerFile, overwriteLedgerRows, LedgerRow, fetchLedgerRows } from '../services/sheetsService';

export interface Expense {
  id: string;
  amount: number;
  category: string;
  date: string;
  taskToEarn: string;
  timestamp: string;
  synced: boolean;
}

export interface WorkSession {
  id: string;
  hours: number;
  task: string;
  description: string;
  date: string;
  timestamp: string;
  synced: boolean;
}

export interface Ratio {
  baseAmount: number; // e.g., 1000 RS
  requiredHours: number; // e.g., 4 Hours
}

export interface RPGState {
  xp: number;
  level: number;
  streakCount: number;
  lastWorkDate: string | null;
  unlockedBadges: string[];
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'expense' | 'work' | 'level' | 'streak';
}

export const BADGES_LIST: Badge[] = [
  { id: 'FIRST_EXPENSE', title: 'Frugal Spark', description: 'Log your first expense debt', icon: 'Sparkles', category: 'expense' },
  { id: 'FIRST_WORK', title: 'Action Pioneer', description: 'Complete your first work session', icon: 'Flame', category: 'work' },
  { id: 'STREAK_3', title: 'Consistency Knight', description: 'Maintain a 3-day work streak', icon: 'Shield', category: 'streak' },
  { id: 'LEVEL_5', title: 'Discipline Adept', description: 'Reach Level 5 RPG Rank', icon: 'Crown', category: 'level' },
  { id: 'DEBT_FREE_HERO', title: 'Debt Slayer', description: 'Slay your entire hour debt completely', icon: 'Sword', category: 'work' },
  { id: 'BUDGET_SAVIOR', title: 'Zen Budgeter', description: 'Log a full week with no daily budget overruns', icon: 'CheckCircle', category: 'expense' },
];

interface AppContextType {
  expenses: Expense[];
  workSessions: WorkSession[];
  ratio: Ratio;
  dailyBudgetLimit: number;
  user: User | null;
  accessToken: string | null;
  spreadsheetId: string | null;
  isOnline: boolean;
  syncing: boolean;
  rpg: RPGState;
  toasts: Array<{ id: string; message: string; type: 'success' | 'warning' | 'info' | 'rpg' }>;
  addToast: (message: string, type?: 'success' | 'warning' | 'info' | 'rpg') => void;
  removeToast: (id: string) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  addExpense: (amount: number, category: string, taskToEarn: string, date: string) => void;
  addWorkSession: (hours: number, task: string, description: string, date: string) => void;
  deleteExpense: (id: string) => void;
  deleteWorkSession: (id: string) => void;
  updateRatio: (baseAmount: number, requiredHours: number) => void;
  updateDailyBudgetLimit: (limit: number) => void;
  triggerManualSync: () => Promise<void>;
  clearLedgerLocal: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  // State from Local Storage
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('wb_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  const [workSessions, setWorkSessions] = useState<WorkSession[]>(() => {
    const saved = localStorage.getItem('wb_work_sessions');
    return saved ? JSON.parse(saved) : [];
  });

  const [ratio, setRatio] = useState<Ratio>(() => {
    const saved = localStorage.getItem('wb_ratio');
    return saved ? JSON.parse(saved) : { baseAmount: 1000, requiredHours: 4 };
  });

  const [dailyBudgetLimit, setDailyBudgetLimit] = useState<number>(() => {
    const saved = localStorage.getItem('wb_budget_limit');
    return saved ? parseInt(saved, 10) : 500;
  });

  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem('wb_spreadsheet_id') || null;
  });

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Connection & Sync States
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'warning' | 'info' | 'rpg' }>>([]);

  // Toast notifier helper
  const addToast = (message: string, type: 'success' | 'warning' | 'info' | 'rpg' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('wb_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('wb_work_sessions', JSON.stringify(workSessions));
  }, [workSessions]);

  useEffect(() => {
    localStorage.setItem('wb_ratio', JSON.stringify(ratio));
  }, [ratio]);

  useEffect(() => {
    localStorage.setItem('wb_budget_limit', dailyBudgetLimit.toString());
  }, [dailyBudgetLimit]);

  useEffect(() => {
    if (spreadsheetId) {
      localStorage.setItem('wb_spreadsheet_id', spreadsheetId);
    } else {
      localStorage.removeItem('wb_spreadsheet_id');
    }
  }, [spreadsheetId]);

  // Handle Online/Offline Status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addToast('Back online! Sync operations resumed.', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast('Running offline. Changes will save locally and sync when online.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor auth status on load
  useEffect(() => {
    initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        addToast(`Welcome back, ${currentUser.displayName}!`, 'success');
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
  }, []);

  // Check and setup Google Sheets automatically when logged in
  useEffect(() => {
    if (user && accessToken && isOnline && !spreadsheetId) {
      const initializeSheets = async () => {
        setSyncing(true);
        try {
          let sheetId = await findLedgerFile(accessToken);
          if (!sheetId) {
            sheetId = await createLedgerFile(accessToken);
            addToast('Created "WorkBack Ledger" Spreadsheet in Google Drive!', 'success');
          } else {
            addToast('Connected to existing "WorkBack Ledger" in Google Drive.', 'success');
            // Pull existing logs to sync on first connection
            await pullAndMergeFromSheet(accessToken, sheetId);
          }
          setSpreadsheetId(sheetId);
        } catch (err) {
          console.error(err);
          addToast('Failed to connect with Google Drive Ledger.', 'warning');
        } finally {
          setSyncing(false);
        }
      };
      initializeSheets();
    }
  }, [user, accessToken, isOnline, spreadsheetId]);

  // Startup auto pull sync from Google Sheets once spreadsheet details are loaded
  useEffect(() => {
    if (user && accessToken && spreadsheetId && isOnline) {
      pullAndMergeFromSheet(accessToken, spreadsheetId);
    }
  }, [user, accessToken, spreadsheetId]);

  // Trigger auto background sync of unsynced items
  useEffect(() => {
    const hasUnsynced = expenses.some((e) => !e.synced) || workSessions.some((w) => !w.synced);
    if (hasUnsynced && user && accessToken && spreadsheetId && isOnline && !syncing) {
      triggerManualSync();
    }
  }, [expenses, workSessions, user, accessToken, spreadsheetId, isOnline]);

  // RPG Calculations derived dynamically from the complete set of logs!
  // This guarantees perfect multi-device mirroring of Levels, XP, Streaks, and Badges.
  const rpg = useMemo<RPGState>(() => {
    // 1. Calculate XP from focus/study work hours
    const totalXp = workSessions.reduce((sum, w) => sum + Math.round(w.hours * 100), 0);

    // 2. Calculate Level using level scaling (level L needs L * 200 XP to level up)
    let remainingXp = totalXp;
    let level = 1;
    let nextLvlThreshold = level * 200;
    while (remainingXp >= nextLvlThreshold) {
      remainingXp -= nextLvlThreshold;
      level += 1;
      nextLvlThreshold = level * 200;
    }

    // 3. Calculate consecutive daily Streaks
    const uniqueWorkDates = Array.from(new Set(workSessions.map((w) => w.date))).sort((a, b) => b.localeCompare(a));
    const lastWorkDate = uniqueWorkDates[0] || null;
    let streakCount = 0;

    if (lastWorkDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastWorkDate === todayStr || lastWorkDate === yesterdayStr) {
        streakCount = 1;
        const checkDate = new Date(lastWorkDate);
        while (true) {
          checkDate.setDate(checkDate.getDate() - 1);
          const checkDateStr = checkDate.toISOString().split('T')[0];
          if (uniqueWorkDates.includes(checkDateStr)) {
            streakCount += 1;
          } else {
            break;
          }
        }
      }
    }

    // 4. Determine Badge Achievements dynamically
    const unlockedBadges: string[] = [];
    if (expenses.length > 0) unlockedBadges.push('FIRST_EXPENSE');
    if (workSessions.length > 0) unlockedBadges.push('FIRST_WORK');
    if (streakCount >= 3) unlockedBadges.push('STREAK_3');
    if (level >= 5) unlockedBadges.push('LEVEL_5');

    const totalHoursWorked = workSessions.reduce((sum, w) => sum + w.hours, 0);
    const totalExpenseDebt = expenses.reduce((sum, e) => sum + (e.amount / ratio.baseAmount) * ratio.requiredHours, 0);
    if (totalHoursWorked >= totalExpenseDebt && totalExpenseDebt > 0) {
      unlockedBadges.push('DEBT_FREE_HERO');
    }

    // Zen Budgeter - At least 5 expenses logged, with no daily budget overruns
    const dailyExpensesMap: { [date: string]: number } = {};
    expenses.forEach((e) => {
      dailyExpensesMap[e.date] = (dailyExpensesMap[e.date] || 0) + e.amount;
    });
    const hasOverruns = Object.values(dailyExpensesMap).some((amount) => amount > dailyBudgetLimit);
    if (expenses.length >= 5 && !hasOverruns) {
      unlockedBadges.push('BUDGET_SAVIOR');
    }

    return {
      xp: remainingXp,
      level,
      streakCount,
      lastWorkDate,
      unlockedBadges,
    };
  }, [expenses, workSessions, ratio, dailyBudgetLimit]);

  // Log Google Auth Login
  const login = async () => {
    try {
      const authResult = await googleSignIn();
      if (authResult) {
        setUser(authResult.user);
        setAccessToken(authResult.accessToken);
        addToast(`Authenticated successfully as ${authResult.user.displayName}`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      addToast('Authentication failed. Check your connection or retry popup.', 'warning');
    }
  };

  // Sign out
  const logout = async () => {
    await firebaseLogout();
    setUser(null);
    setAccessToken(null);
    setSpreadsheetId(null);
    addToast('Logged out of Google account.', 'info');
  };

  // Local actions (Offline-first)
  const addExpense = (amount: number, category: string, taskToEarn: string, date: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const dailyTotal = expenses
      .filter((e) => e.date === todayStr)
      .reduce((sum, e) => sum + e.amount, 0) + amount;

    if (dailyTotal > dailyBudgetLimit) {
      addToast(`Daily budget limit exceeded! Spent: ${dailyTotal} / ${dailyBudgetLimit} RS`, 'warning');
      triggerLocalNotification('Budget Limit Warning', `You have spent ${dailyTotal} RS today, exceeding your ${dailyBudgetLimit} RS limit!`);
    }

    const newExpense: Expense = {
      id: Math.random().toString(36).substring(2, 9),
      amount,
      category,
      date,
      taskToEarn,
      timestamp: new Date().toISOString(),
      synced: false,
    };

    setExpenses((prev) => [newExpense, ...prev]);
    addToast(`Expense logged! Debt Hours increased by ${((amount / ratio.baseAmount) * ratio.requiredHours).toFixed(1)} hrs`, 'success');
  };

  const addWorkSession = (hours: number, task: string, description: string, date: string) => {
    const newSession: WorkSession = {
      id: Math.random().toString(36).substring(2, 9),
      hours,
      task,
      description,
      date,
      timestamp: new Date().toISOString(),
      synced: false,
    };

    // Calculate level-up toasts in advance
    const xpGained = Math.round(hours * 100);
    const currentTotalXp = workSessions.reduce((sum, w) => sum + Math.round(w.hours * 100), 0);
    const newTotalXp = currentTotalXp + xpGained;

    let tempXp = currentTotalXp;
    let currentLvl = 1;
    let nextLvlThreshold = currentLvl * 200;
    while (tempXp >= nextLvlThreshold) {
      tempXp -= nextLvlThreshold;
      currentLvl += 1;
      nextLvlThreshold = currentLvl * 200;
    }

    let tempNewXp = newTotalXp;
    let newLvl = 1;
    let nextNewLvlThreshold = newLvl * 200;
    while (tempNewXp >= nextNewLvlThreshold) {
      tempNewXp -= nextNewLvlThreshold;
      newLvl += 1;
      nextNewLvlThreshold = newLvl * 200;
    }

    setWorkSessions((prev) => [newSession, ...prev]);
    addToast(`Completed focus task! Earned +${xpGained} XP.`, 'success');
    
    if (newLvl > currentLvl) {
      addToast(`LEVEL UP! You reached Level ${newLvl}!`, 'rpg');
      triggerLocalNotification('LEVEL UP!', `Congratulations! You reached RPG Level ${newLvl} in self-discipline!`);
    }
  };

  const deleteExpense = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this expense record? This will permanently erase it from Google Sheets.');
    if (!confirmed) return;

    setExpenses((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      setTimeout(() => {
        triggerManualSyncWithState(updated, workSessions);
      }, 50);
      return updated;
    });
    addToast('Expense removed.', 'info');
  };

  const deleteWorkSession = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this study/work session? This will permanently erase it from Google Sheets.');
    if (!confirmed) return;

    setWorkSessions((prev) => {
      const updated = prev.filter((w) => w.id !== id);
      setTimeout(() => {
        triggerManualSyncWithState(expenses, updated);
      }, 50);
      return updated;
    });
    addToast('Work session deleted.', 'info');
  };

  const updateRatio = (baseAmount: number, requiredHours: number) => {
    setRatio({ baseAmount, requiredHours });
    addToast(`Formula customized: ${requiredHours} Hours per ${baseAmount} RS`, 'success');
  };

  const updateDailyBudgetLimit = (limit: number) => {
    setDailyBudgetLimit(limit);
    addToast(`Daily budget limit configured to ${limit} RS`, 'success');
  };

  // Downward sync: Pull & Merge logs from Google Sheet
  const pullAndMergeFromSheet = async (token: string, sheetId: string) => {
    try {
      const remoteRows = await fetchLedgerRows(token, sheetId);
      if (!remoteRows) return;

      const remoteExpenses: Expense[] = [];
      const remoteSessions: WorkSession[] = [];

      remoteRows.forEach((row) => {
        let taskToEarn = '';
        if (row.description.startsWith('Task required: ')) {
          taskToEarn = row.description.replace('Task required: ', '');
        } else {
          taskToEarn = row.description;
        }

        if (row.type === 'EXPENSE') {
          remoteExpenses.push({
            id: row.id,
            amount: row.amountOrHours,
            category: row.categoryOrTask,
            date: row.timestamp.split('T')[0],
            taskToEarn: taskToEarn,
            timestamp: row.timestamp,
            synced: true,
          });
        } else if (row.type === 'WORK') {
          remoteSessions.push({
            id: row.id,
            hours: row.amountOrHours,
            task: row.categoryOrTask,
            description: row.description,
            date: row.timestamp.split('T')[0],
            timestamp: row.timestamp,
            synced: true,
          });
        }
      });

      setExpenses((localPrev) => {
        const merged = [...localPrev];
        remoteExpenses.forEach((remote) => {
          if (!merged.some((local) => local.id === remote.id)) {
            merged.push(remote);
          }
        });
        return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      });

      setWorkSessions((localPrev) => {
        const merged = [...localPrev];
        remoteSessions.forEach((remote) => {
          if (!merged.some((local) => local.id === remote.id)) {
            merged.push(remote);
          }
        });
        return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      });
    } catch (err) {
      console.error('pullAndMergeFromSheet error:', err);
    }
  };

  // Trigger manual sheets update with a specific current state (useful for instant deletion pushes)
  const triggerManualSyncWithState = async (currentExpenses: Expense[], currentSessions: WorkSession[]) => {
    if (!user || !accessToken || !spreadsheetId) return;
    if (!isOnline) {
      addToast('Offline. Changes will sync to Google Sheets when internet returns.', 'warning');
      return;
    }

    setSyncing(true);
    try {
      const rowsToPut: LedgerRow[] = [];

      currentExpenses.forEach((e) => {
        rowsToPut.push({
          timestamp: e.timestamp,
          type: 'EXPENSE',
          id: e.id,
          amountOrHours: e.amount,
          categoryOrTask: e.category,
          description: `Task required: ${e.taskToEarn}`,
          ratio: `${ratio.requiredHours}h / ${ratio.baseAmount}RS`,
        });
      });

      currentSessions.forEach((w) => {
        rowsToPut.push({
          timestamp: w.timestamp,
          type: 'WORK',
          id: w.id,
          amountOrHours: w.hours,
          categoryOrTask: w.task,
          description: w.description,
          ratio: `${ratio.requiredHours}h / ${ratio.baseAmount}RS`,
        });
      });

      const sortedRows = rowsToPut.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const success = await overwriteLedgerRows(accessToken, spreadsheetId, sortedRows);
      if (success) {
        setExpenses((prev) => prev.map((e) => ({ ...e, synced: true })));
        setWorkSessions((prev) => prev.map((w) => ({ ...w, synced: true })));
        addToast('Google Sheet successfully updated and mirrored!', 'success');
      } else {
        throw new Error('Google Sheets overwrite request failed.');
      }
    } catch (err) {
      console.error(err);
      addToast('Encountered an error writing deletion to Google Sheets.', 'warning');
    } finally {
      setSyncing(false);
    }
  };

  // Manual pull-and-push bidirectional sync
  const triggerManualSync = async () => {
    if (!user || !accessToken || !spreadsheetId) {
      addToast('Sign in to your Google Account to synchronize data.', 'warning');
      return;
    }

    if (!isOnline) {
      addToast('No internet connection. Sync postponed.', 'warning');
      return;
    }

    setSyncing(true);
    try {
      // 1. Fetch remote rows
      const remoteRows = await fetchLedgerRows(accessToken, spreadsheetId);
      
      const remoteExpenses: Expense[] = [];
      const remoteSessions: WorkSession[] = [];

      remoteRows.forEach((row) => {
        let taskToEarn = '';
        if (row.description.startsWith('Task required: ')) {
          taskToEarn = row.description.replace('Task required: ', '');
        } else {
          taskToEarn = row.description;
        }

        if (row.type === 'EXPENSE') {
          remoteExpenses.push({
            id: row.id,
            amount: row.amountOrHours,
            category: row.categoryOrTask,
            date: row.timestamp.split('T')[0],
            taskToEarn: taskToEarn,
            timestamp: row.timestamp,
            synced: true,
          });
        } else if (row.type === 'WORK') {
          remoteSessions.push({
            id: row.id,
            hours: row.amountOrHours,
            task: row.categoryOrTask,
            description: row.description,
            date: row.timestamp.split('T')[0],
            timestamp: row.timestamp,
            synced: true,
          });
        }
      });

      // 2. Align local states with remote data
      let finalExpenses = [...expenses];
      let finalSessions = [...workSessions];

      // Merge remote items we don't have locally
      remoteExpenses.forEach((remote) => {
        if (!finalExpenses.some((local) => local.id === remote.id)) {
          finalExpenses.push(remote);
        }
      });

      remoteSessions.forEach((remote) => {
        if (!finalSessions.some((local) => local.id === remote.id)) {
          finalSessions.push(remote);
        }
      });

      // 3. Mark all as synced locally
      finalExpenses = finalExpenses.map(e => ({ ...e, synced: true }));
      finalSessions = finalSessions.map(w => ({ ...w, synced: true }));

      // 4. Overwrite Sheet with the merged list to ensure perfect symmetry
      const rowsToPut: LedgerRow[] = [];

      finalExpenses.forEach((e) => {
        rowsToPut.push({
          timestamp: e.timestamp,
          type: 'EXPENSE',
          id: e.id,
          amountOrHours: e.amount,
          categoryOrTask: e.category,
          description: `Task required: ${e.taskToEarn}`,
          ratio: `${ratio.requiredHours}h / ${ratio.baseAmount}RS`,
        });
      });

      finalSessions.forEach((w) => {
        rowsToPut.push({
          timestamp: w.timestamp,
          type: 'WORK',
          id: w.id,
          amountOrHours: w.hours,
          categoryOrTask: w.task,
          description: w.description,
          ratio: `${ratio.requiredHours}h / ${ratio.baseAmount}RS`,
        });
      });

      const sortedRows = rowsToPut.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const success = await overwriteLedgerRows(accessToken, spreadsheetId, sortedRows);

      if (success) {
        setExpenses(finalExpenses.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setWorkSessions(finalSessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        addToast('Synced perfectly with Google Sheets!', 'success');
      } else {
        throw new Error('Push sync overwrite failed.');
      }
    } catch (err) {
      console.error(err);
      addToast('Two-way sync encountered an issue.', 'warning');
    } finally {
      setSyncing(false);
    }
  };

  // Helper to trigger system push notification if allowed
  const triggerLocalNotification = (title: string, body: string) => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon.svg' });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification(title, { body, icon: '/icon.svg' });
          }
        });
      }
    }
  };

  // Direct option for developer testing/resetting ledger
  const clearLedgerLocal = () => {
    if (window.confirm('Reset all local expenses & work session logs? (This does not touch your Google Sheet)')) {
      setExpenses([]);
      setWorkSessions([]);
      localStorage.removeItem('wb_spreadsheet_id');
      setSpreadsheetId(null);
      addToast('Local workspace data reset.', 'info');
    }
  };

  return (
    <AppContext.Provider
      value={{
        expenses,
        workSessions,
        ratio,
        dailyBudgetLimit,
        user,
        accessToken,
        spreadsheetId,
        isOnline,
        syncing,
        rpg,
        toasts,
        addToast,
        removeToast,
        login,
        logout,
        addExpense,
        addWorkSession,
        deleteExpense,
        deleteWorkSession,
        updateRatio,
        updateDailyBudgetLimit,
        triggerManualSync,
        clearLedgerLocal,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
