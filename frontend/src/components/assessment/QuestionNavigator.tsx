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
  return (
    <div className="question-navigator" aria-label="Navegador de preguntas">
      <h3 className="navigator-title">Preguntas ({totalQuestions})</h3>
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
              aria-label={`Pregunta ${index + 1}: ${isAnswered ? 'Respondida' : 'Sin responder'}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
      <div className="navigator-legend">
        <div className="legend-item">
          <span className="legend-box answered" /> Respondida
        </div>
        <div className="legend-item">
          <span className="legend-box unanswered" /> Sin responder
        </div>
        <div className="legend-item">
          <span className="legend-box current" /> Actual
        </div>
      </div>
    </div>
  );
};
