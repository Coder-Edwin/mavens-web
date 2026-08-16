import type { ReactNode } from 'react';

/** Renders **bold** markdown-style segments inside feed/activity text without a markdown lib. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <b key={i}>{part.slice(2, -2)}</b>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  tone = 'neutral'
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: 'up' | 'warn' | 'neutral';
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta && <div className={`kpi-delta ${tone !== 'neutral' ? tone : ''}`}>{delta}</div>}
    </div>
  );
}

export function Panel({
  title,
  linkLabel,
  onLinkClick,
  children
}: {
  title: string;
  linkLabel?: string;
  onLinkClick?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">{title}</div>
        {linkLabel && (
          <span className="panel-link" onClick={onLinkClick}>
            {linkLabel} →
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function FeedItem({ text, time }: { text: string; time?: string }) {
  return (
    <div className="feed-item">
      <div className="feed-dot" />
      <div>
        <div className="feed-text">
          <RichText text={text} />
        </div>
        {time && <div className="feed-time">{time}</div>}
      </div>
    </div>
  );
}

export function Chip({ status, label }: { status: 'paid' | 'overdue' | 'pending'; label: string }) {
  return <span className={`chip ${status}`}>{label}</span>;
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="pbar">
      <div className="pbar-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Button({
  variant = 'gold',
  size,
  onClick,
  children
}: {
  variant?: 'gold' | 'ghost';
  size?: 'sm';
  onClick?: () => void;
  children: ReactNode;
}) {
  const classes = ['btn', variant === 'gold' ? 'btn-gold' : 'btn-ghost', size === 'sm' ? 'btn-sm' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button className={classes} onClick={onClick}>
      {children}
    </button>
  );
}
