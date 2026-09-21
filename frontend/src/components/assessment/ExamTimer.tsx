import React, { useEffect, useState } from 'react';

interface ExamTimerProps {
  startedAt: string;
  timeLimitMinutes: number | null;
  onTimeExpired: () => void;
}

export const ExamTimer: React.FC<ExamTimerProps> = ({ startedAt, timeLimitMinutes, onTimeExpired }) => {
  const calculateRemainingSeconds = (): number => {
    if (!timeLimitMinutes || timeLimitMinutes <= 0) return 0;
    const startTimeMs = new Date(startedAt).getTime();
    const durationMs = timeLimitMinutes * 60 * 1000;
    const targetEndTimeMs = startTimeMs + durationMs;
    const nowMs = Date.now();
    const diffSeconds = Math.floor((targetEndTimeMs - nowMs) / 1000);
    return Math.max(0, diffSeconds);
  };

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => calculateRemainingSeconds());

  useEffect(() => {
    if (!timeLimitMinutes || timeLimitMinutes <= 0) return;

    const interval = setInterval(() => {
      const startTimeMs = new Date(startedAt).getTime();
      const durationMs = timeLimitMinutes * 60 * 1000;
      const targetEndTimeMs = startTimeMs + durationMs;
      const nowMs = Date.now();
      const diffSeconds = Math.floor((targetEndTimeMs - nowMs) / 1000);
      const remaining = Math.max(0, diffSeconds);

      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onTimeExpired();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, timeLimitMinutes, onTimeExpired]);

  if (!timeLimitMinutes || timeLimitMinutes <= 0) {
    return (
      <div className="exam-timer-badge no-limit" aria-label="Sin límite de tiempo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>Sin límite de tiempo</span>
      </div>
    );
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isCritical = remainingSeconds <= 300; // 5 minutos o menos

  return (
    <div
      className={`exam-timer-badge ${isCritical ? 'critical' : 'normal'}`}
      aria-live="polite"
      aria-label={`Tiempo restante: ${minutes} minutos y ${seconds} segundos`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      <span className="timer-text">{formattedTime}</span>
    </div>
  );
};

