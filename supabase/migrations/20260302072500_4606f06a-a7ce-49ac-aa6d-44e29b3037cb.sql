
-- Create coin transaction type enum
CREATE TYPE public.coin_transaction_type AS ENUM (
  'topup', 'tip_sent', 'tip_received', 'purchase', 'sale', 
  'event_payment', 'event_earned', 'service_payment', 'service_earned',
  'subscription', 'withdrawal', 'refund'
);

-- Coin wallets - one per user
CREATE TABLE public.coin_wallets (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coin transactions - immutable ledger
CREATE TABLE public.coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type coin_transaction_type NOT NULL,
  reference_id UUID,
  description TEXT NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coin top-ups
CREATE TABLE public.coin_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'demo',
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coin withdrawals
CREATE TABLE public.coin_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payout_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_topups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS: Users can read their own wallet
CREATE POLICY "Users can view own wallet" ON public.coin_wallets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- RLS: Users can read their own transactions
CREATE POLICY "Users can view own transactions" ON public.coin_transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- RLS: Users can view their own topups
CREATE POLICY "Users can view own topups" ON public.coin_topups
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- RLS: Users can insert topups for themselves
CREATE POLICY "Users can create own topups" ON public.coin_topups
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- RLS: Users can view their own withdrawals
CREATE POLICY "Users can view own withdrawals" ON public.coin_withdrawals
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- RLS: Users can request withdrawals for themselves
CREATE POLICY "Users can create own withdrawals" ON public.coin_withdrawals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Auto-create wallet for new profiles
CREATE OR REPLACE FUNCTION public.create_coin_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.coin_wallets (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_create_wallet
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_coin_wallet();

-- Atomic coin transfer function (sender→receiver)
CREATE OR REPLACE FUNCTION public.transfer_coins(
  _sender_id UUID,
  _receiver_id UUID,
  _amount INTEGER,
  _type_sent coin_transaction_type,
  _type_received coin_transaction_type,
  _reference_id UUID DEFAULT NULL,
  _description TEXT DEFAULT ''
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sender_balance INTEGER;
  _receiver_balance INTEGER;
BEGIN
  -- Lock sender wallet
  SELECT balance INTO _sender_balance
  FROM coin_wallets WHERE user_id = _sender_id FOR UPDATE;

  IF _sender_balance IS NULL OR _sender_balance < _amount THEN
    RETURN FALSE;
  END IF;

  -- Lock receiver wallet
  SELECT balance INTO _receiver_balance
  FROM coin_wallets WHERE user_id = _receiver_id FOR UPDATE;

  IF _receiver_balance IS NULL THEN
    -- Auto-create wallet
    INSERT INTO coin_wallets (user_id) VALUES (_receiver_id)
    ON CONFLICT DO NOTHING;
    _receiver_balance := 0;
  END IF;

  -- Deduct from sender
  UPDATE coin_wallets
  SET balance = balance - _amount, total_spent = total_spent + _amount, updated_at = now()
  WHERE user_id = _sender_id;

  -- Credit receiver
  UPDATE coin_wallets
  SET balance = balance + _amount, total_earned = total_earned + _amount, updated_at = now()
  WHERE user_id = _receiver_id;

  -- Record sender transaction
  INSERT INTO coin_transactions (user_id, amount, type, reference_id, description, balance_after)
  VALUES (_sender_id, -_amount, _type_sent, _reference_id, _description, _sender_balance - _amount);

  -- Record receiver transaction
  INSERT INTO coin_transactions (user_id, amount, type, reference_id, description, balance_after)
  VALUES (_receiver_id, _amount, _type_received, _reference_id, _description, _receiver_balance + _amount);

  RETURN TRUE;
END;
$$;

-- Top-up coins function
CREATE OR REPLACE FUNCTION public.topup_coins(
  _user_id UUID,
  _amount INTEGER,
  _payment_method TEXT DEFAULT 'demo'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_balance INTEGER;
BEGIN
  -- Ensure wallet exists
  INSERT INTO coin_wallets (user_id) VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock and get balance
  SELECT balance INTO _current_balance
  FROM coin_wallets WHERE user_id = _user_id FOR UPDATE;

  -- Add coins
  UPDATE coin_wallets
  SET balance = balance + _amount, total_earned = total_earned + _amount, updated_at = now()
  WHERE user_id = _user_id;

  -- Record transaction
  INSERT INTO coin_transactions (user_id, amount, type, description, balance_after)
  VALUES (_user_id, _amount, 'topup', 'Top-up via ' || _payment_method, COALESCE(_current_balance, 0) + _amount);

  -- Record topup
  INSERT INTO coin_topups (user_id, amount, payment_method, status)
  VALUES (_user_id, _amount, _payment_method, 'completed');

  RETURN TRUE;
END;
$$;

-- Spend coins function (single user deduction)
CREATE OR REPLACE FUNCTION public.spend_coins(
  _user_id UUID,
  _amount INTEGER,
  _type coin_transaction_type,
  _reference_id UUID DEFAULT NULL,
  _description TEXT DEFAULT ''
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_balance INTEGER;
BEGIN
  SELECT balance INTO _current_balance
  FROM coin_wallets WHERE user_id = _user_id FOR UPDATE;

  IF _current_balance IS NULL OR _current_balance < _amount THEN
    RETURN FALSE;
  END IF;

  UPDATE coin_wallets
  SET balance = balance - _amount, total_spent = total_spent + _amount, updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO coin_transactions (user_id, amount, type, reference_id, description, balance_after)
  VALUES (_user_id, -_amount, _type, _reference_id, _description, _current_balance - _amount);

  RETURN TRUE;
END;
$$;

-- Request withdrawal function
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _user_id UUID,
  _amount INTEGER,
  _payout_method TEXT DEFAULT 'bank_transfer'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_balance INTEGER;
BEGIN
  SELECT balance INTO _current_balance
  FROM coin_wallets WHERE user_id = _user_id FOR UPDATE;

  IF _current_balance IS NULL OR _current_balance < _amount THEN
    RETURN FALSE;
  END IF;

  -- Deduct coins
  UPDATE coin_wallets
  SET balance = balance - _amount, total_spent = total_spent + _amount, updated_at = now()
  WHERE user_id = _user_id;

  -- Record transaction
  INSERT INTO coin_transactions (user_id, amount, type, description, balance_after)
  VALUES (_user_id, -_amount, 'withdrawal', 'Withdrawal request via ' || _payout_method, _current_balance - _amount);

  -- Create withdrawal request
  INSERT INTO coin_withdrawals (user_id, amount, payout_method)
  VALUES (_user_id, _amount, _payout_method);

  RETURN TRUE;
END;
$$;

-- Create wallets for existing users
INSERT INTO public.coin_wallets (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Add indexes
CREATE INDEX idx_coin_transactions_user_id ON public.coin_transactions(user_id, created_at DESC);
CREATE INDEX idx_coin_topups_user_id ON public.coin_topups(user_id);
CREATE INDEX idx_coin_withdrawals_user_id ON public.coin_withdrawals(user_id);
