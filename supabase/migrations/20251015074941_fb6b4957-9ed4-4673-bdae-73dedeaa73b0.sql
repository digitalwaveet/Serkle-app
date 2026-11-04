-- Add about_text and guidelines columns to circles table
ALTER TABLE public.circles
ADD COLUMN about_text TEXT,
ADD COLUMN guidelines TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.circles.about_text IS 'Extended description about the circle';
COMMENT ON COLUMN public.circles.guidelines IS 'Array of community guidelines for the circle';