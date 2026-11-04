import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThumbsUp, BadgeCheck } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { useExpertProfiles } from '@/hooks/useExpertProfiles';
import { useNavigate } from 'react-router-dom';
import { AllExpertsModal } from './AllExpertsModal';
import { ExpertProfileModal } from './ExpertProfileModal';

interface ExpertAnswersCarouselProps {
  onViewAnswer?: (answerId: string) => void;
}

const getCategoryIcon = (category: string) => {
  const icons: Record<string, string> = {
    parenting: '👶',
    health: '❤️',
    relationships: '💑',
    career: '💼',
    'mental-health': '🧠',
    education: '📚',
    lifestyle: '✨',
    family: '👨‍👩‍👧‍👦',
    other: '💭',
  };
  return icons[category] || '💭';
};

export const ExpertAnswersCarousel: React.FC<ExpertAnswersCarouselProps> = ({ onViewAnswer }) => {
  const { data: experts, isLoading } = useExpertProfiles();
  const navigate = useNavigate();
  const [showAllExperts, setShowAllExperts] = useState(false);
  const [stableExperts, setStableExperts] = useState<any[]>([]);
  const [selectedExpert, setSelectedExpert] = useState<any>(null);

  useEffect(() => {
    if (experts && experts.length > 0) {
      setStableExperts(experts);
    }
  }, [experts]);

  const visibleExperts = useMemo(
    () => (experts && experts.length > 0 ? experts : stableExperts),
    [experts, stableExperts],
  );

  if (isLoading && visibleExperts.length === 0) {
    return (
      <div className="px-4 py-3">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <BadgeCheck className="w-4 h-4 text-primary" />
          Verified Experts
        </h2>
        <div className="flex gap-2">
          <div className="col-span-full flex min-h-24 w-full items-center justify-center py-8"><SerkleLoader size="sm" label="Loading answers" /></div>
        </div>
      </div>
    );
  }

  if (visibleExperts.length === 0) {
    return null;
  }

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <BadgeCheck className="w-4 h-4 text-primary" />
          Verified Experts
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary text-xs font-medium h-7"
          onClick={() => setShowAllExperts(true)}
        >
          View All →
        </Button>
      </div>

      <Carousel className="w-full">
        <CarouselContent className="-ml-2">
          {visibleExperts.map((expert: any) => (
            <CarouselItem key={expert.id} className="pl-2 basis-[70%] sm:basis-[55%]">
              <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-background to-muted/30">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <Avatar
                      className="w-12 h-12 border-2 border-primary/20 cursor-pointer"
                      onClick={() => setSelectedExpert(expert)}
                    >
                      <AvatarImage src={expert.profiles?.avatar_url} />
                      <AvatarFallback style={{ backgroundColor: expert.profiles?.avatar_color }}>
                        {expert.profiles?.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3
                          className="text-sm font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                          onClick={() => setSelectedExpert(expert)}
                        >
                          {expert.profiles?.name || expert.profiles?.username}
                        </h3>
                        <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0" />
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                          Expert
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{expert.specialty}</p>
                      {expert.years_experience && (
                        <p className="text-xs text-muted-foreground">
                          {expert.years_experience} years experience
                        </p>
                      )}
                    </div>
                    {expert.answer_likes > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ThumbsUp className="w-3 h-3 fill-primary text-primary" />
                        <span>{expert.answer_likes}</span>
                      </div>
                    )}
                  </div>

                  {expert.featured_answer && (
                    <>
                      <div className="space-y-1">
                        <Badge variant="secondary" className="text-xs">
                          {getCategoryIcon(expert.specialty)} Featured Answer
                        </Badge>
                        <p className="text-sm font-medium line-clamp-2">
                          {expert.featured_answer.questions?.question}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {expert.featured_answer.answer}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const questionId = expert.featured_answer.question_id;
                          if (questionId) navigate(`/ask/question/${questionId}`);
                          if (onViewAnswer && expert.featured_answer.id) onViewAnswer(expert.featured_answer.id);
                        }}
                      >
                        View Answer
                      </Button>
                    </>
                  )}

                  {!expert.featured_answer && expert.bio && (
                    <p className="text-xs text-muted-foreground line-clamp-3">{expert.bio}</p>
                  )}
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <AllExpertsModal open={showAllExperts} onClose={() => setShowAllExperts(false)} />
      <ExpertProfileModal
        open={!!selectedExpert}
        onClose={() => setSelectedExpert(null)}
        expert={selectedExpert}
      />
    </div>
  );
};
