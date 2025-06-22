import { useState, useEffect, useRef, useCallback, useReducer } from "react";
import toast, { Toaster } from "react-hot-toast";
import type { FC } from "react";

interface SessionLog {
  id: string;
  type: "Work" | "Break";
  duration: string;
  time: string;
}

interface TimerState {
  secondsLeft: number;
  isRunning: boolean;
  isBreak: boolean;
  message: string;
  workSessions: number;
  breakSessions: number;
  sessionLog: SessionLog[];
}

type TimerAction =
  | { type: "TICK" }
  | {
      type: "PHASE_TRANSITION";
      workMinutes: number;
      breakMinutes: number;
      autoStart: boolean;
    }
  | { type: "TOGGLE_TIMER"; isBreak: boolean }
  | { type: "STOP" }
  | { type: "RESET"; workMinutes: number }
  | { type: "RESET_HISTORY" }
  | {
      type: "INIT_STATE";
      workSessions: number;
      breakSessions: number;
      sessionLog: SessionLog[];
    };

const timerReducer = (state: TimerState, action: TimerAction): TimerState => {
  switch (action.type) {
    case "TICK":
      return {
        ...state,
        secondsLeft: state.secondsLeft > 0 ? state.secondsLeft - 1 : 0,
      };
    case "PHASE_TRANSITION": {
      const currentPhase = state.isBreak ? "Break" : "Work";
      const nextPhase = !state.isBreak;
      const newSecondsLeft =
        (nextPhase ? action.breakMinutes : action.workMinutes) * 60;
      return {
        ...state,
        secondsLeft: newSecondsLeft,
        isBreak: nextPhase,
        isRunning: nextPhase ? true : action.autoStart,
        message: nextPhase ? "Break time! 🎉" : "Back to work! 💪",
        workSessions:
          currentPhase === "Work" ? state.workSessions + 1 : state.workSessions,
        breakSessions:
          currentPhase === "Break"
            ? state.breakSessions + 1
            : state.breakSessions,
        sessionLog: [
          {
            id: `${Date.now()}-${Math.random()}`,
            type: currentPhase,
            duration: formatTime(
              state.isBreak ? action.breakMinutes * 60 : action.workMinutes * 60
            ),
            time: new Date().toLocaleTimeString("en-US", {
              hour12: true,
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
          ...state.sessionLog.slice(0, 49),
        ],
      };
    }
    case "TOGGLE_TIMER":
      return {
        ...state,
        isRunning: !state.isRunning,
        message: action.isBreak ? "Break time! ☕" : "Focus time! 🧠",
      };
    case "STOP":
      return { ...state, isRunning: false };
    case "RESET":
      return {
        ...state,
        isRunning: false,
        isBreak: false,
        secondsLeft: action.workMinutes * 60,
        message: "Focus time! 🧠",
      };
    case "RESET_HISTORY":
      return { ...state, sessionLog: [], workSessions: 0, breakSessions: 0 };
    case "INIT_STATE":
      return {
        ...state,
        workSessions: action.workSessions,
        breakSessions: action.breakSessions,
        sessionLog: action.sessionLog,
      };
    default:
      return state;
  }
};

const getLocalStorage = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      console.log(
        `localStorage key "${key}" not found, using fallback:`,
        fallback
      );
      return fallback;
    }
    const parsed = JSON.parse(item);
    if (key === "sessionLog") {
      if (
        !Array.isArray(parsed) ||
        !parsed.every(
          (entry: any) =>
            entry &&
            typeof entry.id === "string" &&
            ["Work", "Break"].includes(entry.type) &&
            typeof entry.duration === "string" &&
            typeof entry.time === "string"
        )
      ) {
        console.warn(`Invalid sessionLog in localStorage, using fallback: []`);
        return fallback;
      }
    }
    console.log(`Loaded ${key} from localStorage:`, parsed);
    return parsed;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return fallback;
  }
};

const setLocalStorage = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    console.log(`Saved ${key} to localStorage:`, value);
  } catch (error) {
    console.error(`Error writing to localStorage key "${key}":`, error);
    toast.error(`Failed to save ${key} to storage. Check browser settings.`, {
      duration: 3000,
    });
  }
};

const formatTime = (totalSeconds: number): string => {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
};

const Timer: FC = () => {
  const [workMinutes, setWorkMinutes] = useState<number>(25);
  const [breakMinutes, setBreakMinutes] = useState<number>(5);
  const [workInput, setWorkInput] = useState<string>("25");
  const [breakInput, setBreakInput] = useState<string>("5");
  const [autoStart, setAutoStart] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [state, dispatch] = useReducer(timerReducer, {
    secondsLeft: 25 * 60,
    isRunning: false,
    isBreak: false,
    message: "Focus time! 🧠",
    workSessions: 0,
    breakSessions: 0,
    sessionLog: [],
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const workAudioRef = useRef<HTMLAudioElement>(null);
  const breakAudioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isLoggingRef = useRef<boolean>(false);
  const transitionRef = useRef<boolean>(false);

  const totalTime = state.isBreak ? breakMinutes * 60 : workMinutes * 60;
  const progress = ((totalTime - state.secondsLeft) / totalTime) * 100;

  // Initialize from localStorage
  useEffect(() => {
    console.log("Initializing from localStorage");
    const work = getLocalStorage("workMinutes", 25);
    const brk = getLocalStorage("breakMinutes", 5);
    const auto = getLocalStorage("autoStart", false);
    const workS = getLocalStorage("workSessions", 0);
    const breakS = getLocalStorage("breakSessions", 0);
    const log = getLocalStorage("sessionLog", []);
    setWorkMinutes(work);
    setBreakMinutes(brk);
    setWorkInput(String(work));
    setBreakInput(String(brk));
    setAutoStart(auto);
    dispatch({ type: "RESET", workMinutes: work });
    dispatch({
      type: "INIT_STATE",
      workSessions: workS,
      breakSessions: breakS,
      sessionLog: log,
    });
  }, []);

  // Persist all state to localStorage
  useEffect(() => {
    setLocalStorage("workMinutes", workMinutes);
    setLocalStorage("breakMinutes", breakMinutes);
    setLocalStorage("autoStart", autoStart);
    setLocalStorage("workSessions", state.workSessions);
    setLocalStorage("breakSessions", state.breakSessions);
    setLocalStorage("sessionLog", state.sessionLog);
  }, [
    workMinutes,
    breakMinutes,
    autoStart,
    state.workSessions,
    state.breakSessions,
    state.sessionLog,
  ]);

  // Theme initialization
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    console.log("Initializing theme from localStorage:", storedTheme);
    let initialTheme: "light" | "dark" = "light";

    if (storedTheme === "dark" || storedTheme === "light") {
      initialTheme = storedTheme;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      initialTheme = "dark";
    }

    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    setLocalStorage("theme", initialTheme);
    console.log("Applied theme:", initialTheme);
  }, []);

  // Sync theme changes to document
  useEffect(() => {
    console.log("Syncing theme to document:", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    setLocalStorage("theme", theme);
  }, [theme]);

  // Timer countdown logic
  useEffect(() => {
    console.log("Countdown useEffect triggered", {
      isRunning: state.isRunning,
      secondsLeft: state.secondsLeft,
    });
    if (state.isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        dispatch({ type: "TICK" });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.isRunning]);

  // Handle phase transition with fade animation and immediate save
  useEffect(() => {
    if (state.secondsLeft <= 0 && state.isRunning && !isLoggingRef.current) {
      console.log("Phase transition triggered", { state });
      isLoggingRef.current = true;
      transitionRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);

      const audio = state.isBreak
        ? breakAudioRef.current
        : workAudioRef.current;
      audio?.play().catch((error) => {
        console.error(
          `Error playing ${state.isBreak ? "break" : "work"} end sound:`,
          error
        );
        toast.error(
          "Sound playback failed. Please ensure audio files are in public/sounds/.",
          { duration: 3000 }
        );
      });

      dispatch({
        type: "PHASE_TRANSITION",
        workMinutes,
        breakMinutes,
        autoStart,
      });

      // Save to localStorage immediately after phase transition
      setLocalStorage(
        "workSessions",
        state.workSessions + (state.isBreak ? 0 : 1)
      );
      setLocalStorage(
        "breakSessions",
        state.breakSessions + (state.isBreak ? 1 : 0)
      );
      setLocalStorage("sessionLog", [
        {
          id: `${Date.now()}-${Math.random()}`,
          type: state.isBreak ? "Break" : "Work",
          duration: formatTime(
            state.isBreak ? breakMinutes * 60 : workMinutes * 60
          ),
          time: new Date().toLocaleTimeString("en-US", {
            hour12: true,
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
        ...state.sessionLog.slice(0, 49),
      ]);

      // Restart timer immediately if next phase is running
      if (!state.isBreak || (state.isBreak && autoStart)) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          dispatch({ type: "TICK" });
        }, 1000);
      }

      // Reset transition flag after animation
      setTimeout(() => {
        transitionRef.current = false;
      }, 300);

      isLoggingRef.current = false;
    }
  }, [
    state.secondsLeft,
    state.isRunning,
    workMinutes,
    breakMinutes,
    autoStart,
    state.isBreak,
    state.workSessions,
    state.breakSessions,
    state.sessionLog,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        toggleTimer();
      } else if (e.code === "KeyR") {
        resetTimer();
      } else if (e.code === "KeyS") {
        stopTimer();
      } else if (e.code === "KeyF") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const toggleTimer = useCallback(() => {
    if (!state.isRunning) {
      workAudioRef.current
        ?.play()
        .then(() => workAudioRef.current?.pause())
        .catch((error) => console.error("Work audio unlock failed:", error));
      breakAudioRef.current
        ?.play()
        .then(() => breakAudioRef.current?.pause())
        .catch((error) => console.error("Break audio unlock failed:", error));
    }
    dispatch({ type: "TOGGLE_TIMER", isBreak: state.isBreak });
  }, [state.isBreak]);

  const stopTimer = useCallback(() => {
    dispatch({ type: "STOP" });
  }, []);

  const resetTimer = useCallback(() => {
    dispatch({ type: "RESET", workMinutes });
  }, [workMinutes]);

  const toggleDarkMode = useCallback(() => {
    console.log("Toggling theme from:", theme);
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    setIsMenuOpen(false);
    console.log("New theme:", newTheme);
  }, [theme]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
    setIsMenuOpen(false);
  }, []);

  const handleWorkInputBlur = () => {
    const val = Math.max(1, parseInt(workInput) || 1);
    setWorkMinutes(val);
    setWorkInput(String(val));
    if (!state.isBreak && !state.isRunning)
      dispatch({ type: "RESET", workMinutes: val });
  };

  const handleBreakInputBlur = () => {
    const val = Math.max(1, parseInt(breakInput) || 1);
    setBreakMinutes(val);
    setBreakInput(String(val));
    if (state.isBreak && !state.isRunning)
      dispatch({ type: "RESET", workMinutes });
  };

  const openResetHistoryModal = () => {
    setIsModalOpen(true);
    setIsMenuOpen(false);
  };

  const closeResetHistoryModal = () => {
    setIsModalOpen(false);
  };

  const confirmResetHistory = () => {
    console.log("Resetting history");
    dispatch({ type: "RESET_HISTORY" });
    setLocalStorage("workSessions", 0);
    setLocalStorage("breakSessions", 0);
    setLocalStorage("sessionLog", []);
    toast.success("History reset!", { duration: 2000 });
    setIsModalOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col p-4 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-gray-800 dark:text-gray-100 font-sans transition-colors duration-300 ${
        transitionRef.current
          ? "opacity-50 transition-opacity duration-300"
          : "opacity-100"
      }`}
    >
      <Toaster />
      <div className="w-full max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 space-y-4">
        {/* Header with dropdown menu */}
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {state.message}
          </h1>
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {isMenuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10"
              >
                <button
                  onClick={toggleDarkMode}
                  className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                  {theme === "dark" ? "Light Theme" : "Dark Theme"}
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                </button>
                <button
                  onClick={openResetHistoryModal}
                  className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Clear History
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Timer Circle */}
        <div
          className="relative w-40 h-40 mx-auto"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle
              className="text-gray-200 dark:text-gray-700"
              strokeWidth="8"
              stroke="currentColor"
              fill="transparent"
              r="46"
              cx="50"
              cy="50"
            />
            <circle
              className="text-green-500"
              strokeWidth="8"
              stroke="currentColor"
              strokeLinecap="round"
              fill="transparent"
              r="46"
              cx="50"
              cy="50"
              style={{
                strokeDasharray: 289,
                strokeDashoffset: 289 - (progress / 100) * 289,
                transition: "stroke-dashoffset 0.3s ease-in-out",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-mono font-semibold">
              {formatTime(state.secondsLeft)}
            </span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex justify-center gap-2">
          <button
            onClick={toggleTimer}
            className={`p-3 rounded-full text-white font-medium transition-all ${
              state.isRunning
                ? "bg-yellow-500 hover:bg-yellow-600"
                : "bg-green-600 hover:bg-green-700"
            }`}
            aria-label={state.isRunning ? "Pause timer" : "Start timer"}
          >
            {state.isRunning ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
          </button>
          <button
            onClick={stopTimer}
            className="p-3 rounded-full bg-gray-500 hover:bg-gray-600 text-white"
            aria-label="Stop timer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
              />
            </svg>
          </button>
          <button
            onClick={resetTimer}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white"
            aria-label="Reset timer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {/* Duration Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              Work (min)
            </span>
            <input
              type={state.isRunning ? "text" : "number"}
              min="1"
              value={workInput}
              onChange={(e) => setWorkInput(e.target.value)}
              onBlur={handleWorkInputBlur}
              className="p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={state.isRunning}
              aria-label="Work duration in minutes"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Break (min)
            </span>
            <input
              type={state.isRunning ? "text" : "number"}
              min="1"
              value={breakInput}
              onChange={(e) => setBreakInput(e.target.value)}
              onBlur={handleBreakInputBlur}
              className="p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={state.isRunning}
              aria-label="Break duration in minutes"
            />
          </label>
        </div>

        {/* Auto-start */}
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
              aria-label="Auto-start next session"
            />
            <span className="text-sm">Auto-start next session</span>
          </label>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Work</div>
              <div className="font-bold">{state.workSessions}</div>
            </div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Breaks</div>
              <div className="font-bold">{state.breakSessions}</div>
            </div>
          </div>
        </div>

        {/* Session History */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 max-h-40 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              History
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {state.sessionLog.length} sessions
            </span>
          </div>
          {state.sessionLog.length === 0 ? (
            <p className="text-sm text-gray-500 italic text-center py-2">
              No sessions yet
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {state.sessionLog.slice(0, 5).map((entry) => (
                <li
                  key={entry.id}
                  className="flex justify-between items-center p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                >
                  <div className="flex items-center gap-2">
                    {entry.type === "Work" ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-green-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-blue-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    )}
                    <span className="text-xs">{entry.time}</span>
                  </div>
                  <span className="text-xs font-medium">{entry.duration}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Keyboard Shortcuts */}
        <div className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <p className="font-medium mb-1">Keyboard Shortcuts:</p>
          <div className="grid grid-cols-2 gap-1">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                Space
              </kbd>
              <span>Start/Pause</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                R
              </kbd>
              <span>Reset</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                S
              </kbd>
              <span>Stop</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                F
              </kbd>
              <span>Fullscreen</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reset History Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
              Clear Session History
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to clear all session history? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={closeResetHistoryModal}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmResetHistory}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}

      <audio ref={workAudioRef} src="/sounds/notification.mp3" preload="auto" />
      <audio ref={breakAudioRef} src="/sounds/chime.mp3" preload="auto" />
    </div>
  );
};

export default Timer;