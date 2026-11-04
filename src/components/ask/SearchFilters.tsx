import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

interface SearchFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'parenting', label: 'Parenting & Child Care' },
  { value: 'health', label: 'Health & Wellness' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'career', label: 'Career & Work' },
  { value: 'mental-health', label: 'Mental Health' },
  { value: 'education', label: 'Education & Learning' },
  { value: 'lifestyle', label: 'Lifestyle & Personal' },
  { value: 'family', label: 'Family & Home' },
  { value: 'other', label: 'Other' }
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'answered', label: 'Most Answered' }
];

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  sortBy,
  onSortChange
}) => {
  return (
    <div className="space-y-3 mb-6">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search questions, tags..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category and Sort Filters */}
      <div className="grid grid-cols-2 gap-3">
        <Select value={categoryFilter} onValueChange={onCategoryChange}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger>
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};