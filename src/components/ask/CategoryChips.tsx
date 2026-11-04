import React, { useRef } from 'react';

const CATEGORIES = [
  { value: 'all', label: 'All', icon: '🔥' },
  { value: 'parenting', label: 'Parenting', icon: '👶' },
  { value: 'health', label: 'Health', icon: '❤️' },
  { value: 'relationships', label: 'Relationships', icon: '💑' },
  { value: 'career', label: 'Career', icon: '💼' },
  { value: 'mental-health', label: 'Mental Health', icon: '🧠' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'lifestyle', label: 'Lifestyle', icon: '✨' },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { value: 'other', label: 'Other', icon: '💭' },
];

interface CategoryChipsProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export const CategoryChips: React.FC<CategoryChipsProps> = ({
  activeCategory,
  onCategoryChange,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="mb-3 -mx-4">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-thin"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => onCategoryChange(cat.value)}
              className={`
                flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium
                transition-all duration-200 border flex-shrink-0
                ${isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                }
              `}
            >
              <span className="text-sm">{cat.icon}</span>
              {cat.label}
            </button>
          );
        })}
      </div>
      {/* Hide WebKit scrollbar */}
      <style>{`
        div[class*="overflow-x-auto"]::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};
