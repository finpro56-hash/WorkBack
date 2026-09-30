import React, { useState, useEffect, useRef } from 'react';
import { useApp, Expense, WorkSession, BADGES_LIST } from './context/AppContext';
import {
  Sparkles,
  Flame,
  Shield,
  Crown,
  Sword,
  CheckCircle,
  Plus,
  Trash2,
  Settings,
  User,
  LogOut,
  RefreshCw,
  Wifi,
  WifiOff,
  CloudLightning,
  Coins,
  Briefcase,
  Play,
  Square,
  Award,
  BookOpen,
  Calendar as CalendarIcon,
  ChevronRight,
  TrendingDown,
  Timer
} from 'lucide-react';

export default function App() {
  const {
    expenses,
    workSessions,
    ratio,
    dailyBudgetLimit,
    user,
    accessToken,
    spreadsheetId,
    isOnline,
    syncing,
    lastSyncTime,
    isAuthExpired,
    rpg,
    toasts,
    removeToast,
    login,
    logout,
    reconnectGoogle,
    manuallySetSpreadsheetId,
    addExpense,
    addWorkSession,
    deleteExpense,
    deleteWorkSession,
    updateRatio,
    updateDailyBudgetLimit,
    triggerManualSync,
    clearLedgerLocal
  } = useApp();

  // Active Bottom Tab: 'home', 'expense', 'work', 'rpg', 'settings'
  const [activeTab, setActiveTab] = useState<'home' | 'expense' | 'work' | 'rpg' | 'settings'>('home');

  // Input states
  const [manualSheetInput, setManualSheetInput] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Leisure');
  const [expenseTask, setExpenseTask] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [workHours, setWorkHours] = useState('');
  const [workTask, setWorkTask] = useState('');
  const [workDesc, setWorkDesc] = useState('');
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Settings Ratio states
  const [ratioBase, setRatioBase] = useState(ratio.baseAmount.toString());
  const [ratioHours, setRatioHours] = useState(ratio.requiredHours.toString());
  const [budgetLimit, setBudgetLimit] = useState(dailyBudgetLimit.toString());

  // Focus Timer states
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(1500); // 25 mins Pomodoro
  const [selectedTimerMinutes, setSelectedTimerMinutes] = useState(25);
  const [focusTask, setFocusTask] = useState('');
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // iOS install guide modal state
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Listen to PWA install prompts
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Check URL query parameters for PWA Home Screen Shortcuts
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'expense' || tabParam === 'work' || tabParam === 'rpg' || tabParam === 'settings') {
      setActiveTab(tabParam as any);
      // Clean up the URL query parameters to keep the path clean
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      setShowIOSPrompt(true);
    }
  };

  // Synced status for ratios on settings tab
  useEffect(() => {
    setRatioBase(ratio.baseAmount.toString());
    setRatioHours(ratio.requiredHours.toString());
    setBudgetLimit(dailyBudgetLimit.toString());
  }, [ratio, dailyBudgetLimit]);

  // Focus Timer counting
  useEffect(() => {
    if (timerActive) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            // Timer complete!
            clearInterval(timerIntervalRef.current!);
            setTimerActive(false);
            const loggedHours = selectedTimerMinutes / 60;
            addWorkSession(
              parseFloat(loggedHours.toFixed(2)),
              focusTask || 'Completed Focus Session',
              `Timer focused work for ${selectedTimerMinutes} mins`,
              new Date().toISOString().split('T')[0]
            );
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerActive, focusTask, selectedTimerMinutes]);

  const handleTimerStartStop = () => {
    if (timerActive) {
      setTimerActive(false);
    } else {
      setTimerSeconds(selectedTimerMinutes * 60);
      setTimerActive(true);
    }
  };

  const handleTimerReset = () => {
    setTimerActive(false);
    setTimerSeconds(selectedTimerMinutes * 60);
  };

  const handleTimerConfig = (mins: number) => {
    setTimerActive(false);
    setSelectedTimerMinutes(mins);
    setTimerSeconds(mins * 60);
  };

  // Calculations for Accountability Math
  const totalExpended = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalWorkRequired = expenses.reduce((sum, e) => {
    return sum + (e.amount / ratio.baseAmount) * ratio.requiredHours;
  }, 0);
  const totalWorkCompleted = workSessions.reduce((sum, w) => sum + w.hours, 0);
  const remainingWorkDebt = totalWorkRequired - totalWorkCompleted;
  const isDebtFree = remainingWorkDebt <= 0;

  // Level thresholds
  const xpNeeded = rpg.level * 200;
  const xpPercent = Math.min(Math.max((rpg.xp / xpNeeded) * 100, 0), 100);

  // Helper to retrieve character rank string based on level
  const getRankName = (lvl: number) => {
    if (lvl < 5) return 'Frugal Novice';
    if (lvl < 10) return 'Discipline Apprentice';
    if (lvl < 15) return 'Accountability Knight';
    return 'Self-Discipline Grandmaster';
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Trigger submission events
  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) return;
    if (!expenseTask.trim()) {
      alert('Please enter what specific study/discipline task you will do to pay back this expenditure!');
      return;
    }

    addExpense(amount, expenseCategory, expenseTask, expenseDate);
    setExpenseAmount('');
    setExpenseTask('');
    setActiveTab('home'); // Go to dashboard to view update
  };

  const handleWorkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hrs = parseFloat(workHours);
    if (isNaN(hrs) || hrs <= 0) return;
    if (!workTask.trim()) return;

    addWorkSession(hrs, workTask, workDesc, workDate);
    setWorkHours('');
    setWorkTask('');
    setWorkDesc('');
    setActiveTab('home');
  };

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const base = parseFloat(ratioBase);
    const hrs = parseFloat(ratioHours);
    const limit = parseFloat(budgetLimit);

    if (isNaN(base) || base <= 0 || isNaN(hrs) || hrs <= 0 || isNaN(limit) || limit < 0) {
      alert('Please enter valid positive values.');
      return;
    }

    updateRatio(base, hrs);
    updateDailyBudgetLimit(limit);
  };

  // Lucide helper for icons mapping in RPG badge cards
  const renderBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />;
      case 'Flame':
        return <Flame className="w-6 h-6 text-orange-500" />;
      case 'Shield':
        return <Shield className="w-6 h-6 text-blue-500" />;
      case 'Crown':
        return <Crown className="w-6 h-6 text-amber-500" />;
      case 'Sword':
        return <Sword className="w-6 h-6 text-rose-500" />;
      case 'CheckCircle':
        return <CheckCircle className="w-6 h-6 text-emerald-500" />;
      default:
        return <Award className="w-6 h-6 text-indigo-500" />;
    }
  };

  // Generate background clock hands angle based on current actual time
  const [currentDate, setCurrentDate] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hrsAngle = (currentDate.getHours() % 12) * 30 + currentDate.getMinutes() * 0.5;
  const minsAngle = currentDate.getMinutes() * 6;

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col items-center justify-start pb-24 font-sans select-none overflow-x-hidden">
      
      {/* Toast Manager Overlay */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border text-sm flex items-start gap-3 justify-between transition-all duration-300 animate-[slideDown_0.2s_ease-out] ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : toast.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : toast.type === 'rpg'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-900 ring-2 ring-indigo-500'
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex-1">
              <p className="font-semibold">{toast.type === 'rpg' ? '🏆 RPG Reward!' : toast.type === 'warning' ? '⚠️ Caution' : '✓ Update'}</p>
              <p className="mt-0.5 text-xs opacity-90">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 font-bold px-1.5 py-0.5 rounded text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Top Banner / Sync Info */}
      <header className="w-full max-w-md bg-slate-50/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/50 py-3 px-4 flex items-center justify-between shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white font-extrabold shadow-md shadow-indigo-200 text-lg">
            W
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5">
              WorkBack
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              )}
            </h1>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Discipline Engine</p>
          </div>
        </div>

        {/* Sync & Profile Status Panel */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              {isAuthExpired && (
                <button
                  onClick={reconnectGoogle}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[11px] shadow-sm animate-pulse transition"
                  title="Google Sheets session expired. Click to re-connect."
                >
                  <RefreshCw className="w-3 h-3" />
                  Reconnect
                </button>
              )}

              <button
                onClick={triggerManualSync}
                disabled={syncing || !isOnline}
                className={`p-2 rounded-xl transition bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-600 shadow-sm relative ${
                  syncing ? 'animate-spin text-indigo-500' : ''
                }`}
                title="Sync database with Google Sheets"
              >
                <RefreshCw className="w-4 h-4" />
                {expenses.some((e) => !e.synced) || workSessions.some((w) => !w.synced) ? (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-slate-50" />
                ) : null}
              </button>

              <button
                onClick={logout}
                className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 text-slate-500 transition shadow-sm"
                title="Sign out of Google"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Profile'}
                  className="w-8 h-8 rounded-full border-2 border-slate-300 shadow-inner"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs">
                  {user.displayName?.charAt(0) || 'U'}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={login}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-white text-xs font-bold text-indigo-600 shadow-sm hover:bg-indigo-50 transition"
            >
              <User className="w-3.5 h-3.5" />
              Connect Sheets
            </button>
          )}
        </div>
      </header>

      {/* Main Core Container */}
      <main className="w-full max-w-md px-4 mt-4 flex-1 flex flex-col gap-5">
        
        {/* TAB 1: HOME/DASHBOARD VIEW */}
        {activeTab === 'home' && (
          <>
            {/* RPG Status Widget (Hero Card) */}
            <div className="bg-slate-50/90 rounded-3xl p-5 border border-slate-200/60 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.9),_4px_4px_8px_rgba(163,177,198,0.3)] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full w-max">
                    <Crown className="w-3.5 h-3.5" />
                    Level {rpg.level} — {getRankName(rpg.level)}
                  </div>
                  <h2 className="text-xl font-black text-slate-800 mt-1.5 tracking-tight">{user?.displayName || 'Discipline Warrior'}</h2>
                </div>
                {/* Streak Counter Neumorphic badge */}
                <div className="bg-slate-50 px-3 py-2 rounded-2xl border border-slate-200/50 shadow-[inset_-2px_-2px_4px_rgba(255,255,255,0.9),_2px_2px_4px_rgba(163,177,198,0.2)] flex items-center gap-1.5">
                  <Flame className="w-5 h-5 text-orange-500 animate-[pulse_1.5s_infinite]" />
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Streak</p>
                    <p className="text-sm font-extrabold text-slate-700 leading-none mt-0.5">{rpg.streakCount} Days</p>
                  </div>
                </div>
              </div>

              {/* Progress bar to next Level */}
              <div>
                <div className="flex justify-between items-center text-xs text-slate-400 font-bold mb-1.5">
                  <span>RPG EXP: {rpg.xp} / {xpNeeded} XP</span>
                  <span>{Math.round(xpPercent)}%</span>
                </div>
                <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden shadow-inner p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-500 ease-out shadow-sm"
                    style={{ width: `${xpPercent}%` }}
                  />
                </div>
              </div>

              {/* Cloud Sync Status & Quick Action */}
              <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${syncing ? 'bg-indigo-500 animate-ping' : isAuthExpired ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className="truncate max-w-[170px]">
                    {isAuthExpired ? 'Auth expired' : lastSyncTime ? `Synced: ${lastSyncTime}` : 'Cloud Connected'}
                  </span>
                </div>
                <button
                  onClick={isAuthExpired ? reconnectGoogle : triggerManualSync}
                  disabled={syncing || !isOnline}
                  className="flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50/90 hover:bg-indigo-100/80 px-2.5 py-1 rounded-xl transition shadow-xs text-xs"
                >
                  <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{isAuthExpired ? 'Reconnect' : 'Sync Now'}</span>
                </button>
              </div>
            </div>

            {/* Analogue Neumorphic Timer Widget (Inspired by Mockup Image Clock) */}
            <div className="bg-slate-50/90 rounded-3xl p-5 border border-slate-200/60 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.9),_4px_4px_8px_rgba(163,177,198,0.3)] flex flex-col items-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Timer className="w-4 h-4 text-slate-500" />
                Focus Accountability Clock
              </h3>

              {/* Neumorphic Clock Base */}
              <div className="relative w-48 h-48 rounded-full bg-slate-50 border border-slate-200/50 shadow-[inset_-6px_-6px_12px_rgba(255,255,255,0.9),_6px_6px_12px_rgba(163,177,198,0.35)] flex items-center justify-center mb-5">
                
                {/* Dial increments (Minimal dashes) */}
                <div className="absolute inset-2 border-2 border-dashed border-slate-200/40 rounded-full pointer-events-none" />

                {/* Clock hands matching actual time (Very faint background detail) */}
                <div
                  className="absolute w-1 h-14 bg-slate-300 origin-bottom rounded-full transition-transform duration-1000"
                  style={{
                    transform: `rotate(${hrsAngle}deg)`,
                    bottom: '50%',
                  }}
                />
                <div
                  className="absolute w-0.5 h-18 bg-slate-200 origin-bottom rounded-full transition-transform duration-1000"
                  style={{
                    transform: `rotate(${minsAngle}deg)`,
                    bottom: '50%',
                  }}
                />

                {/* Digital overlay text & time remaining */}
                <div className="z-10 text-center flex flex-col items-center">
                  <p className="text-2xl font-black text-slate-800 tracking-tight font-mono">{formatTime(timerSeconds)}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    {timerActive ? 'FOCUS ACTIVE' : 'TIMED DEBT RESET'}
                  </p>
                </div>

                {/* Dial Center Pin */}
                <div className="absolute w-3.5 h-3.5 bg-slate-50 border-2 border-indigo-400 rounded-full shadow-md shadow-indigo-100" />
              </div>

              {/* Focus Task Picker Form */}
              <div className="w-full mb-4">
                <input
                  type="text"
                  placeholder="What task are you earning money for?"
                  value={focusTask}
                  onChange={(e) => setFocusTask(e.target.value)}
                  className="w-full text-center text-xs font-semibold px-3 py-2 bg-slate-100 border border-slate-200/50 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 shadow-inner text-slate-700 placeholder-slate-400"
                />
              </div>

              {/* Preset Selection & Timer Controls */}
              <div className="flex flex-col gap-3.5 w-full">
                <div className="flex justify-center gap-2">
                  {[10, 25, 50].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => handleTimerConfig(mins)}
                      className={`px-3.5 py-1.5 rounded-xl border text-xs font-extrabold shadow-sm transition ${
                        selectedTimerMinutes === mins
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>

                <div className="flex gap-2.5">
                  <button
                    onClick={handleTimerStartStop}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-2xl text-xs font-bold text-white shadow-md transition ${
                      timerActive
                        ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-100'
                        : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100'
                    }`}
                  >
                    {timerActive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {timerActive ? 'Pause' : 'Start Focus Work'}
                  </button>

                  <button
                    onClick={handleTimerReset}
                    className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Accountability Balance Card */}
            <div className="bg-slate-50/90 rounded-3xl p-5 border border-slate-200/60 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.9),_4px_4px_8px_rgba(163,177,198,0.3)] flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-slate-400" />
                Accountability Balance
              </h3>

              <div className="grid grid-cols-2 gap-3 mt-1.5">
                {/* Left: Total Spending */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-[inset_-2px_-2px_4px_rgba(255,255,255,0.8),_2px_2px_4px_rgba(163,177,198,0.15)]">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Total Spent</p>
                  <p className="text-lg font-black text-slate-800 leading-none mt-1.5">{totalExpended.toLocaleString()} RS</p>
                  <p className="text-[10px] font-semibold text-indigo-500 mt-1 leading-none">{totalWorkRequired.toFixed(1)} hrs debt</p>
                </div>

                {/* Right: Remaining Work Debt */}
                <div className={`p-3 rounded-2xl border border-slate-100 shadow-[inset_-2px_-2px_4px_rgba(255,255,255,0.8),_2px_2px_4px_rgba(163,177,198,0.15)] ${
                  isDebtFree ? 'bg-emerald-50/40 border-emerald-100' : 'bg-rose-50/40 border-rose-100'
                }`}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Pending Labor</p>
                  <p className={`text-lg font-black leading-none mt-1.5 ${isDebtFree ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isDebtFree ? '0.0 hrs' : `${remainingWorkDebt.toFixed(1)} hrs`}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-1 leading-none">
                    {isDebtFree ? 'Discipline Level: Max' : 'Must study / work off'}
                  </p>
                </div>
              </div>

              {/* Motivation quote / Progress visual indicator */}
              <div className="mt-2 text-xs font-bold bg-white/75 p-3 rounded-2xl text-slate-500 flex items-center gap-2 border border-slate-100">
                <CloudLightning className="w-4 h-4 text-yellow-500 flex-shrink-0 animate-bounce" />
                <p>
                  {isDebtFree
                    ? 'Amazing! You are lazy-free! Keep doing tasks to accumulate work credit.'
                    : `Every 1,000 RS spent costs ${ratio.requiredHours} hours of focus. Study hard!`}
                </p>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: EXPENSE SUBMISSION & DEBT LOG VIEW */}
        {activeTab === 'expense' && (
          <>
            <div className="bg-slate-50/90 rounded-3xl p-5 border border-slate-200/60 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.9),_4px_4px_8px_rgba(163,177,198,0.3)] flex flex-col gap-4">
              <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
                <Coins className="w-5 h-5 text-indigo-500" />
                Add Expense & Task Debt
              </h2>

              <form onSubmit={handleExpenseSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Amount (RS)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 500"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner font-extrabold text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-semibold text-slate-700"
                    >
                      <option value="Leisure">Leisure / Fun</option>
                      <option value="Food">Food / Dining</option>
                      <option value="Shopping">Shopping</option>
                      <option value="Travel">Travel / Taxi</option>
                      <option value="Subscriptions">Subscriptions</option>
                      <option value="Other">Other Category</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date</label>
                    <input
                      type="date"
                      required
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-semibold text-slate-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Associated Discipline Task</label>
                  <textarea
                    required
                    placeholder="What specific STUDY/WORK task will you do to earn this money back? (e.g. read 2 chapters, solve 10 math challenges)"
                    rows={2}
                    value={expenseTask}
                    onChange={(e) => setExpenseTask(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner text-sm font-semibold text-slate-700 placeholder-slate-400"
                  />
                </div>

                {expenseAmount && !isNaN(parseFloat(expenseAmount)) && (
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs font-bold text-indigo-700 flex items-center justify-between">
                    <span>Task Quota Required:</span>
                    <span className="text-sm font-black underline decoration-2 underline-offset-2">
                      {((parseFloat(expenseAmount) / ratio.baseAmount) * ratio.requiredHours).toFixed(2)} Hours
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-100 transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Log Expense Debt
                </button>
              </form>
            </div>

            {/* Chronological ledger items */}
            <div className="bg-slate-50/90 rounded-3xl p-5 border border-slate-200/60 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.9),_4px_4px_8px_rgba(163,177,198,0.3)] flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                <h3 className="text-sm font-black text-slate-800 tracking-tight">Recent Spending Debt</h3>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2.5 py-0.5 rounded-full">
                  {expenses.length} Records
                </span>
              </div>

              <div className="flex flex-col gap-3.5 max-h-72 overflow-y-auto pr-1">
                {expenses.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                    No expense debts logged yet. You are completely debt-free!
                  </div>
                ) : (
                  expenses.map((exp) => {
                    const reqHrs = (exp.amount / ratio.baseAmount) * ratio.requiredHours;
                    return (
                      <div
                        key={exp.id}
                        className="p-3 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition flex items-start gap-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-extrabold text-sm flex-shrink-0">
                          {exp.amount}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-xs font-black text-slate-800 truncate">{exp.category}</h4>
                            <span className="text-[9px] font-extrabold text-indigo-500 bg-indigo-50/70 px-2 py-0.5 rounded-full shrink-0">
                              +{reqHrs.toFixed(1)} hrs
                            </span>
                          </div>
                          <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-2">{exp.taskToEarn}</p>
                          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[9px] text-slate-400 font-bold">
                            <span>{exp.date}</span>
                            <div className="flex items-center gap-2">
                              {exp.synced ? (
                                <span className="text-emerald-500">Cloud Synced</span>
                              ) : (
                                <span className="text-amber-500">Local Only</span>
                              )}
                              <button
                                onClick={() => deleteExpense(exp.id)}
                                className="text-slate-400 hover:text-rose-500 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {/* TAB 3: WORK SESSIONS LOG VIEW */}
        {activeTab === 'work' && (
          <>
            <div className="bg-slate-50/90 rounded-3xl p-5 border border-slate-200/60 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.9),_4px_4px_8px_rgba(163,177,198,0.3)] flex flex-col gap-4">
              <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
                <Briefcase className="w-5 h-5 text-indigo-500" />
                Log Completed Work Hours
              </h2>

              <form onSubmit={handleWorkSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Hours Done</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="e.g. 1.5"
                      value={workHours}
                      onChange={(e) => setWorkHours(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner font-extrabold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date</label>
                    <input
                      type="date"
                      required
                      value={workDate}
                      onChange={(e) => setWorkDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-semibold text-slate-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Core Task Description</label>
                  <input
                    type="text"
                    required
                    placeholder="What specific work did you do? (e.g. study calculus)"
                    value={workTask}
                    onChange={(e) => setWorkTask(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner text-sm font-semibold text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Work Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="Extra details about your study session..."
                    value={workDesc}
                    onChange={(e) => setWorkDesc(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner text-xs font-semibold text-slate-600"
                  />
                </div>

                {workHours && !isNaN(parseFloat(workHours)) && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs font-bold text-emerald-700 flex items-center justify-between">
                    <span>RPG Experience Earned:</span>
                    <span className="text-sm font-black">+{Math.round(parseFloat(workHours) * 100)} XP</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-100 transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Log Task Completion
                </button>
              </form>
            </div>

            {/* Chronological work ledger items */}
            <div className="bg-slate-50/90 rounded-3xl p-5 border border-slate-200/60 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.9),_4px_4px_8px_rgba(163,177,198,0.3)] flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                <h3 className="text-sm font-black text-slate-800 tracking-tight">Recent Study/Work Logs</h3>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2.5 py-0.5 rounded-full">
                  {workSessions.length} Logs
                </span>
              </div>

              <div className="flex flex-col gap-3.5 max-h-72 overflow-y-auto pr-1">
                {workSessions.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                    No study/work records logged yet. Begin a focus timer session or log hours above!
                  </div>
                ) : (
                  workSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-3 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition flex items-start gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-extrabold text-xs flex-shrink-0">
                        {session.hours} hrs
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-black text-slate-800 truncate">{session.task}</h4>
                          <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50/70 px-2 py-0.5 rounded-full shrink-0">
                            +{Math.round(session.hours * 100)} XP
                          </span>
                        </div>
                        {session.description && (
                          <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-1">{session.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[9px] text-slate-400 font-bold">
                          <span>{session.date}</span>
                          <div className="flex items-center gap-2">
                            {session.synced ? (
                              <span className="text-emerald-500">Cloud Synced</span>
                            ) : (
                              <span className="text-amber-500">Local Only</span>
                            )}
                            <button
                              onClick={() => deleteWorkSession(session.id)}
                              className="text-slate-400 hover:text-rose-500 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* TAB 4: RPG LEVEL STATUS & BADGES */}
        {activeTab === 'rpg' && (
          <>
            {/* Complete RPG Status Widget */}
            <div className="bg-slate-50/90 rounded-3xl p-5 border border-slate-200/60 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.9),_4px_4px_8px_rgba(163,177,198,0.3)] flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center border-2 border-indigo-200 shadow-md">
                <Crown className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">Accountability Hero Profile</h2>
                <p className="text-xs font-bold text-indigo-500 mt-0.5">Rank: {getRankName(rpg.level)} (Level {rpg.level})</p>
              </div>

              {/* Progress Detail */}
              <div className="w-full mt-2 bg-slate-100 p-3.5 rounded-2xl border border-slate-200/40 text-left">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-1">
                  <span>EXP Progress to next Rank:</span>
                  <span>{rpg.xp} / {xpNeeded} XP</span>
                </div>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden p-0.5">
                  <div className="h-full rounded-full bg-indigo-600" style={{ width: `${xpPercent}%` }} />
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-2">
                  <span>Level {rpg.level}</span>
                  <span>Level {rpg.level + 1}</span>
                </div>
              </div>

              {/* Quick stats for character profile */}
              <div className="grid grid-cols-3 gap-2.5 w-full mt-2">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/40">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Focus Streak</p>
                  <p className="text-sm font-black text-slate-800 mt-1">{rpg.streakCount} days</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/40">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Labor Done</p>
                  <p className="text-sm font-black text-emerald-600 mt-1">{totalWorkCompleted.toFixed(1)} hrs</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/40">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Badges</p>
                  <p className="text-sm font-black text-indigo-600 mt-1">{rpg.unlockedBadges.length} / {BADGES_LIST.length}</p>
                </div>
              </div>
            </div>

            {/* Badges Showcase Showcase */}
            <div className="bg-slate-50/90 rounded-3xl p-5 border border-slate-200/60 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.9),_4px_4px_8px_rgba(163,177,198,0.3)] flex flex-col gap-4">
              <h3 className="text-sm font-black text-slate-800 border-b border-slate-200/50 pb-2 flex items-center gap-1.5">
                <Award className="w-5 h-5 text-indigo-500" />
                Self-Discipline Milestones
              </h3>

              <div className="grid grid-cols-2 gap-3.5">
                {BADGES_LIST.map((badge) => {
                  const isUnlocked = rpg.unlockedBadges.includes(badge.id);
                  return (
                    <div
                      key={badge.id}
                      className={`p-3.5 rounded-2xl border text-center flex flex-col items-center gap-2 transition-all shadow-sm ${
                        isUnlocked
                          ? 'bg-white border-indigo-100 shadow-indigo-50/50 ring-1 ring-indigo-50'
                          : 'bg-slate-100/50 border-slate-200/60 opacity-60'
                      }`}
                    >
                      <div className={`p-2.5 rounded-xl ${isUnlocked ? 'bg-indigo-50/80' : 'bg-slate-200'}`}>
                        {isUnlocked ? renderBadgeIcon(badge.icon) : <Award className="w-6 h-6 text-slate-400" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800 leading-tight">{badge.title}</h4>
                        <p className="text-[9px] font-semibold text-slate-400 leading-tight mt-1">{badge.description}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        isUnlocked ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {isUnlocked ? 'Active' : 'Locked'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* TAB 5: SETTINGS & ACCOUNTABILITY MATH VIEW */}
        {activeTab === 'settings' && (
          <>
            {/* Customizable Ratio & Budget form */}
            <div className="bg-slate-50/90 rounded-3xl p-5 border border-slate-200/60 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.9),_4px_4px_8px_rgba(163,177,198,0.3)] flex flex-col gap-4">
              <h2 className="text-base font-black text-slate-800 border-b border-slate-200/50 pb-2 flex items-center gap-1.5">
                <Settings className="w-5 h-5 text-slate-500" />
                Customize Accountability Rules
              </h2>

              <form onSubmit={saveSettings} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    For Every (RS Expenditure)
                  </label>
                  <input
                    type="number"
                    required
                    value={ratioBase}
                    onChange={(e) => setRatioBase(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner font-extrabold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    I Need To Do (Study / Task Hours)
                  </label>
                  <input
                    type="number"
                    required
                    step="0.5"
                    value={ratioHours}
                    onChange={(e) => setRatioHours(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner font-extrabold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Daily Spending Alert Limit (RS)
                  </label>
                  <input
                    type="number"
                    required
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner font-extrabold text-slate-800"
                  />
                </div>

                <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600">
                  Current Ratio: {ratio.requiredHours} Focus Hours per {ratio.baseAmount} RS Spent.
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition"
                >
                  Save Rules & Limits
                </button>
              </form>
            </div>

            {/* Google Sheets Spreadsheet Ledger Direct Integration details */}
            <div className="bg-slate-50/90 rounded-3xl p-5 border border-slate-200/60 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.9),_4px_4px_8px_rgba(163,177,198,0.3)] flex flex-col gap-3.5">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                Google Drive Synchronization
              </h3>

              <div className="text-xs text-slate-500 font-semibold flex flex-col gap-2">
                <p>
                  WorkBack stores all your transaction and work records in a single unified ledger sheet in Google Drive. This allows complete real-time tracking from any device!
                </p>
                {spreadsheetId ? (
                  <div className="mt-2.5 flex flex-col gap-2">
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-900 font-bold break-all flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">Spreadsheet ID:</span>
                      <span className="text-[11px] font-mono leading-relaxed">{spreadsheetId}</span>
                    </div>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-center py-2 px-4 rounded-2xl border border-indigo-200 text-indigo-600 font-extrabold text-xs bg-white hover:bg-indigo-50 transition shadow-sm"
                    >
                      Open Google Sheets Ledger
                    </a>
                  </div>
                ) : (
                  <p className="p-3 rounded-2xl bg-amber-50 text-amber-900 border border-amber-100 font-bold mt-1">
                    Connect your Google Account at the top of the screen to enable real-time Drive backing.
                  </p>
                )}

                {/* Direct Sheet Linker Input */}
                <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Link Specific Google Sheet (ID or URL)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste Google Sheet URL or ID..."
                      value={manualSheetInput}
                      onChange={(e) => setManualSheetInput(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (manualSheetInput.trim()) {
                          manuallySetSpreadsheetId(manualSheetInput.trim());
                          setManualSheetInput('');
                        }
                      }}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition shrink-0"
                    >
                      Connect
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Tip: If you opened WorkBack on a new laptop, copy the Google Sheet link or ID from your phone or Drive to sync both devices to the exact same ledger instantly!
                  </p>
                </div>
              </div>
            </div>

            {/* PWA Installer Option */}
            <div className="bg-slate-50/90 rounded-3xl p-5 border border-slate-200/60 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.9),_4px_4px_8px_rgba(163,177,198,0.3)] flex flex-col gap-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <CloudLightning className="w-5 h-5 text-indigo-500 animate-bounce" />
                Install WorkBack App
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Add WorkBack to your mobile home screen as a full Progressive Web App. Runs offline instantly and keeps tabs on your discipline.
              </p>
              {isInstalled ? (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl text-xs font-bold text-center">
                  WorkBack is already installed and running in Standalone mode!
                </div>
              ) : (
                <button
                  onClick={handleInstallClick}
                  className="w-full py-2.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Install App / Add To Home
                </button>
              )}
            </div>

            {/* Developer controls / local reset */}
            <div className="bg-slate-50/90 rounded-3xl p-5 border border-slate-200/60 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.9),_4px_4px_8px_rgba(163,177,198,0.3)] flex flex-col gap-3">
              <h3 className="text-sm font-black text-slate-800">Local Workspace Settings</h3>
              <button
                onClick={clearLedgerLocal}
                className="w-full py-2.5 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-extrabold text-xs transition"
              >
                Clear Local Workspace Data
              </button>
            </div>
          </>
        )}
      </main>

      {/* iOS Safari PWA Prompt Modal */}
      {showIOSPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 flex flex-col gap-4 animate-[scaleUp_0.25s_ease-out]">
            <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
              Install on iPhone / iPad
            </h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Apple Safari does not support automated install prompts. To add this discipline tracker to your device:
            </p>
            <div className="text-xs font-bold text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-2.5">
              <p className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">1</span>
                Tap the <span className="underline decoration-indigo-400">Share</span> button in Safari toolbar.
              </p>
              <p className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">2</span>
                Scroll down and tap <span className="underline decoration-indigo-400">Add to Home Screen</span>.
              </p>
            </div>
            <button
              onClick={() => setShowIOSPrompt(false)}
              className="w-full py-2.5 rounded-2xl bg-slate-900 text-white font-extrabold text-xs shadow-md transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Elegant Bottom Tab Navigator */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-50/90 backdrop-blur-md border-t border-slate-200/50 py-2.5 px-4 flex items-center justify-around shadow-[0_-4px_12px_rgba(15,23,42,0.03)]">
        {[
          { id: 'home', label: 'Dashboard', icon: Crown },
          { id: 'expense', label: 'Spent Debt', icon: Coins },
          { id: 'work', label: 'Labor Log', icon: Briefcase },
          { id: 'rpg', label: 'Badges', icon: Award },
          { id: 'settings', label: 'Rules', icon: Settings }
        ].map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex flex-col items-center gap-1 transition relative px-3 py-1 rounded-2xl"
            >
              <div className={`p-1.5 rounded-xl transition ${
                isActive ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-400 hover:text-slate-600'
              }`}>
                <IconComponent className="w-5 h-5" />
              </div>
              <span className={`text-[9px] font-extrabold ${isActive ? 'text-indigo-600 font-black' : 'text-slate-400'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-1.5 h-1.5 bg-indigo-600 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
