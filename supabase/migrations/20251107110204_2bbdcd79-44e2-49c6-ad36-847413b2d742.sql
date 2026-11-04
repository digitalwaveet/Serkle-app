-- Fix function search path for calculate_distance (existing function)
CREATE OR REPLACE FUNCTION public.calculate_distance(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- Haversine formula for distance in miles
  RETURN (
    3959 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(lat1)) * cos(radians(lat2)) * 
        cos(radians(lon2) - radians(lon1)) + 
        sin(radians(lat1)) * sin(radians(lat2))
      ))
    )
  );
END;
$$;