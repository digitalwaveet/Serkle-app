-- Add new fields to expert_profiles table
ALTER TABLE expert_profiles
ADD COLUMN IF NOT EXISTS professional_title TEXT,
ADD COLUMN IF NOT EXISTS qualification TEXT,
ADD COLUMN IF NOT EXISTS institution TEXT;

-- Update trigger to handle copying the new fields
CREATE OR REPLACE FUNCTION handle_expert_verification_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'verified' AND (OLD.status IS NULL OR OLD.status != 'verified') THEN
    INSERT INTO expert_profiles (
      user_id, 
      specialty, 
      years_experience, 
      bio, 
      is_verified, 
      verified,
      professional_title,
      qualification,
      institution
    )
    VALUES (
      NEW.user_id, 
      NEW.specialty, 
      NEW.years_experience, 
      NEW.bio, 
      true, 
      true,
      NEW.professional_title,
      NEW.qualification,
      NEW.institution
    )
    ON CONFLICT (user_id) DO UPDATE SET
      specialty = EXCLUDED.specialty,
      years_experience = EXCLUDED.years_experience,
      bio = EXCLUDED.bio,
      is_verified = true,
      verified = true,
      professional_title = EXCLUDED.professional_title,
      qualification = EXCLUDED.qualification,
      institution = EXCLUDED.institution;
  ELSIF NEW.status = 'suspended' AND OLD.status != 'suspended' THEN
    UPDATE expert_profiles SET is_verified = false, verified = false WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
