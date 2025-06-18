import { useState, useEffect, useRef } from 'react'

function Timer() {
  const [workMinutes, setWorkMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)

  const [secondsLeft, setSecondsLeft] = useState(workMinutes * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isBreak, setIsBreak] = useState(false)
  const [message, setMessage] = useState('Focus time!')
  const [workSessions, setWorkSessions] = useState(0)
  const [breakSessions, setBreakSessions] = useState(0)

  const timerRef = useRef(null)

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev === 1) {
            clearInterval(timerRef.current)
            const nextPhase = !isBreak
            setIsBreak(nextPhase)
            setIsRunning(false)
            setMessage(nextPhase ? 'Break time! 🎉' : 'Back to work! 💪')
            nextPhase
              ? setBreakSessions((b) => b + 1)
              : setWorkSessions((w) => w + 1)
            setSecondsLeft((nextPhase ? breakMinutes : workMinutes) * 60)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => clearInterval(timerRef.current)
  }, [isRunning, isBreak, breakMinutes, workMinutes])

  const toggleTimer = () => {
    setIsRunning(!isRunning)
    setMessage(isBreak ? 'Break time!' : 'Focus time!')
  }

  const resetTimer = () => {
    clearInterval(timerRef.current)
    setIsRunning(false)
    setIsBreak(false)
    setSecondsLeft(workMinutes * 60)
    setMessage('Focus time!')
  }

  const formatTime = (totalSeconds) => {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
    const s = String(totalSeconds % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  const handleDurationChange = (type, value) => {
    const val = Math.max(1, Number(value))
    if (type === 'work') {
      setWorkMinutes(val)
      if (!isBreak) setSecondsLeft(val * 60)
    } else {
      setBreakMinutes(val)
      if (isBreak) setSecondsLeft(val * 60)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 h-screen bg-white text-center max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-2">{message}</h1>

      <div className="text-6xl font-bold text-blue-600 mb-4">
        {formatTime(secondsLeft)}
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={toggleTimer}
          className={`px-6 py-2 rounded text-white ${isRunning ? 'bg-yellow-500' : 'bg-green-500'} hover:opacity-90`}
        >
          {isRunning ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={resetTimer}
          className="px-6 py-2 rounded bg-red-500 text-white hover:opacity-90"
        >
          Reset
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          type="number"
          min="1"
          value={workMinutes}
          onChange={(e) => handleDurationChange('work', e.target.value)}
          className="w-20 p-1 border rounded"
        />
        <label>Work (min)</label>

        <input
          type="number"
          min="1"
          value={breakMinutes}
          onChange={(e) => handleDurationChange('break', e.target.value)}
          className="w-20 p-1 border rounded"
        />
        <label>Break (min)</label>
      </div>

      <div className="text-sm text-gray-600 mt-4">
        ✅ Work Sessions: <strong>{workSessions}</strong> <br />
        ☕ Breaks Taken: <strong>{breakSessions}</strong>
      </div>
    </div>
  )
}

export default Timer
