import React, { useId, useState } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
export function ScrollTriggeredAIInsight({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  if (!content?.trim()) return null;
  return (
    <section className={cn("ask-ui ask-insight", className)}>
      <button
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(!expanded)}
      >
        <Sparkles aria-hidden="true" />
        AI insight
        {expanded ? (
          <ChevronUp className="ml-auto size-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="ml-auto size-4" aria-hidden="true" />
        )}
      </button>
      {expanded && <p id={id}>{content}</p>}
    </section>
  );
}
