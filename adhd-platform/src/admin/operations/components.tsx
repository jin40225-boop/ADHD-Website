import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="ops-page-header">
      <div>
        {eyebrow ? <p className="ops-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="ops-page-description">{description}</p> : null}
      </div>
      {actions ? <div className="ops-page-actions">{actions}</div> : null}
    </header>
  );
}

export function OpsNotice({ tone = 'info', children, role }: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  children: ReactNode;
  role?: 'status' | 'alert';
}) {
  return <div className={`ops-notice ops-notice--${tone}`} role={role}>{children}</div>;
}

export function MetricCard({ label, value, detail, tone = 'neutral' }: {
  label: string;
  value: number | string;
  detail?: string;
  tone?: 'neutral' | 'blue' | 'coral' | 'green' | 'yellow';
}) {
  return (
    <article className={`ops-metric ops-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

export function EmptyPanel({ title, description }: { title: string; description?: string }) {
  return (
    <div className="ops-empty">
      <span aria-hidden="true">✦</span>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function InlineSpinner({ label = '載入中…' }: { label?: string }) {
  return <div className="ops-loading"><span aria-hidden="true" />{label}</div>;
}

export function StatusPill({ children, tone = 'gray' }: {
  children: ReactNode;
  tone?: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'coral';
}) {
  return <span className={`ops-status ops-status--${tone}`}>{children}</span>;
}
