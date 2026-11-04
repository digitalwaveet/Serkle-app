-- Update expert_verification_requests schema
ALTER TABLE expert_verification_requests
ADD COLUMN IF NOT EXISTS professional_category TEXT,
ADD COLUMN IF NOT EXISTS full_legal_name TEXT,
ADD COLUMN IF NOT EXISTS public_display_name TEXT,
ADD COLUMN IF NOT EXISTS professional_title TEXT,
ADD COLUMN IF NOT EXISTS qualification TEXT,
ADD COLUMN IF NOT EXISTS institution TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS professional_organization TEXT,
ADD COLUMN IF NOT EXISTS license_number TEXT,
ADD COLUMN IF NOT EXISTS credential_documents JSONB DEFAULT '[]'::jsonb;

-- Create secure storage bucket for credentials
INSERT INTO storage.buckets (id, name, public) 
VALUES ('expert_credentials', 'expert_credentials', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for expert_credentials
-- Users can insert their own documents
CREATE POLICY "Users can upload their own credentials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'expert_credentials' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can view their own documents
CREATE POLICY "Users can view their own credentials"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'expert_credentials' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admins can view all documents (assuming they have admin role or based on some auth logic)
CREATE POLICY "Admins can view all credentials"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'expert_credentials' AND EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

-- Trigger to handle expert_profiles updates when suspended
CREATE OR REPLACE FUNCTION handle_expert_verification_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'verified' AND (OLD.status IS NULL OR OLD.status != 'verified') THEN
    INSERT INTO expert_profiles (user_id, specialty, years_experience, bio, is_verified, verified)
    VALUES (NEW.user_id, NEW.specialty, NEW.years_experience, NEW.bio, true, true)
    ON CONFLICT (user_id) DO UPDATE SET
      specialty = EXCLUDED.specialty,
      years_experience = EXCLUDED.years_experience,
      bio = EXCLUDED.bio,
      is_verified = true,
      verified = true;
  ELSIF NEW.status = 'suspended' AND OLD.status != 'suspended' THEN
    UPDATE expert_profiles SET is_verified = false, verified = false WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expert_verification_status_trigger ON expert_verification_requests;
CREATE TRIGGER expert_verification_status_trigger
AFTER UPDATE ON expert_verification_requests
FOR EACH ROW EXECUTE FUNCTION handle_expert_verification_status();
