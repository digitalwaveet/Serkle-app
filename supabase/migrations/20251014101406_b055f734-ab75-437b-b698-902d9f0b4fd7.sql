-- Enable realtime for videos table
ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_saves;