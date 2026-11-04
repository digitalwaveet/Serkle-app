
-- Add premium_price column to posts table for circle premium posts
ALTER TABLE public.posts ADD COLUMN premium_price integer DEFAULT NULL;

-- Create table to track which users have unlocked which premium posts
CREATE TABLE public.post_unlocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_paid integer NOT NULL,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE public.post_unlocks ENABLE ROW LEVEL SECURITY;

-- Users can see their own unlocks
CREATE POLICY "Users can view own unlocks"
ON public.post_unlocks
FOR SELECT
USING (auth.uid() = user_id);

-- Users can unlock posts (insert)
CREATE POLICY "Users can unlock posts"
ON public.post_unlocks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create a SECURITY DEFINER function to check if user has unlocked a post
CREATE OR REPLACE FUNCTION public.has_unlocked_post(_user_id uuid, _post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.post_unlocks
    WHERE user_id = _user_id
      AND post_id = _post_id
  )
$$;

-- Function to unlock a premium post by spending coins
CREATE OR REPLACE FUNCTION public.unlock_premium_post(_user_id uuid, _post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _price integer;
  _owner_id uuid;
  _already_unlocked boolean;
  _sender_balance integer;
BEGIN
  -- Get post price and owner
  SELECT premium_price, user_id INTO _price, _owner_id
  FROM public.posts
  WHERE id = _post_id AND is_premium = true;

  IF _price IS NULL OR _price <= 0 THEN
    RAISE EXCEPTION 'Post is not a paid premium post';
  END IF;

  -- Check if user is the post owner (owners can always see their own posts)
  IF _user_id = _owner_id THEN
    RETURN true;
  END IF;

  -- Check if already unlocked
  SELECT EXISTS (
    SELECT 1 FROM public.post_unlocks
    WHERE post_id = _post_id AND user_id = _user_id
  ) INTO _already_unlocked;

  IF _already_unlocked THEN
    RETURN true;
  END IF;

  -- Check sender balance
  SELECT balance INTO _sender_balance
  FROM public.coin_wallets
  WHERE coin_wallets.user_id = _user_id;

  IF _sender_balance IS NULL OR _sender_balance < _price THEN
    RAISE EXCEPTION 'Insufficient coin balance. Need % coins.', _price;
  END IF;

  -- Deduct from sender
  UPDATE public.coin_wallets
  SET balance = balance - _price,
      total_spent = total_spent + _price,
      updated_at = now()
  WHERE coin_wallets.user_id = _user_id;

  -- Add to receiver
  UPDATE public.coin_wallets
  SET balance = balance + _price,
      total_earned = total_earned + _price,
      updated_at = now()
  WHERE coin_wallets.user_id = _owner_id;

  -- If receiver has no wallet, create one
  IF NOT FOUND THEN
    INSERT INTO public.coin_wallets (user_id, balance, total_earned)
    VALUES (_owner_id, _price, _price);
  END IF;

  -- Record transactions
  INSERT INTO public.coin_transactions (user_id, amount, type, reference_id, description, balance_after)
  VALUES (
    _user_id, _price, 'premium_unlock',
    _post_id,
    'Unlocked premium post',
    (SELECT balance FROM public.coin_wallets WHERE coin_wallets.user_id = _user_id)
  );

  INSERT INTO public.coin_transactions (user_id, amount, type, reference_id, description, balance_after)
  VALUES (
    _owner_id, _price, 'premium_earning',
    _post_id,
    'Premium post unlocked by reader',
    (SELECT balance FROM public.coin_wallets WHERE coin_wallets.user_id = _owner_id)
  );

  -- Record the unlock
  INSERT INTO public.post_unlocks (post_id, user_id, amount_paid)
  VALUES (_post_id, _user_id, _price);

  RETURN true;
END;
$$;
