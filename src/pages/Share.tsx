import { Link, useSearchParams } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { validShareId } from '@/lib/shareDraft';
import CreatePost from './CreatePost';

export default function Share() {
  const [params] = useSearchParams();
  const { user, isLoading } = useUser();
  const id = params.get('draft') || '';
  if (isLoading) return <SerkleLoader size="lg" />;
  if (validShareId(id) && user) return <CreatePost key={`${user.id}:${id}`} shareId={id} />;
  return <main className="min-h-screen bg-background text-foreground grid place-items-center p-6">
    <section className="max-w-md space-y-5 rounded-3xl border border-border bg-card p-7">
      <h1 className="text-2xl font-semibold">Share to Serkle</h1>
      {validShareId(id) ? <>
        <p>Sign in to review your shared draft. Nothing has been uploaded or published.</p>
        <p className="text-sm text-muted-foreground">Shared drafts stay on this device for up to one hour of use. Expired drafts are removed the next time the share inbox is accessed.</p>
        <Link className="block rounded-xl bg-primary p-3 text-center text-primary-foreground" to={`/login?returnTo=${encodeURIComponent(`/share?draft=${id}`)}`}>Sign in to review</Link>
      </> : <>
        <p>{params.has('error') ? 'This share could not be saved. Try text, a web link, or up to 5 JPG, PNG or WebP images (10 MB each, 20 MB total). Finish earlier drafts if the inbox is full.' : 'Choose Serkle from your device’s Share menu after installing the app in a supported browser.'}</p>
        <Link className="block text-primary underline" to="/">Back to Serkle</Link>
      </>}
    </section>
  </main>;
}
