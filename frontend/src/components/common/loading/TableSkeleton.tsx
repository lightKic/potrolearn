import React from 'react';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
  showHeader?: boolean;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 4,
  columns = 4,
  className = '',
  showHeader = true,
}) => {
  return (
    <div
      className={`table-skeleton-wrapper ${className}`}
      role="status"
      aria-busy="true"
      aria-label="Cargando datos..."
    >
      <div className="table-skeleton-container">
        {showHeader && (
          <div className="table-skeleton-header">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div key={colIdx} className="table-skeleton-header-cell skeleton-pulse" />
            ))}
          </div>
        )}
        <div className="table-skeleton-body">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <div key={rowIdx} className="table-skeleton-row">
              {Array.from({ length: columns }).map((_, colIdx) => (
                <div key={colIdx} className="table-skeleton-cell skeleton-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
