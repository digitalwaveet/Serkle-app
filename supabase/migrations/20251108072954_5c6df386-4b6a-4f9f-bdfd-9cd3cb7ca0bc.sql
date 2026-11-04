-- Create notification trigger functions for social interactions

-- Function to notify when someone likes a post
CREATE OR REPLACE FUNCTION notify_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id uuid;
  liker_name text;
  post_content text;
BEGIN
  -- Get post owner and content
  SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
  
  -- Don't notify if user likes their own post
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get liker's name
  SELECT name INTO liker_name FROM profiles WHERE id = NEW.user_id;
  
  -- Get post content preview
  SELECT SUBSTRING(content, 1, 50) INTO post_content FROM posts WHERE id = NEW.post_id;
  
  -- Create notification
  INSERT INTO push_notifications (
    user_id,
    notification_type,
    title,
    body,
    data
  ) VALUES (
    post_owner_id,
    'like',
    liker_name || ' liked your post',
    COALESCE(post_content, 'your post'),
    jsonb_build_object(
      'userId', NEW.user_id,
      'postId', NEW.post_id,
      'type', 'post_like'
    )
  );
  
  RETURN NEW;
END;
$$;

-- Trigger for post likes
DROP TRIGGER IF EXISTS on_post_like ON likes;
CREATE TRIGGER on_post_like
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_like();

-- Function to notify when someone likes a video
CREATE OR REPLACE FUNCTION notify_video_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  video_owner_id uuid;
  liker_name text;
  video_title text;
BEGIN
  -- Get video owner and title
  SELECT user_id, title INTO video_owner_id, video_title FROM videos WHERE id = NEW.video_id;
  
  -- Don't notify if user likes their own video
  IF video_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get liker's name
  SELECT name INTO liker_name FROM profiles WHERE id = NEW.user_id;
  
  -- Create notification
  INSERT INTO push_notifications (
    user_id,
    notification_type,
    title,
    body,
    data
  ) VALUES (
    video_owner_id,
    'like',
    liker_name || ' liked your video',
    COALESCE(video_title, 'your video'),
    jsonb_build_object(
      'userId', NEW.user_id,
      'videoId', NEW.video_id,
      'type', 'video_like'
    )
  );
  
  RETURN NEW;
END;
$$;

-- Trigger for video likes
DROP TRIGGER IF EXISTS on_video_like ON video_likes;
CREATE TRIGGER on_video_like
  AFTER INSERT ON video_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_video_like();

-- Function to notify when someone comments on a post
CREATE OR REPLACE FUNCTION notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id uuid;
  commenter_name text;
  comment_preview text;
BEGIN
  -- Get post owner
  SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
  
  -- Don't notify if user comments on their own post
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get commenter's name
  SELECT name INTO commenter_name FROM profiles WHERE id = NEW.user_id;
  
  -- Get comment preview
  comment_preview := SUBSTRING(NEW.content, 1, 100);
  
  -- Create notification
  INSERT INTO push_notifications (
    user_id,
    notification_type,
    title,
    body,
    data
  ) VALUES (
    post_owner_id,
    'comment',
    commenter_name || ' commented on your post',
    comment_preview,
    jsonb_build_object(
      'userId', NEW.user_id,
      'postId', NEW.post_id,
      'commentId', NEW.id,
      'type', 'post_comment'
    )
  );
  
  RETURN NEW;
END;
$$;

-- Trigger for post comments
DROP TRIGGER IF EXISTS on_post_comment ON comments;
CREATE TRIGGER on_post_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_comment();

-- Function to notify when someone comments on a video
CREATE OR REPLACE FUNCTION notify_video_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  video_owner_id uuid;
  commenter_name text;
  comment_preview text;
BEGIN
  -- Get video owner
  SELECT user_id INTO video_owner_id FROM videos WHERE id = NEW.video_id;
  
  -- Don't notify if user comments on their own video
  IF video_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get commenter's name
  SELECT name INTO commenter_name FROM profiles WHERE id = NEW.user_id;
  
  -- Get comment preview
  comment_preview := SUBSTRING(NEW.content, 1, 100);
  
  -- Create notification
  INSERT INTO push_notifications (
    user_id,
    notification_type,
    title,
    body,
    data
  ) VALUES (
    video_owner_id,
    'comment',
    commenter_name || ' commented on your video',
    comment_preview,
    jsonb_build_object(
      'userId', NEW.user_id,
      'videoId', NEW.video_id,
      'commentId', NEW.id,
      'type', 'video_comment'
    )
  );
  
  RETURN NEW;
END;
$$;

-- Trigger for video comments
DROP TRIGGER IF EXISTS on_video_comment ON video_comments;
CREATE TRIGGER on_video_comment
  AFTER INSERT ON video_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_video_comment();

-- Function to notify when someone follows a user
CREATE OR REPLACE FUNCTION notify_new_follower()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  follower_name text;
BEGIN
  -- Get follower's name
  SELECT name INTO follower_name FROM profiles WHERE id = NEW.follower_id;
  
  -- Create notification
  INSERT INTO push_notifications (
    user_id,
    notification_type,
    title,
    body,
    data
  ) VALUES (
    NEW.following_id,
    'follow',
    follower_name || ' started following you',
    'You have a new follower',
    jsonb_build_object(
      'userId', NEW.follower_id,
      'type', 'new_follower'
    )
  );
  
  RETURN NEW;
END;
$$;

-- Trigger for new follows
DROP TRIGGER IF EXISTS on_new_follower ON follows;
CREATE TRIGGER on_new_follower
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_follower();

-- Function to notify followers when a user creates a new post
CREATE OR REPLACE FUNCTION notify_followers_new_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  follower_record RECORD;
  creator_name text;
  post_preview text;
BEGIN
  -- Get creator's name
  SELECT name INTO creator_name FROM profiles WHERE id = NEW.user_id;
  
  -- Get post preview
  post_preview := SUBSTRING(NEW.content, 1, 100);
  
  -- Notify all followers
  FOR follower_record IN 
    SELECT follower_id FROM follows WHERE following_id = NEW.user_id
  LOOP
    INSERT INTO push_notifications (
      user_id,
      notification_type,
      title,
      body,
      data
    ) VALUES (
      follower_record.follower_id,
      'new_post',
      creator_name || ' shared a new post',
      post_preview,
      jsonb_build_object(
        'userId', NEW.user_id,
        'postId', NEW.id,
        'type', 'new_post'
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger for new posts
DROP TRIGGER IF EXISTS on_new_post ON posts;
CREATE TRIGGER on_new_post
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION notify_followers_new_post();

-- Function to notify followers when a user creates a new video
CREATE OR REPLACE FUNCTION notify_followers_new_video()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  follower_record RECORD;
  creator_name text;
  video_title_text text;
BEGIN
  -- Get creator's name
  SELECT name INTO creator_name FROM profiles WHERE id = NEW.user_id;
  
  -- Get video title
  video_title_text := NEW.title;
  
  -- Notify all followers
  FOR follower_record IN 
    SELECT follower_id FROM follows WHERE following_id = NEW.user_id
  LOOP
    INSERT INTO push_notifications (
      user_id,
      notification_type,
      title,
      body,
      data
    ) VALUES (
      follower_record.follower_id,
      'new_video',
      creator_name || ' posted a new video',
      video_title_text,
      jsonb_build_object(
        'userId', NEW.user_id,
        'videoId', NEW.id,
        'type', 'new_video'
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger for new videos
DROP TRIGGER IF EXISTS on_new_video ON videos;
CREATE TRIGGER on_new_video
  AFTER INSERT ON videos
  FOR EACH ROW
  EXECUTE FUNCTION notify_followers_new_video();