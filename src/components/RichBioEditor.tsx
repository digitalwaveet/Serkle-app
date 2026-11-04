import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Bold, Italic, Underline } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface RichBioEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  rows?: number;
}

const RichBioEditor: React.FC<RichBioEditorProps> = ({
  value,
  onChange,
  maxLength = 500,
  placeholder = 'Tell us about yourself',
  rows = 4,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });

  const wrapSelection = useCallback((prefix: string, suffix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end);

    if (!selectedText) return;

    // Check if already wrapped - if so, unwrap
    const before = value.slice(0, start);
    const after = value.slice(end);
    
    const alreadyWrapped = 
      before.endsWith(prefix) && after.startsWith(suffix);

    let newValue: string;
    let newStart: number;
    let newEnd: number;

    if (alreadyWrapped) {
      // Unwrap
      newValue = before.slice(0, -prefix.length) + selectedText + after.slice(suffix.length);
      newStart = start - prefix.length;
      newEnd = end - prefix.length;
    } else {
      // Wrap
      newValue = before + prefix + selectedText + suffix + after;
      newStart = start + prefix.length;
      newEnd = end + prefix.length;
    }

    if (maxLength && newValue.length > maxLength) return;

    onChange(newValue);

    // Restore selection after state update
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
    });
  }, [value, onChange, maxLength]);

  const handleSelect = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      setShowToolbar(false);
      return;
    }

    // Calculate position relative to textarea
    const rect = textarea.getBoundingClientRect();
    
    // Simple positioning: above the textarea, centered
    setToolbarPos({
      top: -44,
      left: rect.width / 2 - 60,
    });
    setShowToolbar(true);
  }, []);

  // Close toolbar on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        toolbarRef.current && !toolbarRef.current.contains(e.target as Node) &&
        textareaRef.current && !textareaRef.current.contains(e.target as Node)
      ) {
        setShowToolbar(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  return (
    <div className="relative">
      {/* Floating toolbar */}
      {showToolbar && (
        <div
          ref={toolbarRef}
          className="absolute z-50 flex items-center gap-1 bg-popover border border-border rounded-lg shadow-lg px-2 py-1.5 animate-fade-in"
          style={{ top: toolbarPos.top, left: toolbarPos.left }}
        >
          <button
            type="button"
            className="p-1.5 rounded hover:bg-muted transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              wrapSelection('**', '**');
            }}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-muted transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              wrapSelection('*', '*');
            }}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-muted transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              wrapSelection('__', '__');
            }}
            title="Underline"
          >
            <Underline className="h-4 w-4" />
          </button>
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={handleSelect}
        onBlur={() => {
          // Delay to allow toolbar clicks
          setTimeout(() => {
            if (!toolbarRef.current?.contains(document.activeElement)) {
              setShowToolbar(false);
            }
          }, 200);
        }}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="resize-none"
      />
      <div className="text-xs text-muted-foreground mt-1 text-right">{value.length}/{maxLength}</div>
    </div>
  );
};

export default RichBioEditor;
