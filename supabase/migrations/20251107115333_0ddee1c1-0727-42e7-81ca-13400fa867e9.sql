-- Add seller type and verification fields to seller_profiles
ALTER TABLE seller_profiles 
ADD COLUMN seller_type text NOT NULL DEFAULT 'personal' CHECK (seller_type IN ('personal', 'shop')),
ADD COLUMN business_registration_number text,
ADD COLUMN tax_id text,
ADD COLUMN business_license_url text,
ADD COLUMN verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
ADD COLUMN verification_submitted_at timestamp with time zone,
ADD COLUMN verification_notes text;

-- Enable realtime for tables not already in publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'shop_item_stats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shop_item_stats;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'seller_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE seller_profiles;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'seller_stats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE seller_stats;
  END IF;
END $$;