-- Create user roles enum and table
CREATE TYPE public.user_role AS ENUM ('citizen', 'authority', 'admin');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL DEFAULT 'citizen',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'authority' THEN 2
      WHEN 'citizen' THEN 3
    END
  LIMIT 1
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.hazard_reports(id) ON DELETE SET NULL,
  alert_message TEXT NOT NULL,
  sent_to TEXT, -- Can be 'all', 'nearby', or specific criteria
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS on alerts
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Add credibility_score to hazard_reports
ALTER TABLE public.hazard_reports 
ADD COLUMN credibility_score DECIMAL(3,2) DEFAULT 0.5 CHECK (credibility_score >= 0 AND credibility_score <= 1);

-- RLS policies for alerts
CREATE POLICY "Citizens can view active alerts"
ON public.alerts
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Authorities and admins can create alerts"
ON public.alerts
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'authority') OR 
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Authorities and admins can view all alerts"
ON public.alerts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'authority') OR 
  public.has_role(auth.uid(), 'admin')
);

-- Update hazard_reports RLS policies to allow authorities and admins to view all reports
CREATE POLICY "Authorities and admins can view all reports"
ON public.hazard_reports
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'authority') OR 
  public.has_role(auth.uid(), 'admin')
);

-- Function to assign default citizen role to new users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY definer
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'citizen');
  RETURN NEW;
END;
$$;

-- Trigger to assign role on user creation
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Function to calculate credibility score
CREATE OR REPLACE FUNCTION public.calculate_credibility_score(
  has_image BOOLEAN,
  has_location BOOLEAN,
  description_length INTEGER,
  nearby_reports_count INTEGER DEFAULT 0
)
RETURNS DECIMAL(3,2)
LANGUAGE plpgsql
IMMUTABLE
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

-- Add updated_at trigger for user_roles
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add real-time for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;