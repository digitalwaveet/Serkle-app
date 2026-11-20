-- Retarget database-driven push delivery after moving Serkle to its new
-- Supabase project. The legacy anon key is public and is used only to pass the
-- Edge gateway's JWT check; the function loads notification content from the
-- database and atomically claims each row before delivery.
CREATE OR REPLACE FUNCTION public.deliver_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://fkeyentcklsuqecqgmak.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrZXllbnRja2xzdXFlY3FnbWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwOTI4NzAsImV4cCI6MjExMDY2ODcwfQ.Axxn8ACd7sdHtC1KJfoQtMu--GPJPSCN2LS2a0jkPIk',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrZXllbnRja2xzdXFlY3FnbWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwOTI4NzAsImV4cCI6MjExMDY2ODcwfQ.Axxn8ACd7sdHtC1KJfoQtMu--GPJPSCN2LS2a0jkPIk'
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );

  RETURN NEW;
END;
$$;
