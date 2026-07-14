import type { HTMLAttributes, ReactNode } from 'react';
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> { /** Badge content. */ children: ReactNode; /** Fill colour using a design token or CSS color. */ color?: string; }
/** A small pill label used for categories and counts. */
export function Badge({ children, color='var(--ui-blue)', className='', style, ...props }: BadgeProps) { return <span className={`ui-badge ${className}`} style={{ ...style, backgroundColor: color }} {...props}>{children}</span>; }
