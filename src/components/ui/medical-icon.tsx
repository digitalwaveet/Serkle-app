import React from 'react';

interface MedicalIconProps {
  size?: number;
  className?: string;
}

export const MedicalIcon: React.FC<MedicalIconProps> = ({ 
  size = 24, 
  className = "" 
}) => {
  const circleRadius = size / 2;
  const crossThickness = circleRadius * 0.4; // Much thicker cross
  const crossLength = circleRadius * 0.6; // Slightly longer arms
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Red Circle Background */}
      <circle
        cx={center}
        cy={center}
        r={circleRadius}
        fill="#FF0000"
      />
      
      {/* White Cross */}
      {/* Horizontal bar */}
      <rect
        x={center - crossLength}
        y={center - crossThickness / 2}
        width={crossLength * 2}
        height={crossThickness}
        fill="#FFFFFF"
      />
      
      {/* Vertical bar */}
      <rect
        x={center - crossThickness / 2}
        y={center - crossLength}
        width={crossThickness}
        height={crossLength * 2}
        fill="#FFFFFF"
      />
    </svg>
  );
};