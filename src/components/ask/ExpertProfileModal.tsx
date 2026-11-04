import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BadgeCheck, MessageCircle, ArrowLeft, MessageSquare, ThumbsUp, Users, Info, GraduationCap, CheckCircle2 } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useCreateConversation } from '@/hooks/useConversations';
import { usePresence } from '@/hooks/usePresence';
import { useUserPosts } from '@/hooks/useUserPosts';
import { useExpertAnswers } from '@/hooks/useExpertAnswers';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ExpertProfileModalProps {
  open: boolean;
  onClose: () => void;
  expert: {
    user_id: string;
    specialty: string;
    bio?: string | null;
    years_experience?: number | null;
    certifications?: string[] | null;
    professional_title?: string | null;
    qualification?: string | null;
    institution?: string | null;
    profiles?: {
      name?: string;
      username?: string;
      avatar_url?: string | null;
      initials?: string;
      avatar_color?: string;
    } | null;
    answers_count?: number;
    helpful_percentage?: number;
    followers_count?: number;
    answer_likes?: number;
  } | null;
}

export const ExpertProfileModal: React.FC<ExpertProfileModalProps> = ({ open, onClose, expert }) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { createConversation } = useCreateConversation();
  const { isUserOnline } = usePresence(user?.id);
  const [isDmLoading, setIsDmLoading] = useState(false);

  const { posts, isLoading: postsLoading } = useUserPosts(expert?.user_id);
  const { data: answers, isLoading: answersLoading } = useExpertAnswers(expert?.user_id);

  if (!open || !expert) return null;

  const isOnline = isUserOnline(expert.user_id);
  const profile = expert.profiles;

  const handleDmExpert = async () => {
    if (!user?.id) {
      toast.error('Please sign in to message experts');
      return;
    }
    if (user.id === expert.user_id) {
      toast.info("You can't message yourself");
      return;
    }
    setIsDmLoading(true);
    try {
      await createConversation(user.id, expert.user_id);
      onClose();
      navigate(`/messages?userId=${expert.user_id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to start conversation');
    } finally {
      setIsDmLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 animate-fade-in">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background/80 to-accent/20 backdrop-blur-xl" />

      <div className="relative h-full w-full overflow-y-auto">
        {/* Header bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-background/30 backdrop-blur-lg border-b border-border/30">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold text-foreground">Expert Profile</h1>
          <div className="w-10" />
        </div>

        {/* Profile hero */}
        <div className="flex flex-col items-center text-center px-6 pt-8 pb-4 space-y-4">
          {/* Avatar with glass ring */}
          <div className="relative">
            <div className="rounded-full p-1 bg-gradient-to-br from-primary/40 to-accent/40 backdrop-blur-sm">
              <Avatar className="w-24 h-24 border-2 border-background/60">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback
                  className="text-xl text-white font-bold"
                  style={{ backgroundColor: profile?.avatar_color }}
                >
                  {profile?.initials}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className={`absolute bottom-1 right-1 w-4.5 h-4.5 rounded-full border-2 border-background ${isOnline ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
          </div>

          {/* Name + badge */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1.5">
              <h2 className="text-xl font-bold text-foreground">{profile?.name || profile?.username || 'Expert'}</h2>
            </div>
            {expert.professional_title && (
              <p className="text-sm font-medium text-muted-foreground">{expert.professional_title}</p>
            )}
            
            <div className="pt-1 flex items-center justify-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="text-xs bg-primary/10 text-primary border-primary/20 flex items-center gap-1 cursor-help hover:bg-primary/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified by Serkle
                      <Info className="w-3 h-3 ml-0.5 opacity-70" />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Serkle reviewed this professional's submitted credentials.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-muted-foreground pt-1">{isOnline ? '🟢 Online now' : 'Offline'}</p>
          </div>

          {/* Details */}
          <div className="flex flex-col items-center gap-1 mt-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-medium">Specialty:</span>
              <span className="font-semibold text-foreground">{expert.specialty}</span>
            </div>
            {expert.years_experience && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground font-medium">Experience:</span>
                <span className="font-semibold text-foreground">{expert.years_experience} years</span>
              </div>
            )}
          </div>

          {/* Trust Signals */}
          <div className="flex items-center gap-4 py-2">
            <div className="flex flex-col items-center px-4 py-2.5 rounded-xl bg-card/50 backdrop-blur-sm border border-border/30">
              <span className="text-sm font-bold text-foreground">{expert.answers_count || 0}</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><MessageSquare className="w-3 h-3" /> Answers</span>
            </div>
            <div className="flex flex-col items-center px-4 py-2.5 rounded-xl bg-card/50 backdrop-blur-sm border border-border/30">
              <span className="text-sm font-bold text-foreground">{expert.helpful_percentage || 0}%</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><ThumbsUp className="w-3 h-3" /> Helpful</span>
            </div>
            <div className="flex flex-col items-center px-4 py-2.5 rounded-xl bg-card/50 backdrop-blur-sm border border-border/30">
              <span className="text-sm font-bold text-foreground">{(expert.followers_count ?? 0) >= 1000 ? ((expert.followers_count ?? 0) / 1000).toFixed(1) + 'K' : (expert.followers_count || 0)}</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><Users className="w-3 h-3" /> Followers</span>
            </div>
          </div>



          {/* DM button */}
          <Button
            className="w-full gap-2 rounded-xl"
            size="lg"
            onClick={handleDmExpert}
            disabled={isDmLoading}
          >
            <MessageCircle className="w-4 h-4" />
            {isDmLoading ? 'Opening chat...' : 'DM Expert'}
          </Button>
        </div>

        {/* Tabs section */}
        <div className="px-4 pb-8">
          <Tabs defaultValue="about" className="w-full">
            <TabsList className="w-full flex overflow-x-auto no-scrollbar bg-card/50 backdrop-blur-sm border border-border/30 rounded-xl justify-start p-1 h-auto">
              <TabsTrigger value="about" className="flex-1 whitespace-nowrap min-w-[80px] gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary py-2 text-xs">
                About
              </TabsTrigger>
              <TabsTrigger value="answers" className="flex-1 whitespace-nowrap min-w-[110px] gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary py-2 text-xs">
                Expert Answers
              </TabsTrigger>
              <TabsTrigger value="credentials" className="flex-1 whitespace-nowrap min-w-[100px] gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary py-2 text-xs">
                Credentials
              </TabsTrigger>
              <TabsTrigger value="topics" className="flex-1 whitespace-nowrap min-w-[80px] gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary py-2 text-xs">
                Topics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="about" className="mt-4 space-y-4">
              {expert.bio ? (
                <div className="rounded-xl bg-card/40 backdrop-blur-sm border border-border/30 p-4">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{expert.bio}</p>
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No about information provided
                </div>
              )}
            </TabsContent>

            <TabsContent value="credentials" className="mt-4 space-y-4">
              <div className="rounded-xl bg-card/40 backdrop-blur-sm border border-border/30 p-4 space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    Education & Qualifications
                  </h3>
                  {expert.qualification || expert.institution ? (
                    <ul className="space-y-1.5 mt-2">
                      {expert.qualification && (
                        <li className="text-sm text-foreground flex items-start gap-2">
                          <span className="text-muted-foreground w-20 flex-shrink-0">Degree:</span>
                          <span className="font-medium">{expert.qualification}</span>
                        </li>
                      )}
                      {expert.institution && (
                        <li className="text-sm text-foreground flex items-start gap-2">
                          <span className="text-muted-foreground w-20 flex-shrink-0">Institution:</span>
                          <span className="font-medium">{expert.institution}</span>
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No specific qualifications listed.</p>
                  )}
                </div>

                {expert.certifications && expert.certifications.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <BadgeCheck className="w-4 h-4 text-primary" />
                      Certifications
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {expert.certifications.map((cert, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-medium bg-background/50">
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="topics" className="mt-4 space-y-4">
              <div className="rounded-xl bg-card/40 backdrop-blur-sm border border-border/30 p-4">
                <h3 className="text-sm font-semibold mb-3">Expertise Areas</h3>
                {answers && answers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(answers.map((a: any) => a.questions?.category).filter(Boolean))).map((category: any, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {category}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No topics active yet.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="answers" className="mt-3 space-y-3">
              {answersLoading ? (
                <div className="min-h-48 w-full flex items-center justify-center py-8"><SerkleLoader label="Loading profile" showText /></div>
              ) : !answers || answers.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No answers yet
                </div>
              ) : (
                answers.map((item: any) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-card/40 backdrop-blur-sm border border-border/30 p-4 space-y-2 transition-colors hover:bg-card/60"
                    onClick={() => {
                      onClose();
                      navigate(`/question/${item.question_id}`);
                    }}
                  >
                    {item.question_text && (
                      <p className="text-xs font-medium text-primary line-clamp-1">Q: {item.question_text}</p>
                    )}
                    <p className="text-sm text-foreground line-clamp-3">{item.answer}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                      {item.is_helpful && (
                        <Badge variant="outline" className="text-[10px] h-5 border-green-500/30 text-green-600">
                          ✓ Helpful
                        </Badge>
                      )}
                      <span className="ml-auto">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
