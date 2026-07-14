import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export interface WarmCardProps extends HTMLAttributes<HTMLDivElement> { /** Card content. */ children: ReactNode; /** Optional card fill color. */ bgColor?: string; /** Enables the signature lift animation. */ hoverable?: boolean; }
/** A branded, hard-shadow card for public and admin surfaces. */
export function WarmCard({ children, bgColor, hoverable = false, className = '', style, ...props }: WarmCardProps) { return <div className={`ui-card ${hoverable ? 'ui-card--hoverable' : ''} ${className}`} style={{ ...style, ...(bgColor ? { backgroundColor: bgColor } as CSSProperties : {}) }} {...props}>{children}</div>; }
