import React from 'react';

interface CardSkeletonProps {
  count?: number;
  type?: 'kpi' | 'course' | 'generic';
  className?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  count = 3,
  type = 'generic',
  className = '',
}) => {
  return (
    <div className={`card-skeleton-grid type-${type} ${className}`} role="status" aria-busy="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="card-skeleton-item skeleton-pulse">
          <div className="card-skeleton-header" />
          <div className="card-skeleton-body" />
          {type === 'course' && <div className="card-skeleton-footer" />}
        </div>
      ))}
    </div>
  );
};
