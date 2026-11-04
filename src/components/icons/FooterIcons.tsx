import React from 'react';

export interface FooterIconProps extends React.SVGProps<SVGSVGElement> {
  active?: boolean;
  className?: string;
  fillMode?: 'gradient' | 'current';
}

/**
 * 1. Home Icon
 */
export const HomeIcon: React.FC<FooterIconProps> = ({
  active = false,
  className = 'size-7',
  fillMode = 'gradient',
  ...props
}) => {
  const isCurrent = fillMode === 'current' || (className && className.includes('text-white'));
  const fill1 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#home-gradient-1)'
    : 'url(#home-inactive-1)';
  const fill2 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#home-gradient-2)'
    : 'url(#home-inactive-2)';

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-all duration-200 ${
        active
          ? 'opacity-100 scale-105 drop-shadow-sm'
          : 'opacity-85 hover:opacity-100'
      } ${className}`}
      {...props}
    >
      <defs>
        {/* Active Serkle Brand Gradients */}
        <linearGradient
          id="home-gradient-1"
          x1="55.17"
          y1="53.92"
          x2="95.94"
          y2="53.92"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>
        <linearGradient
          id="home-gradient-2"
          x1="4.06"
          y1="50.01"
          x2="69.06"
          y2="50.01"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>

        {/* Inactive Bold Slate-Grey Gradients */}
        <linearGradient
          id="home-inactive-1"
          x1="55.17"
          y1="53.92"
          x2="95.94"
          y2="53.92"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#404040" />
          <stop offset="1" stopColor="#666666" />
        </linearGradient>
        <linearGradient
          id="home-inactive-2"
          x1="4.06"
          y1="50.01"
          x2="69.06"
          y2="50.01"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#484848" />
          <stop offset="1" stopColor="#6e6e6e" />
        </linearGradient>
      </defs>
      <path
        fill={fill1}
        d="M85.25,80.96c-2.85,0-5.53-1.11-7.56-3.13-2.03-2.03-3.14-4.71-3.14-7.57v-7.76c0-3.14-2.56-5.7-5.7-5.7h-2.29v-5h2.29c5.9,0,10.7,4.8,10.7,10.7v7.76c0,1.53.59,2.96,1.67,4.03,1.08,1.07,2.51,1.67,4.03,1.67,3.14,0,5.69-2.56,5.69-5.7v-17.39c0-1.66-.71-3.23-1.96-4.32l-17.68-15.31c-2.13-1.85-5.34-1.84-7.47,0l-5.38,4.66-3.27-3.78,5.38-4.66c3.99-3.46,10.02-3.46,14.01,0l17.69,15.32c2.34,2.04,3.68,4.99,3.68,8.09v17.39c0,5.9-4.79,10.7-10.69,10.7Z"
      />
      <path
        fill={fill2}
        d="M57.06,80.96c-6.62,0-12-5.38-12-12v-9c0-3.86-3.14-7-7-7h-3c-3.86,0-7,3.14-7,7v9c0,6.62-5.38,12-12,12s-12-5.38-12-12v-20.16c0-3.48,1.51-6.79,4.14-9.07l20.5-17.77c4.48-3.88,11.24-3.88,15.72,0l20.5,17.77c2.63,2.28,4.14,5.59,4.14,9.07v20.16c0,6.62-5.38,12-12,12ZM35.06,47.96h3c6.62,0,12,5.38,12,12v9c0,3.86,3.14,7,7,7s7-3.14,7-7v-20.16c0-2.03-.88-3.96-2.42-5.29l-20.5-17.77c-2.61-2.27-6.56-2.26-9.17,0l-20.5,17.77c-1.54,1.33-2.42,3.26-2.42,5.29v20.16c0,3.86,3.14,7,7,7s7-3.14,7-7v-9c0-6.62,5.38-12,12-12Z"
      />
    </svg>
  );
};

/**
 * 2. Circles Icon
 */
export const CirclesIcon: React.FC<FooterIconProps> = ({
  active = false,
  className = 'size-7',
  fillMode = 'gradient',
  ...props
}) => {
  const isCurrent = fillMode === 'current' || (className && className.includes('text-white'));
  const fill1 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#circle-gradient-1)'
    : 'url(#circle-inactive-1)';
  const fill2 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#circle-gradient-2)'
    : 'url(#circle-inactive-2)';
  const fill3 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#circle-gradient-3)'
    : 'url(#circle-inactive-3)';

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-all duration-200 ${
        active
          ? 'opacity-100 scale-105 drop-shadow-sm'
          : 'opacity-85 hover:opacity-100'
      } ${className}`}
      {...props}
    >
      <defs>
        {/* Active Serkle Brand Gradients */}
        <linearGradient
          id="circle-gradient-1"
          x1="58.2"
          y1="28.77"
          x2="81.12"
          y2="28.77"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>
        <linearGradient
          id="circle-gradient-2"
          x1="11.82"
          y1="62.27"
          x2="88.18"
          y2="62.27"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>
        <linearGradient
          id="circle-gradient-3"
          x1="17.64"
          y1="28.77"
          x2="40.56"
          y2="28.77"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>

        {/* Inactive Bold Slate-Grey Gradients */}
        <linearGradient
          id="circle-inactive-1"
          x1="58.2"
          y1="28.77"
          x2="81.12"
          y2="28.77"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#404040" />
          <stop offset="1" stopColor="#666666" />
        </linearGradient>
        <linearGradient
          id="circle-inactive-2"
          x1="11.82"
          y1="62.27"
          x2="88.18"
          y2="62.27"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#484848" />
          <stop offset="1" stopColor="#6e6e6e" />
        </linearGradient>
        <linearGradient
          id="circle-inactive-3"
          x1="17.64"
          y1="28.77"
          x2="40.56"
          y2="28.77"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#404040" />
          <stop offset="1" stopColor="#666666" />
        </linearGradient>
      </defs>
      <path
        fill={fill1}
        d="M69.66,40.23c-6.32,0-11.46-5.14-11.46-11.46s5.14-11.46,11.46-11.46,11.46,5.14,11.46,11.46-5.14,11.46-11.46,11.46ZM69.66,22.31c-3.56,0-6.46,2.9-6.46,6.46s2.9,6.46,6.46,6.46,6.46-2.9,6.46-6.46-2.9-6.46-6.46-6.46Z"
      />
      <path
        fill={fill2}
        d="M70.26,80.19c-7.48,0-13.29-4.82-16.98-9.11.61-.86,1.18-1.74,1.7-2.62.05-.09.73-1.3.73-1.3.38.48.77.95,1.17,1.41,2.9,3.3,7.57,7.24,13.37,7.24,7.46,0,13.53-6.07,13.53-13.54,0-5.96-3.82-11.15-9.51-12.93-1.3-.41-2.65-.61-4.02-.61-6.17,0-11.09,4.41-14.14,8.13l-.08.08-.03.05c-1.51,1.87-2.45,3.43-2.71,3.88l-.2.2v.16s-2.5,4.45-2.5,4.45c-.08.15-.21.37-.38.64-.35.58-.76,1.18-1.19,1.8-.32.44-.67.93-1.08,1.45-3.07,3.97-9.51,10.62-18.21,10.62-3.58,0-7.04-1.06-10-3.06h0c-4.96-3.35-7.92-8.91-7.92-14.86s2.96-11.51,7.92-14.86c2.97-2.01,6.43-3.07,10.02-3.07,3.16,0,6.3.88,9.33,2.63,2.26,1.29,4.45,3.06,6.51,5.24.39.41.77.83,1.13,1.25-.82,1.16-1.38,2.08-1.66,2.56l-.77,1.37c-.87-1.11-2.01-2.42-3.38-3.67-3.6-3.31-7.36-4.98-11.18-4.98-.92,0-1.83.09-2.72.28-6.26,1.29-10.81,6.87-10.81,13.26,0,7.46,6.07,13.53,13.54,13.53,9.61,0,16.19-10.84,16.96-12.15l2.69-4.8c.16-.28.49-.83.96-1.55.54-.82,1.09-1.59,1.68-2.34,3.07-3.97,9.5-10.62,18.21-10.62,9.88,0,17.92,8.04,17.92,17.92s-8.04,17.92-17.92,17.92Z"
      />
      <path
        fill={fill3}
        d="M29.1,40.23c-6.32,0-11.46-5.14-11.46-11.46s5.14-11.46,11.46-11.46,11.46,5.14,11.46,11.46-5.14,11.46-11.46,11.46ZM29.1,22.31c-3.56,0-6.46,2.9-6.46,6.46s2.9,6.46,6.46,6.46,6.46-2.9,6.46-6.46-2.9-6.46-6.46-6.46Z"
      />
    </svg>
  );
};

/**
 * 3. Create / Add Icon
 */
export const CreateIcon: React.FC<FooterIconProps> = ({
  active = false,
  className = 'size-7',
  fillMode = 'gradient',
  ...props
}) => {
  const isCurrent = fillMode === 'current' || (className && className.includes('text-white'));
  const fill1 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#create-gradient-1)'
    : 'url(#create-inactive-1)';
  const fill2 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#create-gradient-2)'
    : 'url(#create-inactive-2)';

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-all duration-200 ${className}`}
      {...props}
    >
      <defs>
        {/* Active Serkle Brand Gradients */}
        <linearGradient
          id="create-gradient-1"
          x1="8.77"
          y1="50"
          x2="91.23"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>
        <linearGradient
          id="create-gradient-2"
          x1="26.6"
          y1="50"
          x2="59.86"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>

        {/* Inactive Bold Slate-Grey Gradients */}
        <linearGradient
          id="create-inactive-1"
          x1="8.77"
          y1="50"
          x2="91.23"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#404040" />
          <stop offset="1" stopColor="#666666" />
        </linearGradient>
        <linearGradient
          id="create-inactive-2"
          x1="26.6"
          y1="50"
          x2="59.86"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#484848" />
          <stop offset="1" stopColor="#6e6e6e" />
        </linearGradient>
      </defs>
      <path
        fill={fill1}
        d="M67.17,26.37c-.69,0-1.38.04-2.06.1-6.17-6.09-14.57-9.57-23.26-9.57-18.24,0-33.09,14.85-33.09,33.09s14.84,33.09,33.09,33.09c8.39,0,16.31-3.11,22.44-8.78.96.11,1.92.19,2.87.19,13.27,0,24.06-10.8,24.06-24.07s-10.79-24.06-24.06-24.06ZM61.69,69.89l-.02.02c-5.3,5.28-12.34,8.18-19.82,8.18-15.49,0-28.09-12.6-28.09-28.09s12.6-28.09,28.09-28.09c7.73,0,15.19,3.23,20.48,8.87l.02.02c4.9,5.22,7.59,12.04,7.59,19.21,0,7.52-2.93,14.58-8.26,19.89ZM68.64,69.45c4.1-5.62,6.31-12.36,6.31-19.45,0-6.66-1.98-13.08-5.66-18.51,9.52,1.06,16.94,9.15,16.94,18.95s-7.77,18.26-17.59,19.02Z"
      />
      <path
        fill={fill2}
        d="M57.36,47.5h-11.63v-11.63c0-1.38-1.12-2.5-2.5-2.5s-2.5,1.12-2.5,2.5v11.63h-11.63c-1.38,0-2.5,1.12-2.5,2.5s1.12,2.5,2.5,2.5h11.63v11.63c0,1.38,1.12,2.5,2.5,2.5s2.5-1.12,2.5-2.5v-11.63h11.63c1.38,0,2.5-1.12,2.5-2.5s-1.12-2.5-2.5-2.5Z"
      />
    </svg>
  );
};

/**
 * 4. Ask Anonymously Icon
 */
export const AskIcon: React.FC<FooterIconProps> = ({
  active = false,
  className = 'size-7',
  fillMode = 'gradient',
  ...props
}) => {
  const isCurrent = fillMode === 'current' || (className && className.includes('text-white'));
  const fill1 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#ask-gradient-1)'
    : 'url(#ask-inactive-1)';
  const fill2 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#ask-gradient-2)'
    : 'url(#ask-inactive-2)';
  const fill3 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#ask-gradient-3)'
    : 'url(#ask-inactive-3)';

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-all duration-200 ${
        active
          ? 'opacity-100 scale-105 drop-shadow-sm'
          : 'opacity-85 hover:opacity-100'
      } ${className}`}
      {...props}
    >
      <defs>
        {/* Active Serkle Brand Gradients */}
        <linearGradient
          id="ask-gradient-1"
          x1="59.72"
          y1="50.46"
          x2="93.39"
          y2="50.46"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>
        <linearGradient
          id="ask-gradient-2"
          x1="6.61"
          y1="50"
          x2="73.22"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>
        <linearGradient
          id="ask-gradient-3"
          x1="26.61"
          y1="51.02"
          x2="53.58"
          y2="51.02"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>

        {/* Inactive Bold Slate-Grey Gradients */}
        <linearGradient
          id="ask-inactive-1"
          x1="59.72"
          y1="50.46"
          x2="93.39"
          y2="50.46"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#404040" />
          <stop offset="1" stopColor="#666666" />
        </linearGradient>
        <linearGradient
          id="ask-inactive-2"
          x1="6.61"
          y1="50"
          x2="73.22"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#484848" />
          <stop offset="1" stopColor="#6e6e6e" />
        </linearGradient>
        <linearGradient
          id="ask-inactive-3"
          x1="26.61"
          y1="51.02"
          x2="53.58"
          y2="51.02"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#404040" />
          <stop offset="1" stopColor="#666666" />
        </linearGradient>
      </defs>
      <path
        fill={fill1}
        d="M63.85,74.44c-.46,0-.97-.03-1.67-.15l-2.46-.43.86-4.93,2.46.43c.56.1.79.09,1.33.06.49-.02,1.19-.02,1.9-.04l18.23-.1-2.05-1.88c-1.94-1.78-2.33-4.68-.93-6.9,1.9-3.01,2.9-6.49,2.9-10.07,0-5.29-2.13-10.2-5.99-13.83-3.86-3.62-8.93-5.43-14.23-5.09-.1,0-.2,0-.3,0l-2.51.37-.73-4.95,2.47-.36c.82-.12,1.42.02,1.87.27-.38-.22-.82-.32-1.21-.32,6.8-.43,13.18,1.85,18.06,6.43,4.81,4.51,7.57,10.88,7.57,17.47,0,4.53-1.27,8.93-3.68,12.74-.11.17-.08.4.08.55l6.75,6.18c.76.7,1.01,1.78.64,2.74-.37.96-1.29,1.59-2.32,1.6l-24.54.13c-.56.02-1.32.02-1.79.04-.24.01-.48.02-.73.02ZM65.39,27.11c.67.58.83,1.39.84,1.46-.11-.62-.43-1.11-.84-1.46Z"
      />
      <path
        fill={fill2}
        d="M9.11,82.95c-1.08,0-2.03-.69-2.37-1.71-.34-1.02.02-2.15.88-2.79l7.8-5.81c.18-.13.23-.3.24-.42.01-.11,0-.32-.17-.52-5.26-6-8.15-13.71-8.15-21.69,0-9.09,3.81-17.86,10.45-24.07,6.74-6.3,15.55-9.42,24.78-8.79,16.28,1.1,29.42,14.21,30.56,30.49h0c.65,9.26-2.46,18.08-8.76,24.84-6.49,6.96-15.81,10.86-25.32,10.46l-29.94.04h0ZM39.11,77.91s.07,0,.11,0c.35.02.71.02,1.06.02,7.72,0,15.17-3.24,20.44-8.89,5.34-5.73,7.98-13.22,7.43-21.08-.97-13.8-12.11-24.92-25.91-25.85-7.85-.54-15.31,2.12-21.03,7.46-5.64,5.27-8.87,12.71-8.87,20.42,0,6.77,2.46,13.31,6.91,18.4,1.04,1.19,1.55,2.78,1.38,4.34-.17,1.55-.98,2.97-2.23,3.91l-1.74,1.29,22.44-.03h0Z"
      />
      <path
        fill={fill3}
        d="M36.57,60.44c0-.1,0-.26-.03-.47-.02-.21-.03-.37-.03-.47,0-1.42.27-2.64.8-3.66.53-1.02,1.56-2.15,3.08-3.38.4-.32,1.2-.91,2.38-1.76,1.18-.85,2.1-1.56,2.76-2.14.81-.71,1.43-1.51,1.85-2.42s.63-1.86.63-2.87c0-2.04-.72-3.67-2.15-4.87-1.43-1.21-3.39-1.81-5.87-1.81s-4.6.68-6,2.04c-.97.94-1.62,2.16-1.95,3.67-.28,1.28-1.37,2.21-2.68,2.21h0c-1.77,0-3.09-1.66-2.67-3.38.6-2.41,1.78-4.4,3.54-5.96,2.52-2.24,5.96-3.37,10.31-3.37,3.9,0,7.04,1.04,9.44,3.11,2.4,2.08,3.59,4.81,3.59,8.2,0,1.13-.16,2.21-.47,3.24s-.76,1.97-1.35,2.83c-1.03,1.45-2.95,3.11-5.77,4.96-.78.52-1.36.92-1.75,1.19-.86.62-1.48,1.28-1.86,1.96-.38.68-.57,1.48-.57,2.39,0,.08,0,.21.03.37.02.16.03.28.03.37h-5.29ZM36.14,67.5v-.75c0-1.51,1.23-2.74,2.74-2.74h.55c1.51,0,2.74,1.23,2.74,2.74v.75c0,1.51-1.23,2.74-2.74,2.74h-.55c-1.51,0-2.74-1.23-2.74-2.74Z"
      />
    </svg>
  );
};

/**
 * 5. Messages Icon
 */
export const MessagesIcon: React.FC<FooterIconProps> = ({
  active = false,
  className = 'size-7',
  fillMode = 'gradient',
  ...props
}) => {
  const isCurrent = fillMode === 'current' || (className && className.includes('text-white'));
  const fill1 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#msg-gradient-1)'
    : 'url(#msg-inactive-1)';
  const fill2 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#msg-gradient-2)'
    : 'url(#msg-inactive-2)';
  const fill3 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#msg-gradient-3)'
    : 'url(#msg-inactive-3)';
  const fill4 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#msg-gradient-4)'
    : 'url(#msg-inactive-4)';
  const fill5 = isCurrent
    ? 'currentColor'
    : active
    ? 'url(#msg-gradient-5)'
    : 'url(#msg-inactive-5)';

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-all duration-200 ${
        active
          ? 'opacity-100 scale-105 drop-shadow-sm'
          : 'opacity-85 hover:opacity-100'
      } ${className}`}
      {...props}
    >
      <defs>
        {/* Active Serkle Brand Gradients */}
        <linearGradient
          id="msg-gradient-1"
          x1="59.72"
          y1="50.46"
          x2="93.39"
          y2="50.46"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>
        <linearGradient
          id="msg-gradient-2"
          x1="6.61"
          y1="50"
          x2="73.22"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>
        <linearGradient
          id="msg-gradient-3"
          x1="24.18"
          y1="44.85"
          x2="57.8"
          y2="50.89"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>
        <linearGradient
          id="msg-gradient-4"
          x1="23.78"
          y1="47.1"
          x2="57.4"
          y2="53.14"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>
        <linearGradient
          id="msg-gradient-5"
          x1="23.37"
          y1="49.35"
          x2="56.99"
          y2="55.39"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#693403" />
          <stop offset="1" stopColor="#dd9a43" />
        </linearGradient>

        {/* Inactive Bold Slate-Grey Gradients */}
        <linearGradient
          id="msg-inactive-1"
          x1="59.72"
          y1="50.46"
          x2="93.39"
          y2="50.46"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#404040" />
          <stop offset="1" stopColor="#666666" />
        </linearGradient>
        <linearGradient
          id="msg-inactive-2"
          x1="6.61"
          y1="50"
          x2="73.22"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#484848" />
          <stop offset="1" stopColor="#6e6e6e" />
        </linearGradient>
        <linearGradient
          id="msg-inactive-3"
          x1="24.18"
          y1="44.85"
          x2="57.8"
          y2="50.89"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#404040" />
          <stop offset="1" stopColor="#666666" />
        </linearGradient>
        <linearGradient
          id="msg-inactive-4"
          x1="23.78"
          y1="47.1"
          x2="57.4"
          y2="53.14"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#404040" />
          <stop offset="1" stopColor="#666666" />
        </linearGradient>
        <linearGradient
          id="msg-inactive-5"
          x1="23.37"
          y1="49.35"
          x2="56.99"
          y2="55.39"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#404040" />
          <stop offset="1" stopColor="#666666" />
        </linearGradient>
      </defs>
      <path
        fill={fill1}
        d="M63.85,74.44c-.46,0-.97-.03-1.67-.15l-2.46-.43.86-4.93,2.46.43c.56.1.79.09,1.33.06.49-.02,1.19-.02,1.9-.04l18.23-.1-2.05-1.88c-1.94-1.78-2.33-4.68-.93-6.9,1.9-3.01,2.9-6.49,2.9-10.07,0-5.29-2.13-10.2-5.99-13.83-3.86-3.62-8.92-5.43-14.23-5.09-.1,0-.2,0-.3,0l-2.51.37-.73-4.95,2.47-.36c.82-.12,1.42.02,1.87.27-.38-.22-.81-.32-1.21-.32,6.8-.43,13.18,1.85,18.06,6.43,4.81,4.51,7.57,10.88,7.57,17.47,0,4.53-1.27,8.93-3.68,12.74-.11.17-.08.4.08.55l6.75,6.18c.76.7,1.01,1.78.64,2.74-.37.96-1.29,1.59-2.32,1.6l-24.54.13c-.56.02-1.32.02-1.79.04-.24.01-.48.02-.73.02ZM65.39,27.11c.67.58.83,1.39.84,1.46-.11-.62-.43-1.11-.84-1.46Z"
      />
      <path
        fill={fill2}
        d="M9.11,82.95c-1.08,0-2.03-.69-2.37-1.71-.34-1.02.02-2.15.88-2.79l7.8-5.81c.18-.13.23-.3.24-.42.01-.11,0-.32-.17-.52-5.26-6-8.15-13.71-8.15-21.69,0-9.09,3.81-17.86,10.45-24.07,6.74-6.3,15.54-9.42,24.78-8.79,16.28,1.1,29.42,14.21,30.56,30.49h0c.65,9.26-2.46,18.08-8.76,24.84-6.49,6.96-15.81,10.86-25.32,10.46l-29.94.04h0ZM39.11,77.91s.07,0,.11,0c.35.02.71.02,1.06.02,7.72,0,15.17-3.24,20.44-8.89,5.34-5.73,7.98-13.22,7.43-21.08-.97-13.8-12.11-24.92-25.91-25.85-7.85-.54-15.31,2.12-21.03,7.46-5.64,5.27-8.87,12.71-8.87,20.42,0,6.77,2.46,13.31,6.91,18.4,1.04,1.19,1.55,2.78,1.38,4.34-.17,1.55-.98,2.97-2.23,3.91l-1.74,1.29,22.44-.03h0Z"
      />
      <g>
        <circle fill={fill3} cx="52.82" cy="50" r="4.45" />
        <circle fill={fill4} cx="39.91" cy="50" r="4.45" />
        <circle fill={fill5} cx="27" cy="50" r="4.45" />
      </g>
    </svg>
  );
};
