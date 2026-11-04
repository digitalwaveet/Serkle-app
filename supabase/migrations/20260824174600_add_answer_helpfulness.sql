
-- Add helpfulness tracking columns to answers table
ALTER TABLE answers
ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS not_helpful_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_feedback INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS helpful_percentage NUMERIC DEFAULT 0;

-- Create an enum for feedback types
DO $$ BEGIN
    CREATE TYPE feedback_type AS ENUM ('helpful', 'not_helpful');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add feedback_type to answer_votes if it doesn't exist, default to 'helpful'
ALTER TABLE answer_votes
ADD COLUMN IF NOT EXISTS feedback_type feedback_type DEFAULT 'helpful';

-- Ensure a user can only vote once per answer
ALTER TABLE answer_votes
DROP CONSTRAINT IF EXISTS answer_votes_user_id_answer_id_key;

ALTER TABLE answer_votes
ADD CONSTRAINT answer_votes_user_id_answer_id_key UNIQUE (user_id, answer_id);

-- Create a function to update answer helpfulness metrics
CREATE OR REPLACE FUNCTION update_answer_helpfulness()
RETURNS TRIGGER AS $$
BEGIN
  -- If inserting a new vote or changing a vote
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE answers
    SET 
      helpful_count = (SELECT COUNT(*) FROM answer_votes WHERE answer_id = NEW.answer_id AND feedback_type = 'helpful'),
      not_helpful_count = (SELECT COUNT(*) FROM answer_votes WHERE answer_id = NEW.answer_id AND feedback_type = 'not_helpful'),
      total_feedback = (SELECT COUNT(*) FROM answer_votes WHERE answer_id = NEW.answer_id),
      helpful_percentage = CASE 
        WHEN (SELECT COUNT(*) FROM answer_votes WHERE answer_id = NEW.answer_id) > 0 THEN
          ROUND(((SELECT COUNT(*) FROM answer_votes WHERE answer_id = NEW.answer_id AND feedback_type = 'helpful')::NUMERIC / (SELECT COUNT(*) FROM answer_votes WHERE answer_id = NEW.answer_id)::NUMERIC) * 100)
        ELSE 0 
      END
    WHERE id = NEW.answer_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE answers
    SET 
      helpful_count = (SELECT COUNT(*) FROM answer_votes WHERE answer_id = OLD.answer_id AND feedback_type = 'helpful'),
      not_helpful_count = (SELECT COUNT(*) FROM answer_votes WHERE answer_id = OLD.answer_id AND feedback_type = 'not_helpful'),
      total_feedback = (SELECT COUNT(*) FROM answer_votes WHERE answer_id = OLD.answer_id),
      helpful_percentage = CASE 
        WHEN (SELECT COUNT(*) FROM answer_votes WHERE answer_id = OLD.answer_id) > 0 THEN
          ROUND(((SELECT COUNT(*) FROM answer_votes WHERE answer_id = OLD.answer_id AND feedback_type = 'helpful')::NUMERIC / (SELECT COUNT(*) FROM answer_votes WHERE answer_id = OLD.answer_id)::NUMERIC) * 100)
        ELSE 0 
      END
    WHERE id = OLD.answer_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on answer_votes
DROP TRIGGER IF EXISTS answer_votes_helpfulness_trigger ON answer_votes;
CREATE TRIGGER answer_votes_helpfulness_trigger
AFTER INSERT OR UPDATE OR DELETE ON answer_votes
FOR EACH ROW EXECUTE FUNCTION update_answer_helpfulness();

-- Populate existing answer votes as helpful
UPDATE answers
SET 
  helpful_count = (SELECT COUNT(*) FROM answer_votes WHERE answer_votes.answer_id = answers.id),
  total_feedback = (SELECT COUNT(*) FROM answer_votes WHERE answer_votes.answer_id = answers.id),
  helpful_percentage = CASE 
    WHEN (SELECT COUNT(*) FROM answer_votes WHERE answer_votes.answer_id = answers.id) > 0 THEN 100 
    ELSE 0 
  END;
