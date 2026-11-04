import React from 'react';
import { cn } from '@/lib/utils';
import './SerkleLoader.css';

export interface SerkleLoaderProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Kept for pull-to-refresh: a resting wordmark should not animate. */
  pulse?: boolean;
  showText?: boolean;
  label?: string;
  dark?: boolean;
}

/** One lightweight, accessible loading language for requests, uploads and media. */
export const SerkleLoader = ({
  size = 'md', className, pulse = true, showText = false,
  label = 'Loading', dark = false, ...props
}: SerkleLoaderProps) => (
  <span role="status" aria-live="polite" aria-label={label} {...props}
    className={cn('serkle-loader text-primary', `serkle-loader--${size}`,
      !pulse && 'serkle-loader--still', dark && 'text-[#fff4e5]', className)}>
    <span className="serkle-loader__word" aria-hidden="true">
      {'SERKLE'.split('').map((letter, index) => (
        <span key={index} className="serkle-loader__letter"
          style={{ '--letter-index': index } as React.CSSProperties}>{letter}</span>
      ))}
    </span>
    {showText && <span className="serkle-loader__label" aria-hidden="true">{label}</span>}
  </span>
);
