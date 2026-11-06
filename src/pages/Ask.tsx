import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, UserRound, Glasses, BadgeCheck } from "lucide-react";
import Header from "@/components/Header";
import FooterNav from "@/components/FooterNav";
import { InstallPrompt } from "@/components/InstallPrompt";
import { AskQuestionForm } from "@/components/ask/AskQuestionForm";
import { AnonymousStoryModal } from "@/components/ask/AnonymousStoryModal";
import { QuestionFeed } from "@/components/ask/QuestionFeed";
import { ExpertAnswersCarousel } from "@/components/ask/ExpertAnswersCarousel";
import { CategoryChips } from "@/components/ask/CategoryChips";
import type { TabKey } from "@/hooks/useAppNav";
import "@/components/ask/ask.css";
interface AskProps {
  activeTab: TabKey;
  onTabSelect: (tab: TabKey) => void;
  onOpenCreate: () => void;
}
export default function Ask({ activeTab, onOpenCreate }: AskProps) {
  const navigate = useNavigate();
  const [showQuestion, setShowQuestion] = useState(false),
    [showStory, setShowStory] = useState(false);
  const [sort, setSort] = useState<"recent" | "trending" | "unanswered">(
    "recent",
  );
  const [expert, setExpert] = useState(false);
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  return (
    <div className="ask-root" data-testid="ask-page">
      <InstallPrompt />
      <Header />
      <section className="ask-ui ask-shell">
        <main className="ask-main">
          <section className="ask-hero">
            <div className="ask-hero-heading">
              <div>
                <p className="ask-eyebrow">Serkle Ask</p>
                <h1>
                  What’s on
                  <br />
                  your mind?
                </h1>
              </div>
              <button
                className="ask-button ask-button--quiet"
                onClick={() => navigate("/ask/profile")}
              >
                <UserRound aria-hidden="true" />
                My activity
              </button>
            </div>
            <p>Ask a question. Share a perspective.</p>
            <div className="ask-hero-action">
              <button
                className="ask-button ask-button--primary"
                onClick={() => setShowQuestion(true)}
              >
                <Plus aria-hidden="true" />
                Ask a question
              </button>
              <span className="ask-identity-hint">
                <Glasses aria-hidden="true" />
                Choose how your identity appears before posting.
              </span>
            </div>
          </section>
          <div className="ask-search">
            <label className="sr-only" htmlFor="ask-search">
              Search questions and topics
            </label>
            <Search aria-hidden="true" />
            <input
              id="ask-search"
              type="search"
              placeholder="Search questions and topics"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <CategoryChips
            activeCategory={category}
            onCategoryChange={setCategory}
          />
          <div className="ask-feed-controls">
            <div className="ask-sort" role="group" aria-label="Question order">
              {(["recent", "trending", "unanswered"] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={sort === value}
                  onClick={() => {
                    setSort(value);
                    setExpert(false);
                  }}
                >
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
            <button
              className="ask-expert-filter"
              aria-pressed={expert}
              onClick={() => {
                setExpert(!expert);
                setSort("recent");
              }}
            >
              <BadgeCheck aria-hidden="true" />
              From experts
            </button>
          </div>
          <QuestionFeed
            filter={expert ? "expert" : sort}
            searchQuery={query}
            categoryFilter={category}
          />
          <section
            className="ask-experts-section"
            aria-label="Verified community experts"
          >
            <ExpertAnswersCarousel
              onViewAnswer={(questionId) =>
                navigate(`/ask/question/${questionId}`)
              }
            />
          </section>
        </main>
      </section>
      {showQuestion && (
        <AskQuestionForm
          isOpen={showQuestion}
          onClose={() => setShowQuestion(false)}
        />
      )}{" "}
      {showStory && (
        <AnonymousStoryModal
          isOpen={showStory}
          onClose={() => setShowStory(false)}
        />
      )}
      <FooterNav
        active={activeTab}
        onSelect={() => {}}
        onOpenCreate={onOpenCreate}
        onOpenStoryModal={() => setShowStory(true)}
        onOpenQuestionForm={() => setShowQuestion(true)}
      />
    </div>
  );
}
