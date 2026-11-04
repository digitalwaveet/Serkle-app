
-- Add new transaction types for premium unlock
ALTER TYPE public.coin_transaction_type ADD VALUE IF NOT EXISTS 'premium_unlock';
ALTER TYPE public.coin_transaction_type ADD VALUE IF NOT EXISTS 'premium_earning';
