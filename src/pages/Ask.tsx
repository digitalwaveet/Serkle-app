import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import FooterNav from '../components/FooterNav';
import { InstallPrompt } from '../components/InstallPrompt';
import { AskQuestionForm } from '../components/ask/AskQuestionForm';
import { QuestionFeed } from '../components/ask/QuestionFeed';
import { ExpertAnswersCarousel } from '../components/ask/ExpertAnswersCarousel';
import { AnonymousStoryModal } from '../components/ask/AnonymousStoryModal';
import { CategoryChips } from '../components/ask/CategoryChips';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { User, Plus, Search, BadgeCheck } from 'lucide-react';
import { type TabKey } from '@/hooks/useAppNav';

interface AskProps {
  activeTab: TabKey;
  onTabSelect: (tab: TabKey) => void;
  onOpenCreate: () => void;
}

const Ask: React.FC<AskProps> = ({
  activeTab,
  onTabSelect,
  onOpenCreate
}) => {
  const navigate = useNavigate();
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [activeQuestionTab, setActiveQuestionTab] = useState("recent");
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showExpertOnly, setShowExpertOnly] = useState(false);

  const handleViewExpertAnswer = (answerId: string) => {
    navigate(`/ask/question/${answerId}`);
  };

  // Determine the effective filter for the feed
  const effectiveFilter = showExpertOnly ? 'expert' as const : activeQuestionTab as 'recent' | 'trending' | 'unanswered';

  return <div className="min-h-screen bg-background" data-testid="ask-page">
      <InstallPrompt />
      <Header />
      
      <main className="container mx-auto max-w-2xl px-4 pt-4 pb-24">
        {/* 1. Hero Area */}
        <div className="mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Ask anonymously
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Get advice from the community without judgment.
              </p>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/ask/profile')}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <User className="h-4 w-4" />
              Profile
            </Button>
          </div>
          
          {/* Primary CTA - most visually important action */}
          <Button
            onClick={() => setShowQuestionForm(true)}
            className="w-full bg-gradient-primary text-primary-foreground font-semibold h-12 text-base shadow-glow hover:shadow-elegant transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Ask a Question
          </Button>
        </div>

        {/* 2. Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search questions, topics & experts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 3. Category Navigation - horizontal scrollable chips */}
        <CategoryChips
          activeCategory={categoryFilter}
          onCategoryChange={setCategoryFilter}
        />

        {/* 4. Feed Filters */}
        <Tabs value={activeQuestionTab} onValueChange={(val) => {
          setActiveQuestionTab(val);
          if (showExpertOnly) setShowExpertOnly(false);
        }}>
          <div className="flex items-center justify-between mb-3">
            <TabsList className="grid grid-cols-3 flex-1 mr-3">
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="trending">Trending</TabsTrigger>
              <TabsTrigger value="unanswered">Unanswered</TabsTrigger>
            </TabsList>
            
            {/* Expert Answers toggle */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Switch
                id="expert-answers"
                checked={showExpertOnly}
                onCheckedChange={setShowExpertOnly}
                className="scale-90"
              />
              <Label 
                htmlFor="expert-answers" 
                className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap flex items-center gap-1"
              >
                <BadgeCheck className="w-3 h-3 text-primary" />
                Expert
              </Label>
            </div>
          </div>
          
          {/* 5. Community Questions Feed */}
          <TabsContent value="recent" className="mt-0">
            <QuestionFeed filter={effectiveFilter} searchQuery={searchQuery} categoryFilter={categoryFilter} />
          </TabsContent>
          
          <TabsContent value="trending" className="mt-0">
            <QuestionFeed filter={effectiveFilter} searchQuery={searchQuery} categoryFilter={categoryFilter} />
          </TabsContent>
          
          <TabsContent value="unanswered" className="mt-0">
            <QuestionFeed filter={effectiveFilter} searchQuery={searchQuery} categoryFilter={categoryFilter} />
          </TabsContent>
        </Tabs>

        {/* 6. Verified Experts - compact section below the feed */}
        <div className="mt-8">
          <ExpertAnswersCarousel onViewAnswer={handleViewExpertAnswer} />
        </div>
      </main>

      {/* Ask Question Form Modal */}
      {showQuestionForm && <AskQuestionForm isOpen={showQuestionForm} onClose={() => setShowQuestionForm(false)} />}

      {/* Anonymous Story Modal */}
      {showStoryModal && <AnonymousStoryModal isOpen={showStoryModal} onClose={() => setShowStoryModal(false)} />}

      <FooterNav 
        active={activeTab} 
        onSelect={() => {}} // Navigation handled by FooterNav directly
        onOpenCreate={onOpenCreate}
        onOpenStoryModal={() => setShowStoryModal(true)}
        onOpenQuestionForm={() => setShowQuestionForm(true)}
      />
    </div>;
};
export default Ask;