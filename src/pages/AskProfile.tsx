import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MessageSquare, ThumbsUp, CheckCircle, Bookmark, Award, BadgeCheck } from 'lucide-react';
import { useUserQuestions, useUserAnswers, useAskStatistics } from '@/hooks/useAskHistory';
import { useQuestionBookmarks } from '@/hooks/useQuestionBookmarks';
import { useIsExpert } from '@/hooks/useExpertProfiles';
import { AnonymousAvatar } from '@/components/ask/AnonymousAvatar';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import ExpertVerificationModal from '@/components/ExpertVerificationModal';

const AskProfile: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('questions');
  const [showExpertModal, setShowExpertModal] = useState(false);

  // Get current user
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const userId = session?.user?.id;

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      return data;
    },
    enabled: !!userId,
  });

  const { data: questions = [] } = useUserQuestions(userId);
  const { data: answers = [] } = useUserAnswers(userId);
  const { data: statistics } = useAskStatistics(userId);
  const { data: bookmarks = [] } = useQuestionBookmarks(userId);
  const { data: isExpert } = useIsExpert(userId);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto max-w-2xl px-4 py-6 pb-24">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/ask')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Ask
        </Button>

        {/* Profile Header */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="text-lg">{profile?.initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{profile?.name}</h1>
                {isExpert && (
                  <div className="flex items-center gap-1">
                    <BadgeCheck className="w-5 h-5 text-primary" />
                    <Badge className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20">
                      Expert
                    </Badge>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground">@{profile?.username}</p>
            </div>
          </div>

          {/* Expert Status */}
          {isExpert ? (
            <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
              <BadgeCheck className="w-5 h-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-primary">Verified Expert</p>
                <p className="text-xs text-muted-foreground">Your posts are public and displayed in the expert section</p>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowExpertModal(true)}
              className="w-full h-11 font-medium border-primary/30 text-primary hover:bg-primary/5 mt-4"
            >
              <Award className="w-4 h-4 mr-2" />
              Apply for Expert Verification
            </Button>
          )}

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{statistics?.questionsAsked || 0}</div>
              <div className="text-xs text-muted-foreground">Questions</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{statistics?.answersGiven || 0}</div>
              <div className="text-xs text-muted-foreground">Answers</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{statistics?.helpfulAnswers || 0}</div>
              <div className="text-xs text-muted-foreground">Helpful</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{statistics?.totalUpvotes || 0}</div>
              <div className="text-xs text-muted-foreground">Upvotes</div>
            </div>
          </div>
        </Card>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="answers">Answers</TabsTrigger>
            <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
          </TabsList>

          {/* Questions Tab */}
          <TabsContent value="questions" className="space-y-4">
            {questions.length === 0 ? (
              <Card className="p-8 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No questions asked yet</p>
              </Card>
            ) : (
              questions.map((question: any) => (
                <Card
                  key={question.id}
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/ask/question/${question.id}`)}
                >
                  {question.is_anonymous && question.anonymous_name && (
                    <div className="flex items-center gap-2 mb-2">
                      <AnonymousAvatar pseudonym={question.anonymous_name} size={24} />
                      <span className="text-sm font-medium text-muted-foreground">
                        {question.anonymous_name}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-foreground line-clamp-2 flex-1">
                      {question.question}
                    </h3>
                    {question.is_thread && (
                      <Badge variant="secondary" className="ml-2">Thread</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      {question.answerCount} answers
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-4 w-4" />
                      {question.upvotes} upvotes
                    </span>
                    <Badge variant="outline">{question.category}</Badge>
                    <span className="ml-auto">
                      {formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Answers Tab */}
          <TabsContent value="answers" className="space-y-4">
            {answers.length === 0 ? (
              <Card className="p-8 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No answers given yet</p>
              </Card>
            ) : (
              answers.map((answer: any) => (
                <Card
                  key={answer.id}
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/ask/question/${answer.questions.id}`)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback className="text-xs">{profile?.initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">
                      {profile?.name}
                    </span>
                  </div>
                  <div className="mb-2">
                    <p className="text-sm text-muted-foreground mb-1">
                      Answered: {answer.questions.question}
                    </p>
                    <p className="text-foreground line-clamp-3">{answer.answer}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-4 w-4" />
                      {answer.upvotes} upvotes
                    </span>
                    {answer.is_helpful && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Helpful
                      </Badge>
                    )}
                    <span className="ml-auto">
                      {formatDistanceToNow(new Date(answer.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Bookmarks Tab */}
          <TabsContent value="bookmarks" className="space-y-4">
            {bookmarks.length === 0 ? (
              <Card className="p-8 text-center">
                <Bookmark className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No bookmarked questions yet</p>
              </Card>
            ) : (
              bookmarks.map((bookmark: any) => (
                <Card
                  key={bookmark.id}
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/ask/question/${bookmark.questions.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-foreground line-clamp-2 flex-1">
                      {bookmark.questions.question}
                    </h3>
                    {bookmark.questions.is_thread && (
                      <Badge variant="secondary" className="ml-2">Thread</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <Badge variant="outline">{bookmark.questions.category}</Badge>
                    <span className="ml-auto">
                      Saved {formatDistanceToNow(new Date(bookmark.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {userId && (
          <ExpertVerificationModal
            open={showExpertModal}
            onClose={() => setShowExpertModal(false)}
            userId={userId}
          />
        )}
      </main>
    </div>
  );
};

export default AskProfile;
