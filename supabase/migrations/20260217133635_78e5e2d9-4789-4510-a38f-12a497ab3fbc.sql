
-- Enable realtime for circle_resources
ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_resources;

-- Trigger to sync circle_stats.resources_count
CREATE OR REPLACE FUNCTION public.update_circle_resources_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO circle_stats (circle_id, resources_count)
    VALUES (NEW.circle_id, 1)
    ON CONFLICT (circle_id)
    DO UPDATE SET resources_count = circle_stats.resources_count + 1,
                  updated_at = now();
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE circle_stats
    SET resources_count = GREATEST(0, resources_count - 1),
        updated_at = now()
    WHERE circle_id = OLD.circle_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER circle_resources_count_trigger
AFTER INSERT OR DELETE ON public.circle_resources
FOR EACH ROW EXECUTE FUNCTION public.update_circle_resources_count();
