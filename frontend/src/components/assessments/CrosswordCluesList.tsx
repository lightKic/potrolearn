import React from 'react';
import { AssessmentQuestionDTO, CrosswordLayoutEntry } from '../../types/assessment.js';
import { WordValidationStatus } from '../../utils/crossword-validation.util.js';
import { MarkdownContent } from '../MarkdownContent.js';

export interface CrosswordCluesListProps {
  questions: AssessmentQuestionDTO[];
  entries: CrosswordLayoutEntry[];
  wordStates?: Record<string, WordValidationStatus>;
  selectedEntryNumber?: number | null;
  selectedDirection?: 'ACROSS' | 'DOWN' | null;
  onSelectEntry?: (entry: CrosswordLayoutEntry) => void;
  cellAnswers?: Record<string, string>;
  showAnswerKey?: boolean;
}

export const CrosswordCluesList: React.FC<CrosswordCluesListProps> = ({
  questions,
  entries,
  wordStates = {},
  selectedEntryNumber = null,
  selectedDirection = null,
  onSelectEntry,
  cellAnswers = {},
  showAnswerKey = false,
}) => {
  const qMap = new Map<string, AssessmentQuestionDTO>();
  for (const q of questions) {
    qMap.set(q.questionId, q);
  }

  const acrossEntries = entries
    .filter((e) => e.direction === 'ACROSS')
    .sort((a, b) => a.number - b.number);

  const downEntries = entries
    .filter((e) => e.direction === 'DOWN')
    .sort((a, b) => a.number - b.number);

  const getTypedCount = (entry: CrosswordLayoutEntry): number => {
    let count = 0;
    for (let i = 0; i < entry.length; i++) {
      const r = entry.direction === 'ACROSS' ? entry.startRow : entry.startRow + i;
      const c = entry.direction === 'ACROSS' ? entry.startCol + i : entry.startCol;
      if (cellAnswers[`${r}-${c}`]?.trim()) {
        count++;
      }
    }
    return count;
  };

  const renderClueItem = (entry: CrosswordLayoutEntry) => {
    const aq = qMap.get(entry.questionId);
    const statement = aq?.question?.statement || '(Pista sin enunciado)';
    const points = aq?.points ?? 10;
    const isSelected = selectedEntryNumber === entry.number && selectedDirection === entry.direction;
    const entryKey = `${entry.number}-${entry.direction}`;
    const status = wordStates[entryKey] || 'PENDING';
    const typedCount = getTypedCount(entry);

    let badgeBg = '#f1f5f9';
    let badgeText = '#475569';
    let badgeLabel = `${typedCount}/${entry.length} letras`;
    let icon = null;

    if (status === 'CORRECT') {
      badgeBg = '#dcfce7';
      badgeText = '#15803d';
      badgeLabel = 'Correcto';
      icon = (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      );
    } else if (status === 'INCORRECT') {
      badgeBg = '#fee2e2';
      badgeText = '#b91c1c';
      badgeLabel = showAnswerKey ? 'Incorrecto' : 'Revisar';
      icon = (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      );
    }

    return (
      <li
        key={`${entry.direction}-${entry.number}-${entry.questionId}`}
        role="button"
        tabIndex={0}
        aria-label={`Pista ${entry.number} ${entry.direction === 'ACROSS' ? 'Horizontal' : 'Vertical'}: ${statement}, Estado ${badgeLabel}`}
        onClick={() => onSelectEntry && onSelectEntry(entry)}
        onKeyDown={(e) => {
          if (onSelectEntry && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelectEntry(entry);
          }
        }}
        style={{
          padding: '10px 14px',
          borderRadius: '8px',
          border: isSelected
            ? '2px solid #0284c7'
            : status === 'CORRECT'
            ? '1px solid #86efac'
            : status === 'INCORRECT'
            ? '1px solid #fca5a5'
            : '1px solid #e2e8f0',
          backgroundColor: isSelected
            ? '#f0f9ff'
            : status === 'CORRECT'
            ? '#f0fdf4'
            : status === 'INCORRECT'
            ? '#fef2f2'
            : '#ffffff',
          marginBottom: '8px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          listStyleType: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span
              style={{
                fontWeight: 800,
                fontSize: '0.85rem',
                color: isSelected ? '#0369a1' : '#475569',
                backgroundColor: isSelected ? '#bae6fd' : '#e2e8f0',
                padding: '2px 7px',
                borderRadius: '6px',
                minWidth: '24px',
                textAlign: 'center',
              }}
            >
              {entry.number}
            </span>
            <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: isSelected ? 600 : 400 }}>
              <MarkdownContent content={statement} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: badgeText,
                backgroundColor: badgeBg,
                padding: '2px 8px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {icon}
              {badgeLabel}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8' }}>
              {points} pts
            </span>
          </div>
        </div>

        {showAnswerKey && (
          <div style={{ marginTop: '6px', paddingLeft: '32px', fontSize: '0.8rem', color: '#15803d', fontWeight: 700 }}>
            🔑 Respuesta: <code>{entry.answerNormalized}</code>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="crossword-clues-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Pistas Horizontales */}
      <div className="crossword-clues-section">
        <h4
          style={{
            fontSize: '0.9rem',
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            textTransform: 'uppercase',
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: '4px',
          }}
        >
          ➡️ Horizontales ({acrossEntries.length})
        </h4>
        <ul style={{ margin: 0, padding: 0 }}>
          {acrossEntries.length === 0 ? (
            <li style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Sin pistas horizontales</li>
          ) : (
            acrossEntries.map(renderClueItem)
          )}
        </ul>
      </div>

      {/* Pistas Verticales */}
      <div className="crossword-clues-section">
        <h4
          style={{
            fontSize: '0.9rem',
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            textTransform: 'uppercase',
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: '4px',
          }}
        >
          ⬇️ Verticales ({downEntries.length})
        </h4>
        <ul style={{ margin: 0, padding: 0 }}>
          {downEntries.length === 0 ? (
            <li style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Sin pistas verticales</li>
          ) : (
            downEntries.map(renderClueItem)
          )}
        </ul>
      </div>
    </div>
  );
};
