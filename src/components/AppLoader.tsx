import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface AppLoaderProps {
  fadeOut?: boolean;
  onAnimationExitPoint?: () => void;
}

// 2.1s of logo motion/hold, followed by the existing 300ms crossfade.
const FULL_MOTION_EXIT_POINT_MS = 2100;
const REDUCED_MOTION_EXIT_POINT_MS = 180;
const OPENING_ASSETS = [
  '/opening/opening_background_1080x1920.png',
  '/opening/serkle_mark_full.png',
];

const decodeOpeningAsset = async (src: string) => {
  const image = new Image();
  image.src = src;
  await image.decode();
};

export const AppLoader = ({
  fadeOut = false,
  onAnimationExitPoint,
}: AppLoaderProps) => {
  const reducedMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(
      () => onAnimationExitPoint?.(),
      reducedMotion ? REDUCED_MOTION_EXIT_POINT_MS : FULL_MOTION_EXIT_POINT_MS,
    );

    return () => window.clearTimeout(timer);
  }, [onAnimationExitPoint, reducedMotion, playing]);

  useEffect(() => {
    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;
    let assetTimeout = 0;

    // Decode once before any logo movement; a missing asset must not trap startup.
    void Promise.race([
      Promise.allSettled(OPENING_ASSETS.map(decodeOpeningAsset)),
      new Promise<void>((resolve) => {
        assetTimeout = window.setTimeout(resolve, 1200);
      }),
    ]).then(() => {
      window.clearTimeout(assetTimeout);
      if (cancelled) return;
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          if (cancelled) return;
          setPlaying(true);
          // The custom background has painted before the native cover is released.
          if (Capacitor.isNativePlatform()) {
            void SplashScreen.hide({ fadeOutDuration: 120 }).catch((error) => {
              console.warn('Unable to release native splash screen:', error);
            });
          }
        });
      });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(assetTimeout);
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, []);

  return (
    <div
      className={`serkle-opening${playing ? ' is-playing' : ''}${fadeOut ? ' is-exiting' : ''}${
        reducedMotion ? ' is-reduced-motion' : ''
      }`}
      aria-label="Serkle is opening"
      role="status"
    >
      <div className="serkle-opening__background" aria-hidden="true" />

      <div className="serkle-opening__mark" aria-hidden="true">
        <img
          className="serkle-opening__layer serkle-opening__full"
          src="/opening/serkle_mark_full.png"
          alt=""
        />
        <div className="serkle-opening__split">
          <img
            className="serkle-opening__layer serkle-opening__left"
            src="/opening/serkle_mark_full.png"
            alt=""
          />
          <img
            className="serkle-opening__layer serkle-opening__right"
            src="/opening/serkle_mark_full.png"
            alt=""
          />
        </div>
        <span className="serkle-opening__shimmer"><span /></span>
      </div>

      <div className="serkle-opening__loading" aria-hidden="true">
        <span>Loading</span>
        <div className="serkle-opening__loading-track">
          <span className="serkle-opening__loading-glide" />
        </div>
      </div>
    </div>
  );
};
