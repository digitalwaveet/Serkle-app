import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NavigationProvider } from "@/contexts/NavigationContext";
import Ask from "@/pages/Ask";
import AskProfile from "@/pages/AskProfile";
import QuestionDetail from "@/pages/QuestionDetail";
import { AnonymousStoryModal } from "@/components/ask/AnonymousStoryModal";
import { AnonymousThreadComponent } from "@/components/ask/AnonymousThread";
import { ScrollTriggeredAIInsight } from "@/components/ask/ScrollTriggeredAIInsight";
import { SearchFilters } from "@/components/ask/SearchFilters";
import { Toaster } from "sonner";
import "@/index.css";
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
function Gallery() {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [sort, setSort] = useState("recent");
  return (
    <main className="ask-ui ask-shell ask-main mx-auto max-w-2xl">
      <h1 className="text-2xl mb-5">Ask components</h1>
      <button
        className="ask-button ask-button--primary mb-5"
        onClick={() => setOpen(true)}
      >
        Open story composer
      </button>
      <SearchFilters
        searchQuery={search}
        onSearchChange={setSearch}
        categoryFilter={category}
        onCategoryChange={setCategory}
        sortBy={sort}
        onSortChange={setSort}
      />
      <ScrollTriggeredAIInsight content="An AI-generated note accompanies the original community discussion." />
      <div className="mt-5">
        <AnonymousThreadComponent
          thread={{
            id: "thread",
            originalQuestion: "Making time for creative work",
            category: "career",
            tags: [],
            timestamp: "2 hours ago",
            upvotes: 0,
            isUrgent: false,
            hasExpertAnswer: false,
            canContinue: true,
            updates: [0, 1, 2].map((i) => ({
              id: "update-" + i,
              content: "A small update from the original conversation.",
              timestamp: "1 hour ago",
              upvotes: i,
              isOriginalPoster: true,
            })),
          }}
          onContinueThread={() => setOpen(true)}
          onUpvote={(id) =>
            (window as any).askFixture.calls.push({
              name: "thread-vote",
              value: id,
            })
          }
        />
      </div>
      <AnonymousStoryModal isOpen={open} onClose={() => setOpen(false)} />
    </main>
  );
}
function App() {
  const location = useLocation();
  return (
    <>
      <Routes>
        <Route
          path="/ask"
          element={
            <Ask
              activeTab="ask"
              onTabSelect={() => {}}
              onOpenCreate={() => {}}
            />
          }
        />
        <Route path="/ask/profile" element={<AskProfile />} />
        <Route path="/ask/question/:questionId" element={<QuestionDetail />} />
        <Route path="/ask/components" element={<Gallery />} />
        <Route path="*" element={<main>Destination</main>} />
      </Routes>
      <p hidden data-testid="ask-current-path">
        {location.pathname}
      </p>
      <Toaster />
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <NavigationProvider>
          <App />
        </NavigationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </BrowserRouter>,
);
