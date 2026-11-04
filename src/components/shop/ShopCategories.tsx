import React from 'react';
import { Badge } from '../ui/badge';

interface ShopCategoriesProps {
  selected: string;
  onSelect: (category: string) => void;
}

const categories = [
  { id: 'all', label: 'All', icon: '🛍️' },
  { id: 'electronics', label: 'Electronics', icon: '📱' },
  { id: 'fashion', label: 'Fashion', icon: '👗' },
  { id: 'home', label: 'Home & Garden', icon: '🏠' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'beauty', label: 'Beauty', icon: '💄' },
  { id: 'books', label: 'Books', icon: '📚' },
  { id: 'art', label: 'Art & Crafts', icon: '🎨' },
  { id: 'food', label: 'Food & Drinks', icon: '🍕' },
];

export const ShopCategories: React.FC<ShopCategoriesProps> = ({ selected, onSelect }) => {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="flex gap-2.5 pb-2">
        {categories.map((category) => (
          <Badge
            key={category.id}
            variant={selected === category.id ? "default" : "secondary"}
            className="cursor-pointer touch-target active:scale-95 transition-all shrink-0 px-4 py-2 text-sm font-medium"
            onClick={() => onSelect(category.id)}
          >
            <span className="mr-1.5 text-base">{category.icon}</span>
            {category.label}
          </Badge>
        ))}
      </div>
    </div>
  );
};