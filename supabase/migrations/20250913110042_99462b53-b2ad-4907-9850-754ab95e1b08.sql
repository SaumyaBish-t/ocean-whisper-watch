-- Fix security issues: Set search_path for all functions

-- Update handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data ->> 'full_name'
  );
  RETURN NEW;
END;
$$;

-- Update handle_new_user_role function  
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'citizen');
  RETURN NEW;
END;
$$;

-- Update calculate_credibility_score function
CREATE OR REPLACE FUNCTION public.calculate_credibility_score(
  has_image BOOLEAN,
  has_location BOOLEAN,
  description_length INTEGER,
  nearby_reports_count INTEGER DEFAULT 0
)
RETURNS DECIMAL(3,2)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  score DECIMAL(3,2) := 0.1; -- Base score
BEGIN
  -- +0.3 if image attached
  IF has_image THEN
    score := score + 0.3;
  END IF;
  
  -- +0.2 if location detected
  IF has_location THEN
    score := score + 0.2;
  END IF;
  
  -- +0.1 if description > 10 words
  IF description_length > 50 THEN -- Roughly 10 words = 50 characters
    score := score + 0.1;
  END IF;
  
  -- +0.3 if multiple reports nearby (simplified)
  IF nearby_reports_count > 0 THEN
    score := score + 0.3;
  END IF;
  
  -- Cap at 1.0
  IF score > 1.0 THEN
    score := 1.0;
  END IF;
  
  RETURN score;
END;
$$;