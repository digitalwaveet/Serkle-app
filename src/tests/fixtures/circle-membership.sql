-- Extend the existing Supabase fixture with membership/preview metadata and
-- policies representative of the application before this migration.
ALTER TABLE circles ADD COLUMN description text, ADD COLUMN category text DEFAULT 'community',
  ADD COLUMN is_active boolean DEFAULT true, ADD COLUMN subscription_method text DEFAULT 'after_join',
  ADD COLUMN invite_code text UNIQUE DEFAULT substr(md5(gen_random_uuid()::text),1,10),
  ADD COLUMN enabled_features text[] NOT NULL DEFAULT ARRAY['posts','videos','resources','events','services','messages'],
  ADD COLUMN posting_policy text NOT NULL DEFAULT 'creator';
ALTER TABLE posts ADD COLUMN pinned_at timestamptz;
ALTER TABLE circle_resources ADD COLUMN downloads_count integer DEFAULT 0;
ALTER TABLE circle_tips ADD COLUMN amount integer;
CREATE TABLE video_playlists(id uuid PRIMARY KEY, circle_id uuid, user_id uuid);
CREATE TABLE circle_messages(id uuid PRIMARY KEY, circle_id uuid, sender_id uuid, content text, is_read boolean DEFAULT false);
ALTER TABLE video_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members ADD COLUMN id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ADD COLUMN role text DEFAULT 'member' CHECK(role IN ('creator','admin','moderator','member')),
  ADD COLUMN joined_at timestamptz DEFAULT now(),
  ADD CONSTRAINT circle_members_circle_id_user_id_key UNIQUE(circle_id,user_id),
  ADD CONSTRAINT circle_members_status_check CHECK(status IN ('active','pending','banned'));
CREATE TABLE circle_stats(circle_id uuid PRIMARY KEY, members_count integer DEFAULT 0);
CREATE TABLE push_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,title text,body text,notification_type text,data jsonb,sent_at timestamptz);
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY existing_circles_select ON circles FOR SELECT USING(NOT is_private OR is_circle_member(id,auth.uid()) OR creator_id=auth.uid());
CREATE POLICY existing_circles_insert ON circles FOR INSERT TO authenticated WITH CHECK(creator_id=auth.uid());
CREATE POLICY existing_circles_update ON circles FOR UPDATE TO authenticated USING(creator_id=auth.uid()) WITH CHECK(creator_id=auth.uid());
CREATE POLICY existing_circles_delete ON circles FOR DELETE TO authenticated USING(creator_id=auth.uid());
CREATE POLICY existing_members_select ON circle_members FOR SELECT USING(is_circle_member(circle_id,auth.uid()) OR EXISTS(SELECT 1 FROM circles WHERE id=circle_id AND NOT is_private));
CREATE POLICY existing_members_insert ON circle_members FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY existing_members_delete ON circle_members FOR DELETE TO authenticated USING(user_id=auth.uid());
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON circles,circle_members,circle_stats TO anon;
