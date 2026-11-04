import React from 'react';

interface CoverImageProps {
  coverUrl?: string | null;
  avatarUrl?: string | null;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Profile cover image with an intentional brand-gradient empty state.
 * When no cover exists, shows a subtle Serkle gradient instead of a plain gray box.
 */
const CoverImage: React.FC<CoverImageProps> = ({ coverUrl, avatarUrl, className = '', children }) => {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {coverUrl ? (
        <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
      ) : (
        <>
          {/* Brand gradient empty state */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, hsl(33 69% 59% / 0.55) 0%, hsl(25 55% 42% / 0.45) 50%, hsl(19 55% 28% / 0.55) 100%)',
            }}
          />
          {/* Soft blurred avatar tint when available */}
          {avatarUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-25 blur-2xl scale-125"
              style={{ backgroundImage: `url('${avatarUrl}')` }}
            />
          )}
          {/* Subtle brand pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(circle at 25% 25%, white 1.5px, transparent 1.5px)',
              backgroundSize: '22px 22px',
            }}
          />
        </>
      )}
      {children}
    </div>
  );
};

export default CoverImage;
