import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Renders bio text with:
 * - Line breaks preserved
 * - **bold**, *italic*, __underline__ formatting
 * - @mentions as clickable links
 * - #hashtags in primary color
 * - URLs as blue clickable links
 */
export const BioRichTextRenderer: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const navigate = useNavigate();

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const mentionRegex = /(@[\w.]+)/g;
  const hashtagRegex = /(#\w+)/g;
  const boldRegex = /\*\*(.+?)\*\*/g;
  const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
  const underlineRegex = /__(.+?)__/g;

  // Process text into React elements
  const renderText = (input: string): React.ReactNode[] => {
    // First split by formatting markers, then by mentions/hashtags/urls
    const parts: React.ReactNode[] = [];
    
    // Combined regex for all tokens
    const combinedRegex = /(\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*(?!\*)[^*]+(?<!\*)\*(?!\*)|@[\w.]+|#\w+|https?:\/\/[^\s]+)/g;
    
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = combinedRegex.exec(input)) !== null) {
      // Add plain text before match
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{input.slice(lastIndex, match.index)}</span>);
      }

      const token = match[0];

      if (token.startsWith('**') && token.endsWith('**')) {
        // Bold
        const inner = token.slice(2, -2);
        parts.push(<strong key={key++}>{inner}</strong>);
      } else if (token.startsWith('__') && token.endsWith('__')) {
        // Underline
        const inner = token.slice(2, -2);
        parts.push(<span key={key++} className="underline">{inner}</span>);
      } else if (token.startsWith('*') && token.endsWith('*') && !token.startsWith('**')) {
        // Italic
        const inner = token.slice(1, -1);
        parts.push(<em key={key++}>{inner}</em>);
      } else if (token.startsWith('@')) {
        // Mention
        const username = token.slice(1);
        parts.push(
          <button
            key={key++}
            className="font-bold text-primary hover:underline inline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${username}`);
            }}
          >
            {token}
          </button>
        );
      } else if (token.startsWith('#')) {
        // Hashtag
        parts.push(<span key={key++} className="text-primary font-medium">{token}</span>);
      } else if (token.startsWith('http')) {
        // URL
        parts.push(
          <a
            key={key++}
            href={token}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {token}
          </a>
        );
      }

      lastIndex = match.index + token.length;
    }

    // Remaining text
    if (lastIndex < input.length) {
      parts.push(<span key={key++}>{input.slice(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : [<span key={0}>{input}</span>];
  };

  // Split by newlines first, then render each line
  const lines = text.split('\n');

  return (
    <span className={className}>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {renderText(line)}
        </React.Fragment>
      ))}
    </span>
  );
};

export default BioRichTextRenderer;
