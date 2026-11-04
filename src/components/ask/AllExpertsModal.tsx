import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BadgeCheck, ThumbsUp, MessageSquare, Users, CheckCircle2 } from 'lucide-react';
import { useExpertProfiles } from '@/hooks/useExpertProfiles';
import { VideoLoader } from '@/components/ui/VideoLoader';
import { ExpertProfileModal } from './ExpertProfileModal';

interface AllExpertsModalProps {
  open: boolean;
  onClose: () => void;
}

export const AllExpertsModal: React.FC<AllExpertsModalProps> = ({ open, onClose }) => {
  const { data: experts, isLoading } = useExpertProfiles(50);
  const navigate = useNavigate();
  const [selectedExpert, setSelectedExpert] = useState<any>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-primary" />
              Verified Experts
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Browse verified community experts and their answers.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <VideoLoader size="md" />
            </div>
          ) : !experts || experts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No verified experts yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {experts.map((expert: any) => (
                <Card key={expert.id} className="overflow-hidden border-primary/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
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
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <h3
                              className="text-sm font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                              onClick={() => setSelectedExpert(expert)}
                            >
                              {expert.profiles?.name || expert.profiles?.username}
                            </h3>
                            <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Verified Professional
                            </Badge>
                          </div>
                          {expert.professional_title && (
                            <p className="text-xs font-medium text-muted-foreground">{expert.professional_title}</p>
                          )}
                        </div>
                        <div className="mt-2 space-y-0.5">
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-muted-foreground w-16">Specialty:</span>
                            <span className="font-medium">{expert.specialty}</span>
                          </div>
                          {expert.years_experience && (
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-muted-foreground w-16">Experience:</span>
                              <span className="font-medium">{expert.years_experience} years</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Trust Signals */}
                    <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 px-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="font-medium text-foreground">{expert.answers_count || 0}</span> Answers
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span className="font-medium text-foreground">{expert.helpful_percentage || 0}%</span> Helpful
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span className="font-medium text-foreground">{expert.followers_count >= 1000 ? (expert.followers_count / 1000).toFixed(1) + 'K' : expert.followers_count || 0}</span> Followers
                      </div>
                    </div>

                    {expert.bio && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{expert.bio}</p>
                    )}

                    {expert.featured_answer && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-3"
                        onClick={() => {
                          onClose();
                          navigate(`/ask/question/${expert.featured_answer.question_id}`);
                        }}
                      >
                        View Featured Answer
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ExpertProfileModal
        open={!!selectedExpert}
        onClose={() => setSelectedExpert(null)}
        expert={selectedExpert}
      />
    </>
  );
};
