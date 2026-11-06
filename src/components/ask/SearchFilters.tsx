import React, { useId } from "react";
import { Search } from "lucide-react";
import { ASK_CATEGORIES } from "@/lib/askPresentation";
interface Props {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
}
export function SearchFilters({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  sortBy,
  onSortChange,
}: Props) {
  const id = useId();
  return (
    <div className="ask-ui mb-6">
      <div className="ask-search">
        <Search aria-hidden="true" />
        <label className="sr-only" htmlFor={`${id}-search`}>
          Search questions and topics
        </label>
        <input
          id={`${id}-search`}
          type="search"
          placeholder="Search questions and topics"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="sr-only" htmlFor={`${id}-category`}>
            Category
          </label>
          <select
            id={`${id}-category`}
            className="ask-native-select"
            value={categoryFilter}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="all">All categories</option>
            {ASK_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="sr-only" htmlFor={`${id}-sort`}>
            Sort questions
          </label>
          <select
            id={`${id}-sort`}
            className="ask-native-select"
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value)}
          >
            <option value="recent">Most recent</option>
            <option value="popular">Most popular</option>
            <option value="answered">Most answered</option>
          </select>
        </div>
      </div>
    </div>
  );
}
