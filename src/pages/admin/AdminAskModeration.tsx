import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAudit } from '@/hooks/useAdminAudit';
import { toast } from '@/hooks/use-toast';
import {
  HelpCircle, MessageSquare, Search, Trash2, Eye, ShieldCheck,
  RefreshCw, Award, Clock, ThumbsUp, Star, CheckCircle, XCircle,
} from 'lucide-react';

interface QuestionRow {
  id: string;
  title: string;
  body: string;
  category: string | null;
  is_anonymous: boolean | null;
  user_id: string | null;
  created_at: string | null;
  upvotes_count: number | null;
  answers_count: number | null;
}

interface AnswerRow {
  id: string;
  question_id: string;
  answer: string;
  user_id: string | null;
  is_helpful: boolean | null;
  created_at: string | null;
}

interface ExpertRow {
  id: string;
  user_id: string;
  specialty: string;
  is_verified: boolean | null;
  verified: boolean | null;
  years_experience: number | null;
  bio: string | null;
  created_at: string | null;
}

export default function AdminAskModeration() {
  const { logAction } = useAdminAudit();
  const [tab, setTab] = useState('questions');
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [experts, setExperts] = useState<ExpertRow[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuestions = async () => {
    setLoading(true);
    let q = supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(100);
    if (search.trim()) q = q.ilike('title', `%${search.trim()}%`);
    if (filterCategory !== 'all') q = q.eq('category', filterCategory);
    const { data } = await q;
    if (data) setQuestions(data as any);
    setLoading(false);
  };

  const fetchAnswers = async (questionId: string) => {
    setSelectedQuestion(questionId);
    const { data } = await supabase.from('answers').select('*').eq('question_id', questionId).order('created_at', { ascending: false });
    if (data) setAnswers(data);
    setTab('answers');
  };

  const fetchExperts = async () => {
    const { data } = await supabase.from('expert_profiles').select('*').order('created_at', { ascending: false }).limit(100);
    if (data) setExperts(data);
  };

  const deleteQuestion = async (q: QuestionRow) => {
    await supabase.from('questions').delete().eq('id', q.id);
    await logAction('question_deleted', 'question', q.id, { title: q.title });
    toast({ title: 'Question deleted' });
    fetchQuestions();
  };

  const deleteAnswer = async (a: AnswerRow) => {
    await supabase.from('answers').delete().eq('id', a.id);
    await logAction('answer_deleted', 'answer', a.id);
    toast({ title: 'Answer deleted' });
    if (selectedQuestion) fetchAnswers(selectedQuestion);
  };

  const toggleExpertVerification = async (expert: ExpertRow) => {
    const newVal = !expert.is_verified;
    await supabase.from('expert_profiles').update({ is_verified: newVal }).eq('id', expert.id);
    await logAction(newVal ? 'expert_verified' : 'expert_unverified', 'expert', expert.id, { specialty: expert.specialty });
    toast({ title: newVal ? 'Expert verified' : 'Verification removed' });
    fetchExperts();
  };

  useEffect(() => { fetchQuestions(); fetchExperts(); }, []);

  const categories = [...new Set(questions.map(q => q.category).filter(Boolean))];

  const totalAnswers = questions.reduce((sum, q) => sum + (q.answers_count || 0), 0);
  const verifiedExperts = experts.filter(e => e.is_verified).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Ask/Q&A Moderation</h1>
        <Button variant="outline" size="sm" onClick={() => { fetchQuestions(); fetchExperts(); }} disabled={loading}>
          {loading ? <SerkleLoader size="xs" className="mr-1 text-current" label="Refreshing" /> : <RefreshCw className="h-4 w-4 mr-1" />}Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{questions.length}</p>
          <p className="text-xs text-muted-foreground">Questions</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{totalAnswers}</p>
          <p className="text-xs text-muted-foreground">Total Answers</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{experts.length}</p>
          <p className="text-xs text-muted-foreground">Expert Profiles</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{verifiedExperts}</p>
          <p className="text-xs text-muted-foreground">Verified Experts</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="questions"><HelpCircle className="h-4 w-4 mr-1" />Questions</TabsTrigger>
          <TabsTrigger value="answers" disabled={!selectedQuestion}><MessageSquare className="h-4 w-4 mr-1" />Answers</TabsTrigger>
          <TabsTrigger value="experts"><Award className="h-4 w-4 mr-1" />Experts</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search questions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9"
                onKeyDown={e => e.key === 'Enter' && fetchQuestions()} />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c!} value={c!}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchQuestions}><Search className="h-4 w-4" /></Button>
          </div>

          <div className="space-y-3">
            {questions.map(q => (
              <Card key={q.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-foreground line-clamp-1">{q.title}</span>
                        {q.category && <Badge variant="outline" className="text-xs">{q.category}</Badge>}
                        {q.is_anonymous && <Badge variant="secondary" className="text-xs">Anonymous</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{q.body}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{q.upvotes_count ?? 0} votes</span>
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{q.answers_count ?? 0} answers</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{q.created_at ? new Date(q.created_at).toLocaleDateString() : '—'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => fetchAnswers(q.id)}>
                        <Eye className="h-4 w-4 mr-1" />Answers
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteQuestion(q)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {questions.length === 0 && !loading && (
              <p className="text-center text-muted-foreground py-8">No questions found</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="answers" className="space-y-4 mt-4">
          {selectedQuestion && (
            <>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setTab('questions')}>← Back</Button>
                <span className="text-sm text-muted-foreground">
                  {questions.find(q => q.id === selectedQuestion)?.title} · {answers.length} answers
                </span>
              </div>
              <div className="space-y-3">
                {answers.map(a => (
                  <Card key={a.id}>
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">{a.answer}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {a.is_helpful && <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs"><Star className="h-3 w-3 mr-0.5" />Helpful</Badge>}
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}</span>
                          {a.user_id && <span>by {a.user_id.slice(0, 8)}…</span>}
                        </div>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => deleteAnswer(a)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {answers.length === 0 && <p className="text-center text-muted-foreground py-6">No answers yet</p>}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="experts" className="space-y-4 mt-4">
          <div className="space-y-3">
            {experts.map(e => (
              <Card key={e.id}>
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-foreground">{e.specialty}</span>
                      {e.is_verified
                        ? <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs"><CheckCircle className="h-3 w-3 mr-0.5" />Verified</Badge>
                        : <Badge variant="outline" className="text-xs"><XCircle className="h-3 w-3 mr-0.5" />Unverified</Badge>
                      }
                      {e.years_experience && <Badge variant="secondary" className="text-xs">{e.years_experience}yr exp</Badge>}
                    </div>
                    {e.bio && <p className="text-sm text-muted-foreground line-clamp-2">{e.bio}</p>}
                    <p className="text-xs text-muted-foreground mt-1">User: {e.user_id.slice(0, 8)}… · {e.created_at ? new Date(e.created_at).toLocaleDateString() : ''}</p>
                  </div>
                  <Button
                    variant={e.is_verified ? "destructive" : "default"}
                    size="sm"
                    onClick={() => toggleExpertVerification(e)}
                  >
                    <ShieldCheck className="h-4 w-4 mr-1" />
                    {e.is_verified ? 'Revoke' : 'Verify'}
                  </Button>
                </CardContent>
              </Card>
            ))}
            {experts.length === 0 && <p className="text-center text-muted-foreground py-8">No expert profiles</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
