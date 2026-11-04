import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ExpertProfileModal } from './ExpertProfileModal';
import { AnonymousAvatar } from './AnonymousAvatar';
import { useQuestionVote, useUserVotes } from '@/hooks/useQuestions';
import { useExpertProfiles } from '@/hooks/useExpertProfiles';
import anonymousLogo from '@/assets/anonymous-logo.png';
import { 
  ThumbsUp, 
  MessageCircle, 
  AlertTriangle, 
  BadgeCheck,
  GitBranch,
  Sparkles
} from 'lucide-react';

interface Question {
  id: string;
  question: string;
  category: string;
  tags: string[];
  timestamp: string;
  answerCount: number;
  expertAnswerCount?: number;
  helpfulCount?: number;
  upvotes: number;
  voteCount?: number;
  isUrgent: boolean;
  hasExpertAnswer: boolean;
  aiResponse?: string;
  isThread?: boolean;
  threadUpdates?: number;
  isUpdatedToday?: boolean;
  lastUpdate?: string;
  is_anonymous?: boolean;
  anonymous_name?: string;
  isExpert?: boolean;
  expertUserId?: string;
  expertProfile?: {
    username: string;
    name: string;
    avatar_url?: string;
    initials?: string;
    avatar_color?: string;
  } | null;
  profiles?: {
    username: string;
    name: string;
  };
}

interface QuestionCardProps {
  question: Question;
  onClick?: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ question, onClick }) => {
  const navigate = useNavigate();
  const voteOnQuestion = useQuestionVote();
  const { data: userVotes } = useUserVotes();
  const hasVoted = userVotes?.questions?.includes(question.id);
  const [selectedExpert, setSelectedExpert] = useState<any>(null);
  const { data: allExperts } = useExpertProfiles(50);

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
    navigate(`/ask/question/${question.id}`);
  };
  
  const handleUpvote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await voteOnQuestion.mutateAsync({ 
      questionId: question.id, 
      hasVoted: !!hasVoted 
    });
  };

  const handleExpertNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (question.isExpert && question.expertUserId && allExperts) {
      const expert = allExperts.find((ex: any) => ex.user_id === question.expertUserId);
      if (expert) {
        setSelectedExpert(expert);
      }
    }
  };

  const helpfulTotal = question.helpfulCount ?? (question.voteCount ?? question.upvotes ?? 0);
  const expertAnswers = question.expertAnswerCount ?? (question.hasExpertAnswer ? 1 : 0);

  return (
    <>
      <Card 
        className={`group cursor-pointer rounded-xl border transition-all duration-150 hover:shadow-sm hover:border-primary/40 ${
          question.isThread 
            ? 'border-l-[3.5px] border-l-primary border-border/80 bg-gradient-to-r from-primary/[0.03] via-card to-card'
            : 'border-border/70 bg-card'
        }`}
        onClick={handleClick}
      >
        <CardContent className="p-3.5 sm:p-4 space-y-2.5">
          {/* 1. Header: [avatar] AskerName · 2h */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative flex-shrink-0">
                {question.isExpert && question.expertProfile ? (
                  <Avatar
                    className="w-6 h-6 border border-primary/30 cursor-pointer"
                    onClick={handleExpertNameClick}
                  >
                    <AvatarImage src={question.expertProfile.avatar_url} />
                    <AvatarFallback 
                      className="text-[10px] text-white"
                      style={{ backgroundColor: question.expertProfile.avatar_color }}
                    >
                      {question.expertProfile.initials}
                    </AvatarFallback>
                  </Avatar>
                ) : question.anonymous_name ? (
                  <AnonymousAvatar pseudonym={question.anonymous_name} size={24} className="border border-border rounded-full" />
                ) : (
                  <img 
                    src={anonymousLogo} 
                    alt="Anonymous Asker" 
                    className="w-6 h-6 rounded-full border border-border"
                  />
                )}
              </div>

              <div className="flex items-center gap-1.5 min-w-0 text-xs text-muted-foreground truncate">
                <span
                  className={`font-medium text-foreground truncate ${question.isExpert ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                  onClick={question.isExpert ? handleExpertNameClick : undefined}
                >
                  {question.isExpert && question.expertProfile
                    ? question.expertProfile.name
                    : question.is_anonymous 
                      ? (question.anonymous_name || 'Anonymous') 
                      : 'Community Member'}
                </span>

                {question.isExpert && (
                  <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-primary bg-primary/10 px-1 py-0.2 rounded font-semibold border border-primary/20">
                    <BadgeCheck className="w-3 h-3 text-primary" />
                    Expert
                  </span>
                )}

                <span className="text-muted-foreground/50 flex-shrink-0">·</span>
                <span className="flex-shrink-0 text-muted-foreground font-normal">{question.timestamp}</span>
              </div>
            </div>

            {question.isUrgent && (
              <Badge variant="destructive" className="animate-pulse text-[10px] px-1.5 py-0 h-4 flex-shrink-0 font-semibold">
                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                Urgent
              </Badge>
            )}
          </div>

          {/* 2. Question Text (Line clamped to 2 lines for fast scanning) */}
          <h3 className="text-[14px] sm:text-[15px] font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            “{question.question}”
          </h3>

          {/* 3. Category & Tags */}
          <div className="flex flex-wrap items-center gap-1.5">
            {question.category && (
              <Badge 
                variant="secondary" 
                className="text-[11px] px-2 py-0 h-5 font-medium bg-muted/70 text-foreground hover:bg-muted border-border/50"
              >
                {question.category}
              </Badge>
            )}
            {question.tags && question.tags.slice(0, 2).map((tag) => (
              <Badge 
                key={tag} 
                variant="outline" 
                className="text-[11px] px-1.5 py-0 h-5 text-muted-foreground border-border/60"
              >
                #{tag}
              </Badge>
            ))}
            {question.tags && question.tags.length > 2 && (
              <span className="text-[10px] text-muted-foreground/80 font-medium">
                +{question.tags.length - 2}
              </span>
            )}
          </div>

          {/* 4. Stats: Answers · Expert Answers · Helpful */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1 border-t border-border/40">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
              {question.answerCount} {question.answerCount === 1 ? 'Answer' : 'Answers'}
            </span>

            {expertAnswers > 0 && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="flex items-center gap-1 font-medium text-primary">
                  <BadgeCheck className="w-3.5 h-3.5 text-primary" />
                  {expertAnswers} Expert Answer{expertAnswers !== 1 ? 's' : ''}
                </span>
              </>
            )}

            <span className="text-muted-foreground/30">·</span>
            <button
              type="button"
              onClick={handleUpvote}
              className={`flex items-center gap-1 hover:text-primary transition-colors ${
                hasVoted ? 'text-primary font-semibold' : 'text-muted-foreground'
              }`}
              title="Mark as helpful / upvote"
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${hasVoted ? 'fill-current' : ''}`} />
              Helpful {helpfulTotal}
            </button>
          </div>

          {/* 5. Indicators: ✨ AI Summary available & Story Updates */}
          {(Boolean(question.answerCount >= 2) || Boolean(question.isThread)) && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {question.answerCount >= 2 && (
                <span 
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full transition-colors group-hover:bg-primary/15"
                >
                  <Sparkles className="w-3 h-3 text-primary" />
                  AI Summary available
                </span>
              )}

              {question.isThread && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground bg-muted/70 border border-border/80 px-2 py-0.5 rounded-full">
                  <GitBranch className="w-3 h-3 text-primary" />
                  {question.isUpdatedToday ? (
                    <span className="inline-flex items-center gap-1 text-primary font-semibold">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                      </span>
                      Updated today
                    </span>
                  ) : (question.threadUpdates || 0) > 0 ? (
                    <span>{question.threadUpdates} Story Update{question.threadUpdates !== 1 ? 's' : ''}</span>
                  ) : (
                    <span>2 Story Updates</span>
                  )}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ExpertProfileModal
        open={!!selectedExpert}
        onClose={() => setSelectedExpert(null)}
        expert={selectedExpert}
      />
    </>
  );
};
