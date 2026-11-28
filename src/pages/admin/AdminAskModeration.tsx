import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, MessageSquare, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { ASK_CATEGORIES, askCategory, formatAskCount } from '@/lib/askPresentation';

const PAGE_SIZE = 20;
type Removal = { kind: 'question' | 'answer'; id: string; text: string };

export default function AdminAskModeration() {
  const { session } = useUser();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'ask', userId] as const;
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [thread, setThread] = useState<{ id: string; title: string } | null>(null);
  const [answerPage, setAnswerPage] = useState(0);
  const [removal, setRemoval] = useState<Removal | null>(null);

  const questions = useQuery({
    queryKey: [...queryKey, 'questions', search, category, page], enabled: Boolean(userId) && !thread,
    gcTime: 0, networkMode: 'always', retry: false,
    queryFn: async ({ signal }) => {
      let query = supabase.from('questions').select('id,question,category,is_anonymous,created_at,answers(count)', { count: 'exact' })
        .order('created_at', { ascending: false }).order('id');
      if (search) query = query.ilike('question', `%${search}%`);
      if (category !== 'all') query = query.eq('category', category);
      const { data, error, count } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).abortSignal(signal);
      if (error) throw error;
      if (count === null) throw new Error('Missing question count');
      return { items: data, count };
    },
  });

  const answers = useQuery({
    queryKey: [...queryKey, 'answers', thread?.id, answerPage], enabled: Boolean(userId && thread),
    gcTime: 0, networkMode: 'always', retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, count } = await supabase.from('answers').select('id,answer,is_helpful,created_at', { count: 'exact' })
        .eq('question_id', thread!.id).order('created_at').order('id')
        .range(answerPage * PAGE_SIZE, (answerPage + 1) * PAGE_SIZE - 1).abortSignal(signal);
      if (error) throw error;
      if (count === null) throw new Error('Missing answer count');
      return { items: data, count };
    },
  });

  const remove = useMutation({
    mutationFn: async ({ kind, id }: Removal) => {
      const { error } = await supabase.rpc('delete_admin_ask_content', { _kind: kind, _content_id: id });
      if (error) throw error;
      return kind;
    },
    onSuccess: async (kind) => {
      setRemoval(null);
      if (kind === 'question') setPage(0);
      else setAnswerPage(0);
      toast.success(kind === 'question' ? 'Question deleted' : 'Answer deleted');
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'snapshot', userId] });
    },
    onError: (error) => {
      if ('code' in error && error.code === 'P0002') {
        setRemoval(null);
        setPage(0);
        setAnswerPage(0);
        toast.error('This content is already unavailable.');
        void queryClient.invalidateQueries({ queryKey });
      } else toast.error('Could not delete this content.');
    },
  });

  const current = thread ? answers : questions;
  const currentPage = thread ? answerPage : page;
  const setCurrentPage = thread ? setAnswerPage : setPage;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Ask moderation</h1><p className="mt-1.5 text-sm text-muted-foreground">Review questions and answers without revealing their authors.</p></div>
        <Button asChild variant="outline" className="h-11"><Link to="/admin/expert-verification">Expert verification <ArrowUpRight size={15} className="ml-1.5" /></Link></Button>
      </header>
      <section aria-label={thread ? 'Question answers' : 'Questions'} className="rounded-2xl border bg-card">
        {thread ? (
          <div className="border-b p-4">
            <Button variant="ghost" className="mb-2 h-10 px-2" onClick={() => setThread(null)}><ArrowLeft size={16} className="mr-2" />Back to questions</Button>
            <h2 className="break-words font-semibold">{thread.title}</h2>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 border-b p-4">
            <form className="flex min-w-0 flex-1 basis-56 gap-2" role="search" aria-label="Find an Ask question" onSubmit={(event) => { event.preventDefault(); setPage(0); setSearch(draft.trim()); }}>
              <Input className="h-11 min-w-0" value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Search question text" placeholder="Search questions" maxLength={100} />
              <Button type="submit" variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Search questions"><Search size={17} /></Button>
            </form>
            <Select value={category} onValueChange={(value) => { setCategory(value); setPage(0); }}>
              <SelectTrigger className="h-11 w-44" aria-label="Question category"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All categories</SelectItem>{ASK_CATEGORIES.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {current.isPending && <Skeleton className="m-4 h-28" role="status" aria-label="Loading Ask content" />}
        {current.isError && (
          <div role="alert" className="space-y-2 p-4 text-sm">
            <p>Could not load {thread ? 'answers' : 'questions'}.</p>
            <Button size="sm" variant="outline" disabled={current.isFetching} onClick={() => void current.refetch()}>Retry</Button>
            {currentPage > 0 && <Button size="sm" variant="ghost" onClick={() => setCurrentPage(0)}>First page</Button>}
          </div>
        )}
        {current.isSuccess && !current.data.items.length && <p className="p-9 text-center text-sm text-muted-foreground">{thread ? 'No answers yet.' : 'No questions match these filters.'}</p>}
        {!thread && questions.isSuccess && (
          <ul className="divide-y">
            {questions.data.items.map((question) => (
              <li key={question.id} className="flex flex-wrap gap-3 p-4 sm:p-5">
                <div className="min-w-0 flex-1 basis-48">
                  <h3 className="whitespace-pre-wrap break-words font-semibold">{question.question}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {question.category && <Badge variant="outline">{askCategory(question.category)}</Badge>}
                    {question.is_anonymous && <Badge variant="outline">Anonymous</Badge>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="h-10" onClick={() => { setThread({ id: question.id, title: question.question }); setAnswerPage(0); }}><MessageSquare size={16} className="mr-1.5" />{typeof question.answers?.[0]?.count === 'number' ? formatAskCount(question.answers[0].count, 'answer') : 'Answers'}</Button>
                  <Button variant="ghost" className="h-10 w-10 text-destructive" size="icon" aria-label="Delete question" onClick={() => setRemoval({ kind: 'question', id: question.id, text: question.question })}><Trash2 size={16} /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {thread && answers.isSuccess && (
          <ul className="divide-y">
            {answers.data.items.map((answer) => (
              <li key={answer.id} className="flex items-start gap-3 p-4 sm:p-5">
                <div className="min-w-0 flex-1"><p className="whitespace-pre-wrap break-words text-sm">{answer.answer}</p>{answer.is_helpful && <Badge variant="secondary" className="mt-2">Helpful</Badge>}</div>
                <Button variant="ghost" className="h-10 w-10 shrink-0 text-destructive" size="icon" aria-label="Delete answer" onClick={() => setRemoval({ kind: 'answer', id: answer.id, text: answer.answer })}><Trash2 size={16} /></Button>
              </li>
            ))}
          </ul>
        )}
        {current.isSuccess && (currentPage > 0 || current.data.count > PAGE_SIZE) && (
          <nav aria-label="Ask results pages" className="flex items-center justify-between gap-2 border-t p-3">
            <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setCurrentPage(currentPage - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {currentPage + 1}</span>
            <Button variant="outline" size="sm" disabled={(currentPage + 1) * PAGE_SIZE >= current.data.count} onClick={() => setCurrentPage(currentPage + 1)}>Next</Button>
          </nav>
        )}
      </section>

      <Dialog open={removal !== null} onOpenChange={(open) => { if (!open && !remove.isPending) setRemoval(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {removal?.kind}?</DialogTitle><DialogDescription>{removal?.kind === 'question' ? 'The question and its related replies will be removed.' : 'The answer will be permanently removed.'}</DialogDescription></DialogHeader>
          <p className="line-clamp-4 break-words rounded-lg bg-muted/60 p-3 text-sm">{removal?.text}</p>
          <DialogFooter>
            <Button variant="outline" disabled={remove.isPending} onClick={() => setRemoval(null)}>Cancel</Button>
            <Button variant="destructive" disabled={remove.isPending || !removal} onClick={() => { if (removal) remove.mutate(removal); }}>{remove.isPending ? 'Deleting…' : 'Delete permanently'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
