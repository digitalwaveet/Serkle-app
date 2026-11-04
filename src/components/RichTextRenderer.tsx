import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Renders text with @mentions as bold clickable links and #hashtags in primary color.
 */
export const RichTextRenderer: React.FC<{ text: string }> = ({ text }) => {
  const navigate = useNavigate();
  const parts = text.split(/(@\w+|#\w+)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('#')) {
          return <span key={i} className="text-primary font-medium">{part}</span>;
        }
        if (part.startsWith('@')) {
          const username = part.slice(1);
          return (
            <button
              key={i}
              className="font-bold text-primary hover:underline inline"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${username}`);
              }}
            >
              {part}
            </button>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
};
