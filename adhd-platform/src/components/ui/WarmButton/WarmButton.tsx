import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
export interface WarmButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { /** Visual emphasis. */ variant?: 'primary'|'secondary'|'danger'; /** Button scale. */ size?: 'sm'|'md'|'lg'; /** Optional lucide-react icon. */ icon?: LucideIcon; /** Button text or content. */ children: ReactNode; }
/** Branded button with a tactile hard-shadow press effect. */
export function WarmButton({ variant='primary', size='md', icon: Icon, children, className='', type='button', ...props }: WarmButtonProps) { return <button type={type} className={`ui-button ui-button--${variant} ui-button--${size} ${className}`} {...props}>{Icon ? <Icon aria-hidden="true" size={size === 'sm' ? 16 : 18} /> : null}{children}</button>; }
