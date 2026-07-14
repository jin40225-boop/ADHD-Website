import type { HTMLAttributes, ReactNode } from 'react';
export interface SectionTitleProps extends HTMLAttributes<HTMLHeadingElement> { /** Heading content. */ children: ReactNode; /** Semantic heading level. */ as?: 'h1'|'h2'|'h3'|'h4'; /** Visual scale. */ size?: 'sm'|'md'|'lg'; }
/** Heading with the old site's hand-marker highlight. */
export function SectionTitle({ children, as: Tag='h2', size='md', className='', ...props }: SectionTitleProps) { return <Tag className={`ui-section-title ui-section-title--${size} ${className}`} {...props}><span className="ui-section-title__text">{children}</span></Tag>; }
