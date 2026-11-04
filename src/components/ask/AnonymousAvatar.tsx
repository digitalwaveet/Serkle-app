import React from 'react';
import { getAnonymousIdentity, type AvatarShape } from '@/utils/anonymousIdentity';

interface AnonymousAvatarProps {
  pseudonym: string;
  /** Size in pixels. Defaults to 32 (w-8 h-8). */
  size?: number;
  className?: string;
}

/**
 * Generates a unique SVG avatar from an anonymous pseudonym.
 * Uses Serkle design tokens — warm colors, rounded shapes,
 * and the user's derived initials.
 * 
 * No real identity information is used or leaked.
 */
export const AnonymousAvatar: React.FC<AnonymousAvatarProps> = ({
  pseudonym,
  size = 32,
  className = '',
}) => {
  const identity = getAnonymousIdentity(pseudonym);
  const { color, shape, initials } = identity;

  // Font size scales with avatar size
  const fontSize = Math.round(size * 0.38);

  return (
    <div
      className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={pseudonym}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0"
      >
        {/* Background shape */}
        <ShapePath shape={shape} color={color} />
        
        {/* Subtle decorative pattern */}
        <PatternOverlay shape={shape} color={color} />
      </svg>
      
      {/* Initials overlay */}
      <span
        className="relative z-10 font-semibold text-white select-none"
        style={{ fontSize: `${fontSize}px`, lineHeight: 1, letterSpacing: '0.5px' }}
      >
        {initials}
      </span>
    </div>
  );
};

/** Renders the background shape */
function ShapePath({ shape, color }: { shape: AvatarShape; color: string }) {
  switch (shape) {
    case 'circle':
      return <circle cx="20" cy="20" r="20" fill={color} />;
    case 'diamond':
      return (
        <rect
          x="4"
          y="4"
          width="32"
          height="32"
          rx="8"
          fill={color}
          transform="rotate(0 20 20)"
        />
      );
    case 'hexagon':
      return (
        <path
          d="M20 0 L38 10 L38 30 L20 40 L2 30 L2 10 Z"
          fill={color}
        />
      );
    case 'rounded-square':
      return <rect x="2" y="2" width="36" height="36" rx="10" fill={color} />;
    default:
      return <circle cx="20" cy="20" r="20" fill={color} />;
  }
}

/** Subtle decorative pattern overlay for visual variety */
function PatternOverlay({ shape, color }: { shape: AvatarShape; color: string }) {
  const lightColor = 'rgba(255,255,255,0.08)';
  
  switch (shape) {
    case 'circle':
      return (
        <>
          <circle cx="28" cy="12" r="8" fill={lightColor} />
          <circle cx="12" cy="30" r="5" fill={lightColor} />
        </>
      );
    case 'diamond':
      return (
        <rect x="20" y="4" width="16" height="16" rx="4" fill={lightColor} />
      );
    case 'hexagon':
      return (
        <path d="M20 5 L33 12.5 L33 20 L20 20 Z" fill={lightColor} />
      );
    case 'rounded-square':
      return (
        <>
          <rect x="22" y="2" width="16" height="20" rx="8" fill={lightColor} />
        </>
      );
    default:
      return null;
  }
}
