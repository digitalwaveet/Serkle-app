import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PersistentCommentComposer } from '@/components/PersistentCommentComposer';
import { useAnswers, useCreateAnswer, useAnswerVote, useUpdateAnswer, useDeleteAnswer } from '@/hooks/useAnswers';
import { useQuestion, useQuestionVote, useUserVotes, useUpdateQuestion, useDeleteQuestion } from '@/hooks/useQuestions';
import { useThreadUpdates, useCreateThreadUpdate, useUpdateThreadUpdate, useDeleteThreadUpdate } from '@/hooks/useThreadUpdates';
import { useIsQuestionBookmarked, useToggleQuestionBookmark } from '@/hooks/useQuestionBookmarks';
import { useStoryFollowersCount, useIsStoryFollowed, useToggleStoryFollow } from '@/hooks/useStoryFollowers';
import { supabase } from '@/integrations/supabase/client';
import anonymousLogo from '@/assets/anonymous-logo.png';
import { AnonymousAvatar } from '@/components/ask/AnonymousAvatar';
import { AIDiscussionSummary } from '@/components/ask/AIDiscussionSummary';
import { ThumbsUp, MessageCircle, Sparkles, Share2, Bookmark, ArrowLeft, Edit3, CheckCircle2, BadgeCheck, Pencil, Trash2, Heart, Check, Bell, BellRing, GitBranch, ImagePlus, X, Clock, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export default function QuestionDetail() {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: question, isLoading: questionLoading } = useQuestion(questionId || '');
  const { data: answers, isLoading: answersLoading } = useAnswers(questionId || '');
  const { data: threadUpdates, isLoading: threadLoading } = useThreadUpdates(questionId || '');
  const { data: userVotes } = useUserVotes();
  const createAnswer = useCreateAnswer();
  const createThreadUpdate = useCreateThreadUpdate();
  const updateThreadUpdate = useUpdateThreadUpdate();
  const deleteThreadUpdate = useDeleteThreadUpdate();
  const voteOnAnswer = useAnswerVote();
  const voteOnQuestion = useQuestionVote();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();
  const updateAnswer = useUpdateAnswer();
  const deleteAnswer = useDeleteAnswer();
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [answerVoteCounts, setAnswerVoteCounts] = useState<Record<string, number>>({});
  const [questionVoteCount, setQuestionVoteCount] = useState(0);
  const [showThreadForm, setShowThreadForm] = useState(false);
  const [threadUpdate, setThreadUpdate] = useState('');
  const [questionAuthorIsExpert, setQuestionAuthorIsExpert] = useState(false);
  const [questionAuthorProfile, setQuestionAuthorProfile] = useState<any>(null);
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [editedQuestionText, setEditedQuestionText] = useState('');
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editedAnswerText, setEditedAnswerText] = useState('');
  const [editingThreadUpdateId, setEditingThreadUpdateId] = useState<string | null>(null);
  const [editedThreadUpdateText, setEditedThreadUpdateText] = useState('');
  const [editedThreadUpdateTitle, setEditedThreadUpdateTitle] = useState('');
  const [editedThreadUpdateMediaUrl, setEditedThreadUpdateMediaUrl] = useState<string | null>(null);

  const [threadUpdateTitle, setThreadUpdateTitle] = useState('');
  const [threadUpdateImageFile, setThreadUpdateImageFile] = useState<File | null>(null);
  const [threadUpdateImagePreview, setThreadUpdateImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Bookmark functionality
  const { data: isBookmarked = false } = useIsQuestionBookmarked(questionId, currentUser?.id);
  const toggleBookmark = useToggleQuestionBookmark();

  // Story Followers functionality
  const { data: isStoryFollowed = false } = useIsStoryFollowed(questionId, currentUser?.id);
  const { data: storyFollowersCount = 0 } = useStoryFollowersCount(questionId);
  const toggleStoryFollow = useToggleStoryFollow();

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      if (user) {
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setCurrentUserProfile(profile);
      }
    };
    fetchCurrentUser();
  }, []);

  // Check if question author is an expert and fetch their profile
  useEffect(() => {
    if (!question?.user_id) return;
    const checkExpert = async () => {
      const sb = supabase as any;
      const { data } = await sb
        .from('expert_profiles')
        .select('is_verified')
        .eq('user_id', question.user_id)
        .eq('is_verified', true)
        .maybeSingle();
      
      if (data?.is_verified) {
        setQuestionAuthorIsExpert(true);
        const { data: profile } = await sb
          .from('profiles')
          .select('id, username, name, avatar_url, initials, avatar_color')
          .eq('id', question.user_id)
          .single();
        setQuestionAuthorProfile(profile);
      }
    };
    checkExpert();
  }, [question?.user_id]);

  useEffect(() => {
    setEditedQuestionText(question?.question || '');
  }, [question?.question]);

  // Fetch initial vote counts
  useEffect(() => {
    const fetchVoteCounts = async () => {
      if (!questionId) return;

      // Fetch question votes
      const { data: qVotes } = await (supabase as any)
        .from('question_votes')
        .select('id')
        .eq('question_id', questionId);
      setQuestionVoteCount(qVotes?.length || 0);

      // Fetch answer votes
      if (answers && answers.length > 0) {
        const answerIds = answers.map((a: any) => a.id);
        const { data: aVotes } = await (supabase as any)
          .from('answer_votes')
          .select('answer_id')
          .in('answer_id', answerIds);

        const counts: Record<string, number> = {};
        aVotes?.forEach((vote: any) => {
          counts[vote.answer_id] = (counts[vote.answer_id] || 0) + 1;
        });
        setAnswerVoteCounts(counts);
      }
    };
    fetchVoteCounts();
  }, [questionId, answers]);

  // Real-time subscription for answers
  useEffect(() => {
    if (!questionId) return;

    const channel = supabase
      .channel(`answers:${questionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'answers',
          filter: `question_id=eq.${questionId}`
        },
        () => {
          // Answers will auto-refresh via useQuery
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [questionId]);

  // Real-time subscription for question votes
  useEffect(() => {
    if (!questionId) return;

    const channel = supabase
      .channel(`question_votes:${questionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'question_votes',
          filter: `question_id=eq.${questionId}`
        },
        async () => {
          const { data: qVotes } = await (supabase as any)
            .from('question_votes')
            .select('id')
            .eq('question_id', questionId);
          setQuestionVoteCount(qVotes?.length || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [questionId]);

  // Real-time subscription for answer votes
  useEffect(() => {
    if (!questionId || !answers || answers.length === 0) return;

    const channel = supabase
      .channel(`answer_votes:${questionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'answer_votes'
        },
        async (payload) => {
          // Refresh vote counts for the specific answer
          const answerIds = answers.map((a: any) => a.id);
          const { data: aVotes } = await (supabase as any)
            .from('answer_votes')
            .select('answer_id')
            .in('answer_id', answerIds);

          const counts: Record<string, number> = {};
          aVotes?.forEach((vote: any) => {
            counts[vote.answer_id] = (counts[vote.answer_id] || 0) + 1;
          });
          setAnswerVoteCounts(counts);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [questionId, answers]);

  // Real-time subscription for thread updates
  useEffect(() => {
    if (!questionId) return;

    const channel = supabase
      .channel(`thread_updates:${questionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'thread_updates',
          filter: `question_id=eq.${questionId}`
        },
        () => {
          // Thread updates will auto-refresh via useQuery
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [questionId]);

  const handleSubmitAnswer = async (answerText: string) => {
    try {
      await createAnswer.mutateAsync({
        questionId: questionId || '',
        answer: answerText,
      });
    } catch (error) {
      console.error('Error submitting answer:', error);
    }
  };

  const handleQuestionVote = async () => {
    if (!currentUser || !questionId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to vote",
        variant: "destructive"
      });
      return;
    }

    const hasVoted = userVotes?.questions?.includes(questionId);
    await voteOnQuestion.mutateAsync({ questionId, hasVoted: !!hasVoted });
  };

  const handleAnswerVote = async (answerId: string) => {
    if (!currentUser || !questionId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to vote",
        variant: "destructive"
      });
      return;
    }

    const hasVoted = userVotes?.answers?.includes(answerId);
    await voteOnAnswer.mutateAsync({ answerId, hasVoted: !!hasVoted, questionId });
  };

  const handleContinueThread = () => {
    setShowThreadForm(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Images must be smaller than 5MB.",
          variant: "destructive"
        });
        return;
      }
      setThreadUpdateImageFile(file);
      setThreadUpdateImagePreview(URL.createObjectURL(file));
    }
  };

  const handleToggleFollowStory = async () => {
    if (!currentUser || !questionId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to follow this story and receive updates.",
        variant: "destructive"
      });
      return;
    }

    try {
      await toggleStoryFollow.mutateAsync({
        questionId,
        userId: currentUser.id,
        isFollowed: !!isStoryFollowed,
      });
    } catch (error) {
      console.error('Error toggling story follow:', error);
    }
  };

  const handleSubmitThreadUpdate = async () => {
    if (!threadUpdate.trim() || !questionId) return;

    setIsUploadingImage(true);
    let uploadedMediaUrl: string | undefined = undefined;

    try {
      if (threadUpdateImageFile && currentUser) {
        const fileExt = threadUpdateImageFile.name?.split('.').pop() || 'jpg';
        const filePath = `${currentUser.id}/story-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(filePath, threadUpdateImageFile);

        if (uploadError) {
          console.warn('Image upload failed, posting update without image:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('post-media')
            .getPublicUrl(filePath);
          uploadedMediaUrl = publicUrl;
        }
      }

      await createThreadUpdate.mutateAsync({
        questionId,
        content: threadUpdate.trim(),
        title: threadUpdateTitle.trim() || undefined,
        mediaUrl: uploadedMediaUrl
      });

      setThreadUpdate('');
      setThreadUpdateTitle('');
      setThreadUpdateImageFile(null);
      setThreadUpdateImagePreview(null);
      setShowThreadForm(false);
      toast({
        title: "Story update posted",
        description: "Your new chapter has been added to the story timeline.",
      });
    } catch (error: any) {
      console.error('Error posting thread update:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to post story update.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveQuestionEdit = async () => {
    if (!questionId || !editedQuestionText.trim() || !question) return;

    await updateQuestion.mutateAsync({
      questionId,
      question: editedQuestionText.trim(),
      category: question.category,
      tags: question.tags || [],
    });

    setIsEditingQuestion(false);
  };

  const handleDeleteQuestion = async () => {
    if (!questionId) return;
    const confirmed = window.confirm('Delete this ask? This cannot be undone.');
    if (!confirmed) return;

    await deleteQuestion.mutateAsync(questionId);
    navigate('/ask');
  };

  const handleSaveAnswerEdit = async (answerId: string) => {
    if (!questionId || !editedAnswerText.trim()) return;

    await updateAnswer.mutateAsync({
      answerId,
      questionId,
      answer: editedAnswerText.trim(),
    });

    setEditingAnswerId(null);
    setEditedAnswerText('');
  };

  const handleDeleteAnswer = async (answerId: string) => {
    if (!questionId) return;
    const confirmed = window.confirm('Delete this comment?');
    if (!confirmed) return;

    await deleteAnswer.mutateAsync({ answerId, questionId });
  };

  const handleSaveThreadUpdateEdit = async (updateId: string) => {
    if (!questionId || !editedThreadUpdateText.trim()) return;

    await updateThreadUpdate.mutateAsync({
      updateId,
      questionId,
      content: editedThreadUpdateText.trim(),
      title: editedThreadUpdateTitle.trim() || undefined,
      mediaUrl: editedThreadUpdateMediaUrl || undefined,
    });

    setEditingThreadUpdateId(null);
    setEditedThreadUpdateText('');
    setEditedThreadUpdateTitle('');
    setEditedThreadUpdateMediaUrl(null);
  };

  const handleDeleteThreadUpdate = async (updateId: string) => {
    if (!questionId) return;
    const confirmed = window.confirm('Delete this story update?');
    if (!confirmed) return;

    await deleteThreadUpdate.mutateAsync({ updateId, questionId });
  };

  const handleMarkHelpful = async (answerId: string) => {
    if (!currentUser || !isQuestionAuthor) {
      toast({
        title: "Not authorized",
        description: "Only question authors can mark answers as helpful",
        variant: "destructive"
      });
      return;
    }

    try {
      await (supabase as any)
        .from('answers')
        .update({ is_helpful: true })
        .eq('id', answerId);
      
      toast({
        title: "Marked as helpful",
        description: "This answer has been marked as helpful",
      });
    } catch (error) {
      console.error('Error marking answer as helpful:', error);
      toast({
        title: "Error",
        description: "Failed to mark answer as helpful",
        variant: "destructive"
      });
    }
  };

  const handleToggleBookmark = async () => {
    if (!currentUser || !questionId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to bookmark questions",
        variant: "destructive"
      });
      return;
    }

    try {
      await toggleBookmark.mutateAsync({
        questionId,
        userId: currentUser.id,
        isBookmarked
      });
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  if (questionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SerkleLoader size="md" className="text-primary" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-xl font-semibold mb-2">Question not found</h2>
        <Button onClick={() => navigate('/ask')}>Back to Ask</Button>
      </div>
    );
  }

  const isQuestionAuthor = currentUser && question.user_id === currentUser.id;
  const questionIsAnonymous = question.is_anonymous;

  const authorDisplayName = questionIsAnonymous 
    ? (question.anonymous_name || 'Anonymous') 
    : (questionAuthorIsExpert && questionAuthorProfile 
        ? questionAuthorProfile.name 
        : (question.profiles?.name || question.profiles?.username || 'Community Member'));

  // Determine display name for current user in composer
  let displayName: string | undefined;
  let displayAvatar: string | undefined;
  let displayColor: string | undefined;

  if (isQuestionAuthor && questionIsAnonymous) {
    displayName = question.anonymous_name || 'Anonymous';
    displayColor = '#4B164C';
  } else if (currentUserProfile) {
    displayName = currentUserProfile.initials;
    displayAvatar = currentUserProfile.avatar_url;
    displayColor = currentUserProfile.avatar_color;
  }

  const hasVotedQuestion = userVotes?.questions?.includes(questionId || '');

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/ask')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {!isQuestionAuthor && (
              <Button 
                variant={isStoryFollowed ? "secondary" : "outline"} 
                size="sm"
                onClick={handleToggleFollowStory}
                className={`gap-1.5 text-xs font-medium rounded-full ${
                  isStoryFollowed 
                    ? "bg-primary/15 text-primary border border-primary/30" 
                    : "border-primary/30 text-primary hover:bg-primary/10"
                }`}
              >
                {isStoryFollowed ? (
                  <>
                    <BellRing className="w-3.5 h-3.5 fill-current" />
                    <span className="hidden xs:inline">Following</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Follow Story</span>
                  </>
                )}
                {storyFollowersCount > 0 && (
                  <span className="text-[10px] font-bold">({storyFollowersCount})</span>
                )}
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: question?.title || '', url: window.location.href }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  toast({ title: 'Link copied to clipboard' });
                }
              }}
            >
              <Share2 className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleToggleBookmark}
              className={isBookmarked ? 'text-primary' : ''}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Question Header */}
        <div className="space-y-4">
          {/* Asker info */}
          <div className="flex items-center gap-3">
            {questionAuthorIsExpert && questionAuthorProfile ? (
              <div 
                className="size-10 rounded-full grid place-items-center text-xs font-medium text-white overflow-hidden border-2 border-primary/30"
                style={{ backgroundColor: questionAuthorProfile.avatar_color }}
              >
                {questionAuthorProfile.avatar_url ? (
                  <img src={questionAuthorProfile.avatar_url} alt={questionAuthorProfile.name} className="w-full h-full object-cover" />
                ) : (
                  questionAuthorProfile.initials
                )}
              </div>
            ) : question.anonymous_name ? (
              <AnonymousAvatar pseudonym={question.anonymous_name} size={40} className="border-2 border-border" />
            ) : (
              <img 
                src={anonymousLogo} 
                alt="Asker" 
                className="w-10 h-10 rounded-full border-2 border-border"
              />
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  {questionAuthorIsExpert && questionAuthorProfile
                    ? questionAuthorProfile.name
                    : question.is_anonymous 
                      ? (question.anonymous_name || 'Anonymous') 
                      : 'Community Member'}
                </span>
                {questionAuthorIsExpert && (
                  <BadgeCheck className="w-4 h-4 text-primary" />
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
          
          {/* Anonymous identity helper text */}
          {question.is_anonymous && question.anonymous_name && (
            <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
              <span>🔒</span> Your anonymous identity is unique to this story.
            </p>
          )}

          {isEditingQuestion ? (
            <div className="space-y-2">
              <textarea
                value={editedQuestionText}
                onChange={(e) => setEditedQuestionText(e.target.value)}
                className="w-full min-h-[120px] p-3 bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setIsEditingQuestion(false);
                  setEditedQuestionText(question.question || '');
                }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveQuestionEdit} disabled={!editedQuestionText.trim() || updateQuestion.isPending}>
                  Save Ask
                </Button>
              </div>
            </div>
          ) : (
            <h1 className="text-xl font-semibold text-foreground leading-relaxed">
              {question.question}
            </h1>
          )}

          {isQuestionAuthor && !isEditingQuestion && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditingQuestion(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1" />
                Edit Ask
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeleteQuestion} disabled={deleteQuestion.isPending}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete Ask
              </Button>
            </div>
          )}

          {/* Tags */}
          {question.tags && question.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {question.tags.map((tag: string) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <Button
              variant="ghost"
              size="sm"
              className={`h-auto p-0 ${hasVotedQuestion ? 'text-primary' : 'text-muted-foreground'} hover:text-primary`}
              onClick={handleQuestionVote}
            >
              <ThumbsUp className={`w-4 h-4 mr-1 ${hasVotedQuestion ? 'fill-current' : ''}`} />
              {questionVoteCount}
            </Button>
            <div className="flex items-center gap-1 text-muted-foreground">
              <MessageCircle className="w-4 h-4" />
              {answers?.length || 0} answers
            </div>
          </div>
        </div>

        {/* EMOTIONAL NARRATIVE STORY TIMELINE */}
        {(question.is_thread || (threadUpdates && threadUpdates.length > 0) || isQuestionAuthor) && (
          <>
            <Separator className="my-2" />
            <section className="rounded-2xl bg-gradient-to-b from-primary/[0.04] via-card to-card border border-primary/20 p-4 sm:p-6 shadow-sm space-y-6">
              {/* Header of Story Section */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-primary/15 text-primary">
                      <GitBranch className="w-4 h-4" />
                    </span>
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground uppercase">
                      {isQuestionAuthor ? "YOUR STORY" : `${authorDisplayName}'s Story`}
                    </h2>
                    <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-2 py-0.5 font-semibold">
                      Story Timeline
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Follow the evolving narrative from the original question through each real-life chapter and update.
                  </p>
                </div>

                {/* Follow Story / Followers Count */}
                <div className="flex items-center gap-2">
                  {!isQuestionAuthor ? (
                    <Button
                      variant={isStoryFollowed ? "secondary" : "outline"}
                      size="sm"
                      onClick={handleToggleFollowStory}
                      disabled={toggleStoryFollow.isPending}
                      className={`gap-1.5 rounded-full text-xs font-medium transition-all shadow-sm ${
                        isStoryFollowed
                          ? "bg-primary/15 text-primary border-primary/40 hover:bg-primary/20"
                          : "border-primary/30 text-primary hover:bg-primary/10"
                      }`}
                    >
                      {isStoryFollowed ? (
                        <>
                          <BellRing className="w-3.5 h-3.5 fill-current text-primary" />
                          <span>Following Story</span>
                        </>
                      ) : (
                        <>
                          <Bell className="w-3.5 h-3.5" />
                          <span>Follow Story</span>
                        </>
                      )}
                      {storyFollowersCount > 0 && (
                        <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-background/80 font-bold border border-border">
                          {storyFollowersCount}
                        </span>
                      )}
                    </Button>
                  ) : (
                    storyFollowersCount > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-primary/5 px-2.5 py-1 rounded-full border border-primary/15">
                        <Bell className="w-3.5 h-3.5 text-primary" />
                        <span><strong className="text-foreground">{storyFollowersCount}</strong> following your story</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Narrative Timeline */}
              <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-primary before:via-primary/50 before:to-primary/20">
                
                {/* NODE 1: Original Question */}
                <div className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-6 sm:-left-8 top-1 flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-background border-2 border-primary shadow-sm z-10">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>

                  <div className="rounded-xl bg-background/70 border border-border/70 p-4 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[11px] font-semibold text-primary border-primary/30 bg-primary/5">
                          ● Original Question
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {questionIsAnonymous ? (
                          <AnonymousAvatar pseudonym={authorDisplayName} size={20} />
                        ) : null}
                        <span className="font-medium text-foreground">{authorDisplayName}</span>
                      </div>
                    </div>

                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      {question.question}
                    </p>
                  </div>
                </div>

                {/* NODES 2..N: Updates */}
                {threadLoading && (
                  <div className="flex justify-center py-4">
                    <SerkleLoader size="sm" className="text-primary" />
                  </div>
                )}

                {threadUpdates && threadUpdates.length > 0 ? (
                  threadUpdates.map((update: any, index: number) => {
                    const isLatest = index === threadUpdates.length - 1;
                    const isOwnerUpdate = isQuestionAuthor;
                    const isEditingThisUpdate = editingThreadUpdateId === update.id;

                    return (
                      <div key={update.id} className="relative group">
                        {/* Timeline Dot */}
                        <div className={`absolute -left-6 sm:-left-8 top-1.5 flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-background border-2 ${
                          isLatest 
                            ? "border-primary shadow-glow ring-2 ring-primary/20" 
                            : "border-primary/60"
                        } shadow-sm z-10`}>
                          <div className={`rounded-full ${isLatest ? "w-2.5 h-2.5 bg-primary animate-pulse" : "w-2 h-2 bg-primary/70"}`} />
                        </div>

                        <div className={`rounded-xl border transition-all ${
                          isLatest 
                            ? "bg-card border-primary/30 shadow-md ring-1 ring-primary/15" 
                            : "bg-background/60 border-border/70 shadow-sm"
                        } p-4 space-y-3`}>
                          {/* Update Header */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Badge 
                                className={
                                  isLatest && threadUpdates.length > 1
                                    ? "bg-primary text-primary-foreground text-[11px] font-semibold"
                                    : "bg-muted text-foreground border-border text-[11px] font-medium"
                                }
                              >
                                {isLatest && threadUpdates.length > 1 ? "● Latest Update" : `● Update #${update.update_number || index + 1}`}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
                              </span>
                            </div>

                            {/* Author info & actions */}
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-xs">
                                {questionIsAnonymous ? (
                                  <AnonymousAvatar pseudonym={authorDisplayName} size={20} />
                                ) : null}
                                <span className="text-muted-foreground font-medium">{authorDisplayName}</span>
                                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/5 text-primary border-primary/20">
                                  Author
                                </Badge>
                              </div>

                              {isOwnerUpdate && !isEditingThisUpdate && (
                                <div className="flex items-center gap-1 ml-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                                    onClick={() => {
                                      setEditingThreadUpdateId(update.id);
                                      setEditedThreadUpdateText(update.update_text || '');
                                      setEditedThreadUpdateTitle(update.title || '');
                                      setEditedThreadUpdateMediaUrl(update.media_url || null);
                                    }}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeleteThreadUpdate(update.id)}
                                    disabled={deleteThreadUpdate.isPending}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Editing View */}
                          {isEditingThisUpdate ? (
                            <div className="space-y-3 pt-1">
                              <input
                                type="text"
                                value={editedThreadUpdateTitle}
                                onChange={(e) => setEditedThreadUpdateTitle(e.target.value)}
                                placeholder="Optional title/headline..."
                                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                              <textarea
                                value={editedThreadUpdateText}
                                onChange={(e) => setEditedThreadUpdateText(e.target.value)}
                                className="w-full min-h-[90px] p-3 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="Update text..."
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingThreadUpdateId(null);
                                    setEditedThreadUpdateText('');
                                    setEditedThreadUpdateTitle('');
                                    setEditedThreadUpdateMediaUrl(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveThreadUpdateEdit(update.id)}
                                  disabled={!editedThreadUpdateText.trim() || updateThreadUpdate.isPending}
                                >
                                  Save Changes
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {update.title && (
                                <h3 className="text-base font-bold text-foreground tracking-tight">
                                  {update.title}
                                </h3>
                              )}
                              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                {update.update_text}
                              </p>
                              {update.media_url && (
                                <div className="mt-3 overflow-hidden rounded-xl border border-border max-h-96 bg-muted/20">
                                  <img
                                    src={update.media_url}
                                    alt="Story update attachment"
                                    className="w-full h-auto object-cover hover:scale-[1.01] transition-transform duration-200"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : null}

                {/* NODE END: + Add Update CTA (only for author) */}
                {isQuestionAuthor && (
                  <div className="relative pt-1">
                    {/* Timeline Dot */}
                    <div className="absolute -left-6 sm:-left-8 top-3 flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-background border-2 border-dashed border-primary/60 text-primary z-10">
                      <Plus className="w-3.5 h-3.5" />
                    </div>

                    {!showThreadForm ? (
                      <div className="pl-1">
                        <Button
                          onClick={handleContinueThread}
                          className="bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all rounded-xl gap-2"
                          size="sm"
                        >
                          <Plus className="w-4 h-4" />
                          Add Update
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Share what happened next, what advice helped, or where your journey stands now.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-card border-2 border-primary/30 p-4 shadow-md space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-primary" />
                            Add Story Update
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground"
                            onClick={() => {
                              setShowThreadForm(false);
                              setThreadUpdate('');
                              setThreadUpdateTitle('');
                              setThreadUpdateImageFile(null);
                              setThreadUpdateImagePreview(null);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Title Input */}
                        <div>
                          <input
                            type="text"
                            value={threadUpdateTitle}
                            onChange={(e) => setThreadUpdateTitle(e.target.value)}
                            placeholder="Update title or chapter name (optional, e.g. 'Two weeks later')"
                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        {/* Text Input */}
                        <div>
                          <textarea
                            value={threadUpdate}
                            onChange={(e) => setThreadUpdate(e.target.value)}
                            placeholder="Write your story update... What happened next? How did you handle it?"
                            className="w-full min-h-[110px] p-3 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        {/* Image Attachment */}
                        <div className="space-y-2">
                          {threadUpdateImagePreview ? (
                            <div className="relative inline-block rounded-lg overflow-hidden border border-border max-h-48">
                              <img src={threadUpdateImagePreview} alt="Preview" className="max-h-48 object-cover" />
                              <button
                                type="button"
                                onClick={() => {
                                  setThreadUpdateImageFile(null);
                                  setThreadUpdateImagePreview(null);
                                }}
                                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-background/80 text-foreground hover:bg-background shadow-sm"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-primary/50 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                              <ImagePlus className="w-3.5 h-3.5 text-primary" />
                              <span>Attach image (optional)</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageSelect}
                              />
                            </label>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/50">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowThreadForm(false);
                              setThreadUpdate('');
                              setThreadUpdateTitle('');
                              setThreadUpdateImageFile(null);
                              setThreadUpdateImagePreview(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSubmitThreadUpdate}
                            disabled={!threadUpdate.trim() || isUploadingImage || createThreadUpdate.isPending}
                            className="bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold shadow-sm"
                          >
                            {isUploadingImage || createThreadUpdate.isPending ? (
                              <>
                                <SerkleLoader size="xs" className="text-current mr-1.5" />
                                Posting...
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5 mr-1.5" />
                                Post Update
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        <Separator />

        {/* Answers Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {!answers || answers.length === 0 
              ? 'No answers yet' 
              : `${answers.length} Answer${answers.length === 1 ? '' : 's'}`}
          </h2>

          {/* AI Discussion Summary (Synthesized from discussion, secondary to community answers) */}
          <AIDiscussionSummary
            questionId={question.id}
            questionText={question.question}
            category={question.category}
            discussionSummary={(question as any).ai_discussion_summary}
            answersCount={answers?.length || 0}
            answers={answers?.map((a: any) => ({
              id: a.id,
              answer: a.answer,
              isExpert: a.isExpert,
              isHelpful: a.isHelpful,
              authorName: a.profile?.name || a.profile?.username
            }))}
          />

          {answersLoading && (
            <div className="flex justify-center py-8">
              <SerkleLoader size="sm" className="text-primary" />
            </div>
          )}

          {answers?.map((answer: any) => {
            const isAnswerByQuestionAuthor = answer.user_id === question.user_id;
            const showAnonymousName = isAnswerByQuestionAuthor && questionIsAnonymous;
            
            let answerDisplayName = 'Anonymous';
            let answerAvatar = '/src/assets/anonymous-logo.png';
            let answerColor = '#4B164C';

            if (showAnonymousName) {
              answerDisplayName = question.anonymous_name || 'Anonymous (OP)';
              answerAvatar = anonymousLogo;
              answerColor = '#4B164C';
            } else if (answer.profile) {
              answerDisplayName = answer.profile.name || answer.profile.username || 'User';
              answerAvatar = answer.profile.avatar_url || answerAvatar;
              answerColor = answer.profile.avatar_color || answerColor;
            }

            const hasVotedAnswer = userVotes?.answers?.includes(answer.id);
            const voteCount = answerVoteCounts[answer.id] || 0;

            return (
              <div key={answer.id} className={`p-4 rounded-lg space-y-3 relative overflow-hidden ${answer.isExpert ? 'bg-primary/5 border border-primary/20 shadow-sm' : 'bg-muted/30'}`}>
                {answer.isExpert && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                )}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="size-10 rounded-full grid place-items-center text-xs font-medium text-white overflow-hidden flex-shrink-0"
                      style={{ backgroundColor: answerColor }}
                    >
                    {showAnonymousName && question.anonymous_name ? (
                        <AnonymousAvatar pseudonym={question.anonymous_name} size={40} />
                      ) : showAnonymousName ? (
                        <img src={anonymousLogo} alt="Anonymous" className="w-full h-full object-cover" />
                      ) : answer.profile?.avatar_url ? (
                        <img src={answer.profile.avatar_url} alt={answerDisplayName} className="w-full h-full object-cover" />
                      ) : (
                        <img src={answerAvatar} alt={answerDisplayName} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      {answer.isExpert ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground">
                            {answerDisplayName}
                          </span>
                          {answer.expertProfile?.specialty && (
                            <span className="text-xs font-medium text-primary mt-0.5">
                              {answer.expertProfile.specialty}
                            </span>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <BadgeCheck className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs text-muted-foreground font-medium">Verified Professional</span>
                            <span className="text-xs text-muted-foreground ml-1">
                              • {formatDistanceToNow(new Date(answer.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">
                              {answerDisplayName}
                              {showAnonymousName && ' (OP)'}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(answer.created_at), { addSuffix: true })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className={`${hasVotedAnswer ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-muted-foreground'} hover:text-primary transition-all`}
                        onClick={() => handleAnswerVote(answer.id)}
                      >
                        {hasVotedAnswer ? (
                          <Check className="w-4 h-4 mr-1.5" />
                        ) : (
                          <Heart className="w-4 h-4 mr-1.5" />
                        )}
                        Helpful {voteCount > 0 ? voteCount : ''}
                      </Button>

                      {answer.user_id === currentUser?.id && editingAnswerId !== answer.id && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => {
                              setEditingAnswerId(answer.id);
                              setEditedAnswerText(answer.answer || '');
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => handleDeleteAnswer(answer.id)}
                            disabled={deleteAnswer.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                    {/* Display helpful percentage if there's enough feedback (e.g., > 3 total votes) */}
                    {(answer.total_feedback || voteCount) > 3 && (
                      <span className="text-[10px] text-muted-foreground px-2">
                        {answer.helpful_percentage || 100}% found this helpful
                      </span>
                    )}
                  </div>
                </div>
                
                {editingAnswerId === answer.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editedAnswerText}
                      onChange={(e) => setEditedAnswerText(e.target.value)}
                      className="w-full min-h-[90px] p-3 bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingAnswerId(null);
                          setEditedAnswerText('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveAnswerEdit(answer.id)}
                        disabled={!editedAnswerText.trim() || updateAnswer.isPending}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed">{answer.answer}</p>
                )}
                
                <div className="flex items-center gap-2">
                  {answer.is_helpful && (
                    <Badge variant="outline" className="text-xs">
                      ✅ Marked as helpful
                    </Badge>
                  )}
                  {isQuestionAuthor && !answer.is_helpful && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleMarkHelpful(answer.id)}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Mark as helpful
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Persistent Comment Composer */}
      <PersistentCommentComposer
        onSubmit={handleSubmitAnswer}
        placeholder="Share your advice..."
        displayName={displayName}
        displayAvatar={displayAvatar}
        displayColor={displayColor}
      />
    </div>
  );
}