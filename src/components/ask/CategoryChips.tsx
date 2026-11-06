import React from "react";
import { ASK_CATEGORIES } from "@/lib/askPresentation";
export function CategoryChips({
  activeCategory,
  onCategoryChange,
}: {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}) {
  return (
    <div className="ask-topics" role="group" aria-label="Question topics">
      {[{ value: "all", label: "All" }, ...ASK_CATEGORIES].map((category) => (
        <button
          key={category.value}
          className="ask-topic"
          aria-pressed={activeCategory === category.value}
          onClick={() => onCategoryChange(category.value)}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
}
