import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export const owner = '00000000-0000-4000-8000-000000000001';
export const member = '00000000-0000-4000-8000-000000000002';
export const outsider = '00000000-0000-4000-8000-000000000003';
export const conversation = '10000000-0000-4000-8000-000000000001';
export const operation = '20000000-0000-4000-8000-000000000001';
export const imageMigration = () => readFile(new URL('../../../supabase/migrations/20261108130000_image_previews.sql', import.meta.url), 'utf8');
export async function imageDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
    CREATE TABLE profiles(id uuid PRIMARY KEY);
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
    INSERT INTO profiles VALUES('${owner}'),('${member}'),('${outsider}');
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,created_at timestamptz DEFAULT now(),UNIQUE(bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY existing_storage ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true);
    CREATE TABLE conversation_members(conversation_id uuid,user_id uuid);
    INSERT INTO conversation_members VALUES('${conversation}','${owner}'),('${conversation}','${member}');
    CREATE FUNCTION public.can_access_chat_object(p_name text,p_upload boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id::text=split_part(p_name,'/',1) AND user_id=auth.uid()) AND (NOT p_upload OR split_part(p_name,'/',2)=auth.uid()::text)$$;
    CREATE POLICY chat_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'chat-media' OR public.can_access_chat_object(name));
    CREATE TABLE posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid DEFAULT '${owner}',circle_id uuid,is_premium boolean,media_url text,media_urls text[],cover_image_url text,voice_url text,original_pdf_url text);
    CREATE TABLE test_entitlements(user_id uuid,post_id uuid);
    CREATE FUNCTION circle_content_access(kind text,content_id uuid,viewer uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT EXISTS(SELECT 1 FROM test_entitlements WHERE user_id=viewer AND post_id=content_id)$$;
    CREATE FUNCTION can_browse_circle(circle_id uuid,viewer uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT viewer IS NOT NULL$$;
    CREATE FUNCTION circle_storage_path(url text,bucket text) RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT CASE WHEN url LIKE '%/storage/v1/object/%/'||bucket||'/%' THEN split_part(split_part(url,'/'||bucket||'/',2),'?',1) ELSE url END$$;
    CREATE FUNCTION can_read_circle_storage(_bucket text,_name text,_user uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT true$$;
    CREATE POLICY circle_guard ON storage.objects AS RESTRICTIVE FOR SELECT USING(public.can_read_circle_storage(bucket_id,name,auth.uid()));
    GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA storage TO authenticated,service_role;
  `);
  await db.exec(await imageMigration());
  return db;
}
export async function imageRole(db: PGlite, user = owner, role = 'authenticated') {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)", [user, role]);
  await db.exec(`SET ROLE ${role}`);
}
export async function imageRpc(db: PGlite, name: string, args: unknown[] = []) {
  return (await db.query<{ result: any }>(`SELECT public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) result`, args)).rows[0]?.result;
}
