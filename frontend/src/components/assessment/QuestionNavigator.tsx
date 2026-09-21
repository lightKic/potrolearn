import React from 'react';

interface QuestionNavigatorProps {
  totalQuestions: number;
  currentIndex: number;
  answeredMap: Record<string, boolean>; // questionId -> boolean
  questionIds: string[];
  onSelectQuestion: (index: number) => void;
}

export const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  totalQuestions,
  currentIndex,
  answeredMap,
  questionIds,
  onSelectQuestion,
}) => {
  const answeredCount = Object.values(answeredMap).filter(Boolean).length;

  return (
    <div className="question-navigator" aria-label="Navegador de preguntas">
      <div className="navigator-header">
        <h3 className="navigator-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          Preguntas ({totalQuestions})
        </h3>
        <span className="navigator-progress-badge">
          {answeredCount}/{totalQuestions}
        </span>
      </div>

      <div className="navigator-grid">
        {questionIds.map((qId, index) => {
          const isCurrent = index === currentIndex;
          const isAnswered = Boolean(answeredMap[qId]);

          let statusClass = 'unanswered';
          if (isAnswered) statusClass = 'answered';
          if (isCurrent) statusClass += ' current';

          return (
            <button
              key={qId}
              type="button"
              className={`navigator-btn ${statusClass}`}
              onClick={() => onSelectQuestion(index)}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Pregunta ${index + 1}: ${isCurrent ? 'Actual' : isAnswered ? 'Respondida' : 'Sin responder'}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <div className="navigator-legend">
        <div className="legend-item">
          <span className="legend-box current" /> Pregunta actual
        </div>
        <div className="legend-item">
          <span className="legend-box answered" /> Respondida
        </div>
        <div className="legend-item">
          <span className="legend-box unanswered" /> Sin responder
        </div>
      </div>
    </div>
  );
};

