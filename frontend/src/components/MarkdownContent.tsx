import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownContentProps {
  content?: string | null;
  className?: string;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = '' }) => {
  if (!content || !content.trim()) {
    return (
      <div className={`markdown-content-empty ${className}`} style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>
        Sin contenido registrado.
      </div>
    );
  }

  return (
    <div
      className={`markdown-content ${className}`}
      style={{
        lineHeight: 1.65,
        fontSize: '0.975rem',
        color: 'var(--color-text)',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-primary, #2563eb)', textDecoration: 'underline' }}
            />
          ),
          table: ({ ...props }) => (
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table
                {...props}
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          ),
          th: ({ ...props }) => (
            <th
              {...props}
              style={{
                backgroundColor: 'var(--color-background)',
                border: '1px solid var(--color-border)',
                padding: '8px 12px',
                textAlign: 'left',
                fontWeight: 600,
              }}
            />
          ),
          td: ({ ...props }) => (
            <td
              {...props}
              style={{
                border: '1px solid var(--color-border)',
                padding: '8px 12px',
              }}
            />
          ),
          pre: ({ ...props }) => (
            <pre
              {...props}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                padding: '12px 16px',
                borderRadius: '6px',
                overflowX: 'auto',
                fontSize: '0.875rem',
                marginBottom: '16px',
              }}
            />
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClassName || '');
            return match ? (
              <code className={codeClassName} {...props}>
                {children}
              </code>
            ) : (
              <code
                style={{
                  backgroundColor: 'var(--color-background)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.875em',
                  fontFamily: 'monospace',
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
