import type { HTMLAttributes } from 'react';
export type StatusTagStatus = 'pending'|'success'|'rejected'|'waitlist'|'confirming';
export interface StatusTagProps extends HTMLAttributes<HTMLSpanElement> { /** Current workflow state. */ status: StatusTagStatus; /** Overrides the default Traditional Chinese status text. */ children?: string; }
const labels: Record<StatusTagStatus,string>={pending:'待審核',success:'成功',rejected:'退回',waitlist:'候補',confirming:'確認中'};
/** A consistent workflow-status pill. */
export function StatusTag({ status, children, className='', ...props }: StatusTagProps) { return <span className={`ui-badge ui-status--${status} ${className}`} {...props}>{children ?? labels[status]}</span>; }
