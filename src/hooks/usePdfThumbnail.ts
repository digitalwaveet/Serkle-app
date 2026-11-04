import { useState, useEffect } from 'react';
import { getPdfThumbnail } from '@/lib/pdfUtils';

interface UsePdfThumbnailResult {
  thumbnailUrl: string | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to generate and manage a temporary preview URL for the first page of a PDF.
 * Automatically handles cleanup (revocation) to prevent memory leaks.
 */
export const usePdfThumbnail = (url: string | null | undefined): UsePdfThumbnailResult => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!url) {
      setThumbnailUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    let localBlobUrl: string | null = null;

    const generate = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const blob = await getPdfThumbnail(url);
        
        if (!active) {
          // Component unmounted while rendering
          return;
        }

        localBlobUrl = URL.createObjectURL(blob);
        setThumbnailUrl(localBlobUrl);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err : new Error('Failed to render PDF thumbnail'));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    generate();

    return () => {
      active = false;
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [url]);

  return { thumbnailUrl, loading, error };
};
