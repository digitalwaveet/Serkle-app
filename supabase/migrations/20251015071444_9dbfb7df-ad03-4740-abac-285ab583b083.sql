-- Drop existing problematic policies
DROP POLICY IF EXISTS "Public circles viewable by everyone" ON public.circles;
DROP POLICY IF EXISTS "Users can join circles" ON public.circle_members;

-- Create security definer function to check circle membership (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_circle_member(_circle_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circle_members
    WHERE circle_id = _circle_id
      AND user_id = _user_id
      AND status = 'active'
  );
$$;

-- Recreate circles SELECT policy using the security definer function
CREATE POLICY "Public circles viewable by everyone" 
ON public.circles 
FOR SELECT 
USING (
  NOT is_private 
  OR public.is_circle_member(id, auth.uid())
  OR creator_id = auth.uid()
);

-- Recreate circle_members INSERT policy without recursive checks
CREATE POLICY "Users can join circles" 
ON public.circle_members 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);