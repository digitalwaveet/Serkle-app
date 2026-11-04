import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { extractVideoDuration, formatVideoDuration, parseVideoDuration } from '@/lib/videoDuration';

interface DurationVideo {
  id: string;
  video_url: string;
  duration: unknown;
}

/** Share recovered legacy metadata between cards and the playback element. */
export function useCircleVideoDuration(video: DurationVideo, probe = false) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['circle-video-duration', video.id, video.video_url], [video.id, video.video_url]);
  const storedSeconds = parseVideoDuration(video.duration);
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const seconds = await extractVideoDuration(video.video_url, { signal });
      // Playback may discover valid metadata while this probe is still pending.
      return seconds ?? parseVideoDuration(queryClient.getQueryData(queryKey));
    },
    enabled: probe && storedSeconds === null && !!video.video_url,
    staleTime: query => parseVideoDuration(query.state.data) === null ? 30000 : Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
  const recordDuration = useCallback((value: unknown) => {
    const seconds = parseVideoDuration(value);
    if (seconds !== null) queryClient.setQueryData(queryKey, seconds);
  }, [queryClient, queryKey]);
  const seconds = parseVideoDuration(query.data) ?? storedSeconds;
  return { seconds, label: formatVideoDuration(seconds), recordDuration };
}
