import React from 'react';

interface ShareIconProps extends React.SVGProps<SVGSVGElement> {
  strokeWidth?: number | string;
}

export const ShareIcon: React.FC<ShareIconProps> = ({
  strokeWidth = 1.85,
  className,
  ...props
}) => (
  <svg
     xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M5 11.5v6a2.5 2.5 0 0 0 2.5 2.5h9a2.5 2.5 0 0 0 2.5-2.5v-6" />
    <path d="M12 15V4" />
    <path d="m8 8 4-4 4 4" />
  </svg>
);

export default ShareIcon;

