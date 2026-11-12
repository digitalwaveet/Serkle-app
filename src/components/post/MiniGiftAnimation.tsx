import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getGiftAnimationTier } from '@/lib/giftComment';

export interface MiniGiftAnimationProps {
  giftId: string;
  name: string;
  emoji?: string;
  image?: string;
  quantity?: number;
  coinValue: number;
  onComplete: () => void;
  className?: string;
}

interface SparkleConfig {
  id: number;
  kind: 'star' | 'dot';
  color: string;
  size: number;
  gx: string;
  gy: string;
}

// 10 sparkling particles in cyan (#53D7FF), purple (#7864EA), and white (#FFFFFF)
const SPARKLE_PARTICLES: SparkleConfig[] = [
  { id: 0, kind: 'star', color: '#53D7FF', size: 13, gx: '-44px', gy: '-26px' },
  { id: 1, kind: 'dot',  color: '#FFFFFF', size: 6,  gx: '-22px', gy: '-48px' },
  { id: 2, kind: 'star', color: '#7864EA', size: 12, gx: '26px',  gy: '-46px' },
  { id: 3, kind: 'star', color: '#FFFFFF', size: 11, gx: '48px',  gy: '-22px' },
  { id: 4, kind: 'dot',  color: '#53D7FF', size: 7,  gx: '50px',  gy: '10px'  },
  { id: 5, kind: 'star', color: '#53D7FF', size: 12, gx: '32px',  gy: '34px'  },
  { id: 6, kind: 'dot',  color: '#7864EA', size: 7,  gx: '-32px', gy: '32px'  },
  { id: 7, kind: 'star', color: '#FFFFFF', size: 10, gx: '-50px', gy: '8px'   },
  { id: 8, kind: 'dot',  color: '#53D7FF', size: 6,  gx: '0px',   gy: '-54px' },
  { id: 9, kind: 'star', color: '#7864EA', size: 11, gx: '0px',   gy: '40px'  },
];

export const DiamondVectorGraphic: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn('w-16 h-16', className)}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="diamondTopGrad" x1="12" y1="10" x2="52" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="55%" stopColor="#53D7FF" />
        <stop offset="100%" stopColor="#7864EA" />
      </linearGradient>
      <linearGradient id="diamondBodyGrad" x1="8" y1="22" x2="56" y2="56" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#53D7FF" />
        <stop offset="52%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#7864EA" />
      </linearGradient>
      <linearGradient id="diamondCenterGrad" x1="32" y1="22" x2="32" y2="56" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#E0F7FF" />
        <stop offset="45%" stopColor="#53D7FF" />
        <stop offset="100%" stopColor="#7864EA" />
      </linearGradient>
    </defs>
    {/* Crown / Top table */}
    <polygon points="18,12 46,12 56,24 8,24" fill="url(#diamondTopGrad)" />
    {/* Pavilion / Lower facets */}
    <polygon points="8,24 56,24 32,54" fill="url(#diamondBodyGrad)" />
    {/* Center bright facet */}
    <polygon points="21,24 43,24 32,54" fill="url(#diamondCenterGrad)" />
    {/* Top center table highlight */}
    <polygon points="24,12 40,12 43,24 21,24" fill="#FFFFFF" fillOpacity="0.65" />
    {/* Left & right crown highlights */}
    <polygon points="18,12 24,12 21,24 8,24" fill="#53D7FF" fillOpacity="0.75" />
    <polygon points="40,12 46,12 56,24 43,24" fill="#7864EA" fillOpacity="0.55" />
    {/* Crisp facet lines */}
    <path
      d="M18 12H46L56 24L32 54L8 24L18 12ZM8 24H56M18 12L21 24L32 54M46 12L43 24L32 54M24 12L21 24M40 12L43 24"
      stroke="#FFFFFF"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeOpacity="0.9"
    />
    {/* Top specular glint */}
    <circle cx="24" cy="18" r="2" fill="#FFFFFF" />
  </svg>
);

export const MiniGiftAnimation: React.FC<MiniGiftAnimationProps> = ({
  giftId,
  name,
  emoji,
  image,
  quantity = 1,
  coinValue,
  onComplete,
  className,
}) => {
  const reducedMotion = useReducedMotion();
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const tier = getGiftAnimationTier(coinValue);
  const effectiveDuration = reducedMotion ? 600 : tier.durationMs;
  const particles = SPARKLE_PARTICLES.slice(0, tier.particleCount);
  const isDiamond =
    giftId.toLowerCase() === 'diamond' ||
    name.toLowerCase() === 'diamond' ||
    emoji === '💎';

  useEffect(() => {
    completedRef.current = false;
    const timer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    }, effectiveDuration);

    return () => {
      clearTimeout(timer);
    };
  }, [effectiveDuration, giftId, coinValue]);

  const titleText =
    quantity > 1 ? `${quantity}× ${name}` : name;

  if (reducedMotion) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn('mini-gift-stage', className)}
      >
        <div className="flex flex-col items-center justify-center rounded-2xl px-4 py-3 bg-[#141829]/95 border border-[#53D7FF]/50 shadow-lg text-white">
          <div className="w-10 h-10 flex items-center justify-center mb-1">
            {image ? (
              <img src={image} alt={name} className="w-9 h-9 object-contain" />
            ) : isDiamond ? (
              <DiamondVectorGraphic className="w-9 h-9" />
            ) : (
              <span className="text-2xl leading-none">{emoji || '🎁'}</span>
            )}
          </div>
          <span className="text-xs font-bold text-white">Sent {titleText}</span>
          <span className="text-[10px] font-semibold text-[#53D7FF]">{coinValue} coins</span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Sending ${titleText} worth ${coinValue} coins`}
      className={cn('mini-gift-stage', className)}
      style={{ '--gift-duration': `${tier.durationMs}ms` } as React.CSSProperties}
    >
      {/* Soft glowing cyan/purple background aura */}
      {tier.level !== 'pop' && <div className="mini-gift-aura" aria-hidden="true" />}

      {/* 6–10 Sparkling particles */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="mini-gift-sparkle"
          style={
            {
              width: `${p.size}px`,
              height: `${p.size}px`,
              color: p.color,
              '--gx': p.gx,
              '--gy': p.gy,
            } as React.CSSProperties
          }
          aria-hidden="true"
        >
          {p.kind === 'star' ? (
            <svg viewBox="0 0 24 24" className="w-full h-full fill-current">
              <path d="M12 1L14.8 9.2L23 12L14.8 14.8L12 23L9.2 14.8L1 12L9.2 9.2L12 1Z" />
            </svg>
          ) : (
            <span
              className="block w-full h-full rounded-full"
              style={{
                backgroundColor: p.color,
                boxShadow: `0 0 6px ${p.color}`,
              }}
            />
          )}
        </span>
      ))}

      {/* Main 64×64px Gift Graphic (56–72px spec) */}
      <div
        className={cn(
          'mini-gift-graphic',
          tier.level === 'pop' && 'mini-gift-graphic--pop',
          tier.level === 'glow' && 'mini-gift-graphic--glow',
          tier.level === 'diamond' && 'mini-gift-graphic--diamond',
          tier.level === 'celebration' && 'mini-gift-graphic--celebration'
        )}
      >
        {image ? (
          <img src={image} alt={name} className="w-16 h-16 object-contain select-none" />
        ) : isDiamond ? (
          <DiamondVectorGraphic className="w-16 h-16" />
        ) : (
          <span className="text-[52px] leading-none select-none">{emoji || '🎁'}</span>
        )}
      </div>

      {/* Compact floating pill */}
      <div className="mini-gift-pill">
        <span>{titleText}</span>
        <span className="mx-1 text-[#53D7FF]">·</span>
        <span className="text-[#53D7FF]">{coinValue} coins</span>
      </div>
    </div>
  );
};

export default MiniGiftAnimation;

